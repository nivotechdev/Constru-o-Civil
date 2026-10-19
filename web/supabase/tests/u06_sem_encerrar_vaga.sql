-- U06 — a vaga não é mais encerrada à mão: close_job não existe; excluir com equipe continua recusado, com a
-- mensagem nova; sem equipe, exclui e avisa quem esperava.
begin;

select pg_temp.ok(to_regprocedure('public.close_job(text)') is null, 'a RPC close_job saiu');

select pg_temp.new_user('76000000-0000-0000-0000-0000000000c1', 'recrutador', 'Obra Sem Encerrar');
select pg_temp.new_user('76000000-0000-0000-0000-0000000000a1', 'trabalhador', 'Escolhido Teste');
select pg_temp.new_user('76000000-0000-0000-0000-0000000000a2', 'trabalhador', 'Esperando Teste');
create temp table t_ids (k text primary key, v text);
grant all on t_ids to authenticated;
insert into t_ids values
  ('com_equipe', pg_temp.new_job('76000000-0000-0000-0000-0000000000c1', 2, 2)),
  ('sem_equipe', pg_temp.new_job('76000000-0000-0000-0000-0000000000c1', 2, 2));

select pg_temp.login('76000000-0000-0000-0000-0000000000a1');
select public.submit_application((select v from t_ids where k = 'com_equipe'));
select pg_temp.login('76000000-0000-0000-0000-0000000000a2');
select public.submit_application((select v from t_ids where k = 'sem_equipe'));
select pg_temp.login('76000000-0000-0000-0000-0000000000c1');
select public.transition_application((select v from t_ids where k = 'com_equipe'), '76000000-0000-0000-0000-0000000000a1', 'aprovar');

-- Com gente escolhida: não exclui, e a mensagem não fala mais em encerrar.
do $$
begin
  perform public.delete_job((select v from t_ids where k = 'com_equipe'));
  raise exception 'delete_job deveria recusar';
exception when sqlstate 'BC409' then
  if sqlerrm <> 'Essa vaga tem gente escolhida ou contratada. Ela não pode ser excluída.' then
    raise exception 'mensagem inesperada: %', sqlerrm;
  end if;
end $$;

-- Sem equipe: exclui, e quem esperava é avisado.
select public.delete_job((select v from t_ids where k = 'sem_equipe'));
select pg_temp.logout();
select pg_temp.ok((select deleted_at is not null and closed from public.jobs where id = (select v from t_ids where k = 'sem_equipe')),
  'sem equipe, a vaga é excluída');
select pg_temp.ok(pg_temp.status_of((select v from t_ids where k = 'sem_equipe'), '76000000-0000-0000-0000-0000000000a2') = 'nao_selecionado',
  'quem esperava vira não selecionado');
select pg_temp.ok((select deleted_at is null and not closed from public.jobs where id = (select v from t_ids where k = 'com_equipe')),
  'com equipe, a vaga continua aberta');

rollback;
