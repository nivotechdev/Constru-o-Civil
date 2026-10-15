# Supabase — o app ligado ao banco

O front novo (`web/`) usa o projeto Supabase **`ppnxdajiihsjaojxokzh`** (Nivo Tech Construção Civil, região São
Paulo), o mesmo do app antigo (que foi desligado no Z08; os dados dele continuam lá). Cada função de
`src/services/` tem dois corpos — o de demonstração (dados em memória) e o real (`src/services/remote/`) — e o build
escolhe um. Este arquivo diz **o que está no banco, o que falta aplicar e o que configurar** para cada recurso que
depende de serviço externo.

## 1. Demonstração ou real

| Situação                                                          | Modo         | O que acontece                                                                               |
| ----------------------------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------- |
| Sem `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` (prévia, testes) | demonstração | dados de `src/data/seed.ts`, contas de teste, simulações (e-mail, código, PIX, CEPs, equipe) |
| Com as duas variáveis no build                                    | real         | contas no Auth, dados nas tabelas, fotos no Storage, CEP no BrasilAPI/ViaCEP, avisos ao vivo |

`src/services/mode.ts` exporta `IS_DEMO`. Nada simulado existe no modo real (botões "Demonstração: …" somem). Todas
as variáveis estão explicadas em `web/.env.example` — só valores **públicos** vão para o front; a chave
`service_role` e os tokens de provedores ficam em **Edge Functions › Secrets**.

## 2. Situação do banco

| O quê                                                       | Situação                                                                                     |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `20261009000100/200/300` (esquema, regras, dados)           | **aplicadas**                                                                                |
| As 36 migrations de `20261010…` a `20261014…` (fases A–E)   | **aplicadas em 12/10/2026**, na ordem de `supabase/APLICAR.md`                               |
| `…000700_x22_limpeza_tentativas` e `…000800_x23_indices_fk` | **aplicadas em 12/10/2026** (correção do cron de limpeza e índices que faltavam)             |
| Extensão `pg_net` (chamadas do banco para as funções)       | **ligada**                                                                                   |
| As 8 Edge Functions (tabela da seção 4)                     | **publicadas** — as que dependem de provedor respondem "desligado" até os segredos existirem |

O histórico do banco tem as versões da hora em que cada uma foi aplicada (não as dos arquivos); antes de usar
`supabase db push` em produção, alinhe com o `repair` de "Histórico de migrations" em `APLICAR.md`.

Como foi conferido, no banco de produção: as 38 consultas de conferência de `APLICAR.md` dão o resultado esperado;
os 38 arquivos de `supabase/tests/` passam rodando lá mesmo (cada teste numa transação desfeita no fim — nada fica
gravado); cada Edge Function foi chamada pelo `pg_net` e respondeu como deve (sem segredo: 401/503; login por
documento com senha errada: `credenciais`). A #31 (X13) reinstalou o PostGIS no schema `extensions` sem perder
nada (não havia coordenada gravada no app antigo; `jobs` estava vazia).

`APLICAR-TUDO.sql` (gerado por `node scripts/aplicar-tudo.mjs`) junta as migrations de depois de 09/10 para aplicar
num ambiente novo (staging): os valores novos de enum numa transação, e o resto numa transação só.

Advisors depois de aplicar (Database › Advisors): segurança sem nenhum ERROR; o que sobra e por quê está em
`docs/ADVISORS.md`.

### Organização

- Tabelas do app: `accounts` (1:1 com `auth.users`), `workers`, `companies`, `company_members`, `oficios`, `jobs`,
  `applications`, `application_events`, `application_attempts`, `saved_jobs`, `reviews`, `worker_posts`,
  `notifications`, `notification_prefs`, `push_subscriptions`, `boost_payments`, `payment_webhook_events`,
  `job_alerts`, `job_invites`, `reports`, `blocks`, `whatsapp_verifications`, `identity_submissions`, `app_config`.
- **Regras no banco**: RLS em todas as tabelas, grants por coluna (WhatsApp, endereço exato, documento, nota, selo e
  impulso não saem nem mudam por `select`/`update`), e RPCs `security definer` com `search_path` fixo para tudo que
  muda mais de um registro. Erros com código próprio (`BC401/404/409/422` → `nao_autorizado`, `nao_encontrado`,
  `conflito`, `validacao`) e mensagem pronta.
- **Rotinas (pg_cron)**: concluir diárias (`7 * * * *`), vencer PIX (`*/10`), lembrete de presença (`0 21 * * *`),
  limpar cadastros nunca confirmados (`23 3 * * *`), limpar registro de tentativas (`17 4 * * *`) e limpar arquivos
  órfãos (`40 4 * * *`, só com a Edge Function configurada).
- **Storage**: `avatars`, `portfolio`, `vagas` (públicos para abrir pelo endereço, sem listagem; cada conta só envia
  na própria pasta) e `identidade` (privado; só a equipe lê).
