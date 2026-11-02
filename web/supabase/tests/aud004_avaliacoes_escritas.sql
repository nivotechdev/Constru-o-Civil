-- AUD-004 — excluir a conta anonimiza as avaliações que a pessoa ESCREVEU: sai o nome e o comentário, a nota
-- continua na média de quem foi avaliado. As avaliações RECEBIDAS saem junto com a conta, como antes.
begin;
select pg_temp.new_user('95000000-0000-0000-0000-0000000004c1', 'recrutador', 'Empresa Que Avalia', '11.222.333/0001-81');
select pg_temp.new_user('95000000-0000-0000-0000-0000000004c2', 'recrutador', 'Empresa Avaliada', '45.723.174/0001-10');
select pg_temp.new_user('95000000-0000-0000-0000-0000000004a1', 'trabalhador', 'Ana Que Escreve');
select pg_temp.new_user('95000000-0000-0000-0000-0000000004a2', 'trabalhador', 'Bruno Avaliado');
create temp table t_ids (k text primary key, v text);
grant all on t_ids to authenticated;
insert into t_ids values ('vaga1', pg_temp.new_job('95000000-0000-0000-0000-0000000004c2'));
insert into t_ids values ('vaga2', pg_temp.new_job('95000000-0000-0000-0000-0000000004c1'));

-- Ana trabalhou para a empresa avaliada e escreveu o que achou; a empresa (que avalia) avaliou o Bruno.
insert into public.applications (job_id, worker_id, status) values
  ((select v from t_ids where k = 'vaga1'), '95000000-0000-0000-0000-0000000004a1', 'concluida'),
  ((select v from t_ids where k = 'vaga2'), '95000000-0000-0000-0000-0000000004a2', 'concluida');
insert into public.reviews (application_id, direction, company_id, author_label, value, tags, comment)
  select id, 'para_construtora', '95000000-0000-0000-0000-0000000004c2', 'Ana Q.', 4, '{}', 'Atrasaram o pagamento'
    from public.applications where job_id = (select v from t_ids where k = 'vaga1');
insert into public.reviews (application_id, direction, worker_id, author_label, value, tags, comment)
  select id, 'para_trabalhador', '95000000-0000-0000-0000-0000000004a2', 'Empresa Que Avalia', 5, '{}', 'Chegou cedo, muito bom'
    from public.applications where job_id = (select v from t_ids where k = 'vaga2');
update public.companies set review_count = review_count where id = '95000000-0000-0000-0000-0000000004c2';
update public.workers set review_count = review_count where id = '95000000-0000-0000-0000-0000000004a2';
select pg_temp.ok((select rating = 4 and review_count = 1 from public.companies where id = '95000000-0000-0000-0000-0000000004c2'),
                  'antes: a empresa avaliada tem a nota 4');
select pg_temp.ok((select rating = 5 and review_count = 1 from public.workers where id = '95000000-0000-0000-0000-0000000004a2'),
                  'antes: o Bruno tem a nota 5');

-- A Ana exclui a conta: a avaliação que ela escreveu fica sem nome e sem comentário, a nota continua.
select pg_temp.login('95000000-0000-0000-0000-0000000004a1', 10);
select public.delete_my_account(true);
select pg_temp.logout();
select pg_temp.ok((select count(*) = 1 and bool_and(author_label = 'Conta excluída' and comment = '' and value = 4)
                     from public.reviews where company_id = '95000000-0000-0000-0000-0000000004c2'),
                  'avaliação escrita pela Ana: sem nome e sem comentário, com a nota');
select pg_temp.ok((select rating = 4 and review_count = 1 from public.companies where id = '95000000-0000-0000-0000-0000000004c2'),
                  'a nota da empresa avaliada continua na média');

-- A empresa que avalia exclui a conta: o que ela escreveu para o Bruno perde o nome e o comentário.
select pg_temp.login('95000000-0000-0000-0000-0000000004c1', 10);
select public.delete_my_account(true);
select pg_temp.logout();
select pg_temp.ok((select count(*) = 1 and bool_and(author_label = 'Empresa (conta excluída)' and comment = '' and value = 5)
                     from public.reviews where worker_id = '95000000-0000-0000-0000-0000000004a2'),
                  'avaliação escrita pela empresa: sem nome e sem comentário, com a nota');
select pg_temp.ok((select rating = 5 and review_count = 1 from public.workers where id = '95000000-0000-0000-0000-0000000004a2'),
                  'a nota do Bruno continua na média');
select pg_temp.ok(not exists (select 1 from public.reviews where comment in ('Atrasaram o pagamento', 'Chegou cedo, muito bom')
                                 or author_label in ('Ana Q.', 'Empresa Que Avalia')),
                  'nenhum nome nem comentário de quem saiu');
rollback;
