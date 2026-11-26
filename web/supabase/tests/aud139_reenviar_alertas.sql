-- AUD-139 — alerta que não saiu (sem chave do Sentry) é reenviado quando a chave passa a existir.
begin;
select pg_temp.ok(not has_function_privilege('authenticated', 'public.resend_pending_cron_alerts()', 'execute'),
                  'só a equipe (service_role) chama');
delete from public.cron_alerts;
insert into public.cron_alerts (jobname, runid, message, sent) values
  ('bicos-teste', 1, 'Rotina bicos-teste falhou', false),
  ('bicos-velho', 2, 'alerta de há 10 dias', false),
  ('bicos-ok', 3, 'já enviado', true);
update public.cron_alerts set alerted_at = now() - interval '10 days' where jobname = 'bicos-velho';

-- Sem a chave no Vault: nada sai e o alerta continua pendente.
select pg_temp.ok(public.resend_pending_cron_alerts() = 0, 'sem chave: nada enviado');
select pg_temp.ok((select not sent from public.cron_alerts where jobname = 'bicos-teste'), 'continua pendente');

-- Com a chave: o pendente de até 7 dias sai; o velho e o já enviado ficam como estavam.
select vault.create_secret('https://abc@o1.ingest.sentry.io/123', 'bicos_sentry_dsn');
select pg_temp.ok(public.resend_pending_cron_alerts() = 1, 'com chave: um alerta reenviado');
select pg_temp.ok((select sent from public.cron_alerts where jobname = 'bicos-teste'), 'marcado como enviado');
select pg_temp.ok((select not sent from public.cron_alerts where jobname = 'bicos-velho'), 'o de 10 dias não é reenviado');
select pg_temp.ok(public.resend_pending_cron_alerts() = 0, 'depois de enviado não se repete');
rollback;
