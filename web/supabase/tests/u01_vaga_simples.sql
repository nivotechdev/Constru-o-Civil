-- U01 — vaga sem ofício, sem número e sem forma de pagamento; título obrigatório; alerta e denúncia continuam.
begin;

select pg_temp.new_user('75000000-0000-0000-0000-0000000000c1', 'recrutador', 'Obra Simples', '11.222.333/0001-81');
select pg_temp.new_user('75000000-0000-0000-0000-0000000000a1', 'trabalhador', 'Quer Aviso');
-- O cadastro da construtora completo (publish_job exige).
update public.accounts set profile_completed_at = now() where id = '75000000-0000-0000-0000-0000000000c1';
-- O trabalhador tem alerta de PINTOR em São Paulo: vaga sem ofício também chega a ele.
insert into public.job_alerts (worker_id, city, uf, lat, lon, radius_km, oficio_id)
values ((select worker_id from public.accounts where id = '75000000-0000-0000-0000-0000000000a1'),
        'São Paulo', 'SP', -23.54, -46.57, null, 'pintor');

create temp table t_draft (p jsonb);
grant all on t_draft to authenticated;
-- O que a tela nova manda: sem ofício, sem número, data a combinar, sem pagamento, sem requisitos.
insert into t_draft select jsonb_build_object(
  'title', 'Reboco da fachada', 'pay', 200, 'cep', '03307-000', 'street', 'Rua Teste', 'number', '',
  'neighborhood', 'Tatuapé', 'city', 'São Paulo', 'uf', 'SP', 'lat', -23.54, 'lon', -46.57,
  'date_to_arrange', true, 'diarias', 2, 'dias', 'semana', 'slots', 3,
  'description', 'Reboco de duas paredes internas', 'requirements', '[]'::jsonb);
create temp table t_ids (k text primary key, v text);
grant all on t_ids to authenticated;

select pg_temp.login('75000000-0000-0000-0000-0000000000c1');
insert into t_ids values ('j', public.publish_job((select p from t_draft)));
-- Título obrigatório (vazio ou só espaços) e com limite.
select pg_temp.fails($$select public.publish_job((select p - 'title' from t_draft))$$, 'BC422');
select pg_temp.fails($$select public.publish_job((select p || '{"title": "   "}' from t_draft))$$, 'BC422');
select pg_temp.fails($$select public.publish_job((select p || jsonb_build_object('title', repeat('x', 61)) from t_draft))$$, 'BC422');
-- Ofício, se vier, ainda tem de existir.
select pg_temp.fails($$select public.publish_job((select p || '{"oficio_id": "astronauta"}' from t_draft))$$, 'BC422');
-- Editar uma vaga sem ofício não cria um.
select public.update_job((select v from t_ids where k = 'j'), (select p || '{"slots": 4}' from t_draft));
select pg_temp.logout();

-- (Conferido fora da sessão: número e pagamento não saem por select para a construtora.)
select pg_temp.ok((select oficio_id is null and number = '' and payment_method is null and date_to_arrange
                          and slots = 4 and title = 'Reboco da fachada'
                     from public.jobs where id = (select v from t_ids where k = 'j')),
  'publicada e editada sem ofício, sem número e sem forma de pagamento');

select pg_temp.ok(exists (select 1 from public.notifications
                           where worker_id = (select worker_id from public.accounts where id = '75000000-0000-0000-0000-0000000000a1')
                             and kind = 'bico_novo' and body like 'Reboco da fachada%'),
  'alerta com ofício recebe a vaga sem ofício, pelo título');

-- A denúncia de uma vaga sem ofício aparece com o título.
select pg_temp.ok((public.report_target_info('vaga', (select v from t_ids where k = 'j')) ->> 'title') = 'Reboco da fachada',
  'denúncia mostra o título da vaga sem ofício');

rollback;
