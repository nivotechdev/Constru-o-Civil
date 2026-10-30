# D4 — comandos e consultas relevantes (saídas resumidas, sem dado pessoal nem segredo)

## Edge Functions publicadas

- `list_edge_functions` produção: 8 funções (`entrar-com-documento` v2, as outras v1; criadas 09–12/10); faltam `verificar-cadastro` e `entrar-com-firebase`. Staging: 10 funções (v81–v151, última publicação 24/10).
- `get_edge_function` produção (8 de 8) lido e comparado com o repo: `_shared/captcha.ts` publicado devolve `true` sem `TURNSTILE_SECRET`; `_shared/http.ts` com `APP_ORIGIN ?? '*'`; `enviar-push` com `VAPID_SUBJECT` padrão de e-mail pessoal; `_shared/monitoring.ts` sem scrub de JWT. `verify_jwt` igual à tabela de `SUPABASE.md` §4.
- `get_edge_function` staging `verificar-cadastro` (v103): sem o captcha do X32.
- `query_logs` produção (24 h, `function_edge_logs`): 1 linha, `/functions/v1/limpar-arquivos` status 401. `function_logs`: 2 linhas, ambas das 04:40 de hoje.

## Banco (staging, só leitura; medições dentro de `raise exception`, nada gravado)

- `pg_proc.proacl` das 12 RPCs internas: `{postgres, service_role}`; `anon`/`authenticated` sem `execute`.
- `pg_get_functiondef`: `document_login_email`, `signup_taken`, `mark_whatsapp_verified`, `rate_limit_hit`, `confirm_boost_payment`, `fail_boost_payment`, `attach_boost_charge`, `orphan_storage_objects`, `save_push_subscription`, `admin_suspend_account`, `delete_my_account`.
- Medição do tempo: `document_login_email('52998224725','…')` (CPF de teste sem conta) média de 20 chamadas = 0,55 ms; `crypt()` contra um hash bcrypt existente = 77,84 ms.
- `auth_attempts`: chaves `cadastro-ip:<ipv4>` (um IPv4 por chave) e `cadastro:<sha256>`; `rate_limit_hit` insere antes de contar.
- `storage.buckets`: `avatars` 10 MB (jpeg/png/webp), `identidade` 10 MB privado, `portfolio` 50 MB (+ mp4/mov/webm), `vagas` 10 MB. `pg_policies` de `storage.objects`: 9 políticas, todas por `storage.foldername(name)[1] = auth.uid()`; leitura de `identidade` só `is_staff()`.
- `app_config`: `storage_public_base` existe no staging (com o endereço do staging) e na produção (contagem 1).
- `auth.users`: produção 4 (0 não confirmados, 0 banidos, 0 anônimos); staging 13 (idem).
- `accounts.document`: valores mascarados no staging (nenhum só com dígitos).
- `get_advisors` security: produção e staging com `auth_leaked_password_protection` WARN; produção com `pg_net` em `public`.

## Navegador (Chromium em `/opt/pw-browsers`, Playwright core do repo, sem rede externa)

- `anexos/csp-media.mjs`: página com o CSP de `_headers` e `<video src="https://…supabase.co/…mp4">` → "Loading media … violates … default-src 'self'. Note that 'media-src' was not explicitly set".
- `anexos/csp-blob.mjs`: `<video>` com `blob:` criado por `URL.createObjectURL` → o mesmo bloqueio.
- `anexos/csp-app.mjs`: `dist-demo` servido com o CSP de `_headers`, 8 rotas públicas → 0 violações.

## Deno (2.9.6 via `npx --yes deno`, cópia das funções no scratchpad, `DENO_DIR` próprio)

- `deno check --no-lock */index.ts` (como o CI): sem erros. `deno lint`: "Checked 17 files", sem erros.
- `anexos/sig.ts`: `validSignature` → `ts` atual true; 1 h atrás false; `ts="abc"` com HMAC correto **true**; `ts` em ms true.
- `anexos/origin.ts`: `originsProblem` aceita `https://*.com`, `https://*.pages.dev`; `allowedOrigin(['https://*.com'],'https://evil.com')` devolve `https://evil.com`.

## Repositório

- `grep` de `dangerouslySetInnerHTML|innerHTML|eval|document.write|postMessage` em `web/src` → nenhum. `target="_blank"` → todos com `rel`. `window.open` com `noopener`. `localStorage`: sessão/tema/`bicos.conta` (documento mascarado). `console.*` só em `monitoring.ts:145` (demo/sem DSN).
- `grep` de padrões de segredo (service_role, BEGIN PRIVATE KEY, `sbp_`, `APP_USR-`, `sk_live`, AIza, JWT) em `src public scripts supabase docs e2e` e `dist-demo` → só comentários SQL/TS com a palavra `service_role`. `git log --all -G'<padrões>'` (279 commits) → nenhum.
- `grep -rn "AbortSignal|timeout" web/supabase/functions` → vazio.
- `grep -rn "cf-connecting-ip|x-forwarded-for"`: SQL `public_job_card` prefere `cf-connecting-ip`; `_shared/http.ts:65` usa o primeiro `x-forwarded-for`.
- `git log`: staging publicado do `master` (5bddd2c, 24/10); commit auditado 67d9ffb tem mais 6 commits.
