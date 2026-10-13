-- X21 — o funil conta o dia de cada passo; só service_role.
begin;
select pg_temp.new_user('7d000000-0000-0000-0000-0000000000b1', 'recrutador', 'Obra Funil', '11.222.333/0001-81');
select pg_temp.new_user('7d000000-0000-0000-0000-0000000000b2', 'trabalhador', 'Ana Funil');
create temp table t_ids (k text primary key, v text);
grant all on t_ids to authenticated;
insert into t_ids values ('j', pg_temp.new_job('7d000000-0000-0000-0000-0000000000b1'));
select pg_temp.login('7d000000-0000-0000-0000-0000000000b2');
select public.submit_application((select v from t_ids));
select pg_temp.fails($$select * from public.funnel_daily(current_date, current_date)$$, '42501');
reset role;
select pg_temp.ok((select candidaturas >= 1 and vagas_publicadas >= 1 and cadastros_iniciados >= 2
                     from public.funnel_daily((now() at time zone 'America/Sao_Paulo')::date,
                                              (now() at time zone 'America/Sao_Paulo')::date)),
                  'hoje: contas, vaga e candidatura');
select pg_temp.ok((select count(*) from public.funnel_daily(current_date - 6, current_date)) = 7, 'um dia por linha');
rollback;
