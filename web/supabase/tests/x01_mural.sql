-- X01 — o mural no servidor: cidade ou raio, impulsionadas → urgentes → ordem, páginas por cursor, busca.
begin;

select pg_temp.new_user('90000000-0000-0000-0000-0000000000c1', 'recrutador', 'Mural Construtora');
select pg_temp.new_user('90000000-0000-0000-0000-0000000000a1', 'trabalhador', 'Leitor do Mural');
create temp table t_ids (k text primary key, v text);
grant all on t_ids to authenticated;
insert into t_ids values
  ('perto', pg_temp.new_job('90000000-0000-0000-0000-0000000000c1', 1, 1)),
  ('longe', pg_temp.new_job('90000000-0000-0000-0000-0000000000c1', 1, 1)),
  ('urgente', pg_temp.new_job('90000000-0000-0000-0000-0000000000c1', 1, 1)),
  ('impulsionada', pg_temp.new_job('90000000-0000-0000-0000-0000000000c1', 1, 1)),
  ('campinas', pg_temp.new_job('90000000-0000-0000-0000-0000000000c1', 1, 1)),
  ('encerrada', pg_temp.new_job('90000000-0000-0000-0000-0000000000c1', 1, 1));
update public.jobs set lat = -23.60, lon = -46.70 where id = (select v from t_ids where k = 'longe');
update public.jobs set urgent = true, lat = -23.62, lon = -46.72 where id = (select v from t_ids where k = 'urgente');
update public.jobs set boost_ends_at = now() + interval '1 day', lat = -23.64, lon = -46.74 where id = (select v from t_ids where k = 'impulsionada');
update public.jobs set city = 'Campinas', lat = -22.90, lon = -47.06 where id = (select v from t_ids where k = 'campinas');
update public.jobs set closed = true where id = (select v from t_ids where k = 'encerrada');
update public.jobs set title = 'Pintura de fachada' where id = (select v from t_ids where k = 'longe');

select pg_temp.login('90000000-0000-0000-0000-0000000000a1');
create temp table t_page as
  select (j->>'id') as id, ordinality as pos, j
    from public.feed_jobs('São Paulo', 'SP', -23.54, -46.57) with ordinality as f(j, ordinality);
select pg_temp.ok((select array_agg(id order by pos) from t_page) =
  array[(select v from t_ids where k = 'impulsionada'), (select v from t_ids where k = 'urgente'),
        (select v from t_ids where k = 'perto'), (select v from t_ids where k = 'longe')],
  'impulsionada → urgente → mais perto; sem encerrada nem outra cidade');
select pg_temp.ok(not exists (select 1 from t_page where not (j ? 'street' and j ? 'cep')), 'U53: o mural manda rua e CEP');

-- Página por cursor: duas por vez.
create temp table t_p1 as select (j->>'id') as id, j from public.feed_jobs('São Paulo', 'SP', -23.54, -46.57, p_limit => 2) j;
select pg_temp.ok((select count(*) from t_p1) = 2, 'primeira página com 2');
select pg_temp.ok((select array_agg(j->>'id') from public.feed_jobs('São Paulo', 'SP', -23.54, -46.57, p_limit => 2,
    p_cursor => (select jsonb_build_object('r', j->'_rank', 'k', j->'_key', 'id', j->>'id') from t_p1 order by (j->>'_rank')::int desc, (j->>'_key')::float8 desc limit 1)) j)
  = array[(select v from t_ids where k = 'perto'), (select v from t_ids where k = 'longe')], 'segunda página continua de onde parou');

-- Raio: até 5 km de onde a pessoa está.
select pg_temp.ok((select array_agg(j->>'id') from public.feed_jobs('São Paulo', 'SP', -23.54, -46.57, 5) j)
  = array[(select v from t_ids where k = 'perto')], 'até 5 km');
-- Busca respeita a cidade; "todas as cidades" amplia.
select pg_temp.ok((select array_agg(j->>'id') from public.feed_jobs('São Paulo', 'SP', -23.54, -46.57, p_search => 'pintura') j)
  = array[(select v from t_ids where k = 'longe')], 'busca "pintura" na cidade');
select pg_temp.ok((select count(*) from public.feed_jobs('São Paulo', 'SP', -23.54, -46.57, p_search => 'pedreiro', p_all_cities => true) j) = 5,
  'busca em todas as cidades acha Campinas também');
select pg_temp.logout();

rollback;
