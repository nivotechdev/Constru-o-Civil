-- F13 — convidar, aceitar (vira candidatura) e recusar.
begin;
select pg_temp.new_user('7f000000-0000-0000-0000-0000000000c1', 'recrutador', 'Obra Convida', '11.222.333/0001-81');
select pg_temp.new_user('7f000000-0000-0000-0000-0000000000a1', 'trabalhador', 'Aceita Convite');
select pg_temp.new_user('7f000000-0000-0000-0000-0000000000a2', 'trabalhador', 'Recusa Convite');
create temp table t_ids (k text primary key, v text);
grant all on t_ids to authenticated;
insert into t_ids values ('j', pg_temp.new_job('7f000000-0000-0000-0000-0000000000c1', 2));

select pg_temp.login('7f000000-0000-0000-0000-0000000000c1');
select public.invite_worker((select v from t_ids), '7f000000-0000-0000-0000-0000000000a1');
select public.invite_worker((select v from t_ids), '7f000000-0000-0000-0000-0000000000a2');
select pg_temp.fails($$select public.invite_worker((select v from t_ids), '7f000000-0000-0000-0000-0000000000a1')$$, 'BC409');
select pg_temp.logout();
select pg_temp.ok((select count(*) from public.notifications where kind = 'convite'
                     and worker_id in ('7f000000-0000-0000-0000-0000000000a1', '7f000000-0000-0000-0000-0000000000a2')) = 2, 'convidados avisados');

select pg_temp.login('7f000000-0000-0000-0000-0000000000a1');
select pg_temp.ok((select count(*) from public.job_invites) = 1, 'trabalhador vê só o próprio convite');
select public.answer_invite((select v from t_ids), true);
select pg_temp.login('7f000000-0000-0000-0000-0000000000a2');
select public.answer_invite((select v from t_ids), false);
select pg_temp.logout();
select pg_temp.ok(pg_temp.status_of((select v from t_ids), '7f000000-0000-0000-0000-0000000000a1') = 'enviada', 'aceitou: candidatura');
select pg_temp.ok(pg_temp.status_of((select v from t_ids), '7f000000-0000-0000-0000-0000000000a2') is null, 'recusou: sem candidatura');
select pg_temp.ok((select count(*) from public.notifications where kind = 'convite'
                     and company_id = '7f000000-0000-0000-0000-0000000000c1') = 2, 'construtora avisada das respostas');
rollback;
