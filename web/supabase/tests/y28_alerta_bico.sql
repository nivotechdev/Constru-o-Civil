-- Y28 — alerta de bico novo: salvo no servidor; vaga nova que bate gera aviso; até 5 por dia.
begin;

select pg_temp.new_user('73000000-0000-0000-0000-0000000000a1', 'trabalhador', 'Quer Aviso Cidade');
select pg_temp.new_user('73000000-0000-0000-0000-0000000000a2', 'trabalhador', 'Quer Aviso Raio');
select pg_temp.new_user('73000000-0000-0000-0000-0000000000a3', 'trabalhador', 'Outro Ofício');
select pg_temp.new_user('73000000-0000-0000-0000-0000000000c1', 'recrutador', 'Obra Alerta', '11.222.333/0001-81');

-- a1: São Paulo inteira, qualquer ofício. a2: até 5 km do Tatuapé, pedreiro. a3: eletricista em SP.
select pg_temp.login('73000000-0000-0000-0000-0000000000a1');
select public.save_job_alert('São Paulo', 'SP', -23.55, -46.63, null, null);
select pg_temp.fails($$select public.save_job_alert('', 'SP', -23.55, -46.63, null, null)$$, 'BC422');
select pg_temp.fails($$select public.save_job_alert('São Paulo', 'SP', -23.55, -46.63, 500, null)$$, 'BC422');
select pg_temp.ok((select count(*) from public.job_alerts) = 1, 'só lê o próprio alerta');
select pg_temp.logout();
select pg_temp.login('73000000-0000-0000-0000-0000000000a2');
select public.save_job_alert('São Paulo', 'SP', -23.54, -46.57, 5, 'pedreiro');
select pg_temp.logout();
select pg_temp.login('73000000-0000-0000-0000-0000000000a3');
select public.save_job_alert('São Paulo', 'SP', -23.55, -46.63, null, 'eletricista');
select pg_temp.logout();

-- A construtora não salva alerta.
select pg_temp.login('73000000-0000-0000-0000-0000000000c1');
select pg_temp.fails($$select public.save_job_alert('São Paulo', 'SP', -23.55, -46.63, null, null)$$, 'BC401');
select pg_temp.logout();

-- Vaga nova de pedreiro no Tatuapé (pg_temp.new_job): avisa a1 e a2, não a3.
create temp table t_ids (k text primary key, v text);
insert into t_ids values ('j1', pg_temp.new_job('73000000-0000-0000-0000-0000000000c1'));
select pg_temp.ok((select count(*) from public.notifications where kind = 'bico_novo'
                     and worker_id in ('73000000-0000-0000-0000-0000000000a1', '73000000-0000-0000-0000-0000000000a2')
                     and target = '/vaga/' || (select v from t_ids where k = 'j1')) = 2, 'avisou cidade e raio');
select pg_temp.ok(not exists (select 1 from public.notifications where kind = 'bico_novo'
                                and worker_id = '73000000-0000-0000-0000-0000000000a3'), 'ofício diferente não recebe');

-- Até 5 por dia.
select pg_temp.new_job('73000000-0000-0000-0000-0000000000c1') from generate_series(1, 6);
select pg_temp.ok((select count(*) from public.notifications where kind = 'bico_novo'
                     and worker_id = '73000000-0000-0000-0000-0000000000a1') = 5, 'no máximo 5 avisos por dia');

-- Desligar.
select pg_temp.login('73000000-0000-0000-0000-0000000000a1');
select public.delete_job_alert();
select pg_temp.ok(not exists (select 1 from public.job_alerts), 'alerta apagado');
select pg_temp.logout();

rollback;
