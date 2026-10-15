#!/usr/bin/env bash
# L08 — Build e publicação do front no Cloudflare Pages, num comando:
#   npm run deploy:staging      (variáveis de .env.staging.local, branch "staging" do Pages → prévia)
#   npm run deploy:producao     (variáveis de .env.production.local, branch "main" do Pages → domínio)
#
# Passos: build (falha sem as variáveis obrigatórias — L01) → confere que NÃO é a demonstração → envia os
# source maps ao Sentry e os apaga de dist/ (L05) → publica com o wrangler. Precisa de CLOUDFLARE_API_TOKEN
# (permissão "Cloudflare Pages: Edit") e CLOUDFLARE_ACCOUNT_ID no ambiente; SENTRY_* são opcionais.
set -euo pipefail
target="${1:?Uso: scripts/deploy.sh staging|producao}"
cd "$(dirname "$0")/.."
project="${CF_PAGES_PROJECT:-bicos}"
case "$target" in
  staging) mode=staging; branch=staging ;;
  producao)
    mode=production; branch=main
    if [ "${CONFIRMO_PRODUCAO:-}" != "sim" ]; then
      echo "Publicar em produção pede CONFIRMO_PRODUCAO=sim." >&2; exit 1
    fi ;;
  *) echo "Alvo inválido: $target (staging|producao)" >&2; exit 2 ;;
esac

npm run typecheck
npx vite build --mode "$mode"

# Armadilha 1: nunca publicar a demonstração. O build real leva a URL do Supabase; o de demonstração não.
if ! grep -rqE 'https://[a-z0-9]+\.supabase\.co' dist/assets/*.js; then
  echo "dist/ parece ser a DEMONSTRAÇÃO (sem URL do Supabase). Publicação cancelada." >&2
  exit 1
fi

node scripts/sentry-sourcemaps.mjs
npx --yes wrangler@4.20.0 pages deploy dist --project-name "$project" --branch "$branch" --commit-dirty=true
echo "Publicado ($target): branch $branch do projeto Pages \"$project\"."
