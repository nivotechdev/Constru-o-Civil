-- Y01/Y04 — vaga cheia editável; equipe concluída encerra a vaga; vaga vencida resolve quem esperava.
begin;

select pg_temp.new_user('80000000-0000-0000-0000-0000000000c1', 'recrutador', 'Ciclo Construtora');
select pg_temp.new_user('80000000-0000-0000-0000-0000000000a1', 'trabalhador', 'Ana Ciclo');
select pg_temp.new_user('80000000-0000-0000-0000-0000000000a2', 'trabalhador', 'Beto Ciclo');
select pg_temp.new_user('80000000-0000-0000-0000-0000000000a3', 'trabalhador', 'Caio Ciclo');
create temp table t_ids (k text primary key, v text);
grant all on t_ids to authenticated;
create temp table t_today as select public.bicos_today() as d;
grant select on t_today to authenticated;
insert into t_ids values
  ('hoje', pg_temp.new_job('80000000-0000-0000-0000-0000000000c1', 1, 0)),
  ('vencida', pg_temp.new_job('80000000-0000-0000-0000-0000000000c1', 2, 2));

-- Vaga de hoje (1 posição): Ana contratada → cheia, ainda editável.
select pg_temp.login('80000000-0000-0000-0000-0000000000a1');
select public.submit_application((select v from t_ids where k = 'hoje'));
select pg_temp.login('80000000-0000-0000-0000-0000000000c1');
select public.transition_application((select v from t_ids where k = 'hoje'), '80000000-0000-0000-0000-0000000000a1', 'aprovar');
select public.transition_application((select v from t_ids where k = 'hoje'), '80000000-0000-0000-0000-0000000000a1', 'contratar');
select public.update_job((select v from t_ids where k = 'hoje'), jsonb_build_object(
  'oficio_id', 'pedreiro', 'pay', 250, 'cep', '03307-000', 'street', 'Rua Teste', 'number', '10',
  'neighborhood', 'Tatuapé', 'city', 'São Paulo', 'uf', 'SP', 'lat', -23.54, 'lon', -46.57,
  'start_date', (select d from t_today), 'end_date', (select d from t_today) + 1, 'slots', 1, 'description', 'Reboco de parede'));
-- Concluir a única posição encerra a vaga sozinha (Y01).
select public.transition_application((select v from t_ids where k = 'hoje'), '80000000-0000-0000-0000-0000000000a1', 'concluir');
select pg_temp.logout();
select pg_temp.ok((select closed and not sem_contratacao and pay = 250 from public.jobs where id = (select v from t_ids where k = 'hoje')),
  'vaga cheia editada e encerrada quando a equipe concluiu');

-- Vaga que vence: Beto esperando, Caio pré-selecionado.
select pg_temp.login('80000000-0000-0000-0000-0000000000a2');
select public.submit_application((select v from t_ids where k = 'vencida'));
select pg_temp.login('80000000-0000-0000-0000-0000000000a3');
select public.submit_application((select v from t_ids where k = 'vencida'));
select pg_temp.login('80000000-0000-0000-0000-0000000000c1');
select public.transition_application((select v from t_ids where k = 'vencida'), '80000000-0000-0000-0000-0000000000a3', 'aprovar');
select pg_temp.logout();
update public.jobs set start_date = public.bicos_today() - 5, end_date = public.bicos_today() - 1
 where id = (select v from t_ids where k = 'vencida');
select public.conclude_finished_jobs();
select pg_temp.ok(pg_temp.status_of((select v from t_ids where k = 'vencida'), '80000000-0000-0000-0000-0000000000a2') = 'nao_selecionado',
  'quem esperava vira não selecionado');
select pg_temp.ok(pg_temp.status_of((select v from t_ids where k = 'vencida'), '80000000-0000-0000-0000-0000000000a3') = 'expirada',
  'pré-selecionado sem contratação vira expirada');
select pg_temp.ok((select closed and sem_contratacao from public.jobs where id = (select v from t_ids where k = 'vencida')),
  'vaga vencida sem ninguém para trabalhar encerra');
select pg_temp.ok((select count(*) from public.notifications where title in ('Vaga vencida', 'A contratação não foi confirmada', 'Prazo da vaga vencido')) = 3,
  'avisos de vaga vencida para os três');

-- Contratado: concluído só 2 dias depois do fim (dá para marcar falta antes).
insert into t_ids values ('fim', pg_temp.new_job('80000000-0000-0000-0000-0000000000c1', 1, 0));
select pg_temp.login('80000000-0000-0000-0000-0000000000a2');
select public.submit_application((select v from t_ids where k = 'fim'));
select pg_temp.login('80000000-0000-0000-0000-0000000000c1');
select public.transition_application((select v from t_ids where k = 'fim'), '80000000-0000-0000-0000-0000000000a2', 'aprovar');
select public.transition_application((select v from t_ids where k = 'fim'), '80000000-0000-0000-0000-0000000000a2', 'contratar');
select pg_temp.logout();
update public.jobs set start_date = public.bicos_today() - 2, end_date = public.bicos_today() - 1
 where id = (select v from t_ids where k = 'fim');
select public.conclude_finished_jobs();
select pg_temp.ok(pg_temp.status_of((select v from t_ids where k = 'fim'), '80000000-0000-0000-0000-0000000000a2') = 'contratado',
  'um dia depois do fim ainda dá para marcar falta');
update public.jobs set start_date = public.bicos_today() - 3, end_date = public.bicos_today() - 2
 where id = (select v from t_ids where k = 'fim');
select public.conclude_finished_jobs();
select pg_temp.ok(pg_temp.status_of((select v from t_ids where k = 'fim'), '80000000-0000-0000-0000-0000000000a2') = 'concluida',
  'dois dias depois do fim, conclui sozinho');

-- A combinar: vence 30 dias depois de publicada.
insert into t_ids values ('combinar', pg_temp.new_job('80000000-0000-0000-0000-0000000000c1', 1, 0));
update public.jobs set date_to_arrange = true, start_date = null, end_date = null, created_at = now() - interval '31 days'
 where id = (select v from t_ids where k = 'combinar');
select pg_temp.ok(not public.job_is_open((select j from public.jobs j where id = (select v from t_ids where k = 'combinar'))),
  'a combinar vence depois de 30 dias');

rollback;
