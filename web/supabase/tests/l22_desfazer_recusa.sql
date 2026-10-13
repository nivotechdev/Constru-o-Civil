-- L22 — desfazer a recusa logo depois: volta para análise; aviso não visto some; tarde demais é recusado.
begin;

select pg_temp.new_user('75000000-0000-0000-0000-0000000000c1', 'recrutador', 'Obra Volta', '11.222.333/0001-81');
select pg_temp.new_user('75000000-0000-0000-0000-0000000000a1', 'trabalhador', 'Recusado Sem Querer');
select pg_temp.new_user('75000000-0000-0000-0000-0000000000a2', 'trabalhador', 'Recusado Faz Tempo');
create temp table t_ids (k text primary key, v text);
grant all on t_ids to authenticated;
insert into t_ids values ('j', pg_temp.new_job('75000000-0000-0000-0000-0000000000c1', 2));

select pg_temp.login('75000000-0000-0000-0000-0000000000a1');
select public.submit_application((select v from t_ids));
select pg_temp.login('75000000-0000-0000-0000-0000000000a2');
select public.submit_application((select v from t_ids));
select pg_temp.login('75000000-0000-0000-0000-0000000000c1');
select public.transition_application((select v from t_ids), '75000000-0000-0000-0000-0000000000a1', 'recusar');
select public.transition_application((select v from t_ids), '75000000-0000-0000-0000-0000000000a2', 'recusar');
select pg_temp.logout();
update public.application_events set at = now() - interval '1 hour'
 where application_id = (select id from public.applications where worker_id = '75000000-0000-0000-0000-0000000000a2');

select pg_temp.login('75000000-0000-0000-0000-0000000000c1');
select public.undo_reject((select v from t_ids), '75000000-0000-0000-0000-0000000000a1');
select pg_temp.fails($$select public.undo_reject((select v from t_ids), '75000000-0000-0000-0000-0000000000a2')$$, 'BC409');
select pg_temp.logout();
select pg_temp.ok(pg_temp.status_of((select v from t_ids), '75000000-0000-0000-0000-0000000000a1') = 'em_analise', 'voltou para análise');
select pg_temp.ok(not exists (select 1 from public.notifications where worker_id = '75000000-0000-0000-0000-0000000000a1'
                                and kind = 'nao_selecionado'), 'aviso não visto saiu');

-- Outra construtora não desfaz.
select pg_temp.new_user('75000000-0000-0000-0000-0000000000c2', 'recrutador', 'Outra', '18.402.551/0001-47');
select pg_temp.login('75000000-0000-0000-0000-0000000000c2');
select pg_temp.fails($$select public.undo_reject((select v from t_ids), '75000000-0000-0000-0000-0000000000a1')$$, 'BC401');
select pg_temp.logout();

rollback;
