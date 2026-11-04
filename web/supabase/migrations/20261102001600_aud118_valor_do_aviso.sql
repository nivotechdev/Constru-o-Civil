-- AUD-118: o aviso "Bico novo" saía com vírgula americana ("R$ 1,500"): to_char('G') segue a configuração de idioma
-- do servidor. Agora o valor sai sempre com ponto de milhar ("R$ 1.500"). Idempotente.

create or replace function public.reais_text(p_value numeric)
returns text language sql immutable set search_path = public as $$
  select regexp_replace(trunc(coalesce(p_value, 0))::bigint::text, '(\d)(?=(\d{3})+$)', '\1.', 'g')
$$;
revoke all on function public.reais_text(numeric) from public, anon, authenticated;

create or replace function public.notify_job_alerts()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  r record;
  v_today date := public.bicos_today();
  v_text text := public.job_title(new) || ' em ' || coalesce(nullif(new.neighborhood, ''), new.city) ||
                 case when new.pay > 0 then ' · R$ ' || public.reais_text(new.pay) || ' por diária' else '' end;
begin
  for r in
    select a.worker_id
      from public.job_alerts a
      join public.workers w on w.id = a.worker_id and w.name <> 'Conta excluída'
     where (a.oficio_id is null or new.oficio_id is null or a.oficio_id = new.oficio_id)
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
