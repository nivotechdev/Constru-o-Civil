-- X15 — políticas sem função por linha continuam certas; limite contra spam de candidatar/retirar.
begin;
select pg_temp.new_user('7d000000-0000-0000-0000-0000000000e1', 'recrutador', 'Obra Um', '11.222.333/0001-81');
select pg_temp.new_user('7d000000-0000-0000-0000-0000000000e2', 'recrutador', 'Obra Dois', '11.444.777/0001-61');
select pg_temp.new_user('7d000000-0000-0000-0000-0000000000e3', 'trabalhador', 'Ana Spam');
select pg_temp.new_user('7d000000-0000-0000-0000-0000000000e4', 'trabalhador', 'Bia Outra');
create temp table t_ids (k text primary key, v text);
grant all on t_ids to authenticated;
insert into t_ids values ('j', pg_temp.new_job('7d000000-0000-0000-0000-0000000000e1', 5));

select pg_temp.login('7d000000-0000-0000-0000-0000000000e3');
select public.submit_application((select v from t_ids where k = 'j'));
select public.withdraw_application((select v from t_ids where k = 'j'));
select public.submit_application((select v from t_ids where k = 'j'));
select public.withdraw_application((select v from t_ids where k = 'j'));
select public.submit_application((select v from t_ids where k = 'j'));
select public.withdraw_application((select v from t_ids where k = 'j'));
select pg_temp.fails($$select public.submit_application((select v from t_ids where k = 'j'))$$, 'BC409');
select pg_temp.logout();

select pg_temp.login('7d000000-0000-0000-0000-0000000000e4');
select public.submit_application((select v from t_ids where k = 'j'));
select pg_temp.ok((select count(*) from public.applications) = 1, 'trabalhadora vê só a própria candidatura');
select pg_temp.ok((select count(*) from public.application_events) = 1, 'e o próprio histórico');
select pg_temp.logout();

select pg_temp.login('7d000000-0000-0000-0000-0000000000e1');
select pg_temp.ok((select count(*) from public.applications) = 1, 'dona da vaga vê a candidatura');
select pg_temp.ok((select count(*) from public.application_events) = 1, 'e o histórico');
select pg_temp.logout();

select pg_temp.login('7d000000-0000-0000-0000-0000000000e2');
select pg_temp.ok((select count(*) from public.applications) = 0, 'outra construtora não vê');
select pg_temp.ok((select count(*) from public.application_events) = 0, 'nem o histórico');
select pg_temp.logout();

-- 30 por dia.
insert into public.application_attempts (worker_id, job_id)
  select '7d000000-0000-0000-0000-0000000000e4', 'X-' || g from generate_series(1, 29) g;
insert into t_ids values ('j2', pg_temp.new_job('7d000000-0000-0000-0000-0000000000e2'));
select pg_temp.login('7d000000-0000-0000-0000-0000000000e4');
select pg_temp.fails($$select public.submit_application((select v from t_ids where k = 'j2'))$$, 'BC409');
select pg_temp.logout();
rollback;
