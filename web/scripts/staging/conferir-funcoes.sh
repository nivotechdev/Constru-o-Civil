#!/usr/bin/env bash
# R08/R09 — Chama cada Edge Function uma vez e confere a resposta esperada (docs/IMPLANTACAO.md › passo 5), o CORS
# (a origem de teste passa; uma estranha não) e o Authentication. Serve para o staging e, depois do "pode", para a
# produção. Só leitura: nenhuma chamada muda dado.
#
#   FUNCTIONS_URL=https://<ref>.supabase.co ANON_KEY=… ALLOWED_ORIGIN=http://localhost:4173 ./scripts/staging/conferir-funcoes.sh
set -uo pipefail
: "${FUNCTIONS_URL:?}" "${ANON_KEY:?}" "${ALLOWED_ORIGIN:?}"
falhas=0
ok() { echo "  ✓ $1"; }
ruim() { echo "  ✗ $1"; falhas=$((falhas + 1)); }

chama() { # nome, cabeçalho extra → grava o corpo em /tmp/fn.out e devolve o código
  curl -s -m 30 -o /tmp/fn.out -w "%{http_code}" -X POST \
    -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" -H "Content-Type: application/json" \
    ${2:+-H "$2"} -d '{}' "$FUNCTIONS_URL/functions/v1/$1"
}
espera() { # nome, códigos aceitos (separados por |), cabeçalho extra
  local code; code="$(chama "$1" "${3:-}")"
  if [[ "|$2|" == *"|$code|"* ]]; then ok "$1 → $code"; else ruim "$1 → $code (esperado $2) $(head -c 120 /tmp/fn.out)"; fi
}

echo "Funções chamadas pelo navegador (sem login de pessoa: recusam, nunca 5xx):"
espera entrar-com-documento "400|401|403|422"
espera excluir-conta "401"
espera codigo-whatsapp "401|404|503"
espera verificar-cnpj "401"
espera criar-cobranca "401|503"
echo "Funções do servidor (sem o segredo delas):"
espera webhook-pagamento "503|401"
espera enviar-push "401" "x-webhook-secret: errado"
espera limpar-arquivos "401" "x-webhook-secret: errado"

echo "CORS (verificar-cnpj):"
pf() { curl -s -m 30 -i -X OPTIONS -H "Origin: $1" -H "Access-Control-Request-Method: POST" "$FUNCTIONS_URL/functions/v1/verificar-cnpj" | tr -d '\r' | grep -i '^access-control-allow-origin' | awk '{print $2}'; }
a="$(pf "$ALLOWED_ORIGIN")"; [ "$a" = "$ALLOWED_ORIGIN" ] && ok "origem do app → $a" || ruim "origem do app devolveu '$a'"
e="$(pf https://evil.example)"; [ "$e" != "https://evil.example" ] && ok "origem estranha não é ecoada ('$e')" || ruim "origem estranha foi liberada"

echo "Authentication:"
s="$(curl -s -m 30 -H "apikey: $ANON_KEY" "$FUNCTIONS_URL/auth/v1/settings")"
echo "$s" | grep -q '"mailer_autoconfirm":false' && ok "confirmação de e-mail ligada" || ruim "mailer_autoconfirm não está false"
echo "$s" | grep -q '"disable_signup":false' && ok "cadastro aberto" || ruim "cadastro fechado"

[ "$falhas" -eq 0 ] && echo "Tudo como esperado." || { echo "$falhas conferência(s) falharam."; exit 1; }
