-- L09 (lançamento) — pg_net fora do `public`, funções em `net.*`, avisos e limpeza continuam chamando a rede.
begin;
select pg_temp.ok((select n.nspname from pg_extension e join pg_namespace n on n.oid = e.extnamespace
                    where e.extname = 'pg_net') = 'extensions', 'pg_net no schema extensions');
select pg_temp.ok(not exists (select 1 from pg_extension e join pg_namespace n on n.oid = e.extnamespace
                               where n.nspname = 'public'), 'nenhuma extensão no public');
select pg_temp.ok(to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is not null, 'net.http_post continua em net');

-- A limpeza diária chama a função pela rede quando o Vault tem a URL e o segredo.
select vault.create_secret('https://exemplo.invalid/functions/v1/limpar-arquivos', 'bicos_cleanup_url');
select vault.create_secret('segredo-limpeza', 'bicos_cleanup_secret');
select public.call_storage_cleanup();
select pg_temp.ok((select count(*) from net.http_request_queue
                    where url = 'https://exemplo.invalid/functions/v1/limpar-arquivos'
                      and headers ->> 'x-webhook-secret' = 'segredo-limpeza') = 1, 'limpeza enfileira a chamada');
rollback;
