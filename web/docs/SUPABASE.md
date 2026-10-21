# Supabase — o app ligado ao banco

O front novo (`web/`) usa o projeto Supabase **`ppnxdajiihsjaojxokzh`** (Nivo Tech Construção Civil, região São
Paulo), o mesmo do app antigo (que foi desligado no Z08; os dados dele continuam lá). Cada função de
`src/services/` tem dois corpos — o de demonstração (dados em memória) e o real (`src/services/remote/`) — e o build
escolhe um. Este arquivo diz **o que está no banco, o que falta aplicar e o que configurar** para cada recurso que
depende de serviço externo.

## 1. Demonstração ou real

| Situação                                                          | Modo         | O que acontece                                                                                                                |
| ----------------------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Sem `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` (prévia, testes) | demonstração | dados de `src/data/seed.ts`, contas de teste, simulações (e-mail, código, PIX, CEPs, equipe)                                  |
| Com as duas variáveis no build                                    | real         | contas no Auth, dados nas tabelas, fotos no Storage, CEP no BrasilAPI/ViaCEP, endereço no OpenStreetMap (U51), avisos ao vivo |

`src/services/mode.ts` exporta `IS_DEMO`. Nada simulado existe no modo real (botões "Demonstração: …" somem). Todas
as variáveis estão explicadas em `web/.env.example` — só valores **públicos** vão para o front; a chave
`service_role` e os tokens de provedores ficam em **Edge Functions › Secrets**.

## 2. Situação do banco

| O quê                                                       | Situação                                                                                                                                                 |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `20261009000100/200/300` (esquema, regras, dados)           | **aplicadas**                                                                                                                                            |
| As 36 migrations de `20261010…` a `20261014…` (fases A–E)   | **aplicadas em 12/10/2026**, na ordem de `supabase/APLICAR.md`                                                                                           |
| `…000700_x22_limpeza_tentativas` e `…000800_x23_indices_fk` | **aplicadas em 12/10/2026** (correção do cron de limpeza e índices que faltavam)                                                                         |
| Extensão `pg_net` (chamadas do banco para as funções)       | **ligada**                                                                                                                                               |
| As Edge Functions (tabela da seção 4)                       | **publicadas** (a `verificar-cadastro`, da U10, ainda não — só com "pode") — as que dependem de provedor respondem "desligado" até os segredos existirem |

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
  órfãos (`40 4 * * *`, só com a Edge Function configurada). **Vigia (L12)**: `bicos-vigiar-cron` (`12 * * * *`)
  alerta no Sentry quando uma rotina falha 2 vezes seguidas e manda o sinal de vida ao monitor de fora; estado de
  todas: `select * from public.cron_health();` (seção 5.1).
- **Storage**: `avatars`, `portfolio`, `vagas` (públicos para abrir pelo endereço, sem listagem; cada conta só envia
  na própria pasta) e `identidade` (privado; só a equipe lê).
- **Vault**: `nivotech_documento_key` (cifra CPF/CNPJ; já existe) e, quando configurados, `bicos_push_url`,
  `bicos_push_secret`, `bicos_cleanup_url`, `bicos_cleanup_secret`, `bicos_sentry_dsn` e `bicos_heartbeat_url` (L12).
- **Equipe** (L06): a área `/admin` do app (filas de identidade, construtoras e denúncias; registro de auditoria).
  Quem é da equipe está em `staff_members` e só entra pelo SQL Editor:
  `select public.add_staff_member('email@da.conta', 'admin');` (sair: `remove_staff_member`). Continuam
  existindo, para o SQL Editor: `set_company_verification`, `set_identity_status`, `funnel_daily(de, até)`.

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
   `VITE_LOGIN_GOOGLE=1` no build. U18: com `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` no ambiente, o
   `scripts/configurar-auth.mjs` liga o provedor sozinho; no GitHub, as mesmas secrets ligam o Google no staging e o
   botão no site de teste. A tela de consentimento precisa estar **publicada** (em "Teste", só os e-mails da lista
   de testadores entram).
