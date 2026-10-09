-- Y18 — a nota do perfil é round(avg, 1) sobre todas as avaliações, sem acumular arredondamento.
begin;

select pg_temp.new_user('70000000-0000-0000-0000-0000000000c1', 'recrutador', 'Obra Média');
create temp table t_ids (k text primary key, v text);
grant all on t_ids to authenticated;
insert into t_ids values ('job', pg_temp.new_job('70000000-0000-0000-0000-0000000000c1', 4, -3));

-- Quatro trabalhadores concluíram a diária e avaliam a obra com 5, 4, 4, 4.
-- Média certa: 4,25 → 4,3. A conta incremental antiga dava 5 → 4,5 → 4,3 → 4,2.
do $$
declare
  v_ids uuid[] := array['70000000-0000-0000-0000-0000000000a1', '70000000-0000-0000-0000-0000000000a2',
                        '70000000-0000-0000-0000-0000000000a3', '70000000-0000-0000-0000-0000000000a4'];
begin
  for i in 1..4 loop
    perform pg_temp.new_user(v_ids[i], 'trabalhador', 'Trabalhador ' || i);
    insert into public.applications (job_id, worker_id, status)
    values ((select v from t_ids where k = 'job'), v_ids[i], 'concluida');
  end loop;
end $$;

select pg_temp.login('70000000-0000-0000-0000-0000000000a1');
select public.submit_review((select id from public.applications where worker_id = '70000000-0000-0000-0000-0000000000a1'), 'para_construtora', 5, '{}', '');
select pg_temp.logout();
select pg_temp.login('70000000-0000-0000-0000-0000000000a2');
select public.submit_review((select id from public.applications where worker_id = '70000000-0000-0000-0000-0000000000a2'), 'para_construtora', 4, '{}', '');
select pg_temp.logout();
select pg_temp.login('70000000-0000-0000-0000-0000000000a3');
select public.submit_review((select id from public.applications where worker_id = '70000000-0000-0000-0000-0000000000a3'), 'para_construtora', 4, '{}', '');
select pg_temp.logout();
select pg_temp.login('70000000-0000-0000-0000-0000000000a4');
select public.submit_review((select id from public.applications where worker_id = '70000000-0000-0000-0000-0000000000a4'), 'para_construtora', 4, '{}', '');
select pg_temp.logout();

select pg_temp.ok((select rating = 4.3 and review_count = 4 from public.companies where id = '70000000-0000-0000-0000-0000000000c1'),
  'nota 4,3 com 4 avaliações');

-- A construtora avalia um trabalhador: a nota dele também vem das avaliações.
select pg_temp.login('70000000-0000-0000-0000-0000000000c1');
select public.submit_review((select id from public.applications where worker_id = '70000000-0000-0000-0000-0000000000a1'), 'para_trabalhador', 3, '{}', '');
select pg_temp.logout();
select pg_temp.ok((select rating = 3.0 and review_count = 1 from public.workers where id = '70000000-0000-0000-0000-0000000000a1'),
  'nota do trabalhador');

-- Um valor escrito à mão não fica: o gatilho recalcula.
update public.companies set rating = 1.0, review_count = 99 where id = '70000000-0000-0000-0000-0000000000c1';
select pg_temp.ok((select rating = 4.3 and review_count = 4 from public.companies where id = '70000000-0000-0000-0000-0000000000c1'),
  'recalculado a partir das avaliações');

rollback;
