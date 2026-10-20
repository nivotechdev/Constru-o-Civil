-- R04/U24 — apagar a conta direto em auth.users (painel/Admin API) faz a mesma limpeza da exclusão pelo app: quem
-- estava no bico é avisado e depois TUDO da conta sai (U24: perfil, vagas, candidaturas, selfie); fotos para a limpeza.
begin;
select pg_temp.new_user('94000000-0000-0000-0000-0000000000c1', 'recrutador', 'Obra Que Sai', '11.222.333/0001-81');
select pg_temp.new_user('94000000-0000-0000-0000-0000000000c2', 'recrutador', 'Obra Que Fica', '45.723.174/0001-10');
select pg_temp.new_user('94000000-0000-0000-0000-0000000000a1', 'trabalhador', 'Ana Que Sai');
select pg_temp.new_user('94000000-0000-0000-0000-0000000000a2', 'trabalhador', 'Bruno Que Fica');
create temp table t_ids (k text primary key, v text);
grant all on t_ids to authenticated;
insert into t_ids values ('j1', pg_temp.new_job('94000000-0000-0000-0000-0000000000c1'));
insert into t_ids values ('j2', pg_temp.new_job('94000000-0000-0000-0000-0000000000c2'));
insert into t_ids select 's1', public_slug from public.jobs where id = (select v from t_ids where k = 'j1');
insert into public.applications (job_id, worker_id, status) values
  ((select v from t_ids where k = 'j1'), '94000000-0000-0000-0000-0000000000a2', 'contratado'),
  ((select v from t_ids where k = 'j2'), '94000000-0000-0000-0000-0000000000a1', 'contratado');

-- Fotos e selfie no Storage (com 2 dias, para a limpeza diária enxergar).
update public.app_config set value = 'https://x.supabase.co/storage/v1/object/public/' where key = 'storage_public_base';
update public.workers set photo_url = 'https://x.supabase.co/storage/v1/object/public/avatars/94000000-0000-0000-0000-0000000000a1/foto.jpg'
 where id = '94000000-0000-0000-0000-0000000000a1';
update public.jobs set photos = array['https://x.supabase.co/storage/v1/object/public/vagas/94000000-0000-0000-0000-0000000000c1/obra.jpg']
 where id = (select v from t_ids where k = 'j1');
insert into public.identity_submissions (worker_id, selfie_path, document_path)
values ('94000000-0000-0000-0000-0000000000a1', '94000000-0000-0000-0000-0000000000a1/selfie.jpg', '94000000-0000-0000-0000-0000000000a1/doc.jpg');
-- (sem `owner`: o Postgres puro dos testes tem uma chave estrangeira de owner para auth.users que o Supabase não tem)
insert into storage.objects (bucket_id, name, created_at) values
  ('avatars', '94000000-0000-0000-0000-0000000000a1/foto.jpg', now() - interval '2 days'),
  ('vagas', '94000000-0000-0000-0000-0000000000c1/obra.jpg', now() - interval '2 days'),
  ('identidade', '94000000-0000-0000-0000-0000000000a1/selfie.jpg', now() - interval '2 days');
select pg_temp.ok((select count(*) from public.orphan_storage_objects(500) where name like '94000000-%') = 0,
                  'antes: nenhum arquivo é órfão');

-- Apagar as duas contas como o painel faz.
delete from auth.users where id in ('94000000-0000-0000-0000-0000000000a1', '94000000-0000-0000-0000-0000000000c1');

select pg_temp.ok(not exists (select 1 from public.workers where id = '94000000-0000-0000-0000-0000000000a1'),
                  'U24: perfil da trabalhadora apagado');
select pg_temp.ok(not exists (select 1 from public.companies where id = '94000000-0000-0000-0000-0000000000c1'),
                  'U24: construtora apagada');
select pg_temp.ok(not exists (select 1 from public.accounts where id in ('94000000-0000-0000-0000-0000000000a1',
                                                                         '94000000-0000-0000-0000-0000000000c1')),
                  'U24: logins apagados');
select pg_temp.ok(not exists (select 1 from public.identity_submissions where worker_id = '94000000-0000-0000-0000-0000000000a1'),
                  'envio da selfie apagado');
select pg_temp.ok(not exists (select 1 from public.applications where worker_id = '94000000-0000-0000-0000-0000000000a1'),
                  'U24: a trabalhadora saiu de todos os bicos');
select pg_temp.ok(exists (select 1 from public.notifications where company_id = '94000000-0000-0000-0000-0000000000c2'
                            and title = 'Um trabalhador saiu da Bicos'), 'construtora que fica foi avisada');
select pg_temp.ok(not exists (select 1 from public.jobs where id = (select v from t_ids where k = 'j1')),
                  'U24: vaga da construtora apagada');
select pg_temp.ok(not exists (select 1 from public.applications where job_id = (select v from t_ids where k = 'j1')),
                  'U24: candidaturas da vaga apagada saem junto');
select pg_temp.ok(exists (select 1 from public.notifications where worker_id = '94000000-0000-0000-0000-0000000000a2'
                            and kind = 'contratacao_cancelada'), 'trabalhador que fica foi avisado');
select pg_temp.ok(public.public_job_card((select v from t_ids where k = 's1')) is null, 'link público não abre');
select pg_temp.ok(exists (select 1 from public.jobs where id = (select v from t_ids where k = 'j2')),
                  'a vaga da construtora que fica continua');

select pg_temp.login('94000000-0000-0000-0000-0000000000a2');
select pg_temp.ok(not exists (select 1 from public.feed_jobs('São Paulo', 'SP', -23.54, -46.57, null, null, null, 'Obra', true) f
                               where f ->> 'company_id' = '94000000-0000-0000-0000-0000000000c1'), 'fora do mural e da busca');
select pg_temp.logout();

select pg_temp.ok((select count(*) from public.orphan_storage_objects(500) where name like '94000000-%') = 3,
                  'foto, foto da vaga e selfie ficam para a limpeza diária');

-- Cadastro nunca concluído continua com a limpeza do Z01 (o perfil vazio sai).
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values ('94000000-0000-0000-0000-0000000000a9', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'abandonado@bicos.test', jsonb_build_object('role', 'trabalhador', 'nome', 'Abandonado', 'documento',
        pg_temp.valid_cpf('abandonado'), 'whatsapp', '11988887777', 'terms_version', '1.0', 'maior_de_idade', true), now(), now());
delete from auth.users where id = '94000000-0000-0000-0000-0000000000a9';
select pg_temp.ok(not exists (select 1 from public.workers where id = '94000000-0000-0000-0000-0000000000a9'),
                  'cadastro abandonado: perfil apagado como antes');
rollback;
