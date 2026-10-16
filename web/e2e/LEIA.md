# E2E (L03) — os fluxos de ponta a ponta num backend de verdade

Playwright (celular Pixel 7, pt-BR) contra um Supabase de verdade: Auth, banco com todas as migrations, Storage e
as Edge Functions. Sete arquivos em `fluxos/`, rodados em ordem (cada um usa o que o anterior criou):

| Arquivo                   | O que prova                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------------- |
| `01-cadastro-trabalhador` | cadastro (CPF válido, 18+) → link de confirmação (Admin API) → completar perfil → mural     |
| `02-construtora-vaga`     | cadastro com CNPJ → vaga com foto → mural do trabalhador por cidade e por raio              |
| `03-candidatura`          | candidatar → construtora vê → aprova → WhatsApp dos dois lados → recusa outro → desfaz      |
| `04-diaria-avaliacao`     | contratar → presença → `conclude_finished_jobs()` → avaliações → notas nos perfis           |
| `05-seguranca-conta`      | denúncia e bloqueio → exportar dados → excluir conta (some do Auth e do Storage)            |
| `06-login`                | login por CPF e CNPJ → 6ª tentativa errada = 429 → recuperação de senha                     |
| `07-equipe`               | `/admin` (L06): conta comum barrada; identidade, construtora, denúncia, suspensão, registro |

As contas de teste usam `E2E_EMAIL_BASE` com `+e2e-<execução>` (o Gmail entrega com "+", nada rebate) e são
**apagadas no fim** pela função `excluir-conta` (`limpeza.ts`), passe ou falhe. `E2E_MANTER_CONTAS=1` mantém, para
depurar. Com `E2E_RELATORIO=1` o fim da execução reescreve `docs/E2E.md` e `docs/e2e-prints/`.

## No staging (CI, job `e2e`)

Segredos do repositório (Settings › Secrets and variables › Actions): `E2E_SUPABASE_URL`, `E2E_ANON_KEY`,
`E2E_SERVICE_ROLE_KEY` (do **staging**, nunca da produção), `E2E_EMAIL_BASE`. No staging: Redirect URLs com
`http://localhost:4173/**` (`EXTRA_REDIRECTS` do `scripts/configurar-auth.mjs`), `APP_ORIGIN` das funções incluindo
`http://localhost:4173`, Turnstile com as chaves de **teste** da Cloudflare. O job roda no `master` e à mão
(Actions › web › Run workflow); sem os segredos ele avisa e não faz nada.

À mão, apontando para o staging:

```bash
cd web
VITE_SUPABASE_URL=https://<ref>.supabase.co VITE_SUPABASE_ANON_KEY=… VITE_SITE_URL=http://localhost:4173 \
VITE_TURNSTILE_SITE_KEY=1x00000000000000000000AA VITE_SENTRY_DSN=https://e2e@sentry.invalid/1 \
  npx vite build --mode e2e --outDir dist-e2e
npx vite preview --outDir dist-e2e --port 4173 &
E2E_SUPABASE_URL=https://<ref>.supabase.co E2E_ANON_KEY=… E2E_SERVICE_ROLE_KEY=… npm run e2e
```

O modo de build `e2e` exige as mesmas variáveis da produção (L01), mas aceita `http://localhost`.

## Local, sem staging (`supabase start`)

1. Projeto de apoio fora do repositório: `supabase init`; em `config.toml`, portas 55321/55322/…, `site_url =
"http://localhost:4173/"`, `additional_redirect_urls = ["http://localhost:4173/**"]`, `[auth.email]
enable_confirmations = true` e `[realtime] enabled = false`; em `supabase/migrations/`: um arquivo com
   `create extension if not exists pg_cron; create extension if not exists pg_net;`, as migrations antigas de
   `/supabase/migrations/0*.sql` renomeadas com data (`20260901000000_legacy_000_baseline.sql`…) e as de
   `web/supabase/migrations/`.
2. `supabase start -x studio,logflare,vector,imgproxy,supavisor,postgres-meta,edge-runtime` (com
   `SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io` se o ECR recusar).
3. `update public.app_config set value = 'http://127.0.0.1:55400/storage/v1/object/public/' where key =
'storage_public_base';` (a Z12 grava o endereço da produção).
4. Funções no Deno + proxy: `E2E_SUPABASE_URL=http://127.0.0.1:55321 SUPABASE_ANON_KEY=… SUPABASE_SERVICE_ROLE_KEY=…
node e2e/local/servidor.mjs` (o app aponta para `http://127.0.0.1:55400`).
5. Build com `VITE_SUPABASE_URL=http://127.0.0.1:55400` (resto como acima) e `npx vite preview --outDir dist-e2e`.
6. `E2E_SUPABASE_URL=http://127.0.0.1:55321 E2E_FUNCTIONS_URL=http://127.0.0.1:55400 E2E_ANON_KEY=…
E2E_SERVICE_ROLE_KEY=… E2E_FAKE_TURNSTILE=1 npm run e2e`

## O que o E2E já achou

- A Z12 grava o endereço do Storage da **produção** em `app_config.storage_public_base`: num projeto novo toda foto
  era recusada. `scripts/staging/aplicar-banco.sh` agora troca (`STAGING_URL`).
- A suspensão (L06) gravava `banned_until = 'infinity'`, que o GoTrue não lê: o login da conta suspensa quebrava
  com erro 500 em vez de "Sua conta está suspensa". Corrigido (`fix(L06)`).
