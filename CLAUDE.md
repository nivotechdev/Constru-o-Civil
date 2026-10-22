# CLAUDE.md — Contexto do Bicos (NivoTech)

> Contexto fixo para qualquer IA trabalhar neste repositório. Leia inteiro antes de mudar qualquer coisa.
> Estado conferido em 17/10/2026 (branch `claude/front-novo-supabase` em `1b07bb6`, `master` em `dd8d0ad`, produção e
> staging inspecionados ao vivo). Rodada atual: **R01–R12** (lançamento); a anterior foi L00–L13.

## 1. O produto

**Bicos** é um marketplace de **bicos e diárias** (trabalho temporário) para o **público geral**, da **NivoTech**
(nivotech.com.br, Brasil). Desde o U48 (21/10/2026) não é mais só de construção: empresas e pessoas que precisam de
alguém para um serviço encontram trabalhadores verificados; quem procura bico tem um canal único de oportunidades.
Nos textos e ícones do app, nada de construtora, obra, pedreiro ou EPI — "empresa", "serviço", "local", "trabalhador".
Os nomes internos antigos (papel `recrutador`, lado `construtora`, `para_construtora`, rota `/construtora/:id`) ficam.

Dois lados (enum `app_role`):
- **trabalhador** (pessoa física, CPF, 18+): quem procura bico (garçom, faxina, eventos, mudança, loja, cuidados…).
- **recrutador** = empresa ou pessoa que contrata (CNPJ, ou CPF em alguns casos; ver Y16/Y17). Na tela: "empresa".

Fluxo central (não mudar sem pedir):
1. Empresa publica a vaga (título, valor da diária, dias/diárias/horário com data a combinar, endereço sem número,
   fotos, pessoas). U01: sem ofício, datas, urgente, pagamento e requisitos na tela — vagas antigas mantêm os seus.
2. Trabalhadores veem o **mural** (`feed_jobs`: cidade ou raio, filtros — sem filtro de ofício desde o U01;
   impulsionadas → urgentes → recentes).
3. Trabalhador se candidata; a empresa vê os candidatos e os perfis (os dois lados veem o perfil do outro).
4. Empresa aprova → **o WhatsApp é liberado para os dois lados** (`get_contact`). Desde o U53 o endereço
   completo e o mapa aparecem para qualquer conta logada (o link público sem conta mostra só bairro e cidade).
5. Presença confirmada → diária concluída (cron) → **avaliação dos dois lados** → notas e histórico nos perfis.
6. Vaga paga ("impulsionar", Mercado Pago PIX/cartão) sobe no mural.

Público: trabalhadores usando celular simples, internet ruim, pouca familiaridade com apps. Texto curto,
direto, em português do Brasil, sem jargão. Isso pesa mais que estética.

## 2. Pessoas e decisões

- Três sócios + a IA fazendo a parte técnica. Quem fala com você é sócio, não desenvolvedor sênior: explique
  decisões em linguagem simples e peça aprovação nos pontos marcados como "ação do responsável".
- **Toda alteração no projeto vai direto para o `master`** (pedido do responsável em 19/10/2026, reforçado no mesmo
  dia: "faça na branch principal, suba na branch principal e sempre faça isso"): commitar e enviar ao `master`
  (`git push origin master`), sem PR e sem pedir de novo. Antes de enviar, rodar as checagens locais (§5); depois,
  conferir o CI `web` e `staging` no `master` e corrigir na hora se ficar vermelho. O `master` publica o site de
  teste (GitHub Pages) e reaplica o staging; **não** mexe na produção — produção continua só com "pode" a cada
  passo (§9).
- Lançamento: **web app (PWA)** primeiro; lojas (React Native/Expo) só depois que o app tracionar.
- Domínio previsto: `https://bicos.nivotech.com.br` (ainda não confirmado no ar).
- Cidade do piloto: **Caxias do Sul (RS)**, confirmado pelo responsável em 19/10/2026. Usar nos testes (cidade do
  mural, vagas de exemplo) e nos textos legais (`{{CIDADE_FORO}}` ainda é decisão da empresa/advogado).

