-- AUD-009 — empresa sem selo: conta com pelo menos 3 dias e teto de 5 aprovações por dia (números em app_config); o
-- WhatsApp do trabalhador só chega à empresa depois que ele toca em "Compartilhar meu WhatsApp". Empresa verificada
-- segue como antes. (A exigência de WhatsApp confirmado da empresa é opcional: `approve_requires_whatsapp` = 'sim'.)
begin;
select pg_temp.new_user('96000000-0000-0000-0000-000000000fc1', 'recrutador', 'Empresa Nova', '51.826.049/0001-39');
select pg_temp.new_user('96000000-0000-0000-0000-000000000fc2', 'recrutador', 'Empresa Selada', '45.723.174/0001-10');
select pg_temp.new_user('96000000-0000-0000-0000-000000000fa1', 'trabalhador', 'Ana Candidata');
select pg_temp.new_user('96000000-0000-0000-0000-000000000fa2', 'trabalhador', 'Bia Candidata');
select pg_temp.new_user('96000000-0000-0000-0000-000000000fa3', 'trabalhador', 'Cida Candidata');
select public.set_company_verification('96000000-0000-0000-0000-000000000fc2', 'verificada');
create temp table t_ids (k text primary key, v text);
grant all on t_ids to authenticated;
insert into t_ids values ('nova', pg_temp.new_job('96000000-0000-0000-0000-000000000fc1', 5));
insert into t_ids values ('selada', pg_temp.new_job('96000000-0000-0000-0000-000000000fc2', 5));
insert into public.applications (job_id, worker_id, status) values
  ((select v from t_ids where k = 'nova'), '96000000-0000-0000-0000-000000000fa1', 'enviada'),
  ((select v from t_ids where k = 'nova'), '96000000-0000-0000-0000-000000000fa2', 'enviada'),
  ((select v from t_ids where k = 'nova'), '96000000-0000-0000-0000-000000000fa3', 'enviada'),
  ((select v from t_ids where k = 'selada'), '96000000-0000-0000-0000-000000000fa1', 'enviada');

-- Conta nova (menos de 3 dias): não aprova.
update public.accounts set created_at = now() where company_id = '96000000-0000-0000-0000-000000000fc1';
select pg_temp.login('96000000-0000-0000-0000-000000000fc1');
select pg_temp.fails($$select public.transition_application((select v from t_ids where k = 'nova'), '96000000-0000-0000-0000-000000000fa1', 'aprovar', null)$$, 'BC409');
select pg_temp.logout();
-- A verificada aprova mesmo com conta nova.
update public.accounts set created_at = now() where company_id = '96000000-0000-0000-0000-000000000fc2';
select pg_temp.login('96000000-0000-0000-0000-000000000fc2');
select public.transition_application((select v from t_ids where k = 'selada'), '96000000-0000-0000-0000-000000000fa1', 'aprovar', null);
select pg_temp.logout();

-- Conta com 4 dias: aprova até o teto do dia (aqui 2).
update public.accounts set created_at = now() - interval '4 days' where company_id = '96000000-0000-0000-0000-000000000fc1';
insert into public.app_config (key, value) values ('approvals_per_day_unverified', '2')
  on conflict (key) do update set value = excluded.value;
select pg_temp.login('96000000-0000-0000-0000-000000000fc1');
select public.transition_application((select v from t_ids where k = 'nova'), '96000000-0000-0000-0000-000000000fa1', 'aprovar', null);
select public.transition_application((select v from t_ids where k = 'nova'), '96000000-0000-0000-0000-000000000fa2', 'aprovar', null);
select pg_temp.fails($$select public.transition_application((select v from t_ids where k = 'nova'), '96000000-0000-0000-0000-000000000fa3', 'aprovar', null)$$, 'BC409');
-- O WhatsApp do trabalhador ainda não chegou à empresa sem selo.
select pg_temp.fails($$select * from public.get_contact((select id from public.applications where job_id = (select v from t_ids where k = 'nova') and worker_id = '96000000-0000-0000-0000-000000000fa1'))$$, 'BC404');
select pg_temp.logout();
-- O trabalhador vê o da empresa na hora; só quem está no bico compartilha.
select pg_temp.login('96000000-0000-0000-0000-000000000fa1');
select pg_temp.ok((select count(*) = 1 from public.get_contact((select id from public.applications where job_id = (select v from t_ids where k = 'nova') and worker_id = '96000000-0000-0000-0000-000000000fa1'))),
                  'o trabalhador aprovado vê o WhatsApp da empresa');
select public.share_my_whatsapp((select v from t_ids where k = 'nova'));
select pg_temp.logout();
select pg_temp.login('96000000-0000-0000-0000-000000000fa3');
select pg_temp.fails($$select public.share_my_whatsapp((select v from t_ids where k = 'nova'))$$, 'BC409');
select pg_temp.logout();
-- Depois de compartilhar, a empresa vê.
select pg_temp.login('96000000-0000-0000-0000-000000000fc1');
select pg_temp.ok((select count(*) = 1 from public.get_contact((select id from public.applications where job_id = (select v from t_ids where k = 'nova') and worker_id = '96000000-0000-0000-0000-000000000fa1'))),
                  'depois de compartilhar, a empresa vê');
select pg_temp.fails($$select * from public.get_contact((select id from public.applications where job_id = (select v from t_ids where k = 'nova') and worker_id = '96000000-0000-0000-0000-000000000fa2'))$$, 'BC404');
select pg_temp.logout();
select pg_temp.ok(exists (select 1 from public.notifications where company_id = '96000000-0000-0000-0000-000000000fc1'
                            and title like '%compartilhou o WhatsApp%'), 'a empresa é avisada');
-- Empresa com selo: vê sem o trabalhador compartilhar.
select pg_temp.login('96000000-0000-0000-0000-000000000fc2');
select pg_temp.ok((select count(*) = 1 from public.get_contact((select id from public.applications where job_id = (select v from t_ids where k = 'selada')))), 'empresa com selo vê direto');
select pg_temp.logout();
rollback;
