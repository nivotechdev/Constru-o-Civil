-- AUD-021 — o perfil do trabalhador só é lido por ele mesmo e pela empresa que tem vínculo com ele (candidatura numa
-- vaga dela ou convite dela). Conta de empresa qualquer, ou outro trabalhador, vê 0 perfis.
begin;
select pg_temp.new_user('96000000-0000-0000-0000-000000000bd1', 'recrutador', 'Empresa Com Vinculo', '51.826.049/0001-39');
select pg_temp.new_user('96000000-0000-0000-0000-000000000bd2', 'recrutador', 'Empresa Sem Vinculo', '45.723.174/0001-10');
select pg_temp.new_user('96000000-0000-0000-0000-000000000ba1', 'trabalhador', 'Ana Candidata');
select pg_temp.new_user('96000000-0000-0000-0000-000000000ba2', 'trabalhador', 'Bia Convidada');
select pg_temp.new_user('96000000-0000-0000-0000-000000000ba3', 'trabalhador', 'Cida Sozinha');
create temp table t_ids (k text primary key, v text);
grant all on t_ids to authenticated;
insert into t_ids values ('vaga', pg_temp.new_job('96000000-0000-0000-0000-000000000bd1', 2));
insert into public.applications (job_id, worker_id, status)
  values ((select v from t_ids where k = 'vaga'), '96000000-0000-0000-0000-000000000ba1', 'enviada');
insert into public.job_invites (job_id, worker_id, company_id)
  values ((select v from t_ids where k = 'vaga'), '96000000-0000-0000-0000-000000000ba2', '96000000-0000-0000-0000-000000000bd1');

-- Empresa sem vínculo: nenhum perfil, nem por filtro.
select pg_temp.login('96000000-0000-0000-0000-000000000bd2');
select pg_temp.ok((select count(*) = 0 from public.workers), 'empresa sem vínculo vê 0 trabalhadores');
select pg_temp.ok((select count(*) = 0 from public.workers where id = '96000000-0000-0000-0000-000000000ba1'), 'nem o candidato de outra empresa');
select pg_temp.logout();
-- Empresa com vínculo: o candidato e o convidado, mais ninguém.
select pg_temp.login('96000000-0000-0000-0000-000000000bd1');
select pg_temp.ok((select array_agg(id order by id) = array['96000000-0000-0000-0000-000000000ba1'::uuid, '96000000-0000-0000-0000-000000000ba2'::uuid]
                     from public.workers), 'a empresa vê o candidato e o convidado');
select pg_temp.logout();
-- Trabalhador: só o próprio perfil.
select pg_temp.login('96000000-0000-0000-0000-000000000ba3');
select pg_temp.ok((select count(*) = 1 and bool_and(id = '96000000-0000-0000-0000-000000000ba3') from public.workers), 'o trabalhador vê só o próprio');
select pg_temp.logout();
select pg_temp.login('96000000-0000-0000-0000-000000000ba1');
select pg_temp.ok((select count(*) = 1 from public.workers), 'a candidata também vê só o próprio perfil');
-- O candidato continua editando o próprio.
update public.workers set bio = 'Faxineira' where id = '96000000-0000-0000-0000-000000000ba1';
select pg_temp.logout();
rollback;