## 3. Repositório

```
/                      ← README.md descreve o produto (R06)
├─ web/                ← O APP. Tudo o que importa está aqui.
│  └─ supabase/legado/ ← migrations 000–012 do app LEGADO (ainda usadas para montar um banco do zero!)
├─ archive/            ← app legado (archive/app, referência de paridade), chats/ e project/ do design,
│                        SETUP-SUPABASE.md antigo — ver archive/LEIA.md (R06)
├─ legal/              ← termos e política em .md (gerados de web/src/services/legal.ts)
└─ .github/workflows/  ← web.yml (CI) e staging.yml (aplica e confere o staging)
```

### web/
- **React 19 + TypeScript (strict) + Vite 7 + Tailwind 3.4.19**, PWA (`vite-plugin-pwa`), `@supabase/supabase-js` 2.
- Roteador próprio por caminho real (`/vaga/BC-1`), em `src/services/router.ts` + `src/routes.ts`; cada tela é um
  chunk lazy. Rotas principais: `/mural`, `/vaga/:id`, `/v/:id` (vaga pública), `/criar-vaga`,
  `/vaga-gerenciar/:id`, `/minhas-vagas`, `/minhas-candidaturas`, `/impulsionar/:id`, `/perfil`, `/empresa`,
  `/configuracoes/*`, `/login`, `/cadastro/:role`, `/completar-perfil/:role`, `/perfil/verificar`.
- Estado: store próprio em memória (`src/services/store.ts`, `useSyncExternalStore`), sem Redux/React Query.
- Pastas: `pages/{shared,worker,recruiter}`, `components/` (biblioteca de UI), `hooks/`, `services/`, `utils/`,
  `types/` (`models.ts` domínio; `database.generated.ts` gerado do banco), `data/` (seed demo + cidades IBGE).

### Regra de arquitetura nº 1 — dois modos, uma porta
- `src/services/mode.ts` → `IS_DEMO = !isSupabaseConfigured()`. **Sem** `VITE_SUPABASE_URL`/`ANON_KEY` o app roda
  com dados falsos em memória (`data/seed.ts`); **com** elas, fala com o Supabase.
- Cada serviço em `src/services/*.ts` tem dois corpos: demo (mexe no store) e real (`src/services/remote/*.ts`).
  Padrão: `if (!IS_DEMO) return remote.algo(...)`.
- **Telas, componentes e hooks nunca importam `data/`** (regra do ESLint `no-restricted-imports`). Dados só via
  `services/`.
- Funções que dependem de provedor externo ficam **escondidas** até configurar: `src/services/features.ts`
  (`payments`, `captcha`, `googleLogin`, `whatsappCode`, `push`).
- Erros: tudo vira `ServiceError` com códigos `offline | falha_demo | nao_autorizado | nao_encontrado | conflito |
  validacao` e mensagem pronta em PT-BR (`services/errors.ts`, `services/remote/client.ts`). As RPCs levantam
  SQLSTATE próprio `BC401/BC404/BC409/BC422` que o client traduz. **Mantenha esse contrato** em código novo.
- Máquina de status da candidatura: **única** fonte em `src/services/applicationMachine.ts` (tabela `TRANSITIONS`),
  espelhada no banco em `transition_application`. Mudou uma, mude a outra e os testes dos dois lados.
  Status: `enviada → em_analise → pre_selecionado → contratado → concluida` e saídas `nao_selecionado`,
  `desistiu`, `cancelado_pela_construtora`, `nao_compareceu`.
- Monitoramento: `services/monitoring.ts` envia ao Sentry **sem SDK** (endpoint `store`), já removendo ids da rota.
  Edge Functions: `supabase/functions/_shared/monitoring.ts`.

## 4. Banco (Supabase)

