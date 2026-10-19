#!/usr/bin/env bash
# L09 — Confere se o histórico de migrations de um banco (supabase_migrations.schema_migrations) é IGUAL aos
# arquivos de web/supabase/migrations: nem arquivo sem aplicar, nem migration aplicada que não está no repo
# (foi o caso do 20261012033541_habilitar_pg_net na produção). Só lê; sai com erro se houver diferença.
#
#   DB_URL='postgresql://postgres.<ref>:<senha>@aws-0-sa-east-1.pooler.supabase.com:5432/postgres' \
#     ./scripts/staging/conferir-migrations.sh
#
# Roda no CI contra o staging (.github/workflows/staging.yml). Na produção só bate depois do `repair` de
# supabase/APLICAR.md › "Histórico de migrations".
set -euo pipefail
: "${DB_URL:?Defina DB_URL (conexão do banco a conferir)}"
here="$(cd "$(dirname "$0")" && pwd)"
dir="$(cd "$here/../../supabase/migrations" && pwd)"

arquivos="$(for f in "$dir"/*.sql; do b="$(basename "$f" .sql)"; echo "${b%%_*}"; done | sort)"
banco="$(psql "$DB_URL" -v ON_ERROR_STOP=1 -tAc 'select version from supabase_migrations.schema_migrations order by 1')"

faltam="$(comm -23 <(echo "$arquivos") <(echo "$banco") | sed '/^$/d')"
sobram="$(comm -13 <(echo "$arquivos") <(echo "$banco") | sed '/^$/d')"
if [ -z "$faltam" ] && [ -z "$sobram" ]; then
  echo "Histórico igual aos arquivos: $(echo "$arquivos" | wc -l | tr -d ' ') migrations."
  exit 0
fi
if [ -n "$faltam" ]; then
  echo "::error::Migrations do repo que NÃO estão no banco (aplicar no staging antes da produção):"
  for v in $faltam; do echo "  $(basename "$(ls "$dir"/"$v"_*.sql)")"; done
fi
if [ -n "$sobram" ]; then
  echo "::error::Migrations no banco que NÃO estão no repo (alguém aplicou direto — traga para o repo):"
  echo "$sobram" | sed 's/^/  /'
fi
exit 1
