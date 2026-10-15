#!/usr/bin/env bash
# L07 — Exporta as tabelas do app antigo (dados e estrutura) para um arquivo, ANTES de apagá-las
# (supabase/pendentes/…_lanc07_apagar_app_antigo.sql). O arquivo tem dados pessoais (nome, e-mail, documento
# cifrado): guarde num cofre fora do repositório e apague quando o prazo de guarda decidido com o advogado acabar.
#
#   DATABASE_URL='postgresql://postgres.<ref>:<senha>@aws-0-sa-east-1.pooler.supabase.com:5432/postgres' \
#     ./scripts/exportar-app-antigo.sh  [arquivo-de-saída]
# O pg_dump precisa ser da versão 17 (a do banco). Sem ele instalado:
#   PG_DUMP='docker run --rm -i --network host postgres:17 pg_dump' ./scripts/exportar-app-antigo.sh
set -euo pipefail
: "${DATABASE_URL:?Defina DATABASE_URL (conexão do banco — Project Settings › Database)}"
out="${1:-$HOME/bicos-app-antigo-$(date +%Y%m%d-%H%M).sql}"
if git -C "$(dirname "$out")" rev-parse >/dev/null 2>&1; then
  echo "Salve fora do repositório (o arquivo tem dados pessoais): passe um caminho como ~/backup/app-antigo.sql" >&2
  exit 1
fi
tables=(profiles vagas candidaturas avaliacoes vagas_salvas publicacoes_trabalhador consentimentos)
args=()
for t in "${tables[@]}"; do args+=(--table "public.$t"); done
${PG_DUMP:-pg_dump} "$DATABASE_URL" --no-owner --no-privileges "${args[@]}" > "$out"
echo "Exportado: $out ($(grep -c '^COPY ' "$out") tabelas com dados). Guarde fora do repositório."