6. **Firebase** (U28, Google e celular): no console do Firebase (`bicoapp-6cc68`) ligar os provedores Google e
   Telefone e autorizar os domínios do app; a Edge Function `entrar-com-firebase` precisa do segredo
   `FIREBASE_PROJECT_ID` e o build, de `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`
   e `VITE_FIREBASE_APP_ID`. Com o Firebase no build, o botão do Google usa o Firebase (não precisa do item 5).

## 4. Edge Functions

**Todas publicadas em 12/10/2026** (as "sem JWT" com a conferência de JWT desligada). Para publicar de novo depois
de mudar o código: `supabase functions deploy <nome>` a partir de `web/supabase/functions`; as marcadas "sem JWT"
são chamadas pelo banco ou por um provedor e conferem um segredo próprio: publique com `--no-verify-jwt`. Sem os
segredos da tabela, cada função recusa o pedido (401 ou 503) — nada acontece pela metade.

| Função                 | Para quê                                                   | Segredos (Edge Functions › Secrets)                                                                        | Sem JWT |
| ---------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------- |
| `entrar-com-documento` | entrar com CPF/CNPJ sem expor o e-mail                     | `TURNSTILE_SECRET` (obrigatório)                                                                           |         |
| `verificar-cadastro`   | cadastro: e-mail, CPF/CNPJ ou WhatsApp já tem conta? (U10) | —                                                                                                          |         |
| `excluir-conta`        | exclusão completa, com os arquivos do Storage (Y15)        | —                                                                                                          |         |
| `codigo-whatsapp`      | código de confirmação do WhatsApp (Twilio Verify, Y25)     | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SID`, `TWILIO_VERIFY_CHANNEL` (`whatsapp`/`sms`) |         |
| `verificar-cnpj`       | consulta do CNPJ na Receita (BrasilAPI, L10)               | `BRASILAPI_URL` (opcional)                                                                                 |         |
| `criar-cobranca`       | PIX e cartão do impulsionamento (Mercado Pago, Z02)        | `MP_ACCESS_TOKEN`                                                                                          |         |
| `webhook-pagamento`    | confirmação do Mercado Pago                                | `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`                                                                     | sim     |
| `enviar-push`          | notificação no celular a cada aviso novo (X03)             | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `PUSH_WEBHOOK_SECRET`                            | sim     |
| `limpar-arquivos`      | apagar arquivos órfãos e fotos de identidade antigas (X09) | `CLEANUP_SECRET`                                                                                           | sim     |

As chamadas pelo navegador (`entrar-com-documento`, `verificar-cadastro`, `excluir-conta`, `codigo-whatsapp`, `verificar-cnpj`,
`criar-cobranca`): `APP_ORIGIN` (**obrigatório** — sem ele a função não sobe, L05; o endereço publicado, ou uma
lista separada por vírgula, com `https://*.dominio` para prévias). As servidor-a-servidor (`webhook-pagamento`,
`enviar-push`, `limpar-arquivos`) **não usam** `APP_ORIGIN` nem mandam cabeçalho CORS (R02): um segredo esquecido não
derruba o webhook nem o cron. Todas: `SENTRY_DSN` e `RELEASE` (opcionais, X21). `SUPABASE_URL`,
`SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` o Supabase já põe sozinho.

## 5. Recursos que dependem de serviço externo

Cada um existe por inteiro no código, mas **fica escondido no modo real até ser configurado** (`services/features.ts`);
na demonstração tudo é simulado.

