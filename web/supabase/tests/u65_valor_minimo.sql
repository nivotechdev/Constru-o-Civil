-- U65 — o filtro "Valor mínimo" do mural: só as vagas com a diária a partir do valor; a vaga "a combinar" não passa
-- quando há mínimo; a busca por texto ignora o filtro, como os outros.
begin;
select pg_temp.new_user('96500000-0000-0000-0000-0000000000c1', 'recrutador', 'Empresa Valor');
select pg_temp.new_user('96500000-0000-0000-0000-0000000000a1', 'trabalhador', 'Quem Filtra');
create temp table t_ids (k text primary key, v text);
grant all on t_ids to authenticated;
insert into t_ids values
  ('barata', pg_temp.new_job('96500000-0000-0000-0000-0000000000c1', 1, 1)),
  ('media', pg_temp.new_job('96500000-0000-0000-0000-0000000000c1', 1, 1)),
  ('cara', pg_temp.new_job('96500000-0000-0000-0000-0000000000c1', 1, 1)),
  ('combinar', pg_temp.new_job('96500000-0000-0000-0000-0000000000c1', 1, 1));
update public.jobs set pay = 100, title = 'Faxina barata' where id = (select v from t_ids where k = 'barata');
update public.jobs set pay = 200, title = 'Faxina média' where id = (select v from t_ids where k = 'media');
update public.jobs set pay = 300, title = 'Faxina cara' where id = (select v from t_ids where k = 'cara');
update public.jobs set pay = null, title = 'Faxina a combinar' where id = (select v from t_ids where k = 'combinar');

select pg_temp.login('96500000-0000-0000-0000-0000000000a1');
create or replace function pg_temp.lista(p_min integer, p_search text default null)
returns text[] language sql as $$
  select coalesce(array_agg(j->>'title' order by j->>'title'), '{}')
    from public.feed_jobs('São Paulo', 'SP', -23.54, -46.57, p_search => p_search, p_min_pay => p_min) j
   where j->>'title' like 'Faxina%'
$$;
select pg_temp.ok(pg_temp.lista(null) = array['Faxina a combinar', 'Faxina barata', 'Faxina cara', 'Faxina média'],
                  'sem mínimo: todas, inclusive a "a combinar"');
select pg_temp.ok(pg_temp.lista(150) = array['Faxina cara', 'Faxina média'], 'a partir de R$ 150');
select pg_temp.ok(pg_temp.lista(200) = array['Faxina cara', 'Faxina média'], 'o mínimo vale com o valor igual');
select pg_temp.ok(pg_temp.lista(300) = array['Faxina cara'], 'a partir de R$ 300');
select pg_temp.ok(pg_temp.lista(1000) = '{}', 'nenhuma vaga tão cara');
select pg_temp.ok(pg_temp.lista(300, 'faxina') = array['Faxina a combinar', 'Faxina barata', 'Faxina cara', 'Faxina média'],
                  'a busca por texto ignora o valor mínimo');
select pg_temp.logout();
rollback;
