# Staging — o ensaio da produção (L02)

Projeto Supabase separado (`bicos-staging`, `sa-east-1`) com **o mesmo banco, as mesmas funções e a mesma
configuração de Auth da produção**, para testar migrations, o E2E (L03) e o volume do mural (L13) sem tocar em
dado real. Nada de produção é usado aqui: outra URL, outras chaves, outros segredos.

## Custo

- Organização no **plano Free** (hoje): até 2 projetos ativos. O projeto antigo `whfaujtppifeqnxoqfxb` está
  **pausado** e não conta, então o staging **não gera cobrança** — mas pausa depois de 7 dias sem uso (basta
  abrir o painel e "Restore").
- Depois de subir para o **Pro** (L08): cada projeto a mais paga a própria instância (Micro ≈ US$ 10/mês; o Pro
  traz US$ 10 de crédito, que cobre só um projeto). Conferir em https://supabase.com/pricing antes de decidir.

## 1. Criar o projeto — **ação do responsável** (ou a IA, depois do seu "pode")

Painel → New project → organização `nivotech.contato@gmail.com`, nome `bicos-staging`, região **South America
(São Paulo)**, senha forte do banco (guardar no cofre de senhas). Anote o **ref** (o código na URL do projeto).

**Criado em 16/10/2026**: ref `setyxomsbfrkneqqfoam` (https://setyxomsbfrkneqqfoam.supabase.co), organização
`cdbmayszwthxqckwozjg`, `sa-east-1`. Já tem `pg_cron`, `pg_net` (no `public`, como a produção — o L09 tira de lá),
PostGIS no `extensions` e a chave `nivotech_documento_key` no Vault (aleatória, só do staging).

## 2. Banco

**Pelo GitHub (recomendado)**: segredos `STAGING_DB_URL` e `STAGING_URL` no repositório → Actions › staging ›
Run workflow. O workflow (`.github/workflows/staging.yml`) roda o script abaixo e depois confere que o histórico
do banco é igual aos arquivos (`conferir-migrations.sh`, L09); também roda sozinho a cada migration nova no
`master`. (O conector do Supabase usado pela IA pede aprovação manual para cada comando com `drop`, e as
migrations têm muitos `drop policy`/`drop function` de recriação — por isso o banco não é montado por ele.)

**Ou à mão:**

```bash
cd web
STAGING_DB_URL='postgresql://postgres.<ref>:<senha>@aws-0-sa-east-1.pooler.supabase.com:5432/postgres' \
STAGING_URL='https://<ref>.supabase.co' \
  ./scripts/staging/aplicar-banco.sh
```

O script liga `pg_cron` e `pg_net`, aplica as migrations do app antigo (as novas ainda dependem delas — armadilha 4) e depois as do app, registrando cada uma no histórico com a versão do arquivo, e troca o endereço do Storage
gravado pela Z12 (`app_config.storage_public_base`, que vem com o da produção) pelo do staging — sem isso toda
foto é recusada. Recusa a conexão da
produção. Rodar de novo é seguro.

Conferência: `list_migrations` do staging = arquivos de `web/supabase/migrations/`. A produção só fica igual
depois do `repair` de `supabase/APLICAR.md` › "Histórico de migrations" (**com aprovação**). A checagem
automática está no CI (L09).

## 3. Edge Functions

```bash
cp supabase/functions/.env.staging.example supabase/functions/.env.staging   # preencher
npx supabase login                                    # ou SUPABASE_ACCESS_TOKEN=...
npx supabase secrets set --project-ref <ref> --env-file supabase/functions/.env.staging
STAGING_REF=<ref> ./scripts/staging/publicar-funcoes.sh
```

Segredos mínimos no staging: `APP_ORIGIN` (endereço do staging), `TURNSTILE_SECRET` (a chave de **teste**
`1x0000000000000000000000000000000AA`, que sempre aprova), `SENTRY_DSN` e `RELEASE`. Os de provedores pagos
(Mercado Pago **sandbox**, Twilio, VAPID) só quando o teste daquele recurso for rodar.

## 4. Auth igual à produção

Authentication do staging, item por item como em `docs/SUPABASE.md` › 3:

| Item                        | Staging                                                                     |
| --------------------------- | --------------------------------------------------------------------------- |
| Site URL / Redirect URLs    | endereço do staging (`https://staging.<projeto>.pages.dev` e `/**`)         |
| Confirm email               | ligado                                                                      |
| Senha mínima                | 8                                                                           |
| SMTP                        | Brevo, remetente `nao-responda@nivotech.com.br` (L04) — o mesmo da produção |
| Templates                   | os 4 de `web/supabase/email-templates/` (L04)                               |
| Google                      | opcional (precisa de outro Client ID com a Callback URL do staging)         |
| Captcha (Attack Protection) | Turnstile com a chave de teste                                              |

## 5. Front

```bash
cp .env.staging.example .env.staging.local     # preencher com a URL e a anon key do staging
npm run build:staging                          # mesmo build da produção (L01), outras variáveis
npm run deploy:staging                         # Cloudflare Pages, branch "staging" (L08)
```

## 6. Aceite

- Advisors do staging (security e performance) sem ERROR — anexar em `docs/ADVISORS.md`.
- `list_migrations` igual aos arquivos (e à produção depois do `repair`).
- E2E verde (`docs/E2E.md`, L03).
