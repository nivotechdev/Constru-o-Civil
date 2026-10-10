-- L18 — forma de pagamento na vaga; mudar avisa os candidatos; requisitos com limite.
begin;

select pg_temp.new_user('74000000-0000-0000-0000-0000000000c1', 'recrutador', 'Obra Paga', '11.222.333/0001-81');
select pg_temp.new_user('74000000-0000-0000-0000-0000000000a1', 'trabalhador', 'Quer Saber');
create temp table t_draft (p jsonb);
grant all on t_draft to authenticated;
insert into t_draft select jsonb_build_object(
  'oficio_id', 'pedreiro', 'pay', 200, 'cep', '03307-000', 'street', 'Rua Teste', 'number', '10',
  'neighborhood', 'Tatuapé', 'city', 'São Paulo', 'uf', 'SP', 'lat', -23.54, 'lon', -46.57,
  'start_date', public.bicos_today() + 2, 'end_date', public.bicos_today() + 3, 'slots', 1,
  'description', 'Reboco', 'payment_method', 'pix_fim', 'requirements', jsonb_build_array('EPI', 'trena própria'));
create temp table t_ids (k text primary key, v text);
grant all on t_ids to authenticated;

select pg_temp.login('74000000-0000-0000-0000-0000000000c1');
insert into t_ids values ('j', public.publish_job((select p from t_draft)));
select pg_temp.ok((select payment_method = 'pix_fim' and payment_note is null from public.jobs where id = (select v from t_ids)),
  'publicada com PIX no fim do bico');
select pg_temp.fails($$select public.publish_job((select p || '{"payment_method": "outro"}' from t_draft))$$, 'BC422');
select pg_temp.fails($$select public.publish_job((select p || '{"payment_method": "cheque"}' from t_draft))$$, 'BC422');
select pg_temp.fails($$select public.publish_job((select p || jsonb_build_object('requirements',
  (select jsonb_agg('item ' || i) from generate_series(1, 13) i)) from t_draft))$$, 'BC422');
-- Sem o campo (app antigo): PIX no fim da diária.
insert into t_ids values ('antigo', public.publish_job((select p - 'payment_method' from t_draft)));
select pg_temp.ok((select payment_method = 'pix_dia' from public.jobs where id = (select v from t_ids where k = 'antigo')), 'padrão PIX no dia');
select pg_temp.logout();

-- Um candidato; a construtora muda para dinheiro: ele é avisado.
select pg_temp.login('74000000-0000-0000-0000-0000000000a1');
select public.submit_application((select v from t_ids where k = 'j'));
select pg_temp.logout();
select pg_temp.login('74000000-0000-0000-0000-0000000000c1');
select public.update_job((select v from t_ids where k = 'j'), (select p || '{"payment_method": "outro", "payment_note": "Metade no início, metade no fim"}' from t_draft));
select pg_temp.logout();
select pg_temp.ok((select payment_method = 'outro' and payment_note = 'Metade no início, metade no fim'
                     from public.jobs where id = (select v from t_ids where k = 'j')), 'pagamento editado');
select pg_temp.ok(exists (select 1 from public.notifications where worker_id = '74000000-0000-0000-0000-0000000000a1'
                            and kind = 'vaga_editada' and body like '%pagamento%'), 'candidato avisado da mudança');

rollback;
