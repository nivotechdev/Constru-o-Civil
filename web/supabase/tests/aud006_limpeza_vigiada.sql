-- AUD-006 — a limpeza diária do Storage não pode falhar em silêncio:
--   * sem URL/segredo no Vault, call_storage_cleanup grava um alerta (no máximo 1 a cada 24 h);
--   * a chamada à Edge Function é registrada e, se a resposta não for 2xx (ou nunca chegar), vira alerta;
--   * saúde: arquivo de identidade que devia ter saído há dias aparece em storage_cleanup_overdue().
begin;
select pg_temp.ok(not has_function_privilege('authenticated', 'public.check_cron_http_calls()', 'execute')
                  and not has_function_privilege('anon', 'public.storage_cleanup_overdue()', 'execute'),
                  'só a equipe (service_role) vê');
delete from public.cron_alerts;

-- Sem configuração: alerta, uma vez só por dia.
select public.call_storage_cleanup();
select pg_temp.ok((select count(*) from public.cron_alerts where jobname = 'bicos-limpar-arquivos'
                    and message like '%não está configurada%') = 1, 'sem segredo: alerta registrado');
select public.call_storage_cleanup();
select pg_temp.ok((select count(*) from public.cron_alerts where jobname = 'bicos-limpar-arquivos') = 1,
                  'o alerta não se repete no mesmo dia');

-- Configurada: a chamada sai e fica registrada.
select vault.create_secret('https://exemplo.test/functions/v1/limpar-arquivos', 'bicos_cleanup_url');
select vault.create_secret('segredo-de-teste', 'bicos_cleanup_secret');
select public.call_storage_cleanup();
select pg_temp.ok((select count(*) from net.http_request_queue where url = 'https://exemplo.test/functions/v1/limpar-arquivos') = 1,
                  'chamada enviada');
select pg_temp.ok((select count(*) from public.cron_http_calls where jobname = 'bicos-limpar-arquivos') = 1,
                  'chamada registrada');

-- Resposta 401 (segredo errado na função): alerta com o código HTTP, sem repetir.
update public.cron_http_calls set called_at = now() - interval '10 minutes';
insert into net._http_response (id, status_code, content, created)
  select request_id, 401, '{"erro":"segredo"}', now() - interval '9 minutes' from public.cron_http_calls;
delete from public.cron_alerts;
select pg_temp.ok(public.check_cron_http_calls() = 1, 'resposta 401 alerta');
select pg_temp.ok((select message like '%HTTP 401%' from public.cron_alerts where jobname = 'bicos-limpar-arquivos'),
                  'a mensagem diz o código');
select pg_temp.ok(public.check_cron_http_calls() = 0, 'a mesma chamada não alerta duas vezes');

-- Resposta 200: nada. Sem resposta depois de 3 horas: alerta.
select public.call_storage_cleanup();
update public.cron_http_calls set called_at = now() - interval '10 minutes' where not checked;
insert into net._http_response (id, status_code, content, created)
  select request_id, 200, '{"apagados":0}', now() from public.cron_http_calls where not checked;
select pg_temp.ok(public.check_cron_http_calls() = 0, 'resposta 200 não alerta');
select public.call_storage_cleanup();
update public.cron_http_calls set called_at = now() - interval '4 hours' where not checked;
delete from public.cron_alerts;
select pg_temp.ok(public.check_cron_http_calls() = 1, 'sem resposta em 3 horas alerta');

-- Saúde: arquivo de identidade que já devia ter saído.
select pg_temp.new_user('7d000000-0000-0000-0000-0000000000d1', 'trabalhador', 'Davi Dia');
insert into storage.objects (bucket_id, name, created_at) values
  ('identidade', '7d000000-0000-0000-0000-0000000000d1/solta.jpg', now() - interval '5 days'),
  ('identidade', '7d000000-0000-0000-0000-0000000000d1/nova.jpg', now() - interval '1 hour');
select pg_temp.ok(public.storage_cleanup_overdue() = 1, 'só a solta há 5 dias está atrasada');
delete from public.cron_alerts;
select pg_temp.ok(public.check_cron_http_calls() = 1, 'atraso da limpeza alerta');
select pg_temp.ok(exists (select 1 from public.cron_alerts where message like '%atrasada%'), 'o alerta diz que está atrasada');
rollback;
