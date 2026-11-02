-- AUD-002: o endereço exato (rua, número, CEP, complemento e ponto exato) deixa de sair por `select` direto para
-- qualquer conta logada (U53). Decisão dos sócios (02/11/2026), opção C:
--   * local COMERCIAL (comércio, prédio, outro): continua visível a quem tem conta, como no U53;
--   * CASA, apartamento, condomínio (e vaga sem tipo, por segurança): só bairro e ponto aproximado até a empresa
--     aprovar a candidatura; a empresa dona vê sempre;
--   * a leitura é por RPC (get_job_addresses) com limite de consultas por conta (app_config
--     `address_lookups_per_hour`, padrão 120) e feed_jobs manda o endereço só quando é visível.
-- As colunas voltam a ficar fora do `select` de authenticated (como no Z06). Idempotente.

revoke select (cep, street, number, complement, lat, lon) on public.jobs from authenticated;

-- Quem pode ver o endereço exato de uma vaga: local comercial, a empresa dona ou o trabalhador aprovado nela.
create or replace function public.job_address_open(p_job_id text, p_company uuid, p_place_type text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(p_place_type in ('comercio', 'predio', 'outro'), false)
      or p_company is not distinct from public.my_company_id()
      or exists (
        select 1 from public.applications a
         where a.job_id = p_job_id and a.worker_id = public.my_worker_id()
           and a.status in ('pre_selecionado', 'contratado')
      )
$$;
revoke all on function public.job_address_open(text, uuid, text) from public, anon, authenticated;

-- O endereço exato que a conta pode ver (até 30 vagas por chamada). A empresa dona e o aprovado sempre; o resto
-- (local comercial) conta no limite por hora — passou do limite, volta só o que é dela.
create or replace function public.get_job_addresses(p_job_ids text[])
returns table (
  job_id text, cep text, street text, number text, complement text, neighborhood text, city text, uf text,
  lat double precision, lon double precision
) language plpgsql volatile security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_ids text[] := p_job_ids[1:30];
  v_max integer := coalesce(nullif((select value from public.app_config where key = 'address_lookups_per_hour'), '')::integer, 120);
  v_limited boolean := false;
begin
  if auth.uid() is null then
    return;
  end if;
  if exists (
    select 1 from public.jobs j
     where j.id = any (v_ids) and j.place_type in ('comercio', 'predio', 'outro')
       and j.company_id is distinct from public.my_company_id()
  ) then
    v_limited := public.rate_limit_hit('addr:' || auth.uid()::text, v_max, interval '1 hour');
  end if;
  return query
    select j.id, j.cep, j.street, j.number, j.complement, j.neighborhood, j.city, j.uf, j.lat, j.lon
      from public.jobs j
     where j.id = any (v_ids)
       and (
         j.company_id is not distinct from public.my_company_id()
         or exists (select 1 from public.applications a
                     where a.job_id = j.id and a.worker_id = public.my_worker_id()
                       and a.status in ('pre_selecionado', 'contratado'))
         or (not v_limited and j.place_type in ('comercio', 'predio', 'outro'))
       );
end;
$$;
revoke all on function public.get_job_addresses(text[]) from public, anon, authenticated;
grant execute on function public.get_job_addresses(text[]) to authenticated;

-- feed_jobs (de 20261022000300_u65_valor_minimo.sql): o endereço exato só nas vagas em que ele é visível.
create or replace function public.feed_jobs(p_city text, p_uf text, p_lat double precision, p_lon double precision,
  p_radius_km integer default null, p_oficio text default null, p_quando text default null,
  p_search text default null, p_all_cities boolean default false, p_sort text default 'perto',
  p_limit integer default 30, p_cursor jsonb default null, p_min_pay integer default null)
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
       -- U65: valor mínimo da diária (vaga "a combinar" não passa quando há mínimo; a busca não usa os filtros).
       and (o.needle is not null or p_min_pay is null or j.pay >= p_min_pay)
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
           'cep', case when v.open then r.cep end, 'street', case when v.open then r.street end,
           'number', case when v.open then r.number end, 'complement', case when v.open then r.complement end,
           'lat', case when v.open then r.lat end, 'lon', case when v.open then r.lon end,
           'date_to_arrange', r.date_to_arrange, 'start_date', r.start_date, 'end_date', r.end_date,
           'start_time', r.start_time, 'end_time', r.end_time, 'diarias', r.diarias, 'dias', r.dias,
           'urgent', r.urgent, 'boost_ends_at', r.boost_ends_at, 'photos', r.photos, 'slots', r.slots,
           'closed', r.closed, 'sem_contratacao', r.sem_contratacao, 'description', r.description,
           'requirements', r.requirements, 'created_at', r.created_at, 'updated_at', r.updated_at,
           'deleted_at', r.deleted_at, 'public_slug', r.public_slug, 'weekdays', r.weekdays, 'place_type', r.place_type,
           '_rank', r.rank, '_key', r.sort_key, '_km', round(r.km::numeric, 1))
    from (
      select * from ranked r
       where p_cursor is null
          or (r.rank, r.sort_key, r.id) > ((p_cursor->>'r')::int, (p_cursor->>'k')::double precision, p_cursor->>'id')
       order by r.rank, r.sort_key, r.id
       limit least(greatest(coalesce(p_limit, 30), 1), 60)
    ) r
    cross join lateral (select public.job_address_open(r.id, r.company_id, r.place_type) as open) v
   order by r.rank, r.sort_key, r.id
$$;

revoke all on function public.feed_jobs(text, text, double precision, double precision, integer, text, text, text,
  boolean, text, integer, jsonb, integer) from public, anon;
grant execute on function public.feed_jobs(text, text, double precision, double precision, integer, text, text, text,
  boolean, text, integer, jsonb, integer) to authenticated;
