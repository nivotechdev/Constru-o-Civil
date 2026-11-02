-- AUD-011 — reputação não se fabrica em segundos: em vaga "a combinar" só dá para concluir (e marcar falta)
-- 24 horas depois de contratar; o bico só entra na contagem (jobs_done) com presença confirmada ou concluído pelo
-- sistema; a equipe vê os pares de contas que só avaliam um ao outro.
begin;
select pg_temp.new_user('96000000-0000-0000-0000-000000000ec1', 'recrutador', 'Empresa Gêmea', '51.826.049/0001-39');
select pg_temp.new_user('96000000-0000-0000-0000-000000000ea1', 'trabalhador', 'Gêmeo Trabalhador');
create temp table t_ids (k text primary key, v text);
grant all on t_ids to authenticated;
insert into t_ids values ('a_combinar', pg_temp.new_job('96000000-0000-0000-0000-000000000ec1', 1));
insert into t_ids values ('com_data', pg_temp.new_job('96000000-0000-0000-0000-000000000ec1', 1, 0));
update public.jobs set date_to_arrange = true, start_date = null, end_date = null
 where id = (select v from t_ids where k = 'a_combinar');
insert into public.applications (job_id, worker_id, status, status_changed_at) values
  ((select v from t_ids where k = 'a_combinar'), '96000000-0000-0000-0000-000000000ea1', 'contratado', now());

-- "A combinar", contratado agora: concluir e marcar falta são recusados.
select pg_temp.login('96000000-0000-0000-0000-000000000ec1');
select pg_temp.fails($$select public.transition_application((select v from t_ids where k = 'a_combinar'), '96000000-0000-0000-0000-000000000ea1', 'concluir', null)$$, 'BC409');
select pg_temp.fails($$select public.transition_application((select v from t_ids where k = 'a_combinar'), '96000000-0000-0000-0000-000000000ea1', 'marcar_falta', null)$$, 'BC409');
select pg_temp.logout();

-- Contratado há mais de 24 horas: pode concluir; sem presença confirmada, não conta como bico feito.
update public.applications set status_changed_at = now() - interval '25 hours'
 where job_id = (select v from t_ids where k = 'a_combinar');
select pg_temp.login('96000000-0000-0000-0000-000000000ec1');
select public.transition_application((select v from t_ids where k = 'a_combinar'), '96000000-0000-0000-0000-000000000ea1', 'concluir', null);
select pg_temp.logout();
select pg_temp.ok(pg_temp.status_of((select v from t_ids where k = 'a_combinar'), '96000000-0000-0000-0000-000000000ea1') = 'concluida', 'concluída depois de 24 h');
select pg_temp.ok((select jobs_done = 0 from public.workers where id = '96000000-0000-0000-0000-000000000ea1'),
                  'sem presença confirmada, não entra na contagem de bicos feitos');

-- Com a presença confirmada, conta.
insert into public.applications (job_id, worker_id, status, status_changed_at, presence_confirmed_at)
  values ((select v from t_ids where k = 'com_data'), '96000000-0000-0000-0000-000000000ea1', 'contratado', now() - interval '3 days', now() - interval '1 day');
select pg_temp.login('96000000-0000-0000-0000-000000000ec1');
select public.transition_application((select v from t_ids where k = 'com_data'), '96000000-0000-0000-0000-000000000ea1', 'concluir', null);
select pg_temp.logout();
select pg_temp.ok((select jobs_done = 1 from public.workers where id = '96000000-0000-0000-0000-000000000ea1'), 'com presença confirmada, conta');

-- A equipe vê os pares que só avaliam um ao outro.
insert into public.reviews (application_id, direction, company_id, author_label, value)
  select id, 'para_construtora', '96000000-0000-0000-0000-000000000ec1', 'Gêmeo T.', 5 from public.applications
   where job_id = (select v from t_ids where k = 'com_data');
insert into public.reviews (application_id, direction, worker_id, author_label, value)
  select id, 'para_trabalhador', worker_id, 'Empresa Gêmea', 5 from public.applications
   where job_id = (select v from t_ids where k = 'com_data');
select pg_temp.ok(not has_function_privilege('authenticated', 'public.reciprocal_review_pairs()', 'execute'), 'só a equipe');
select pg_temp.ok((select count(*) from public.reciprocal_review_pairs() p
                    where p.company_id = '96000000-0000-0000-0000-000000000ec1') = 1, 'o par aparece na lista da equipe');
rollback;
