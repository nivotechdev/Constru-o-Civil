-- AUD-022 — vaga oculta pela equipe e empresa suspensa não aprovam, contratam, desfazem aprovação, convidam nem
-- editam; recusar, cancelar a contratação e desistir continuam possíveis (sair do compromisso é sempre permitido).
begin;
select pg_temp.new_user('96000000-0000-0000-0000-000000000cc1', 'recrutador', 'Empresa Moderada', '51.826.049/0001-39');
select pg_temp.new_user('96000000-0000-0000-0000-000000000ca1', 'trabalhador', 'Ana Candidata');
select pg_temp.new_user('96000000-0000-0000-0000-000000000ca2', 'trabalhador', 'Bia Candidata');
select pg_temp.new_user('96000000-0000-0000-0000-000000000ca3', 'trabalhador', 'Cida Convidada');
create temp table t_ids (k text primary key, v text);
grant all on t_ids to authenticated;
insert into t_ids values ('vaga', pg_temp.new_job('96000000-0000-0000-0000-000000000cc1', 3));
insert into public.applications (job_id, worker_id, status) values
  ((select v from t_ids where k = 'vaga'), '96000000-0000-0000-0000-000000000ca1', 'enviada'),
  ((select v from t_ids where k = 'vaga'), '96000000-0000-0000-0000-000000000ca2', 'pre_selecionado');

-- Vaga oculta pela equipe.
update public.jobs set hidden_at = now(), hidden_reason = 'teste' where id = (select v from t_ids where k = 'vaga');
select pg_temp.login('96000000-0000-0000-0000-000000000cc1');
select pg_temp.fails($$select public.transition_application((select v from t_ids where k = 'vaga'), '96000000-0000-0000-0000-000000000ca1', 'aprovar', null)$$, 'BC409');
select pg_temp.fails($$select public.transition_application((select v from t_ids where k = 'vaga'), '96000000-0000-0000-0000-000000000ca2', 'contratar', null)$$, 'BC409');
select pg_temp.fails($$select public.transition_application((select v from t_ids where k = 'vaga'), '96000000-0000-0000-0000-000000000ca2', 'desfazer_aprovacao', null)$$, 'BC409');
select pg_temp.fails($$select public.invite_worker((select v from t_ids where k = 'vaga'), '96000000-0000-0000-0000-000000000ca3')$$, 'BC409');
-- Recusar continua valendo.
select public.transition_application((select v from t_ids where k = 'vaga'), '96000000-0000-0000-0000-000000000ca1', 'recusar', null);
select pg_temp.logout();
select pg_temp.ok(pg_temp.status_of((select v from t_ids where k = 'vaga'), '96000000-0000-0000-0000-000000000ca1') = 'nao_selecionado', 'recusar segue permitido');

-- Empresa suspensa: nada de aprovar/convidar/editar/desfazer recusa; cancelar a contratação segue.
update public.jobs set hidden_at = null, hidden_reason = null where id = (select v from t_ids where k = 'vaga');
update public.accounts set suspended_at = now(), suspended_reason = 'teste' where company_id = '96000000-0000-0000-0000-000000000cc1';
select pg_temp.login('96000000-0000-0000-0000-000000000cc1');
select pg_temp.fails($$select public.transition_application((select v from t_ids where k = 'vaga'), '96000000-0000-0000-0000-000000000ca2', 'contratar', null)$$, 'BC409');
select pg_temp.fails($$select public.invite_worker((select v from t_ids where k = 'vaga'), '96000000-0000-0000-0000-000000000ca3')$$, 'BC409');
select pg_temp.fails($$select public.undo_reject((select v from t_ids where k = 'vaga'), '96000000-0000-0000-0000-000000000ca1')$$, 'BC409');
select pg_temp.fails($$select public.update_job((select v from t_ids where k = 'vaga'), '{"title": "x"}'::jsonb)$$, 'BC409');
select pg_temp.logout();
rollback;
