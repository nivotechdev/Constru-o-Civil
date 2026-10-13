-- X01 (+ Y10/Y11/L17) — O mural vem do servidor: só vagas abertas e com lugar, da cidade escolhida ou
-- dentro do raio (PostGIS), impulsionadas primeiro, depois urgentes, depois a ordem escolhida (mais perto,
-- mais cedo, maior valor), em páginas (cursor sobre a ordem + id). A busca por texto respeita a cidade
-- (ou procura em todas, se pedido). Distâncias pelo ponto aproximado da obra (area_lat/area_lon, Z06).
-- Índices: vagas abertas por cidade e data, ponto geográfico (GiST) e as chaves estrangeiras que faltavam.
-- Idempotente. O PostGIS deste projeto está no schema public (instalado pelo app antigo).

-- Texto sem acento e em minúsculas, para a busca ("hidráulica" acha "hidraulica").
create or replace function public.fold_text(p text)
returns text language sql immutable parallel safe set search_path = public as $$
  select lower(translate(coalesce(p, ''),
    'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
    'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'))
$$;

alter table public.jobs
  add column if not exists area_geog geography(Point, 4326)
  generated always as (
    st_setsrid(st_makepoint(round(lon::numeric, 2)::double precision, round(lat::numeric, 2)::double precision), 4326)::geography
  ) stored;

create index if not exists jobs_area_geog_idx on public.jobs using gist (area_geog);
create index if not exists jobs_open_city_idx on public.jobs (uf, city, created_at desc)
  where not closed and deleted_at is null;
create index if not exists saved_jobs_job_idx on public.saved_jobs (job_id);
create index if not exists applications_holding_idx on public.applications (job_id)
  where status in ('pre_selecionado', 'contratado', 'concluida');
create index if not exists applications_job_idx on public.applications (job_id);
create index if not exists reviews_application_idx on public.reviews (application_id);

-- O trabalho tem dia em `p_day` (filtro "Hoje"/"Amanhã"), como utils/jobInfo.ts › runsOn.
create or replace function public.job_runs_on(p_job public.jobs, p_day date)
returns boolean language sql stable set search_path = public as $$
  select not p_job.date_to_arrange and p_job.start_date <= p_day and p_day <= coalesce(p_job.end_date, p_job.start_date)
     and case coalesce(p_job.dias::text, 'qualquer')
           when 'semana' then extract(isodow from p_day) between 1 and 5
           when 'fimdesemana' then extract(isodow from p_day) in (6, 7)
           else true end
$$;

/*
 * Uma página do mural. Filtros:
 *   p_city/p_uf — a cidade escolhida (sem raio);  p_lat/p_lon + p_radius_km — "Até X km" do ponto;
 *   p_oficio — id do catálogo;  p_quando — 'Hoje' | 'Amanhã' | 'Durante a semana' | 'Fim de semana';
 *   p_search — texto (título, ofício e sinônimos, construtora, bairro); p_all_cities — busca no país;
 *   p_sort — 'perto' | 'cedo' | 'valor';  p_cursor — {"r": rank, "k": chave, "id": "BC-…"} da última linha.
 * Cada linha: as colunas públicas da vaga + "_rank", "_key" e "_km" (para o cursor e a distância).
 */
create or replace function public.feed_jobs(
  p_city text, p_uf text, p_lat double precision, p_lon double precision, p_radius_km integer default null,
  p_oficio text default null, p_quando text default null, p_search text default null,
  p_all_cities boolean default false, p_sort text default 'perto', p_limit integer default 30,
  p_cursor jsonb default null
) returns setof jsonb language sql stable security definer set search_path = public as $$
  with origin as (
    select st_setsrid(st_makepoint(p_lon, p_lat), 4326)::geography as g, public.bicos_today() as today
  ),
  open_jobs as (
    select j.*, (select g from origin) as o_g, (select today from origin) as today
      from public.jobs j
     where not j.closed and j.deleted_at is null
       and public.job_is_open(j)
       and public.job_holding(j.id) < j.slots
       and (p_oficio is null or j.oficio_id = p_oficio)
       and (
         case
           when nullif(btrim(coalesce(p_search, '')), '') is not null and p_all_cities then true
           when p_radius_km is not null then st_dwithin(j.area_geog, (select g from origin), p_radius_km * 1000)
           else j.city = p_city and j.uf = p_uf
         end
       )
       and (
         p_quando is null
         or (p_quando = 'Hoje' and public.job_runs_on(j, (select today from origin)))
         or (p_quando = 'Amanhã' and public.job_runs_on(j, (select today from origin) + 1))
         or (p_quando = 'Durante a semana' and coalesce(j.dias::text, 'qualquer') in ('semana', 'qualquer'))
         or (p_quando = 'Fim de semana' and coalesce(j.dias::text, 'qualquer') in ('fimdesemana', 'qualquer'))
       )
       and (
         nullif(btrim(coalesce(p_search, '')), '') is null
         or public.fold_text(concat_ws(' ', j.title, j.neighborhood, j.city,
              (select o.nome || ' ' || array_to_string(o.sinonimos, ' ') from public.oficios o where o.id = j.oficio_id),
              (select c.name from public.companies c where c.id = j.company_id)))
            like '%' || public.fold_text(btrim(p_search)) || '%'
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
           'deleted_at', r.deleted_at, '_rank', r.rank, '_key', r.sort_key, '_km', round(r.km::numeric, 1))
    from ranked r
   where p_cursor is null
      or (r.rank, r.sort_key, r.id) > ((p_cursor->>'r')::int, (p_cursor->>'k')::double precision, p_cursor->>'id')
   order by r.rank, r.sort_key, r.id
   limit least(greatest(coalesce(p_limit, 30), 1), 60)
$$;

revoke all on function public.fold_text(text), public.job_runs_on(public.jobs, date) from public, anon, authenticated;
revoke all on function public.feed_jobs(text, text, double precision, double precision, integer, text, text, text, boolean, text, integer, jsonb)
  from public, anon, authenticated;
grant execute on function public.feed_jobs(text, text, double precision, double precision, integer, text, text, text, boolean, text, integer, jsonb)
  to authenticated;
