-- L09 (lançamento): pg_net sai do schema `public` (aviso `extension_in_public` do advisor).
--
-- Na produção o pg_net foi ligado em 12/10 pelo conector (migration 20261012033541_habilitar_pg_net, que só
-- existe lá) e caiu no `public`. A extensão não é relocável (`alter extension … set schema` não funciona):
-- o caminho é apagar e criar de novo no `extensions`. As funções dela continuam em `net.*` — o schema `net`
-- é dela, não do `public` —, então push_new_notification e call_storage_cleanup (que chamam
-- `net.http_post` por `execute`, sem depender do objeto) não mudam.
--
-- O que se perde: a fila de chamadas ainda não enviadas e as respostas guardadas (net.http_request_queue e
-- net._http_response), que são passageiras. Rodar fora do horário dos crons que usam a rede (4h40, 21h).
-- Sem `cascade`: se algo novo depender do pg_net, a migration para em vez de apagar junto.
-- Banco sem pg_net instalado (testes locais): liga no `extensions`, como no staging e na produção.

do $$
declare
  v_schema text;
begin
  select n.nspname into v_schema
    from pg_extension e join pg_namespace n on n.oid = e.extnamespace
   where e.extname = 'pg_net';
  if v_schema = 'extensions' then
    return;
  end if;
  if v_schema is not null then
    execute 'drop extension pg_net';
  end if;
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    execute 'create extension pg_net with schema extensions';
  end if;
end $$;
