-- L13 (lançamento): o mural (feed_jobs) com volume — 2.000 vagas e 20.000 candidaturas (scripts/volume/).
--
-- A medição mostrou o gargalo: `job_is_open(j)` chamada para cada vaga da cidade (~50 µs por linha). Ela chama
-- `job_last_day` e `bicos_today`, e as três têm `search_path` fixo (X13) — o Postgres não "abre" função com SET
-- dentro da consulta, então são três chamadas com troca de configuração por vaga. Agora:
--   * `jobs.last_day`: o último dia da vaga, coluna calculada pelo banco com a mesma regra de `job_last_day`
--     (vaga "a combinar" vale 30 dias da publicação; as outras, até a data de fim). Índice parcial das vagas
--     abertas por cidade e último dia;
--   * feed_jobs compara `last_day` com o "hoje" calculado uma vez, em vez de `job_is_open` por linha (as duas
--     regras ficam iguais — o teste lanc13 confere vaga a vaga);
--   * o texto da busca é normalizado uma vez, não uma por vaga;
--   * cada linha do mural traz também o `public_slug` (L10), para o botão de compartilhar.
-- Idempotente.

alter table public.jobs
  add column if not exists last_day date
  generated always as (
    case when date_to_arrange then (created_at at time zone 'America/Sao_Paulo')::date + 30 else end_date end
  ) stored;

create index if not exists jobs_feed_city_idx on public.jobs (uf, city, last_day)
  where not closed and deleted_at is null and hidden_at is null;

create or replace function public.feed_jobs(
  p_city text, p_uf text, p_lat double precision, p_lon double precision, p_radius_km integer default null,
  p_oficio text default null, p_quando text default null, p_search text default null,
  p_all_cities boolean default false, p_sort text default 'perto', p_limit integer default 30,
  p_cursor jsonb default null
) returns setof jsonb language sql stable security definer set search_path = public, extensions as $$
  with origin as (
    select st_setsrid(st_makepoint(p_lon, p_lat), 4326)::geography as g, public.bicos_today() as today,
           nullif(public.fold_text(btrim(coalesce(p_search, ''))), '') as needle
  ),
  open_jobs as (
    select j.*, o.g as o_g, o.today
      from public.jobs j, origin o
     -- O mesmo que job_is_open(j), sem a chamada por linha (L13).
     where not j.closed and j.deleted_at is null and j.hidden_at is null and j.last_day >= o.today
       and public.job_holding(j.id) < j.slots
       and (p_oficio is null or j.oficio_id = p_oficio)
       and (
         case
           when o.needle is not null and p_all_cities then true
           when p_radius_km is not null then st_dwithin(j.area_geog, o.g, p_radius_km * 1000)
           else j.city = p_city and j.uf = p_uf
         end
       )
       and (
         p_quando is null
         or (p_quando = 'Hoje' and public.job_runs_on(j, o.today))
         or (p_quando = 'Amanhã' and public.job_runs_on(j, o.today + 1))
         or (p_quando = 'Durante a semana' and coalesce(j.dias::text, 'qualquer') in ('semana', 'qualquer'))
         or (p_quando = 'Fim de semana' and coalesce(j.dias::text, 'qualquer') in ('fimdesemana', 'qualquer'))
       )
       and (
         o.needle is null
         or public.fold_text(concat_ws(' ', j.title, j.neighborhood, j.city,
              (select f.nome || ' ' || array_to_string(f.sinonimos, ' ') from public.oficios f where f.id = j.oficio_id),
              (select c.name from public.companies c where c.id = j.company_id)))
            like '%' || o.needle || '%'
       )
  ),
  ranked as (
    select oj.*,
           case when oj.boost_ends_at > now() then 0 when oj.urgent then 1 else 2 end as rank,
           case p_sort
             when 'valor' then coalesce(-oj.pay::double precision, 1e12)
             when 'cedo' then coalesce(extract(epoch from oj.start_date::timestamp), 1e12)
             else st_distance(oj.area_geog, oj.o_g)
           end as sort_key,
           st_distance(oj.area_geog, oj.o_g) / 1000.0 as km
      from open_jobs oj
  )
  select jsonb_build_object(
           'id', r.id, 'company_id', r.company_id, 'oficio_id', r.oficio_id, 'title', r.title, 'pay', r.pay,
           'neighborhood', r.neighborhood, 'city', r.city, 'uf', r.uf, 'area_lat', r.area_lat, 'area_lon', r.area_lon,
           'date_to_arrange', r.date_to_arrange, 'start_date', r.start_date, 'end_date', r.end_date,
           'start_time', r.start_time, 'end_time', r.end_time, 'diarias', r.diarias, 'dias', r.dias,
           'urgent', r.urgent, 'boost_ends_at', r.boost_ends_at, 'photos', r.photos, 'slots', r.slots,
           'closed', r.closed, 'sem_contratacao', r.sem_contratacao, 'description', r.description,
           'requirements', r.requirements, 'created_at', r.created_at, 'updated_at', r.updated_at,
           'deleted_at', r.deleted_at, 'public_slug', r.public_slug,
           '_rank', r.rank, '_key', r.sort_key, '_km', round(r.km::numeric, 1))
    from ranked r
   where p_cursor is null
      or (r.rank, r.sort_key, r.id) > ((p_cursor->>'r')::int, (p_cursor->>'k')::double precision, p_cursor->>'id')
   order by r.rank, r.sort_key, r.id
   limit least(greatest(coalesce(p_limit, 30), 1), 60)
$$;

revoke all on function public.feed_jobs(text, text, double precision, double precision, integer, text, text, text, boolean, text, integer, jsonb)
  from public, anon, authenticated;
grant execute on function public.feed_jobs(text, text, double precision, double precision, integer, text, text, text, boolean, text, integer, jsonb)
  to authenticated;
