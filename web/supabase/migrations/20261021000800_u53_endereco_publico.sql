-- U53 (21/10): o endereço completo da vaga é público para quem está logado — a pedido do responsável, o trabalhador
-- vê rua, número, CEP e o ponto exato antes de se candidatar (com o mapa na vaga). Antes (Z06) só a empresa e quem
-- ela escolheu viam (get_job_addresses, que continua existindo e respondendo igual).
--   * select de cep, street, number, complement, lat e lon em jobs para authenticated;
--   * feed_jobs manda esses campos (o card mede a distância do ponto exato).
-- O link público (public_job_card, sem login) continua sem a rua. Idempotente.

grant select (cep, street, number, complement, lat, lon) on public.jobs to authenticated;

-- feed_jobs (de 20261021000700_u52_dias_e_local.sql): mais o endereço completo.
create or replace function public.feed_jobs(p_city text, p_uf text, p_lat double precision, p_lon double precision,
  p_radius_km integer default null, p_oficio text default null, p_quando text default null,
  p_search text default null, p_all_cities boolean default false, p_sort text default 'perto',
  p_limit integer default 30, p_cursor jsonb default null)
returns setof jsonb
language sql
stable security definer
set search_path = public, extensions
as $$
  with origin as (
    select st_setsrid(st_makepoint(p_lon, p_lat), 4326)::geography as g, public.bicos_today() as today,
           nullif(public.fold_text(btrim(coalesce(p_search, ''))), '') as needle
  ),
  terms as (
    -- As palavras da busca, sem as de ligação; só palavras de ligação ("de") → a busca inteira como uma palavra.
    select o.*,
           coalesce(
             nullif(array(
               select w from regexp_split_to_table(coalesce(o.needle, ''), '[^a-z0-9]+') w
                where w <> '' and w <> all (array['a', 'o', 'as', 'os', 'de', 'da', 'do', 'das', 'dos', 'e', 'em',
                                                  'no', 'na', 'nos', 'nas', 'para', 'pra', 'por', 'com', 'um', 'uma'])
             ), '{}'),
             array[o.needle]
           ) as words
      from origin o
  ),
  open_jobs as (
    select j.*, o.g as o_g, o.today
      from public.jobs j, terms o
     -- O mesmo que job_is_open(j), sem a chamada por linha (L13).
     where not j.closed and j.deleted_at is null and j.hidden_at is null and j.last_day >= o.today
       and public.job_holding(j.id) < j.slots
       and (o.needle is not null or p_oficio is null or j.oficio_id = p_oficio)
       and (
         case
           when o.needle is not null then
             p_all_cities
             or (j.city = p_city and j.uf = p_uf)
             -- U49: a busca nomeia a cidade da vaga (ou começa o nome dela).
             or position(public.fold_text(j.city) in o.needle) > 0
             or (length(o.needle) >= 4 and left(public.fold_text(j.city), length(o.needle)) = o.needle)
           when p_radius_km is not null then st_dwithin(j.area_geog, o.g, p_radius_km * 1000)
           else j.city = p_city and j.uf = p_uf
         end
       )
       and (
         o.needle is not null
         or p_quando is null
         or (p_quando = 'Hoje' and public.job_runs_on(j, o.today))
         or (p_quando = 'Amanhã' and public.job_runs_on(j, o.today + 1))
         or (p_quando = 'Durante a semana' and coalesce(j.dias::text, 'qualquer') in ('semana', 'qualquer'))
         or (p_quando = 'Fim de semana' and coalesce(j.dias::text, 'qualquer') in ('fimdesemana', 'qualquer'))
       )
       and (
         o.needle is null
         or not exists (
           select 1 from unnest(o.words) w
            where position(w in public.fold_text(concat_ws(' ', j.title, j.neighborhood, j.city, j.uf,
                    (select f.nome || ' ' || array_to_string(f.sinonimos, ' ') from public.oficios f
                      where f.id = j.oficio_id)))) = 0
         )
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
           'cep', r.cep, 'street', r.street, 'number', r.number, 'complement', r.complement, 'lat', r.lat, 'lon', r.lon,
           'date_to_arrange', r.date_to_arrange, 'start_date', r.start_date, 'end_date', r.end_date,
           'start_time', r.start_time, 'end_time', r.end_time, 'diarias', r.diarias, 'dias', r.dias,
           'urgent', r.urgent, 'boost_ends_at', r.boost_ends_at, 'photos', r.photos, 'slots', r.slots,
           'closed', r.closed, 'sem_contratacao', r.sem_contratacao, 'description', r.description,
           'requirements', r.requirements, 'created_at', r.created_at, 'updated_at', r.updated_at,
           'deleted_at', r.deleted_at, 'public_slug', r.public_slug, 'weekdays', r.weekdays, 'place_type', r.place_type,
           '_rank', r.rank, '_key', r.sort_key, '_km', round(r.km::numeric, 1))
    from ranked r
   where p_cursor is null
      or (r.rank, r.sort_key, r.id) > ((p_cursor->>'r')::int, (p_cursor->>'k')::double precision, p_cursor->>'id')
   order by r.rank, r.sort_key, r.id
   limit least(greatest(coalesce(p_limit, 30), 1), 60)
$$;
