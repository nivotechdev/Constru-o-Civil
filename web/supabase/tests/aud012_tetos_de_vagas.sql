-- AUD-012 — tetos por empresa (sem selo: 10 abertas e 3 por dia; com selo: 30 e 10) e "urgente" só por impulso pago.
begin;
select pg_temp.new_user('96000000-0000-0000-0000-000000000bc1', 'recrutador', 'Empresa Sem Selo', '51.826.049/0001-39');
select pg_temp.new_user('96000000-0000-0000-0000-000000000bc2', 'recrutador', 'Empresa Com Selo', '45.723.174/0001-10');
update public.accounts set profile_completed_at = now() where id in
  ('96000000-0000-0000-0000-000000000bc1', '96000000-0000-0000-0000-000000000bc2');
select public.set_company_verification('96000000-0000-0000-0000-000000000bc2', 'verificada');
create temp table t_draft (p jsonb);
grant all on t_draft to authenticated;
insert into t_draft select jsonb_build_object(
  'title', 'Garçom para festa', 'pay', 150, 'cep', '95020-000', 'street', 'Rua Sinimbu', 'number', '120',
  'neighborhood', 'Centro', 'city', 'Caxias do Sul', 'uf', 'RS', 'lat', -29.1688, 'lon', -51.1787,
  'date_to_arrange', true, 'diarias', 2, 'slots', 1, 'weekdays', '[6, 7]'::jsonb, 'place_type', 'comercio',
  'description', 'Servir as mesas numa festa de aniversário', 'requirements', '[]'::jsonb);
create temp table t_ids (k text primary key, v text);
grant all on t_ids to authenticated;

-- Por dia, sem selo: 3 passam, a 4ª não.
select pg_temp.login('96000000-0000-0000-0000-000000000bc1');
insert into t_ids values ('a1', public.publish_job((select p from t_draft)));
insert into t_ids values ('a2', public.publish_job((select p from t_draft)));
insert into t_ids values ('a3', public.publish_job((select p || '{"urgent": true}' from t_draft)));
select pg_temp.fails($$select public.publish_job((select p from t_draft))$$, 'BC409');
select pg_temp.logout();
-- "Urgente" no pedido é ignorado.
select pg_temp.ok((select not urgent from public.jobs where id = (select v from t_ids where k = 'a3')), 'urgent do pedido ignorado');
select pg_temp.ok((select (j->>'_rank')::int = 2 from public.feed_jobs('Caxias do Sul', 'RS', -29.1688, -51.1787) j
                    where j->>'id' = (select v from t_ids where k = 'a3')), 'no mural não sobe como urgente');

-- Abertas, sem selo: com o teto diário alto, a 11ª aberta é recusada.
insert into public.app_config (key, value) values ('jobs_per_day_unverified', '100')
  on conflict (key) do update set value = excluded.value;
select pg_temp.login('96000000-0000-0000-0000-000000000bc1');
do $$ begin
  for i in 4..10 loop
    perform public.publish_job((select p from t_draft));
  end loop;
end $$;
select pg_temp.fails($$select public.publish_job((select p from t_draft))$$, 'BC409');
select pg_temp.logout();
select pg_temp.ok((select count(*) = 10 from public.jobs where company_id = '96000000-0000-0000-0000-000000000bc1'), 'dez abertas, nenhuma a mais');

-- Com selo: o teto é maior (30 abertas e 10 por dia).
select pg_temp.login('96000000-0000-0000-0000-000000000bc2');
do $$ begin
  for i in 1..10 loop
    perform public.publish_job((select p from t_draft));
  end loop;
end $$;
select pg_temp.fails($$select public.publish_job((select p from t_draft))$$, 'BC409');
select pg_temp.logout();
select pg_temp.ok((select count(*) = 10 from public.jobs where company_id = '96000000-0000-0000-0000-000000000bc2'), 'com selo: dez no dia');

-- Editar uma vaga não liga o urgente nem mexe no que já era.
select pg_temp.login('96000000-0000-0000-0000-000000000bc1');
select public.update_job((select v from t_ids where k = 'a1'), (select p || '{"urgent": true}' from t_draft));
select pg_temp.logout();
select pg_temp.ok((select not urgent from public.jobs where id = (select v from t_ids where k = 'a1')), 'editar não liga o urgente');
rollback;
