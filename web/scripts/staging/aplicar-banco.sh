#!/usr/bin/env bash
# L02 — Monta o banco de um projeto Supabase NOVO (staging) igual ao da produção, na mesma ordem dos testes
# SQL (supabase/tests/local/setup.sh): extensões → migrations do app antigo (web/supabase/legado/0*.sql, que
# as novas ainda usam) → migrations do app (web/supabase/migrations). Cada migration do app é registrada no
# histórico (supabase_migrations.schema_migrations) com a versão do ARQUIVO — o mesmo que a produção terá
# depois do `repair` de APLICAR.md — para `list_migrations` dar igual nos dois.
#
# Uso (a senha do banco fica em Project Settings › Database; nunca versionar):
#   STAGING_DB_URL='postgresql://postgres.<ref>:<senha>@aws-0-sa-east-1.pooler.supabase.com:5432/postgres' \
#     ./scripts/staging/aplicar-banco.sh
# Rodar de novo é seguro: migrations já registradas são puladas.
#
# STAGING_URL (https://<ref>.supabase.co) é obrigatório: a migration Z12 grava o endereço do Storage da PRODUÇÃO
# em app_config.storage_public_base, e o banco só aceita fotos desse endereço — sem trocar, toda foto do
# staging seria recusada (achado pelo E2E, L03).
set -euo pipefail
: "${STAGING_DB_URL:?Defina STAGING_DB_URL (conexão do projeto de staging — nunca a da produção)}"
: "${STAGING_URL:?Defina STAGING_URL (https://<ref-do-staging>.supabase.co)}"
case "$STAGING_DB_URL" in
  *ppnxdajiihsjaojxokzh*) echo "Recusado: essa é a conexão da PRODUÇÃO." >&2; exit 1 ;;
esac
here="$(cd "$(dirname "$0")" && pwd)"
web="$(cd "$here/../.." && pwd)"
export PGOPTIONS="-c client_min_messages=warning"
psql_() { psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 -q "$@"; }

echo "→ extensões e histórico"
psql_ <<'SQL'
create extension if not exists pg_cron;
create extension if not exists pg_net;
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);
SQL

# O app antigo nunca entrou no histórico da produção: aplica enquanto o app novo não começou (sem `accounts`).
# As migrations antigas são idempotentes, então completam um banco que parou no meio delas; depois que o app
# novo existe, nunca rodam de novo (devolveriam permissões que a Z08 tirou).
if [ "$(psql_ -tAc "select to_regclass('public.accounts') is null")" = "t" ]; then
  for f in "$web"/supabase/legado/0*.sql; do
    echo "→ (app antigo) $(basename "$f")"
    psql_ -f "$f"
  done
fi

for f in "$web"/supabase/migrations/*.sql; do
  base="$(basename "$f" .sql)"
  version="${base%%_*}"
  name="${base#*_}"
  if [ "$(psql_ -tAc "select count(*) from supabase_migrations.schema_migrations where version = '$version'")" != "0" ]; then
    continue
  fi
  echo "→ $base"
  # Como no setup dos testes: o arquivo inteiro, parando no primeiro erro (alguns criam valor de enum e o usam
  # logo depois, o que não cabe numa transação só). As migrations são idempotentes: se falhar no meio, corrija
  # e rode de novo — o histórico só ganha a linha depois que o arquivo inteiro passou.
  psql_ -f "$f"
  psql_ -c "insert into supabase_migrations.schema_migrations (version, name) values ('$version', '$name')"
done
echo "→ endereço do Storage deste projeto (app_config.storage_public_base)"
psql_ -c "update public.app_config set value = '${STAGING_URL%/}/storage/v1/object/public/' where key = 'storage_public_base'"
echo "Banco de staging em dia: $(psql_ -tAc 'select count(*) from supabase_migrations.schema_migrations') migrations no histórico."

# R05: o mesmo que o advisor `rls_disabled_in_public` (ERROR): nenhuma tabela do public sem RLS — nem as do app
# antigo, nem uma que tenha sobrado de uma montagem que parou no meio. Sem RLS, a tabela inteira sai pela API.
echo "→ conferência: RLS em todas as tabelas do public"
sem_rls="$(psql_ -tAc "select string_agg(c.relname, ', ' order by c.relname) from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity")"
if [ -n "$sem_rls" ]; then
  echo "ERRO: tabelas do public sem RLS (expostas pela API): $sem_rls" >&2
  exit 1
fi
echo "   $(psql_ -tAc "select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p')") tabelas, todas com RLS."
DB_URL="$STAGING_DB_URL" "$here/conferir-migrations.sh"
