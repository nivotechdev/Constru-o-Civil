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

## L05 — Anti-abuso e observabilidade

| Feito pela IA                                                                                      | Ação do responsável                                                                                                                                                                                      |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Captcha obrigatório no front (cadastro, login, documento, "esqueci a senha") e nas funções; testes | [ ] Cloudflare › Turnstile (https://dash.cloudflare.com/?to=/:account/turnstile) → "Add site" com `bicos.nivotech.com.br` (e o domínio do staging) → copiar **site key** (vai no build) e **secret key** |
|                                                                                                    | [ ] Supabase › Edge Functions › Secrets: `TURNSTILE_SECRET` = secret key (https://supabase.com/dashboard/project/ppnxdajiihsjaojxokzh/functions/secrets) — **antes** de publicar as funções novas        |
|                                                                                                    | [ ] Supabase › Authentication › Attack Protection → Enable Captcha protection → Turnstile → mesma secret key (https://supabase.com/dashboard/project/ppnxdajiihsjaojxokzh/auth/protection)               |
| `beforeSend` sem dado pessoal, release = commit, source maps ocultos + script de envio; testes     | [ ] Criar conta/projeto no Sentry (https://sentry.io, plano Developer grátis, região US ou EU), plataforma "Browser JavaScript" → copiar o DSN para `VITE_SENTRY_DSN` e `SENTRY_DSN` (Secrets)           |
|                                                                                                    | [ ] Sentry › Settings › Auth Tokens → token com `project:releases` → `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` no ambiente do deploy (Cloudflare Pages › Settings › Variables, como "Secret")  |
|                                                                                                    | [ ] Sentry › Project › Settings › Security & Privacy: ligar "Data Scrubber" e "Use Default Scrubbers" (segunda barreira)                                                                                 |
| `APP_ORIGIN` obrigatório nas funções; `deno check` no CI                                           | [ ] Secrets: `APP_ORIGIN=https://bicos.nivotech.com.br` na produção (staging: o endereço do staging) — **antes** de publicar as funções novas                                                            |
|                                                                                                    | [ ] **Decidir**: código do WhatsApp (Twilio Verify, ~US$ 0,05 por verificação) obrigatório antes da 1ª candidatura, **ou** só validação de formato + aviso claro                                         |

## L06 — Back-office (`/admin`)

| Feito pela IA                                                                                                                                                       | Ação do responsável                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Migration `lanc06_backoffice` (equipe, filas, auditoria, suspensão, vaga oculta) + 39 testes SQL verdes; tela `/admin`; `verificar-cnpj` guarda os dados da Receita | [ ] Dizer "pode" para aplicar a migration no staging e depois na produção, e publicar `verificar-cnpj` de novo                                   |
|                                                                                                                                                                     | [ ] Dizer quem é da equipe (e-mails das contas). Depois de aplicada, no SQL Editor: `select public.add_staff_member('email@da.conta', 'admin');` |
