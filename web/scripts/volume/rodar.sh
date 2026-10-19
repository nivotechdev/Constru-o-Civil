#!/usr/bin/env bash
# L13 — Teste de volume do mural: popula dados sintéticos, mede o feed_jobs e APAGA tudo no fim (mesmo se a
# medição falhar). Só staging ou banco local — recusa a produção.
#
#   DB_URL='postgresql://postgres.<ref-do-staging>:<senha>@aws-0-sa-east-1.pooler.supabase.com:5432/postgres' \
#     ./scripts/volume/rodar.sh
#
# Para ver o plano de uma consulta antes de apagar: MANTER=1 (e depois rode apagar.sql à mão).
set -euo pipefail
: "${DB_URL:?Defina DB_URL (staging ou local — nunca a produção)}"
case "$DB_URL" in
  *ppnxdajiihsjaojxokzh*) echo "Recusado: essa é a conexão da PRODUÇÃO." >&2; exit 1 ;;
esac
here="$(cd "$(dirname "$0")" && pwd)"
psql_() { psql "$DB_URL" -X -q -v ON_ERROR_STOP=1 "$@"; }

if [ "$(psql_ -tAc "select count(*) from auth.users where email like 'volume+%@bicos.invalid'")" != "0" ]; then
  echo "Já há dados de volume no banco: rode apagar.sql antes." >&2
  exit 1
fi
limpar() { [ "${MANTER:-}" = "1" ] || { echo "→ apagando os dados sintéticos"; psql_ -f "$here/apagar.sql"; }; }
trap limpar EXIT

echo "→ populando (50 construtoras, 2.000 trabalhadores, 2.000 vagas, 20.000 candidaturas)"
time psql_ -f "$here/popular.sql"
echo "→ medindo o feed_jobs (6 cenários × 50 chamadas)"
psql_ -f "$here/medir.sql"