- Produção: projeto **`ppnxdajiihsjaojxokzh`** ("Nivo Tech Construção Civil", `sa-east-1`, Postgres 17).
  Organização no **plano Free**. (O projeto `whfaujtppifeqnxoqfxb` é antigo/inativo — ignore.)
- **Staging**: `bicos-staging`, ref **`setyxomsbfrkneqqfoam`** (`sa-east-1`, criado em 16/10, US$ 0). Tem `pg_cron`,
  `pg_net`, PostGIS e a chave do Vault, mas **o banco do app ainda não foi montado** (0 migrations no histórico) —
  o conector pede aprovação a cada `drop`; montar com `scripts/staging/aplicar-banco.sh` (senha do banco) ou pelo
  workflow `.github/workflows/staging.yml`. Ver `web/docs/STAGING.md`. Nunca usar dados reais de pessoas lá.
- Migrations do app: `web/supabase/migrations/` (48 arquivos, 09/10 → 16/10). Na produção estão aplicadas as de até
  14/10 (APLICAR.md #1–#38); **pendentes na produção**: `lanc06`, `lanc07`, `lanc09`, `lanc10`, `lanc12`, `lanc13`
  (#39–#44) e as `r*` desta rodada — só com "pode". O histórico da produção tem outros números de versão (54 linhas,
  aplicadas pelo conector, em partes) — ver `web/supabase/APLICAR.md` › "Histórico de migrations" antes de qualquer
  `supabase db push` (precisa de `repair`). `20261012033541_habilitar_pg_net` agora também está no repo (L09).
  Conferência: `scripts/staging/conferir-migrations.sh`.
- `web/supabase/APLICAR-TUDO.sql` é **gerado** (`node scripts/aplicar-tudo.mjs`); o CI falha se estiver desatualizado.
- `web/src/types/database.generated.ts` é **gerado** (`npm run gen:types` com `DATABASE_URL`); o CI falha se divergir.
- Tabelas do app: `accounts` (1:1 com `auth.users`; documento cifrado em `document_cipher` com a chave do Vault
  `nivotech_documento_key`, busca por `document_hash`), `workers`, `companies`, `company_members`, `oficios`,
  `jobs` (id `BC-<seq>`), `applications`, `application_events`, `application_attempts`, `saved_jobs`, `reviews`,
  `worker_posts`, `notifications`, `notification_prefs`, `push_subscriptions`, `boost_payments`,
  `payment_webhook_events`, `job_alerts`, `job_invites`, `reports`, `blocks`, `whatsapp_verifications`,
  `identity_submissions`, `app_config`, `auth_attempts`, `account_prefs` (U30, tema), `addresses` (U51, o endereço de
  cada trabalhador — só ele lê; o perfil mostra só a cidade; U62: empresa não tem endereço fixo).
- **Tabelas legadas** (app antigo, desligado no Z08, RLS sem política = fechadas): `profiles` (4 linhas, com CPF
  cifrado), `vagas` (3), `candidaturas`, `avaliacoes`, `vagas_salvas`, `publicacoes_trabalhador`, `consentimentos`.
  Não apagar sem autorização.
- Regras: RLS em tudo, grants por coluna (WhatsApp, endereço, documento, nota, selo e impulso não saem por `select`),
  e **toda mudança de mais de uma linha via RPC `security definer` com `search_path` fixo**. 42 RPCs para
  `authenticated` (aviso do advisor esperado, documentado em `web/docs/ADVISORS.md`); 1 para `anon`:
  `public_job_card` (link público da vaga).
- Funções só da equipe (service_role, hoje usadas pelo SQL Editor): `set_company_verification(empresa, status)`,
  `set_identity_status(trabalhador, status, motivo)`, `funnel_daily(de, até)`. Denúncias ficam em `reports`.
  Área da equipe no app: `/admin` (L06; `staff_members`, `add_staff_member(email, papel)` pelo SQL Editor) — **ainda
  não aplicada na produção**.
- Cron (`pg_cron`): `bicos-concluir-diarias` (`7 * * * *`), `bicos-vencer-pix` (`*/10`), `bicos-lembrar-presenca`
  (`0 21 * * *`), `bicos-limpar-cadastros` (`23 3 * * *`), `bicos-limpar-tentativas` (`17 4 * * *`),
  `bicos-limpar-arquivos` (`40 4 * * *`), `bicos-vigiar-cron` (`12 * * * *`, L12: alerta no Sentry após 2 falhas
  seguidas; estado em `select * from public.cron_health()`).
- Storage: `avatars`, `portfolio`, `vagas` (públicos por URL, sem listagem; cada conta só escreve na própria pasta
  `<uid>/…`) e `identidade` (privado — selfie + documento).
- Vault: `nivotech_documento_key`, `bicos_cleanup_url`, `bicos_cleanup_secret`. **Faltam** `bicos_push_url`,
  `bicos_push_secret` (push desligado no lançamento, L12), `bicos_sentry_dsn` e `bicos_heartbeat_url` (L12).
- Dados reais hoje: 4 contas (3 construtoras, 1 trabalhador, criadas até 21/09), **0 vagas, 0 candidaturas,
  0 denúncias, 0 identidades enviadas**. Provedores de Auth usados: email, google.
- Advisors hoje (produção): sem ERROR. WARN: `pg_net` no schema `public` (sai com a `lanc09`), leaked password
  protection desligada (exige Pro), RPCs security definer (esperado).

### Edge Functions (Deno, `web/supabase/functions/`, todas publicadas)
| Função | Papel | JWT | Segredos |
|---|---|---|---|
| `entrar-com-documento` | login por CPF/CNPJ (resposta única, limite 5/doc e 20/IP por 15 min) | sim | `TURNSTILE_SECRET` |
| `verificar-cadastro` | cadastro: e-mail/CPF/CNPJ/WhatsApp já tem conta? (U10; limite 30/IP e 10/valor por 15 min; só sim ou não) — **ainda não publicada na produção** | sim | — |
| `entrar-com-firebase` | Google e celular (U28): confere o ID token do Firebase e abre a sessão da Bicos (limite 20/IP por 15 min) — **ainda não publicada na produção** | sim | `FIREBASE_PROJECT_ID` |
| `excluir-conta` | exclusão completa (inclui Storage) | sim | — |
| `codigo-whatsapp` | código por WhatsApp/SMS (Twilio Verify) | sim | `TWILIO_*` |
| `verificar-cnpj` | CNPJ na Receita (BrasilAPI) — **ligada** | sim | — |
| `criar-cobranca` | PIX/cartão do impulso (Mercado Pago) | sim | `MP_ACCESS_TOKEN` |
| `webhook-pagamento` | confirmação do MP (HMAC `x-signature`, janela 15 min, idempotente) | **não** | `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET` |
| `enviar-push` | Web Push a cada notificação (chamada pelo banco via pg_net) | **não** | `VAPID_*`, `PUSH_WEBHOOK_SECRET` |
| `limpar-arquivos` | apaga órfãos e identidades 30 dias após decisão | **não** | `CLEANUP_SECRET` |

Todas: `SENTRY_DSN`, `RELEASE`. `APP_ORIGIN` (CORS): **obrigatório** desde o L05 — sem ele a função não sobe (não
cai mais para `*`). R02: só as funções chamadas pelo navegador exigem `APP_ORIGIN` (`requireAppOrigin()` no topo);
`webhook-pagamento`, `enviar-push` e `limpar-arquivos` sobem sem ele e não mandam CORS. **Na produção as funções ainda
estão na versão anterior ao L05** (republicar só com "pode", depois dos segredos). Helpers em `_shared/`
(`http.ts`: `adminClient`, `requestUser`, `json`, `rpcError`). As "sem JWT" conferem segredo em tempo constante.
Publicar: `supabase functions deploy <nome>` (as sem JWT com `--no-verify-jwt`).

### O que está ligado e o que não está (produção)
Ligado: Auth e-mail + Google, verificação de CNPJ, cron, Storage, todas as funções publicadas.
**Desligado/sem configurar**: Mercado Pago, Turnstile (captcha), Twilio (código do WhatsApp), Web Push (VAPID),
Sentry, SMTP próprio (Brevo), `CLEANUP_SECRET`, leaked password protection, URL Configuration do Auth (confirmar).

## 5. Como rodar e testar

```bash
cd web
npm ci
npm run dev            # http://localhost:5173 (demo se não houver .env.local)
npm run typecheck && npm run lint && npm run format:check && npm test   # 207 testes Vitest
npm run build          # produção: FALHA se faltar variável obrigatória (L01)
npm run build:demo     # demonstração (dados falsos)
npm run build:standalone
# Testes SQL (precisa de Docker):
./supabase/tests/local/setup.sh
DATABASE_URL=postgres://postgres:postgres@localhost:54322/postgres node supabase/tests/run.mjs supabase/tests/[a-z]*.sql
```
- Testes de serviço rodam nos dois modos; o modo real usa um **falso Supabase** (`src/__tests__/fakeSupabase.ts`):
  tabelas em memória, RPCs respondidas por função, chamadas gravadas para asserção. Use-o para todo serviço novo.
- Testes SQL: cada arquivo roda em `begin … rollback` (pode rodar até na produção sem deixar rastro). Helpers em
  `supabase/tests/_helpers.sql`: `pg_temp.login(uuid)`, `pg_temp.logout()`, `pg_temp.new_user(uuid, papel, nome)`,
  `pg_temp.ok(cond, msg)`, `pg_temp.fails(sql, sqlstate)`. Teste de segurança geral: `supabase/tests/seguranca.sql`.
- CI (`.github/workflows/web.yml`): job `checks` (typecheck, lint, format, testes, 3 builds, Lighthouse mobile
  mediana de 3, axe WCAG 2.1 AA em 14 telas) e job `sql` (Postgres `supabase/postgres:17.6.1.011`, testes SQL,
  `APLICAR-TUDO.sql` e tipos em dia). Último run do master: verde.

## 6. Convenções

- Idioma: **código, nomes e comentários em inglês nos arquivos TS; textos de tela, docs, migrations e commits em
  português.** Siga o que o arquivo ao redor já faz.
- Prettier + ESLint obrigatórios. Sem `any` novo. Sem dependências novas sem justificar (o bundle é medido no Lighthouse).
- IDs de trabalho: cada mudança tem um ID (Z/Y/X/W/L/F das rodadas anteriores; **L01–L14 nesta rodada**). Commit
  `tipo(ID): descrição` em português, um commit por ID. Registre decisões não óbvias em `web/docs/DECISOES.md`
  (formato: `## ID — título`, o problema, o que foi feito, por quê).
- Migration nova: arquivo `web/supabase/migrations/AAAAMMDDHHMMSS_<id>_<nome>.sql`, **idempotente**
  (`create … if not exists`, `create or replace`, blocos `do $$` para enums), com teste em `web/supabase/tests/<id>_*.sql`,
  depois `node scripts/aplicar-tudo.mjs` e `npm run gen:types`. RPC nova: `security definer`,
  `set search_path = public`, `revoke all … from public, anon`, `grant execute … to authenticated`, erro com `BC4xx`.
- UI: use os componentes de `src/components/` (Button, Input, Modal/Sheet, EmptyState, ErrorState, Skeleton,
  QueryView…), tokens de `styles/tokens.css` e o padrão de estados carregando/erro/vazio/offline (B10). Nada de
  tela branca nem botão girando para sempre.
- Acessibilidade e desempenho são critério de aceite (CI barra regressão).

## 7. Armadilhas conhecidas (leia antes de mexer)

1. **Build sem env = app de mentira.** Resolvido no L01: `npm run build` falha sem as variáveis; a demonstração é
   `npm run build:demo`. Mesmo assim, nunca publique sem conferir `IS_DEMO === false`.
2. **Histórico de migrations divergente** em produção: `supabase db push` direto vai tentar reaplicar tudo. Use o
   `repair` documentado em `APLICAR.md`, e só com aprovação.
3. **`pg_net` não aceita `ALTER EXTENSION … SET SCHEMA`**: para tirar de `public` é `drop extension pg_net` +
   `create extension pg_net with schema extensions`; as funções continuam em `net.*`. Teste no staging; confira
   `call_storage_cleanup` e o gatilho de push depois.
4. **O setup dos testes SQL e o `aplicar-banco.sh` aplicam as migrations legadas** de `web/supabase/legado/0*.sql`
   antes das novas, e `src/__tests__/utils.parity.test.ts` + `scripts/parity/` importam `archive/app`. Mover ou
   apagar qualquer um desses quebra o CI se não ajustar os pontos juntos (R06).
5. `public_job_card` é a única RPC para `anon`; os IDs de vaga são sequenciais (`BC-1`…) → enumeráveis (L10).
6. Política de privacidade e termos: a fonte é `web/src/services/legal.ts`; `/legal/*.md` é **gerado** dele
   (`LEGAL_WRITE=1 npx vitest run legal`, e o teste falha se divergir). O aviso "Rascunho para revisão jurídica" só
   some com `LEGAL_REVIEWED = true` (depois do advogado). Mudar `TERMS.version` faz todo mundo aceitar de novo
   (`/aceitar-termos`); cada aceite fica em `terms_acceptances` (L07).
7. Resolvido no L11: `VITE_SUPORTE_WHATSAPP` é obrigatório no build de produção e precisa ser celular com DDD (o padrão
   antigo `5494731661` saiu). `whatsappUrl` decide o `55` pelo tamanho (DDD 55 também começa com 55).
8. O conector do Supabase pede aprovação manual para mudanças: em sessão sem humano presente, prepare o SQL e pare.
9. Plano Free: sem backup diário e o projeto pausa por inatividade. Nada destrutivo em produção sem backup manual antes
   (`pg_dump` ou export pelo painel).

## 8. Documentos a consultar (não leia tudo de uma vez — vá pela seção)

| Arquivo | Para quê |
|---|---|
| `web/docs/CHECKLIST-LANCAMENTO.md` | lista viva do lançamento: o que a IA fez (com commit) e as **ações do responsável** |
| `web/docs/STAGING.md`, `web/docs/E2E.md`, `web/docs/VOLUME.md` | staging, testes de ponta a ponta (Playwright, `npm run e2e`) e teste de volume |
| `web/docs/SUPABASE.md` | banco, funções, segredos, serviços externos, hospedagem — **a referência operacional** |
| `web/supabase/APLICAR.md` | ordem das migrations, conferências, `repair` do histórico |
| `web/docs/CONTRATO-BACKEND.md` | contrato de cada serviço/RPC e das transições |
| `web/docs/DECISOES.md` | por que cada coisa é como é (por ID) |
| `web/docs/RELATORIO-FINAL.md` | o que a rodada anterior entregou |
| `web/docs/ADVISORS.md` | avisos do advisor e por que ficam |
| `web/docs/VALIDACAO.md`, `RELATORIO_PARIDADE.md`, `MAPEAMENTO.md` | histórico da migração do legado (raramente necessários) |

## 9. Regras de segurança para a IA

- Produção (`ppnxdajiihsjaojxokzh`): **somente leitura** sem aprovação explícita. Qualquer DDL, `delete`, mudança de
  Auth, segredo ou função publicada → mostre exatamente o que vai rodar e espere "pode".
- Nunca coloque `service_role`, tokens de provedor ou chaves privadas no front, no repo ou em logs.
- Nunca registre dado pessoal (nome, e-mail, CPF/CNPJ, telefone, selfie) em log, Sentry ou analytics.
- Não marque como feito o que depende do responsável (pagar plano, DNS, contas em provedores, advogado): documente o
  passo a passo e marque "ação do responsável".
