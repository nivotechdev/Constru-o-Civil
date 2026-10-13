-- F12 — confirmar presença, lembrete na véspera, datas novas zeram.
begin;
select pg_temp.new_user('78000000-0000-0000-0000-0000000000c1', 'recrutador', 'Obra Presença', '11.222.333/0001-81');
select pg_temp.new_user('78000000-0000-0000-0000-0000000000a1', 'trabalhador', 'Vai Confirmar');
select pg_temp.new_user('78000000-0000-0000-0000-0000000000a2', 'trabalhador', 'Esqueceu De Confirmar');
create temp table t_ids (k text primary key, v text);
grant all on t_ids to authenticated;
insert into t_ids values ('j', pg_temp.new_job('78000000-0000-0000-0000-0000000000c1', 2, 1));  -- começa amanhã
update public.jobs set dias = null where id = (select v from t_ids);

select pg_temp.login('78000000-0000-0000-0000-0000000000a1');
select public.submit_application((select v from t_ids));
select pg_temp.fails($$select public.confirm_presence((select v from t_ids))$$, 'BC409');  -- ainda não contratado
select pg_temp.login('78000000-0000-0000-0000-0000000000a2');
select public.submit_application((select v from t_ids));
select pg_temp.login('78000000-0000-0000-0000-0000000000c1');
select public.transition_application((select v from t_ids), '78000000-0000-0000-0000-0000000000a1', 'aprovar');
select public.transition_application((select v from t_ids), '78000000-0000-0000-0000-0000000000a1', 'contratar');
select public.transition_application((select v from t_ids), '78000000-0000-0000-0000-0000000000a2', 'aprovar');
select public.transition_application((select v from t_ids), '78000000-0000-0000-0000-0000000000a2', 'contratar');

select pg_temp.login('78000000-0000-0000-0000-0000000000a1');
select public.confirm_presence((select v from t_ids));
select pg_temp.logout();
select pg_temp.ok((select presence_confirmed_at is not null from public.applications where worker_id = '78000000-0000-0000-0000-0000000000a1'),
  'presença confirmada');
select pg_temp.ok(exists (select 1 from public.notifications where company_id = '78000000-0000-0000-0000-0000000000c1'
                            and kind = 'confirmar_presenca'), 'construtora avisada');

-- Lembrete: só quem não confirmou; não repete no mesmo dia.
select pg_temp.ok(public.remind_presence() = 1, 'um lembrete');
select pg_temp.ok(public.remind_presence() = 0, 'sem repetir');
select pg_temp.ok(exists (select 1 from public.notifications where worker_id = '78000000-0000-0000-0000-0000000000a2'
                            and kind = 'confirmar_presenca'), 'quem esqueceu foi lembrado');

-- Datas novas zeram.
update public.jobs set start_date = start_date + 1, end_date = end_date + 1 where id = (select v from t_ids);
select pg_temp.ok((select presence_confirmed_at is null from public.applications where worker_id = '78000000-0000-0000-0000-0000000000a1'),
  'datas novas zeram a confirmação');
rollback;
