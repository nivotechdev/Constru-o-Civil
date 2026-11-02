-- AUD-003 — endereço da vaga, perfis e portfólio têm limite de tamanho (e coordenada válida).
begin;
select pg_temp.new_user('96000000-0000-0000-0000-0000000003e1', 'recrutador', 'Empresa Limites', '51.826.049/0001-39');
update public.accounts set profile_completed_at = now() where id = '96000000-0000-0000-0000-0000000003e1';
select pg_temp.new_user('96000000-0000-0000-0000-0000000003a1', 'trabalhador', 'Tiago Limites');

create temp table t_draft (p jsonb);
grant all on t_draft to authenticated;
insert into t_draft select jsonb_build_object(
  'title', 'Garçom para festa', 'pay', 150, 'cep', '95020-000', 'street', 'Rua Sinimbu', 'number', '120',
  'neighborhood', 'Centro', 'city', 'Caxias do Sul', 'uf', 'RS', 'lat', -29.1688, 'lon', -51.1787,
  'date_to_arrange', true, 'diarias', 2, 'slots', 1, 'weekdays', '[6, 7]'::jsonb,
  'description', 'Servir as mesas numa festa de aniversário', 'requirements', '[]'::jsonb);
create temp table t_ids (k text primary key, v text);
grant all on t_ids to authenticated;

-- Empresa: os limites exatos passam, um a mais não.
select pg_temp.login('96000000-0000-0000-0000-0000000003e1');
insert into t_ids values ('no_limite', public.publish_job((select p || jsonb_build_object(
  'street', repeat('r', 120), 'number', repeat('9', 10), 'complement', repeat('c', 60),
  'neighborhood', repeat('b', 80), 'city', repeat('x', 80)) from t_draft)));
select pg_temp.fails($$select public.publish_job((select p || jsonb_build_object('street', repeat('r', 121)) from t_draft))$$, 'BC422');
select pg_temp.fails($$select public.publish_job((select p || jsonb_build_object('number', repeat('9', 11)) from t_draft))$$, 'BC422');
select pg_temp.fails($$select public.publish_job((select p || jsonb_build_object('complement', repeat('c', 61)) from t_draft))$$, 'BC422');
select pg_temp.fails($$select public.publish_job((select p || jsonb_build_object('neighborhood', repeat('b', 81)) from t_draft))$$, 'BC422');
select pg_temp.fails($$select public.publish_job((select p || jsonb_build_object('city', repeat('x', 81)) from t_draft))$$, 'BC422');
-- Editar uma vaga também recusa.
select pg_temp.fails($$select public.update_job((select v from t_ids where k = 'no_limite'),
  (select p || jsonb_build_object('street', repeat('r', 5000)) from t_draft))$$, 'BC422');
-- Perfil da empresa (escrita direta pela API).
select pg_temp.fails($$update public.companies set location = repeat('a', 100000) where id = '96000000-0000-0000-0000-0000000003e1'$$, '23514');
select pg_temp.fails($$update public.companies set logo_url = repeat('h', 301) where id = '96000000-0000-0000-0000-0000000003e1'$$, 'BC422');
select pg_temp.logout();

-- A foto da vaga com endereço enorme também é recusada (gatilho das fotos).
select pg_temp.fails($$update public.jobs set photos = array[
  (select value from public.app_config where key = 'storage_public_base') || 'vagas/96000000-0000-0000-0000-0000000003e1/' || repeat('f', 400) || '.webp']
  where id = (select v from t_ids where k = 'no_limite')$$, 'BC422');

-- Trabalhador: cidade, bairro, coordenada e links.
select pg_temp.login('96000000-0000-0000-0000-0000000003a1');
select pg_temp.fails($$update public.workers set city = repeat('c', 100000) where id = '96000000-0000-0000-0000-0000000003a1'$$, '23514');
select pg_temp.fails($$update public.workers set neighborhood = repeat('c', 100000) where id = '96000000-0000-0000-0000-0000000003a1'$$, '23514');
select pg_temp.fails($$update public.workers set lat = 999, lon = 999 where id = '96000000-0000-0000-0000-0000000003a1'$$, '23514');
select pg_temp.fails($$update public.workers set lat = 'NaN', lon = -51 where id = '96000000-0000-0000-0000-0000000003a1'$$, '23514');
select pg_temp.fails($$update public.workers set photo_url = repeat('h', 301) where id = '96000000-0000-0000-0000-0000000003a1'$$, 'BC422');
update public.workers set city = 'Caxias do Sul', neighborhood = 'Centro', lat = -29.1688, lon = -51.1787
 where id = '96000000-0000-0000-0000-0000000003a1';
select pg_temp.ok((select lat = -29.1688 from public.workers where id = '96000000-0000-0000-0000-0000000003a1'), 'valores válidos continuam passando');
-- Portfólio: no máximo 50 itens por trabalhador.
insert into public.worker_posts (worker_id, media_type, caption)
  select '96000000-0000-0000-0000-0000000003a1', 'image', 'item ' || g from generate_series(1, 50) g;
select pg_temp.fails($$insert into public.worker_posts (worker_id, media_type, caption)
  values ('96000000-0000-0000-0000-0000000003a1', 'image', 'item 51')$$, 'BC409');
select pg_temp.logout();
rollback;
