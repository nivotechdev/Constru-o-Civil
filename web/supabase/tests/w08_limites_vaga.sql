-- W08 — diária até R$ 5.000, descrição de 20 a 1000 letras, turno da noite aceito, início = fim recusado.
begin;
select pg_temp.new_user('7d000000-0000-0000-0000-0000000000c8', 'recrutador', 'Obra Limites', '11.222.333/0001-81');
create temp table t_draft as select jsonb_build_object(
  'oficio_id', (select id from public.oficios limit 1), 'title', 'Reboco de parede', 'pay', 200, 'cep', '01310-100', 'street', 'Avenida Paulista',
  'number', '1000', 'neighborhood', 'Bela Vista', 'city', 'São Paulo', 'uf', 'SP', 'lat', -23.56, 'lon', -46.65,
  'date_to_arrange', false, 'start_date', public.bicos_today() + 2, 'end_date', public.bicos_today() + 3,
  'slots', 1, 'description', 'Reboco de duas paredes internas', 'start_time', '22:00', 'end_time', '06:00') as d;
grant select on t_draft to authenticated;
select pg_temp.login('7d000000-0000-0000-0000-0000000000c8');
select pg_temp.ok(public.publish_job((select d from t_draft)) is not null, 'turno da noite publica');
select pg_temp.fails($$select public.publish_job((select d || '{"pay": 50000}' from t_draft))$$, 'BC422');
select pg_temp.fails($$select public.publish_job((select d || '{"description": "Reboco"}' from t_draft))$$, 'BC422');
select pg_temp.fails($$select public.publish_job((select d || jsonb_build_object('description', repeat('x', 1001)) from t_draft))$$, 'BC422');
select pg_temp.fails($$select public.publish_job((select d || '{"end_time": "22:00"}' from t_draft))$$, 'BC422');
rollback;
