-- AUD-018 — "Exportar meus dados" traz tudo o que a Bicos guarda sobre a pessoa: preferências, alertas, convites,
-- bloqueios (só o id e a data), denúncias que ela fez, o que ela escreveu, as notificações push. E um teste que percorre
-- o catálogo e falha quando uma tabela nova com coluna de dono não está na exportação nem na lista de exceções.
begin;
select pg_temp.new_user('96000000-0000-0000-0000-000000000dc1', 'recrutador', 'Empresa Exporta', '51.826.049/0001-39');
select pg_temp.new_user('96000000-0000-0000-0000-000000000da1', 'trabalhador', 'Ana Exporta');
select pg_temp.new_user('96000000-0000-0000-0000-000000000da2', 'trabalhador', 'Bia Bloqueada');
create temp table t_ids (k text primary key, v text);
grant all on t_ids to authenticated;
insert into t_ids values ('vaga', pg_temp.new_job('96000000-0000-0000-0000-000000000dc1'));
insert into public.applications (job_id, worker_id, status) values
  ((select v from t_ids where k = 'vaga'), '96000000-0000-0000-0000-000000000da1', 'concluida');
insert into public.reviews (application_id, direction, company_id, author_label, value, tags, comment)
  select id, 'para_construtora', '96000000-0000-0000-0000-000000000dc1', 'Ana E.', 5, '{}', 'Gostei muito' from public.applications;
insert into public.account_prefs (account_id, theme) values ('96000000-0000-0000-0000-000000000da1', 'escuro')
  on conflict (account_id) do update set theme = excluded.theme;
insert into public.notification_prefs (account_id, muted_groups) values ('96000000-0000-0000-0000-000000000da1', array['bicos_novos'])
  on conflict (account_id) do update set muted_groups = excluded.muted_groups;
insert into public.job_alerts (worker_id, city, uf, lat, lon) values
  ('96000000-0000-0000-0000-000000000da1', 'Caxias do Sul', 'RS', -29.17, -51.18);
insert into public.blocks (blocker_id, blocked_id) values
  ('96000000-0000-0000-0000-000000000da1', '96000000-0000-0000-0000-000000000da2');
insert into public.reports (reporter_id, target_type, target_id, reason)
  values ('96000000-0000-0000-0000-000000000da1', 'vaga', (select v from t_ids where k = 'vaga'), 'golpe');
insert into public.push_subscriptions (endpoint, account_id, p256dh, auth, user_agent)
  values ('https://push.example/xyz', '96000000-0000-0000-0000-000000000da1', repeat('k', 24), repeat('a', 12), 'Firefox');

create temp table t_export (j jsonb);
grant all on t_export to authenticated;
select pg_temp.login('96000000-0000-0000-0000-000000000da1');
insert into t_export select public.export_my_data();
select pg_temp.logout();

select pg_temp.ok((select j #>> '{preferencias,tema,theme}' = 'escuro' and j #>> '{preferencias,avisos,muted_groups}' like '%bicos_novos%' from t_export),
                  'preferências (tema e avisos)');
select pg_temp.ok((select jsonb_array_length(j -> 'alertas_de_vaga') = 1 from t_export), 'alertas de vaga');
select pg_temp.ok((select jsonb_array_length(j -> 'bloqueios') = 1
                          and (j #> '{bloqueios,0}') ? 'bloqueado' and (j #> '{bloqueios,0}') ? 'em'
                          and not (j #> '{bloqueios,0}') ? 'blocker_id' from t_export),
                  'bloqueios: só o id bloqueado e a data');
select pg_temp.ok((select jsonb_array_length(j -> 'denuncias_feitas') = 1 from t_export), 'denúncias que ela fez');
select pg_temp.ok((select jsonb_array_length(j -> 'avaliacoes_escritas') = 1
                          and j #>> '{avaliacoes_escritas,0,comment}' = 'Gostei muito' from t_export),
                  'avaliações que ela escreveu');
select pg_temp.ok((select jsonb_array_length(j -> 'notificacoes_push') = 1
                          and not (j #> '{notificacoes_push,0}') ? 'p256dh' and not (j #> '{notificacoes_push,0}') ? 'auth'
                          and not (j #> '{notificacoes_push,0}') ? 'endpoint' from t_export),
                  'push: aparelho e datas, sem chaves nem endereço');

-- O catálogo: toda tabela com coluna de dono aparece na exportação ou está na lista de exceções.
select pg_temp.ok(not exists (
  select 1
    from information_schema.columns c
    join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
   where c.table_schema = 'public'
     and c.column_name in ('worker_id', 'company_id', 'account_id', 'user_id', 'reporter_id', 'blocker_id')
     and c.table_name not in ('application_attempts', 'staff_members', 'accounts', 'cron_alerts')
     and pg_get_functiondef('public.export_my_data()'::regprocedure) !~ ('public\.' || c.table_name || '\M')
), 'toda tabela com dono está na exportação (ou na lista de exceções)');
rollback;
