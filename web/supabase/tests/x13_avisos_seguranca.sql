-- X13 — PostGIS fora da API, visitante sem funções security definer (só a vaga pública), raio continua.
begin;
select pg_temp.ok((select n.nspname from pg_extension e join pg_namespace n on n.oid = e.extnamespace
                    where e.extname = 'postgis') = 'extensions', 'PostGIS em extensions');
select pg_temp.ok(to_regclass('public.spatial_ref_sys') is null, 'spatial_ref_sys fora do public');
select pg_temp.ok(
  (select array_agg(p.proname::text) from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.prosecdef
      and has_function_privilege('anon', p.oid, 'execute')) = array['public_job_card'],
  'visitante só executa public_job_card');
select pg_temp.ok(
  (select count(*) from pg_proc p where p.pronamespace = 'public'::regnamespace
     and p.proname in ('impedir_troca_de_tipo', 'travar_autor_da_vaga', 'expirar_vagas_vencidas')
     and not exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%')) = 0,
  'search_path fixo nas funções antigas');

-- Função nova não nasce aberta a visitante.
create function public.x13_probe() returns int language sql security definer set search_path = public as $$ select 1 $$;
select pg_temp.ok(not has_function_privilege('anon', 'public.x13_probe()', 'execute'), 'função nova fechada ao visitante');

-- O mural por raio continua medindo (area_geog refeita).
select pg_temp.new_user('7d000000-0000-0000-0000-0000000000d1', 'recrutador', 'Obra Raio', '11.222.333/0001-81');
select pg_temp.new_user('7d000000-0000-0000-0000-0000000000d2', 'trabalhador', 'Ana Raio');
create temp table t_ids (k text primary key, v text);
grant all on t_ids to authenticated;
insert into t_ids values ('j', pg_temp.new_job('7d000000-0000-0000-0000-0000000000d1'));
select pg_temp.ok((select area_geog is not null from public.jobs where id = (select v from t_ids where k = 'j')), 'area_geog calculada');
insert into t_ids select 'lat', lat::text from public.jobs where id = (select v from t_ids where k = 'j');
insert into t_ids select 'lon', lon::text from public.jobs where id = (select v from t_ids where k = 'j');
select pg_temp.login('7d000000-0000-0000-0000-0000000000d2');
select pg_temp.ok(exists (
  select 1 from public.feed_jobs(null, null, (select v::float8 from t_ids where k = 'lat'),
    (select v::float8 from t_ids where k = 'lon'), 10, null, null, null, false, 'perto', 30, null) f
   where f ->> 'id' = (select v from t_ids where k = 'j')), 'raio de 10 km acha a vaga');
select pg_temp.logout();
rollback;
