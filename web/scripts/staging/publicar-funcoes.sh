#!/usr/bin/env bash
# L02 — Publica as 8 Edge Functions num projeto (staging por padrão). As chamadas pelo banco ou por um provedor
# (sem JWT) conferem um segredo próprio e vão com --no-verify-jwt, como na produção (docs/SUPABASE.md › 4).
#
# Uso: SUPABASE_ACCESS_TOKEN=<token pessoal> STAGING_REF=<ref do projeto> ./scripts/staging/publicar-funcoes.sh
# Os segredos de cada função (APP_ORIGIN etc.) vão antes, com:
#   npx supabase secrets set --project-ref "$STAGING_REF" --env-file supabase/functions/.env.staging
set -euo pipefail
: "${STAGING_REF:?Defina STAGING_REF (ref do projeto de staging)}"
if [ "$STAGING_REF" = "ppnxdajiihsjaojxokzh" ] && [ "${CONFIRMO_PRODUCAO:-}" != "sim" ]; then
  echo "Esse é o ref da PRODUÇÃO. Para publicar lá, rode com CONFIRMO_PRODUCAO=sim (só com aprovação)." >&2
  exit 1
fi
cd "$(dirname "$0")/../.."
cli="${SUPABASE_CLI:-npx --yes supabase}"
with_jwt=(entrar-com-documento excluir-conta codigo-whatsapp verificar-cnpj criar-cobranca)
without_jwt=(webhook-pagamento enviar-push limpar-arquivos)
for f in "${with_jwt[@]}"; do
  echo "→ $f"
  $cli functions deploy "$f" --project-ref "$STAGING_REF"
done
for f in "${without_jwt[@]}"; do
  echo "→ $f (sem JWT)"
  $cli functions deploy "$f" --project-ref "$STAGING_REF" --no-verify-jwt
done
echo "8 funções publicadas em $STAGING_REF."
