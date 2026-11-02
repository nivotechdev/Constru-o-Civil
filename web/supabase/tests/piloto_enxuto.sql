-- Piloto enxuto (02/11/2026) — impulsionar e verificação de identidade vêm INATIVOS; conta suspensa ou com denúncia em
-- aberto não se exclui sozinha; decisões da equipe com mais de 1 ano saem.
begin;
select pg_temp.new_user('96000000-0000-0000-0000-000000000ec2', 'recrutador', 'Empresa Piloto', '51.826.049/0001-39');
select pg_temp.new_user('96000000-0000-0000-0000-000000000ea2', 'trabalhador', 'Ana Piloto');
select pg_temp.new_user('96000000-0000-0000-0000-000000000ea3', 'trabalhador', 'Bia Denunciada');
create temp table t_ids (k text primary key, v text);
grant all on t_ids to authenticated;
insert into t_ids values ('vaga', pg_temp.new_job('96000000-0000-0000-0000-000000000ec2'));

-- Impulsionar: inativo por padrão.
select pg_temp.fails($$select public.begin_boost_payment('96000000-0000-0000-0000-000000000ec2', (select v from t_ids where k = 'vaga'), '24h', 'pix')$$, 'BC409');
insert into public.app_config (key, value) values ('payments_enabled', 'sim') on conflict (key) do update set value = excluded.value;
select pg_temp.ok((select id is not null from public.begin_boost_payment('96000000-0000-0000-0000-000000000ec2', (select v from t_ids where k = 'vaga'), '24h', 'pix')),
                  'ligado, impulsionar volta a funcionar');

-- Selfie e documento: inativos por padrão.
select pg_temp.login('96000000-0000-0000-0000-000000000ea2');
select pg_temp.fails($$select public.submit_identity('96000000-0000-0000-0000-000000000ea2/s.jpg', '96000000-0000-0000-0000-000000000ea2/d.jpg', '1.0')$$, 'BC409');
select pg_temp.logout();
insert into public.app_config (key, value) values ('identity_enabled', 'sim') on conflict (key) do update set value = excluded.value;
select pg_temp.login('96000000-0000-0000-0000-000000000ea2');
select public.submit_identity('96000000-0000-0000-0000-000000000ea2/s.jpg', '96000000-0000-0000-0000-000000000ea2/d.jpg', '1.0');
select pg_temp.logout();

-- Exclusão: denúncia em aberto contra o perfil segura a exclusão; depois de analisada, sai.
insert into public.reports (reporter_id, target_type, target_id, reason)
  values ('96000000-0000-0000-0000-000000000ea2', 'perfil', '96000000-0000-0000-0000-000000000ea3', 'golpe');
select pg_temp.login('96000000-0000-0000-0000-000000000ea3', 10);
select pg_temp.fails($$select public.delete_my_account(true)$$, 'BC409');
select pg_temp.logout();
update public.reports set status = 'analisada';
-- Conta suspensa também espera a equipe.
update public.accounts set suspended_at = now(), suspended_reason = 'teste' where id = '96000000-0000-0000-0000-000000000ea3';
select pg_temp.login('96000000-0000-0000-0000-000000000ea3', 10);
select pg_temp.fails($$select public.delete_my_account(true)$$, 'BC409');
select pg_temp.logout();
update public.accounts set suspended_at = null, suspended_reason = null where id = '96000000-0000-0000-0000-000000000ea3';
select pg_temp.login('96000000-0000-0000-0000-000000000ea3', 10);
select public.delete_my_account(true);
select pg_temp.logout();
select pg_temp.ok(not exists (select 1 from public.accounts where id = '96000000-0000-0000-0000-000000000ea3'), 'sem pendência, a conta sai');

-- Decisões da equipe com mais de 1 ano saem.
insert into public.staff_actions (staff_id, action, target_type, target_id, reason, created_at)
values ('96000000-0000-0000-0000-000000000ea2', 'teste', 'conta', 'x', 'velha', now() - interval '13 months'),
       ('96000000-0000-0000-0000-000000000ea2', 'teste', 'conta', 'x', 'nova', now() - interval '2 months');
select pg_temp.ok(public.purge_staff_actions() >= 1, 'limpou a velha');
select pg_temp.ok(not exists (select 1 from public.staff_actions where reason = 'velha') and exists (select 1 from public.staff_actions where reason = 'nova'),
                  'só a de mais de 1 ano saiu');
select pg_temp.ok(not has_function_privilege('authenticated', 'public.purge_staff_actions()', 'execute'), 'só service_role');
rollback;
