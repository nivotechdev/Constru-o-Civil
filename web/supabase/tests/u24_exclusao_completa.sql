-- U24 — excluir a conta apaga tudo o que é dela: a construtora leva todas as vagas (candidaturas, vagas salvas,
-- impulsos, denúncias sobre elas) e as avaliações dos dois lados; o trabalhador sai de todos os bicos e leva vagas
-- salvas, publicações, alertas e avaliações. As notas e os bicos feitos do outro lado são refeitos.
begin;
select pg_temp.new_user('95000000-0000-0000-0000-0000000000c1', 'recrutador', 'Obra Que Sai', '11.222.333/0001-81');
select pg_temp.new_user('95000000-0000-0000-0000-0000000000c2', 'recrutador', 'Obra Que Fica', '45.723.174/0001-10');
select pg_temp.new_user('95000000-0000-0000-0000-0000000000a1', 'trabalhador', 'Ana Que Fica');
select pg_temp.new_user('95000000-0000-0000-0000-0000000000a2', 'trabalhador', 'Bruno Que Sai');
create temp table t_ids (k text primary key, v text);
grant all on t_ids to authenticated;
insert into t_ids values ('aberta', pg_temp.new_job('95000000-0000-0000-0000-0000000000c1'));
insert into t_ids values ('feita', pg_temp.new_job('95000000-0000-0000-0000-0000000000c1'));
insert into t_ids values ('outra', pg_temp.new_job('95000000-0000-0000-0000-0000000000c2'));

-- Ana: candidata na vaga aberta, bico concluído na outra (avaliada pela construtora e avaliou de volta).
insert into public.applications (job_id, worker_id, status) values
  ((select v from t_ids where k = 'aberta'), '95000000-0000-0000-0000-0000000000a1', 'enviada'),
  ((select v from t_ids where k = 'feita'), '95000000-0000-0000-0000-0000000000a1', 'concluida'),
  ((select v from t_ids where k = 'outra'), '95000000-0000-0000-0000-0000000000a2', 'contratado');
insert into public.reviews (application_id, direction, company_id, worker_id, author_label, value)
select a.id, d.dir::public.review_direction, '95000000-0000-0000-0000-0000000000c1', a.worker_id, d.label, d.val
  from public.applications a,
       (values ('para_trabalhador', 'Obra Que Sai', 2), ('para_construtora', 'Ana F.', 5)) d(dir, label, val)
 where a.job_id = (select v from t_ids where k = 'feita');
update public.workers set jobs_done = 3, review_count = review_count where id = '95000000-0000-0000-0000-0000000000a1';
update public.companies set review_count = review_count where id = '95000000-0000-0000-0000-0000000000c1';
insert into public.saved_jobs (worker_id, job_id)
values ('95000000-0000-0000-0000-0000000000a1', (select v from t_ids where k = 'aberta'));
insert into public.boost_payments (job_id, company_id, plan, method, amount_cents)
values ((select v from t_ids where k = 'aberta'), '95000000-0000-0000-0000-0000000000c1', '24h', 'pix', 990);
insert into public.reports (reporter_id, target_type, target_id, reason)
values ('95000000-0000-0000-0000-0000000000a1', 'vaga', (select v from t_ids where k = 'aberta'), 'golpe');
select pg_temp.ok((select rating = 2 and review_count = 1 from public.workers where id = '95000000-0000-0000-0000-0000000000a1'),
                  'antes: Ana tem a nota 2 da construtora que sai');

-- A construtora exclui a conta pelo app.
select pg_temp.login('95000000-0000-0000-0000-0000000000c1', 10);
select public.delete_my_account(true);
select pg_temp.logout();

select pg_temp.ok(not exists (select 1 from public.companies where id = '95000000-0000-0000-0000-0000000000c1'), 'empresa apagada');
select pg_temp.ok(not exists (select 1 from public.jobs where company_id = '95000000-0000-0000-0000-0000000000c1'),
                  'todas as vagas dela apagadas');
select pg_temp.ok(not exists (select 1 from public.applications where job_id in (select v from t_ids where k in ('aberta', 'feita'))),
                  'candidaturas das vagas apagadas');
select pg_temp.ok(not exists (select 1 from public.reviews where company_id = '95000000-0000-0000-0000-0000000000c1'),
                  'avaliações dos dois lados apagadas');
select pg_temp.ok(not exists (select 1 from public.saved_jobs where job_id = (select v from t_ids where k = 'aberta')),
                  'some das vagas salvas de quem guardou');
select pg_temp.ok(not exists (select 1 from public.boost_payments where company_id = '95000000-0000-0000-0000-0000000000c1'),
                  'impulsos apagados');
select pg_temp.ok(not exists (select 1 from public.reports where target_id = (select v from t_ids where k = 'aberta')),
                  'denúncia sobre a vaga apagada');
select pg_temp.ok((select rating = 0 and review_count = 0 and jobs_done = 2 from public.workers
                    where id = '95000000-0000-0000-0000-0000000000a1'),
                  'a nota e os bicos feitos da Ana são refeitos sem a construtora que saiu');
select pg_temp.ok(exists (select 1 from public.jobs where id = (select v from t_ids where k = 'outra')),
                  'a vaga de outra construtora continua');

-- Bruno: contratado na vaga que fica, com vaga salva, publicação e alerta; exclui a conta.
insert into public.saved_jobs (worker_id, job_id)
values ('95000000-0000-0000-0000-0000000000a2', (select v from t_ids where k = 'outra'));
insert into public.worker_posts (worker_id, caption)
values ('95000000-0000-0000-0000-0000000000a2', 'Reboco pronto');
insert into public.job_alerts (worker_id, city, uf, lat, lon)
values ('95000000-0000-0000-0000-0000000000a2', 'São Paulo', 'SP', -23.55, -46.63);
select pg_temp.login('95000000-0000-0000-0000-0000000000a2', 10);
select public.delete_my_account(true);
select pg_temp.logout();

select pg_temp.ok(not exists (select 1 from public.workers where id = '95000000-0000-0000-0000-0000000000a2'), 'perfil apagado');
select pg_temp.ok(not exists (select 1 from public.applications where worker_id = '95000000-0000-0000-0000-0000000000a2'),
                  'saiu de todos os bicos');
select pg_temp.ok(not exists (select 1 from public.saved_jobs where worker_id = '95000000-0000-0000-0000-0000000000a2')
                  and not exists (select 1 from public.worker_posts where worker_id = '95000000-0000-0000-0000-0000000000a2')
                  and not exists (select 1 from public.job_alerts where worker_id = '95000000-0000-0000-0000-0000000000a2'),
                  'vagas salvas, publicações e alertas apagados');
select pg_temp.ok(exists (select 1 from public.notifications where company_id = '95000000-0000-0000-0000-0000000000c2'
                            and title = 'Um trabalhador saiu da Bicos'), 'a construtora do bico foi avisada');
select pg_temp.ok(not exists (select 1 from public.accounts where id in ('95000000-0000-0000-0000-0000000000a2',
                                                                         '95000000-0000-0000-0000-0000000000c1')),
                  'logins apagados');
rollback;
