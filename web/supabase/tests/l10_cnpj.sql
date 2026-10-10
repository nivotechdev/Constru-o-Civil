-- L10 — construtora reprovada não publica; o CNPJ completo só sai para o service_role.
begin;
select pg_temp.new_user('7a000000-0000-0000-0000-0000000000c1', 'recrutador', 'Obra Reprovada', '11.222.333/0001-81');
select public.set_company_verification('7a000000-0000-0000-0000-0000000000c1', 'reprovada');
create temp table t_draft (p jsonb);
grant all on t_draft to authenticated;
insert into t_draft select jsonb_build_object(
  'oficio_id', 'pedreiro', 'pay', 200, 'cep', '03307-000', 'street', 'Rua Teste', 'number', '10',
  'neighborhood', 'Tatuapé', 'city', 'São Paulo', 'uf', 'SP', 'lat', -23.54, 'lon', -46.57,
  'start_date', public.bicos_today() + 2, 'end_date', public.bicos_today() + 3, 'slots', 1, 'description', 'Reboco');
select pg_temp.login('7a000000-0000-0000-0000-0000000000c1');
select pg_temp.fails($$select public.publish_job((select p from t_draft))$$, 'BC409');
select pg_temp.fails($$select public.company_cnpj_for_check('7a000000-0000-0000-0000-0000000000c1')$$, '42501');
select pg_temp.logout();
select public.set_company_verification('7a000000-0000-0000-0000-0000000000c1', 'pendente');
select pg_temp.login('7a000000-0000-0000-0000-0000000000c1');
select pg_temp.ok(public.publish_job((select p from t_draft)) like 'BC-%', 'pendente publica');
select pg_temp.logout();
rollback;