- **Vault**: `nivotech_documento_key` (cifra CPF/CNPJ; já existe) e, quando configurados, `bicos_push_url`,
  `bicos_push_secret`, `bicos_cleanup_url`, `bicos_cleanup_secret`.
- **Equipe** (painel/SQL Editor, com service_role): `set_company_verification(empresa, status)`,
  `set_identity_status(trabalhador, status, motivo)`, `funnel_daily(de, até)`; denúncias em `reports`.

## 3. Painel › Authentication

1. **URL Configuration**: _Site URL_ = endereço publicado (ex.: `https://bicos.nivotech.com.br/`); em _Redirect
   URLs_ também `https://bicos.nivotech.com.br/**`. Os links de e-mail voltam para a raiz; o app guarda a sessão e
   troca a URL pela rota (`/redefinir-senha`, `/mural`) — X17.
2. **E-mail**: manter "Confirm email". Para produção, **SMTP próprio** (o do Supabase tem cota baixa). Com a Brevo:
   Authentication › SMTP Settings → host `smtp-relay.brevo.com`, porta `587`, usuário e chave SMTP da Brevo
   (Brevo › SMTP & API), remetente de um domínio verificado na Brevo. Os textos dos e-mails ficam em Authentication ›
   Email Templates.
3. Senha mínima: o app pede 8 com letras e números; deixe o mínimo do Auth em 8 ou menos.
4. **Leaked password protection** (Authentication › Policies): ligar (plano Pro).
5. **Google** (L13): Authentication › Providers › Google com o Client ID/Secret do Google Cloud (tela de consentimento
   com o domínio publicado; URI de redirecionamento = a "Callback URL" mostrada pelo Supabase). Depois,
   `VITE_LOGIN_GOOGLE=1` no build.

## 4. Edge Functions

**Todas publicadas em 12/10/2026** (as "sem JWT" com a conferência de JWT desligada). Para publicar de novo depois
de mudar o código: `supabase functions deploy <nome>` a partir de `web/supabase/functions`; as marcadas "sem JWT"
são chamadas pelo banco ou por um provedor e conferem um segredo próprio: publique com `--no-verify-jwt`. Sem os
segredos da tabela, cada função recusa o pedido (401 ou 503) — nada acontece pela metade.

