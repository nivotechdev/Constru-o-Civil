# Checklist de lançamento

Duas colunas por item: o que a IA já deixou pronto no repositório (com o commit) e o que **só o responsável**
pode fazer (pagar, criar conta, DNS, advogado, aprovar mudança na produção). Nada da segunda coluna está feito
até você marcar `[x]`.

## L01 — Build de produção nunca sai em demonstração

| Feito pela IA                                                                            | Ação do responsável |
| ---------------------------------------------------------------------------------------- | ------------------- |
| `npm run build` falha sem as variáveis; `build:demo` para demonstração; CI prova a falha | —                   |

## L02 — Staging

| Feito pela IA                                                                                                                                                                                                     | Ação do responsável                                                                                                                                                                       |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/staging/aplicar-banco.sh` (testado num Postgres novo, idempotente), `publicar-funcoes.sh`, `.env.staging.example`, `supabase/functions/.env.staging.example`, `npm run build:staging`, `docs/STAGING.md` | [ ] Dizer "pode" para criar o projeto `bicos-staging` (grátis no plano Free; ver custo em `STAGING.md`) **ou** criá-lo no painel: https://supabase.com/dashboard/new/cdbmayszwthxqckwozjg |
|                                                                                                                                                                                                                   | [ ] Passar à IA (ou rodar) a senha do banco do staging e um token pessoal (https://supabase.com/dashboard/account/tokens) para publicar as funções                                        |
