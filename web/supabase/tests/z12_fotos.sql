-- Z12/X09 — só imagens do próprio Storage, na pasta do dono; sem listagem de arquivos.
begin;

select pg_temp.new_user('70000000-0000-0000-0000-0000000000a1', 'trabalhador', 'Com Foto');
select pg_temp.new_user('70000000-0000-0000-0000-0000000000c1', 'recrutador', 'Com Logo');

create temp table t_base as select value from public.app_config where key = 'storage_public_base';
grant select on t_base to authenticated;
select pg_temp.login('70000000-0000-0000-0000-0000000000a1');
update public.workers
   set photo_url = (select value from t_base) || 'avatars/70000000-0000-0000-0000-0000000000a1/abc.webp'
 where id = '70000000-0000-0000-0000-0000000000a1';
select pg_temp.ok((select photo_url like '%/avatars/70000000-0000-0000-0000-0000000000a1/abc.webp'
                     from public.workers where id = '70000000-0000-0000-0000-0000000000a1'), 'foto do próprio Storage é aceita');
select pg_temp.fails($$update public.workers set photo_url = 'https://exemplo.com/x.jpg' where id = '70000000-0000-0000-0000-0000000000a1'$$, 'BC422');
select pg_temp.fails($$update public.workers set cover_url = (select value from t_base) || 'avatars/70000000-0000-0000-0000-0000000000c1/x.jpg' where id = '70000000-0000-0000-0000-0000000000a1'$$, 'BC422');
select pg_temp.fails($$insert into public.worker_posts (worker_id, media_url, caption) values ('70000000-0000-0000-0000-0000000000a1', 'https://exemplo.com/x.mp4', '')$$, 'BC422');
update public.workers set photo_url = null where id = '70000000-0000-0000-0000-0000000000a1';
select pg_temp.ok((select photo_url is null from public.workers where id = '70000000-0000-0000-0000-0000000000a1'), 'tirar a foto é aceito');

-- Ninguém lista os arquivos dos buckets (L06: a única leitura é a da equipe, no bucket privado de identidade).
select pg_temp.ok(not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and cmd = 'SELECT'
                                 and policyname <> 'Equipe lê as fotos de identidade'),
  'sem política de leitura (listagem) nos objetos');
select pg_temp.logout();

-- Fotos de vaga: só da pasta da construtora dona.
select pg_temp.fails(format($$select pg_temp.new_job(%L)$$, '70000000-0000-0000-0000-0000000000c1') ||
  '; update public.jobs set photos = array[''https://exemplo.com/a.jpg''] where company_id = ''70000000-0000-0000-0000-0000000000c1''', 'BC422');

rollback;
