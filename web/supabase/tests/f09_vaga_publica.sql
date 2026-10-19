-- F09 — a vaga compartilhada abre sem login, sem endereço exato; excluída não abre.
begin;
select pg_temp.new_user('7d000000-0000-0000-0000-0000000000c1', 'recrutador', 'Obra Pública', '11.222.333/0001-81');
create temp table t_ids (k text primary key, v text);
grant all on t_ids to anon;
insert into t_ids values ('j', pg_temp.new_job('7d000000-0000-0000-0000-0000000000c1'));
-- L10: o link público é pelo slug da vaga, não pelo BC-n.
update t_ids set v = (select public_slug from public.jobs where id = t_ids.v);
set local role anon;
select pg_temp.ok((select public.public_job_card(v) ->> 'city' from t_ids) = 'São Paulo', 'abre sem login');
select pg_temp.ok(not (select public.public_job_card(v) ? 'street' from t_ids), 'sem rua');
select pg_temp.ok((select (public.public_job_card(v) ->> 'aberta')::boolean from t_ids), 'aberta');
reset role;
update public.jobs set deleted_at = now() where public_slug = (select v from t_ids);
set local role anon;
select pg_temp.ok((select public.public_job_card(v) is null from t_ids), 'excluída não abre');
reset role;
rollback;
