-- Z06 — O endereço da obra é só de quem está no bico.
-- Antes: rua, número, complemento, CEP e as coordenadas exatas saíam para qualquer conta logada, antes de
-- qualquer aprovação. Agora:
--   * select direto em jobs mostra bairro, cidade, UF e um ponto aproximado (area_lat/area_lon: as
--     coordenadas arredondadas em 2 casas, ~1 km) — o bastante para "X km de você" e o filtro de raio;
--   * o endereço completo e o ponto exato saem só por get_job_addresses, para a construtora dona e para o
--     trabalhador pré-selecionado ou contratado naquela vaga.
-- Idempotente.

alter table public.jobs
  add column if not exists area_lat double precision generated always as (round(lat::numeric, 2)::double precision) stored,
  add column if not exists area_lon double precision generated always as (round(lon::numeric, 2)::double precision) stored;

revoke select on public.jobs from authenticated, anon;
grant select (
  id, company_id, oficio_id, title, pay, neighborhood, city, uf, area_lat, area_lon, date_to_arrange,
  start_date, end_date, start_time, end_time, diarias, dias, urgent, boost_ends_at, photos, slots, closed,
  sem_contratacao, description, requirements, created_at, updated_at, deleted_at
) on public.jobs to authenticated;

create or replace function public.get_job_addresses(p_job_ids text[])
returns table (
  job_id text, cep text, street text, number text, complement text, neighborhood text, city text, uf text,
  lat double precision, lon double precision
) language sql stable security definer set search_path = public as $$
  select j.id, j.cep, j.street, j.number, j.complement, j.neighborhood, j.city, j.uf, j.lat, j.lon
    from public.jobs j
   where j.id = any (p_job_ids)
     and (
       j.company_id = public.my_company_id()
       or exists (
         select 1 from public.applications a
          where a.job_id = j.id and a.worker_id = public.my_worker_id()
            and a.status in ('pre_selecionado', 'contratado')
       )
     )
$$;

revoke all on function public.get_job_addresses(text[]) from public, anon, authenticated;
grant execute on function public.get_job_addresses(text[]) to authenticated;