| Função                 | Para quê                                                   | Segredos (Edge Functions › Secrets)                                                                        | Sem JWT |
| ---------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------- |
| `entrar-com-documento` | entrar com CPF/CNPJ sem expor o e-mail                     | `TURNSTILE_SECRET` (opcional)                                                                              |         |
| `excluir-conta`        | exclusão completa, com os arquivos do Storage (Y15)        | —                                                                                                          |         |
| `codigo-whatsapp`      | código de confirmação do WhatsApp (Twilio Verify, Y25)     | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SID`, `TWILIO_VERIFY_CHANNEL` (`whatsapp`/`sms`) |         |
| `verificar-cnpj`       | consulta do CNPJ na Receita (BrasilAPI, L10)               | `BRASILAPI_URL` (opcional)                                                                                 |         |
| `criar-cobranca`       | PIX e cartão do impulsionamento (Mercado Pago, Z02)        | `MP_ACCESS_TOKEN`                                                                                          |         |
| `webhook-pagamento`    | confirmação do Mercado Pago                                | `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`                                                                     | sim     |
| `enviar-push`          | notificação no celular a cada aviso novo (X03)             | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `PUSH_WEBHOOK_SECRET`                            | sim     |
| `limpar-arquivos`      | apagar arquivos órfãos e fotos de identidade antigas (X09) | `CLEANUP_SECRET`                                                                                           | sim     |

Todas: `APP_ORIGIN` (o endereço publicado, para o CORS), `SENTRY_DSN` e `RELEASE` (opcionais, X21). `SUPABASE_URL`,
`SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` o Supabase já põe sozinho.

## 5. Recursos que dependem de serviço externo

Cada um existe por inteiro no código, mas **fica escondido no modo real até ser configurado** (`services/features.ts`);
na demonstração tudo é simulado.

| Recurso                                | Sem configurar (modo real)                                                                                        | Para ligar                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Impulsionar (Mercado Pago)**         | botão escondido; a vaga aparece no mural de graça                                                                 | conta Mercado Pago (CNPJ quando tiver); `MP_ACCESS_TOKEN` e `MP_WEBHOOK_SECRET` nos Secrets; webhook do MP apontando para `.../functions/v1/webhook-pagamento` (`criar-cobranca` e `webhook-pagamento` já estão no ar); no build `VITE_PAGAMENTOS=mercadopago` e `VITE_MP_PUBLIC_KEY`. Testar em sandbox: PIX e cartão.                                                          |
| **Captcha (Cloudflare Turnstile)**     | sem captcha (os limites por número/IP continuam)                                                                  | Cloudflare › Turnstile → criar site com o domínio; `TURNSTILE_SECRET` nos Secrets; `VITE_TURNSTILE_SITE_KEY` no build                                                                                                                                                                                                                                                            |
| **Código do WhatsApp (Twilio Verify)** | o número fica guardado sem confirmação                                                                            | Twilio › Verify → serviço (canal WhatsApp ou SMS); segredos acima (`codigo-whatsapp` já está no ar); `VITE_CODIGO_WHATSAPP=1`                                                                                                                                                                                                                                                    |
| **Entrar com Google**                  | botão escondido                                                                                                   | seção 3, item 5                                                                                                                                                                                                                                                                                                                                                                  |
| **Notificações no celular (push)**     | só o sino do app                                                                                                  | `npx web-push generate-vapid-keys`; segredos `VAPID_*` e `PUSH_WEBHOOK_SECRET`; `enviar-push` e o **pg_net** já estão no ar; no SQL Editor: `select vault.create_secret('https://ppnxdajiihsjaojxokzh.supabase.co/functions/v1/enviar-push', 'bicos_push_url');` e `select vault.create_secret('<PUSH_WEBHOOK_SECRET>', 'bicos_push_secret');`; `VITE_VAPID_PUBLIC_KEY` no build |
| **Limpeza de arquivos órfãos**         | os arquivos ficam                                                                                                 | falta só um passo: em Edge Functions › Secrets, crie `CLEANUP_SECRET` com o mesmo valor de `bicos_cleanup_secret` (Integrations › Vault, já criado com um valor aleatório, junto com `bicos_cleanup_url`). `limpar-arquivos`, o pg_net e o cron das 4h40 já estão no ar; até lá a chamada diária é recusada (401) e nada é apagado                                               |
| **Consulta do CNPJ (BrasilAPI)**       | **ligada**: CNPJ ativo na Receita → "Verificada"; CPF ou consulta sem resposta → "pendente" até a equipe conferir | nada: `verificar-cnpj` já está publicada (a BrasilAPI é gratuita, sem chave)                                                                                                                                                                                                                                                                                                     |
| **E-mail próprio (Brevo SMTP)**        | e-mails do Auth pelo serviço padrão (cota baixa)                                                                  | seção 3, item 2                                                                                                                                                                                                                                                                                                                                                                  |
| **Erros (Sentry)**                     | erros só no console/log                                                                                           | projeto no Sentry; `VITE_SENTRY_DSN` no build e `SENTRY_DSN` nos Secrets                                                                                                                                                                                                                                                                                                         |
| **Verificação de identidade (F07)**    | funciona: a equipe aprova/recusa por `set_identity_status`                                                        | (opcional, futuro) verificação automática por um provedor pago                                                                                                                                                                                                                                                                                                                   |

## 6. Hospedagem

- Build: `npm run build` → `dist/` (com as variáveis do `.env.example`; **falha** se faltar alguma obrigatória —
  L01; a demonstração é `npm run build:demo`). As rotas são caminhos de verdade
  (`/vaga/BC-1`): o servidor responde `index.html` para todo caminho que não for arquivo. **Cloudflare Pages** faz isso
  sozinho (sem `404.html`); Netlify: `/* /index.html 200` em `_redirects`; nginx: `try_files $uri /index.html`.
- `VITE_SITE_URL` (prévia do link no WhatsApp) e `APP_ORIGIN` (CORS das funções) = o domínio publicado.
- Staging separado: recomendado um segundo projeto Supabase (gratuito) com as mesmas migrations; ver DECISOES (X16).

## 7. Onde está cada coisa no código

| Parte                                    | Arquivo                                                                           |
| ---------------------------------------- | --------------------------------------------------------------------------------- |
| Escolha do modo                          | `src/services/mode.ts`, `src/services/features.ts`                                |
| Cliente, erros e chamadas                | `src/services/remote/client.ts`                                                   |
| Sessão, links de e-mail, Realtime        | `src/services/remote/session.ts`                                                  |
| Leituras e escritas                      | `src/services/remote/*.ts` (um corpo real para cada serviço de `src/services/`)   |
| Tipos das tabelas (conferidos com o SQL) | `src/types/supabase.ts` + `src/types/database.generated.ts` (`npm run gen:types`) |
| Migrations, testes SQL, funções          | `supabase/migrations/`, `supabase/tests/`, `supabase/functions/`                  |

## 8. Como foi validado

- `npm run typecheck`, `lint`, `format:check`, `test` (Vitest, com testes de serviço nos dois modos e um falso
  Supabase para o modo real) e os três builds — no CI a cada push (`.github/workflows/web.yml`), junto com
  Lighthouse, axe (acessibilidade) e os testes SQL.
- Testes SQL (`supabase/tests/*.sql`, cada um termina em `rollback`): um por item com regra no banco, mais
  `seguranca.sql` (critério de aceite 8: ninguém lê WhatsApp, endereço ou documento de outra pessoa, nem muda status,
  nota, selo ou impulso por chamada direta; visitante não lê nada disso).
