-- Y28: "Avisar quando aparecer bico novo" de verdade — um alerta salvo no servidor por trabalhador (cidade
-- ou raio a partir de um ponto, e ofício opcional). Cada vaga nova que bate gera a notificação "Bico novo
-- perto de você" (e, quando o push existir, o push: X03). No máximo 5 avisos desses por dia por pessoa.

alter type public.notification_kind add value if not exists 'bico_novo';

create table if not exists public.job_alerts (
  worker_id uuid primary key references public.workers (id) on delete cascade,
  city text not null,
  uf text not null,
  lat double precision not null,
  lon double precision not null,
  radius_km integer check (radius_km is null or radius_km between 1 and 100),
  oficio_id text references public.oficios (id),
  notified_on date,
  notified_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.job_alerts enable row level security;
revoke all on public.job_alerts from anon, authenticated;
grant select (worker_id, city, uf, lat, lon, radius_km, oficio_id, created_at, updated_at)
  on public.job_alerts to authenticated;
drop policy if exists "Trabalhador lê o próprio alerta" on public.job_alerts;
create policy "Trabalhador lê o próprio alerta" on public.job_alerts
  for select to authenticated using (worker_id = (select public.my_worker_id()));

create or replace function public.save_job_alert(
  p_city text, p_uf text, p_lat double precision, p_lon double precision, p_radius_km integer, p_oficio text
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_worker uuid := public.my_worker_id();
begin
  if v_worker is null then
    raise exception using errcode = 'BC401', message = 'Só trabalhadores recebem aviso de bico novo.';
  end if;
  if nullif(btrim(p_city), '') is null or p_uf !~ '^[A-Z]{2}$' or p_lat not between -34 and 6 or p_lon not between -74 and -28 then
    raise exception using errcode = 'BC422', message = 'Escolha a cidade do aviso.';
  end if;
  if p_radius_km is not null and p_radius_km not between 1 and 100 then
    raise exception using errcode = 'BC422', message = 'Escolha uma distância de até 100 km.';
  end if;
  if p_oficio is not null and not exists (select 1 from public.oficios where id = p_oficio) then
    raise exception using errcode = 'BC422', message = 'Escolha o ofício na lista.';
  end if;
  insert into public.job_alerts (worker_id, city, uf, lat, lon, radius_km, oficio_id)
  values (v_worker, btrim(p_city), p_uf, p_lat, p_lon, p_radius_km, p_oficio)
  on conflict (worker_id) do update
    set city = excluded.city, uf = excluded.uf, lat = excluded.lat, lon = excluded.lon,
        radius_km = excluded.radius_km, oficio_id = excluded.oficio_id, updated_at = now();
end;
$$;

create or replace function public.delete_job_alert()
returns void language sql security definer set search_path = public as $$
  delete from public.job_alerts where worker_id = public.my_worker_id()
$$;

-- Vaga nova: avisa quem tem alerta que bate (nunca a própria construtora; conta excluída não recebe).
create or replace function public.notify_job_alerts()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_today date := public.bicos_today();
  v_text text := public.job_title(new) || ' em ' || coalesce(nullif(new.neighborhood, ''), new.city) ||
                 case when new.pay > 0 then ' · R$ ' || to_char(new.pay, 'FM999G999') || ' por diária' else '' end;
begin
  for r in
    select a.worker_id
      from public.job_alerts a
      join public.workers w on w.id = a.worker_id and w.name <> 'Conta excluída'
     where (a.oficio_id is null or a.oficio_id = new.oficio_id)
       and (a.notified_on is distinct from v_today or a.notified_count < 5)
       and case
             when a.radius_km is null then public.fold_text(a.city) = public.fold_text(new.city) and a.uf = new.uf
             else st_dwithin(new.area_geog, st_setsrid(st_makepoint(a.lon, a.lat), 4326)::geography, a.radius_km * 1000)
           end
  loop
    perform public.notify(r.worker_id, null, 'bico_novo', 'Bico novo perto de você', v_text, '/vaga/' || new.id);
    update public.job_alerts
       set notified_count = case when notified_on = v_today then notified_count + 1 else 1 end,
           notified_on = v_today
     where worker_id = r.worker_id;
  end loop;
  return null;
end;
$$;

drop trigger if exists jobs_notify_alerts on public.jobs;
create trigger jobs_notify_alerts after insert on public.jobs
  for each row execute function public.notify_job_alerts();

revoke all on function public.save_job_alert(text, text, double precision, double precision, integer, text),
  public.delete_job_alert(), public.notify_job_alerts() from public, anon, authenticated;
grant execute on function public.save_job_alert(text, text, double precision, double precision, integer, text),
  public.delete_job_alert() to authenticated;
