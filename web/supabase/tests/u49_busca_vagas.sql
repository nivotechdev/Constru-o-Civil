-- U49 — a busca do mural é só de vagas: serviço, bairro ou cidade; nunca o nome da empresa. Cada palavra precisa
-- aparecer na vaga; outra cidade aparece quando a busca a nomeia; os filtros do mural não valem durante a busca.
begin;

select pg_temp.new_user('94900000-0000-0000-0000-0000000000c1', 'recrutador', 'Buffet Alegria');
select pg_temp.new_user('94900000-0000-0000-0000-0000000000a1', 'trabalhador', 'Quem Busca');
create temp table t_ids (k text primary key, v text);
grant all on t_ids to authenticated;
insert into t_ids values
  ('garcom', pg_temp.new_job('94900000-0000-0000-0000-0000000000c1', 1, 5)),
  ('faxina', pg_temp.new_job('94900000-0000-0000-0000-0000000000c1', 1, 1)),
  ('caxias', pg_temp.new_job('94900000-0000-0000-0000-0000000000c1', 1, 1));
update public.jobs set title = 'Garçom para evento', neighborhood = 'Centro', oficio_id = null, lat = -23.70, lon = -46.80
 where id = (select v from t_ids where k = 'garcom');
update public.jobs set title = 'Faxina de apartamento', neighborhood = 'Tatuapé', oficio_id = null
 where id = (select v from t_ids where k = 'faxina');
update public.jobs set title = 'Ajudante de cozinha', neighborhood = 'Centro', city = 'Caxias do Sul', uf = 'RS',
       oficio_id = null, lat = -29.17, lon = -51.18
 where id = (select v from t_ids where k = 'caxias');

select pg_temp.login('94900000-0000-0000-0000-0000000000a1');
create or replace function pg_temp.busca(p text, p_radius integer default null, p_quando text default null)
returns text[] language sql as $$
  select coalesce(array_agg(j->>'id' order by j->>'id'), '{}')
    from public.feed_jobs('São Paulo', 'SP', -23.54, -46.57, p_radius_km => p_radius, p_quando => p_quando,
                          p_search => p) j
$$;
create or replace function pg_temp.id(k text) returns text language sql as $$ select v from t_ids where k = $1 $$;

select pg_temp.ok(pg_temp.busca('garcom') = array[pg_temp.id('garcom')], 'serviço sem acento acha "Garçom"');
select pg_temp.ok(pg_temp.busca('GARÇOM no centro') = array[pg_temp.id('garcom')],
  'serviço + bairro, maiúsculas e palavra de ligação');
select pg_temp.ok(pg_temp.busca('tatuape') = array[pg_temp.id('faxina')], 'bairro');
select pg_temp.ok(pg_temp.busca('centro') = array[pg_temp.id('garcom')], 'bairro fica na cidade do mural');
select pg_temp.ok(pg_temp.busca('Caxias do Sul') = array[pg_temp.id('caxias')], 'outra cidade, quando a busca a nomeia');
select pg_temp.ok(pg_temp.busca('cozinha em caxias do sul, rs') = array[pg_temp.id('caxias')], 'serviço + cidade + UF');
select pg_temp.ok(pg_temp.busca('caxi') = array[pg_temp.id('caxias')], 'começo do nome da cidade (4 letras)');
select pg_temp.ok(pg_temp.busca('cax') = '{}', 'com 3 letras ainda não troca de cidade');
select pg_temp.ok(pg_temp.busca('alegria') = '{}', 'o nome da empresa não é busca');
select pg_temp.ok(pg_temp.busca('garçom faxina') = '{}', 'todas as palavras precisam estar na vaga');
select pg_temp.ok(pg_temp.busca('garcom', 1, 'Hoje') = array[pg_temp.id('garcom')], 'a distância e o "quando" não valem na busca');
select pg_temp.ok(pg_temp.busca('xyz123') = '{}', 'nada encontrado: lista vazia');
select pg_temp.ok(array(select j->>'id' from public.feed_jobs('São Paulo', 'SP', -23.54, -46.57, 1) j) = array[pg_temp.id('faxina')],
  'sem busca, a distância continua valendo');
select pg_temp.logout();

rollback;
