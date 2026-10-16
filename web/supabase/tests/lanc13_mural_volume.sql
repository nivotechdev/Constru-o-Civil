-- L13 (lançamento) — o mural usa jobs.last_day no lugar de job_is_open por linha: as duas regras têm de dar o
-- mesmo resultado, vaga a vaga (datas, "a combinar", encerrada, excluída, oculta, cheia); e o mural traz o slug.
begin;
select pg_temp.new_user('8d000000-0000-0000-0000-0000000000c1', 'recrutador', 'Obra Do Mural', '11.222.333/0001-81');
select pg_temp.new_user('8d000000-0000-0000-0000-0000000000a1', 'trabalhador', 'Olha O Mural');
select pg_temp.new_user('8d000000-0000-0000-0000-0000000000a2', 'trabalhador', 'Contratado Mural');
create temp table t_jobs (k text primary key, id text);
grant all on t_jobs to authenticated;

insert into t_jobs values ('futura', pg_temp.new_job('8d000000-0000-0000-0000-0000000000c1'));
insert into t_jobs values ('hoje', pg_temp.new_job('8d000000-0000-0000-0000-0000000000c1', 1, 0));
insert into t_jobs values ('passada', pg_temp.new_job('8d000000-0000-0000-0000-0000000000c1'));
update public.jobs set start_date = public.bicos_today() - 3, end_date = public.bicos_today() - 1
 where id = (select id from t_jobs where k = 'passada');
insert into t_jobs values ('combinar', pg_temp.new_job('8d000000-0000-0000-0000-0000000000c1'));
update public.jobs set date_to_arrange = true, start_date = null, end_date = null
 where id = (select id from t_jobs where k = 'combinar');
insert into t_jobs values ('combinar_velha', pg_temp.new_job('8d000000-0000-0000-0000-0000000000c1'));
update public.jobs set date_to_arrange = true, start_date = null, end_date = null, created_at = now() - interval '31 days'
 where id = (select id from t_jobs where k = 'combinar_velha');
insert into t_jobs values ('encerrada', pg_temp.new_job('8d000000-0000-0000-0000-0000000000c1'));
update public.jobs set closed = true where id = (select id from t_jobs where k = 'encerrada');
insert into t_jobs values ('excluida', pg_temp.new_job('8d000000-0000-0000-0000-0000000000c1'));
update public.jobs set deleted_at = now() where id = (select id from t_jobs where k = 'excluida');
insert into t_jobs values ('oculta', pg_temp.new_job('8d000000-0000-0000-0000-0000000000c1'));
update public.jobs set hidden_at = now(), hidden_reason = 'teste' where id = (select id from t_jobs where k = 'oculta');
insert into t_jobs values ('cheia', pg_temp.new_job('8d000000-0000-0000-0000-0000000000c1'));
insert into public.applications (job_id, worker_id, status)
values ((select id from t_jobs where k = 'cheia'), '8d000000-0000-0000-0000-0000000000a2', 'contratado');

select pg_temp.ok(bool_and(j.last_day is not distinct from public.job_last_day(j)), 'last_day = job_last_day em todas')
  from public.jobs j where j.company_id = '8d000000-0000-0000-0000-0000000000c1';

select pg_temp.login('8d000000-0000-0000-0000-0000000000a1');
create temp table t_feed as
  select f ->> 'id' as id, f ->> 'public_slug' as slug
    from public.feed_jobs('São Paulo', 'SP', -23.54, -46.57, null, null, null, null, false, 'perto', 60) f;
select pg_temp.logout();

select pg_temp.ok(
  (select array_agg(t.k order by t.k) from t_jobs t join t_feed f on f.id = t.id) =
  (select array_agg(t.k order by t.k) from t_jobs t join public.jobs j on j.id = t.id
    where public.job_is_open(j) and public.job_holding(j.id) < j.slots),
  'mural = job_is_open + com lugar, vaga a vaga');
select pg_temp.ok((select array_agg(t.k order by t.k) from t_jobs t join t_feed f on f.id = t.id)
                  = array['combinar', 'futura', 'hoje'], 'só as abertas e com lugar');
select pg_temp.ok((select bool_and(f.slug = j.public_slug) from t_feed f join public.jobs j on j.id = f.id), 'mural traz o slug');
select pg_temp.ok(exists (select 1 from pg_indexes where indexname = 'jobs_feed_city_idx'), 'índice do mural por cidade');
rollback;
