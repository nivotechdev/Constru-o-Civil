-- F06 — silenciar "bicos novos" no sino; o andamento do bico sempre chega.
begin;
select pg_temp.new_user('80200000-0000-0000-0000-0000000000a1', 'trabalhador', 'Sem Bico Novo');
select pg_temp.new_user('80200000-0000-0000-0000-0000000000c1', 'recrutador', 'Obra Prefs', '11.222.333/0001-81');
select pg_temp.login('80200000-0000-0000-0000-0000000000a1');
select public.save_job_alert('São Paulo', 'SP', -23.55, -46.63, null, null);
select public.save_notification_prefs(array['bicos_novos'], array['candidaturas']);
select pg_temp.fails($$select public.save_notification_prefs(array['candidaturas'], '{}')$$, 'BC422');
select pg_temp.logout();
create temp table t_ids (k text primary key, v text);
grant all on t_ids to authenticated;
insert into t_ids values ('j', pg_temp.new_job('80200000-0000-0000-0000-0000000000c1'));
select pg_temp.ok(not exists (select 1 from public.notifications where worker_id = '80200000-0000-0000-0000-0000000000a1'
                                and kind = 'bico_novo'), 'bico novo silenciado');
select pg_temp.login('80200000-0000-0000-0000-0000000000a1');
select public.submit_application((select v from t_ids));
select pg_temp.login('80200000-0000-0000-0000-0000000000c1');
select public.transition_application((select v from t_ids), '80200000-0000-0000-0000-0000000000a1', 'aprovar');
select pg_temp.logout();
select pg_temp.ok(exists (select 1 from public.notifications where worker_id = '80200000-0000-0000-0000-0000000000a1'
                            and kind = 'pre_selecionado'), 'andamento do bico chega');
rollback;
