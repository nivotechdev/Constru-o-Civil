-- F10: perfil profissional do trabalhador — dias disponíveis, anos de experiência, diária pretendida,
-- distância que topa ir e uma bio curta. Os "fatos" que a construtora vê vêm desses campos (os fatos antigos,
-- escritos à mão, deixam de aparecer). A construtora também vê quantas faltas e desistências a pessoa teve
-- (o diálogo de falta já promete isso).

alter table public.workers
  add column if not exists availability text,
  add column if not exists years_experience smallint,
  add column if not exists desired_pay integer,
  add column if not exists travel_km smallint,
  add column if not exists bio text;
do $$ begin
  alter table public.workers add constraint workers_professional_check check (
    (availability is null or availability in ('semana', 'fimdesemana', 'qualquer'))
    and (years_experience is null or years_experience between 0 and 60)
    and (desired_pay is null or desired_pay between 80 and 2000)
    and (travel_km is null or travel_km between 1 and 100)
    and (bio is null or char_length(bio) <= 280)
  );
exception when duplicate_object then null;
end $$;
grant select (availability, years_experience, desired_pay, travel_km, bio) on public.workers to authenticated;
grant update (availability, years_experience, desired_pay, travel_km, bio) on public.workers to authenticated;

-- Faltas e desistências de cada trabalhador (para construtoras e para a própria pessoa).
create or replace function public.worker_track_record(p_worker_ids uuid[])
returns table (worker_id uuid, faltas integer, desistencias integer)
language sql stable security definer set search_path = public as $$
  select w.id,
         (select count(*)::int from public.applications a where a.worker_id = w.id and a.status = 'nao_compareceu'),
         (select count(*)::int from public.applications a where a.worker_id = w.id and a.status = 'desistiu')
    from public.workers w
   where w.id = any (p_worker_ids)
     and (public.my_company_id() is not null or w.id = public.my_worker_id())
$$;
revoke all on function public.worker_track_record(uuid[]) from public, anon;
grant execute on function public.worker_track_record(uuid[]) to authenticated;