| Recurso                                | Sem configurar (modo real)                                                                                                                                                    | Para ligar                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Impulsionar (Mercado Pago)**         | botão escondido; a vaga aparece no mural de graça                                                                                                                             | conta Mercado Pago (CNPJ quando tiver); `MP_ACCESS_TOKEN` e `MP_WEBHOOK_SECRET` nos Secrets; webhook do MP apontando para `.../functions/v1/webhook-pagamento` (`criar-cobranca` e `webhook-pagamento` já estão no ar); no build `VITE_PAGAMENTOS=mercadopago` e `VITE_MP_PUBLIC_KEY`. Testar em sandbox: PIX e cartão.                                                          |
| **Captcha (Cloudflare Turnstile)**     | **obrigatório na produção (L05)**: o build não sai sem `VITE_TURNSTILE_SITE_KEY` e as funções recusam o pedido sem `TURNSTILE_SECRET`                                         | Cloudflare › Turnstile → criar site com o domínio; `TURNSTILE_SECRET` nos Secrets; `VITE_TURNSTILE_SITE_KEY` no build; Authentication › Attack Protection › **Enable Captcha protection** (Turnstile, mesma secret) — vale para cadastro, login e "esqueci a senha"                                                                                                              |
| **Código do WhatsApp (Twilio Verify)** | o número fica guardado sem confirmação                                                                                                                                        | Twilio › Verify → serviço (canal WhatsApp ou SMS); segredos acima (`codigo-whatsapp` já está no ar); `VITE_CODIGO_WHATSAPP=1`                                                                                                                                                                                                                                                    |
| **Entrar com Google**                  | botão escondido                                                                                                                                                               | seção 3, item 5                                                                                                                                                                                                                                                                                                                                                                  |
| **Notificações no celular (push)**     | só o sino do app                                                                                                                                                              | `npx web-push generate-vapid-keys`; segredos `VAPID_*` e `PUSH_WEBHOOK_SECRET`; `enviar-push` e o **pg_net** já estão no ar; no SQL Editor: `select vault.create_secret('https://ppnxdajiihsjaojxokzh.supabase.co/functions/v1/enviar-push', 'bicos_push_url');` e `select vault.create_secret('<PUSH_WEBHOOK_SECRET>', 'bicos_push_secret');`; `VITE_VAPID_PUBLIC_KEY` no build |
| **Limpeza de arquivos órfãos**         | os arquivos ficam                                                                                                                                                             | falta só um passo: em Edge Functions › Secrets, crie `CLEANUP_SECRET` com o mesmo valor de `bicos_cleanup_secret` (Integrations › Vault, já criado com um valor aleatório, junto com `bicos_cleanup_url`). `limpar-arquivos`, o pg_net e o cron das 4h40 já estão no ar; até lá a chamada diária é recusada (401) e nada é apagado                                               |
| **Consulta do CNPJ (BrasilAPI)**       | **ligada**: CNPJ ativo na Receita → "Verificada"; CPF ou consulta sem resposta → "pendente" até a equipe conferir                                                             | nada: `verificar-cnpj` já está publicada (a BrasilAPI é gratuita, sem chave)                                                                                                                                                                                                                                                                                                     |
| **Endereço e distância (U51)**         | **ligado**, sem chave: CEP pela BrasilAPI/ViaCEP, ruas com CEP pelo ViaCEP (Correios), bairros e o ponto no mapa pelo OpenStreetMap (Nominatim e Photon), direto do navegador | nada. Os serviços são gratuitos e de uso justo: o Nominatim é chamado uma vez por endereço salvo (nunca enquanto digita) e as respostas ficam guardadas na sessão. Se a Bicos crescer muito, trocar por um provedor pago (Google Maps Platform, com cartão) em `services/remote/address.ts`                                                                                      |
| **E-mail próprio (Brevo SMTP)**        | e-mails do Auth pelo serviço padrão (cota baixa)                                                                                                                              | seção 3, item 2                                                                                                                                                                                                                                                                                                                                                                  |
| **Erros (Sentry)**                     | **obrigatório na produção (L05)**: o build não sai sem `VITE_SENTRY_DSN`; nada pessoal sai (`beforeSend`)                                                                     | projeto no Sentry; `VITE_SENTRY_DSN` no build e `SENTRY_DSN` nos Secrets; para os source maps, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` e `SENTRY_PROJECT` no ambiente do deploy (`scripts/sentry-sourcemaps.mjs`)                                                                                                                                                                      |
| **WhatsApp do suporte**                | **obrigatório na produção (L11)**: o build não sai sem um celular com DDD válido                                                                                              | `VITE_SUPORTE_WHATSAPP` no build (ex.: `11987654321`); na demonstração a Ajuda mostra só o e-mail                                                                                                                                                                                                                                                                                |
| **Verificação de identidade (F07)**    | funciona: a equipe aprova/recusa por `set_identity_status`                                                                                                                    | (opcional, futuro) verificação automática por um provedor pago                                                                                                                                                                                                                                                                                                                   |

### 5.1 Rotinas vigiadas (L12) — **ação do responsável** para ligar o aviso

O vigia já roda de hora em hora; sem os dois itens abaixo ele só registra o alerta em `cron_alerts` (ninguém é
avisado). Para ligar:

1. **Sentry** (o mesmo projeto do L05): no SQL Editor da produção,
   `select vault.create_secret('<o DSN do Sentry>', 'bicos_sentry_dsn');`. Depois, no Sentry › Alerts › Create
   Alert › Issues: "A new issue is created" com o filtro `origem` = `pg_cron` → ação "Send a notification to"
   os e-mails dos sócios.
2. **Sinal de vida** (cobre o banco pausado ou o pg_cron parado): conta grátis em https://healthchecks.io → Add
   Check → Period **1 hour**, Grace **1 hour** → copiar a "ping URL" → no SQL Editor:
   `select vault.create_secret('<ping URL>', 'bicos_heartbeat_url');` → em Integrations, e-mail dos sócios.
3. Conferir: `select * from public.cron_health();` (todas com `last_status = succeeded`) e, uma hora depois, o
   check do healthchecks.io verde.

### 5.2 Notificações no celular (push) — **desligadas no lançamento** (L12)

O código está pronto (Edge Function `enviar-push` publicada, gatilho no banco, tela de permissão), mas o push fica
**escondido** enquanto `VITE_VAPID_PUBLIC_KEY` estiver vazio no build: ninguém vê o convite para ativar, e o gatilho
do banco não chama nada enquanto faltar `bicos_push_secret` no Vault. O sino dentro do app funciona normalmente.
Para ligar depois (tudo **ação do responsável**, nessa ordem):

1. Gerar o par de chaves (no computador, uma vez): `npx web-push@3.6.7 generate-vapid-keys` → anotar a pública e
   a privada (cofre de senhas).
2. Gerar o segredo do webhook: `openssl rand -hex 32` (ou um gerador de senha com 64 caracteres).
3. Edge Functions › Secrets (https://supabase.com/dashboard/project/ppnxdajiihsjaojxokzh/functions/secrets):
   `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT=mailto:nivotech.dev@gmail.com` e
   `PUSH_WEBHOOK_SECRET` = o segredo do passo 2.
4. SQL Editor (com o mesmo segredo do passo 2):
   `select vault.create_secret('https://ppnxdajiihsjaojxokzh.supabase.co/functions/v1/enviar-push', 'bicos_push_url');`
   `select vault.create_secret('<segredo do passo 2>', 'bicos_push_secret');`
5. `VITE_VAPID_PUBLIC_KEY` = a chave pública nas variáveis do deploy → publicar o front de novo.
6. Conferir: com uma conta de teste, ativar as notificações no celular e mandar uma candidatura — o aviso chega
   com o app fechado. Logs em Edge Functions › `enviar-push` › Logs.

Fazer primeiro no staging (mesmos passos, com a URL do staging).

## 6. Hospedagem

- Build: `npm run build` → `dist/` (com as variáveis do `.env.example`; **falha** se faltar alguma obrigatória —
  L01; a demonstração é `npm run build:demo`). As rotas são caminhos de verdade
  (`/vaga/BC-1`): o servidor responde `index.html` para todo caminho que não for arquivo. **Cloudflare Pages** faz isso
  sozinho (sem `404.html`); Netlify: `/* /index.html 200` em `_redirects`; nginx: `try_files $uri /index.html`.
- `VITE_SITE_URL` (prévia do link no WhatsApp) e `APP_ORIGIN` (CORS das funções) = o domínio publicado.
- **Deploy (L08)**: `npm run deploy:staging` / `npm run deploy:producao` (`scripts/deploy.sh`): build que falha sem
  variável, recusa publicar a demonstração, envia os source maps ao Sentry e publica no Cloudflare Pages. Os
  cabeçalhos de segurança (CSP, HSTS…) estão em `public/_headers`.
- Staging: `docs/STAGING.md` (L02).

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
