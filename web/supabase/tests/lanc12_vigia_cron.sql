-- L12 (lançamento) — 2 falhas seguidas de uma rotina viram alerta (Sentry pelo pg_net), sem dado pessoal,
-- no máximo 1 por dia; uma falha só não alerta; cron_health mostra o estado.
begin;
select pg_temp.ok(exists (select 1 from cron.job where jobname = 'bicos-vigiar-cron' and schedule = '12 * * * *'),
                  'vigia agendado de hora em hora');
select pg_temp.ok(not has_function_privilege('authenticated', 'public.cron_health()', 'execute')
                  and not has_function_privilege('anon', 'public.check_cron_failures()', 'execute'),
                  'só a equipe (service_role) vê');
set local role authenticated;
select pg_temp.fails($$select * from public.cron_alerts$$, '42501');
reset role;

create or replace function pg_temp.run(p_job text, p_status text, p_msg text, p_ago interval) returns void
language sql as $$
  insert into cron.job_run_details (jobid, runid, job_pid, database, username, command, status, return_message, start_time, end_time)
  select jobid, (select coalesce(max(runid), 0) + 1 from cron.job_run_details), 1, 'postgres', 'postgres', command,
         p_status, p_msg, now() - p_ago, now() - p_ago
    from cron.job where jobname = p_job
$$;
delete from cron.job_run_details;

-- Uma falha só: nada. Duas seguidas: alerta. Sucesso no meio zera a contagem.
select pg_temp.run('bicos-vencer-pix', 'failed', 'erro qualquer', '30 minutes');
select pg_temp.run('bicos-concluir-diarias', 'failed', 'primeira', '3 hours');
select pg_temp.run('bicos-concluir-diarias', 'succeeded', '1 row', '2 hours');
select pg_temp.run('bicos-concluir-diarias', 'failed', 'segunda', '1 hour');
select pg_temp.ok(public.check_cron_failures() = 0, 'uma falha só não alerta');

select pg_temp.run('bicos-vencer-pix', 'failed',
  'duplicate key: Key (email, document)=(ana.souza@gmail.com, 123.456.789-09) whatsapp (11) 98765-4321', '20 minutes');
select pg_temp.ok((select failures_in_a_row from public.cron_health() where jobname = 'bicos-vencer-pix') = 2,
                  'cron_health conta as falhas seguidas');
select pg_temp.ok((select last_status from public.cron_health() where jobname = 'bicos-concluir-diarias') = 'failed',
                  'cron_health mostra a última');

-- Com o DSN do Sentry no Vault, o alerta vira uma chamada ao Sentry.
select vault.create_secret('https://chavepublica@o123.ingest.sentry.io/4507', 'bicos_sentry_dsn');
select pg_temp.ok(public.check_cron_failures() = 1, '2 falhas seguidas alertam');
select pg_temp.ok((select sent and jobname = 'bicos-vencer-pix' from public.cron_alerts), 'alerta registrado e enviado');
select pg_temp.ok((select message !~ '(ana\.souza|123\.456|98765)' and message ~ '\[email\]' and message ~ '\[número\]'
                     from public.cron_alerts), 'sem dado pessoal na mensagem');
select pg_temp.ok((select count(*) from net.http_request_queue
                    where url = 'https://o123.ingest.sentry.io/api/4507/store/'
                      and headers ->> 'X-Sentry-Auth' like '%sentry_key=chavepublica%'
                      and convert_from(body, 'utf8')::jsonb #>> '{tags,job}' = 'bicos-vencer-pix') = 1,
                  'evento no endpoint do Sentry com a chave do DSN');
select pg_temp.ok((select convert_from(body, 'utf8')::jsonb ->> 'message' from net.http_request_queue
                    where url like '%sentry%') !~ 'ana\.souza', 'o evento também vai limpo');

-- Continua falhando: não repete o alerta no mesmo dia.
select pg_temp.run('bicos-vencer-pix', 'failed', 'de novo', '10 minutes');
select pg_temp.ok(public.check_cron_failures() = 0, 'um alerta por rotina a cada 24 h');

-- Sinal de vida para o monitor de fora, a cada execução.
select vault.create_secret('https://hc-ping.com/abc-123', 'bicos_heartbeat_url');
select public.check_cron_failures();
select pg_temp.ok((select count(*) from net.http_request_queue where url = 'https://hc-ping.com/abc-123' and method = 'GET') = 1,
                  'sinal de vida enviado');

-- Histórico do pg_cron mais velho que 14 dias sai.
select pg_temp.run('bicos-limpar-cadastros', 'succeeded', 'velho', '20 days');
select public.check_cron_failures();
select pg_temp.ok(not exists (select 1 from cron.job_run_details where return_message = 'velho'), 'histórico antigo apagado');
rollback;
