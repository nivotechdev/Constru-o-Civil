# O2 — comandos e saídas (resumidos; sem dados pessoais nem segredos)

Variáveis: `S=/tmp/claude-0/-home-user-Constru-o-Civil/f7eb04d4-415c-56cc-909b-2a763e36dc76/scratchpad/out/O2`. Logs completos em `$S/runs/`.

## Suíte Vitest (repositório, `cd web`)

- `npx vitest run` → `Test Files 35 passed, Tests 287 passed`, 10,7 s (`runs/run1.log`). `git status` limpo depois.
- Matriz de fusos e ordem (script `$S/run-matrix.sh`; resultado em `runs/summary.txt`):
  - `TZ=America/Sao_Paulo`, `UTC`, `America/Los_Angeles` → exit 0.
  - `TZ=Asia/Tokyo`, `TZ=Pacific/Kiritimati` → exit 1: `FAIL applications.test.ts > Y01 … AssertionError: expected 'vencida' to be 'cheia'` (linha 242).
  - `npx vitest run --sequence.shuffle --sequence.seed={1,42,1337,99999,2026}` → exit 0 (5/5).
  - repetições 2 e 3 → exit 0.
  - `TZ=Asia/Tokyo … --sequence.seed=7` e `TZ=Pacific/Kiritimati … --sequence.seed=8` → exit 1 (a mesma falha).
- Relógio emulado (pré-carregamento `$S/tools/shift-clock.cjs`, que desloca `Date` no processo):
  `TZ=America/Sao_Paulo NODE_OPTIONS="--require $S/tools/shift-clock.cjs" FAKE_NOW_ISO=2026-10-30T01:30:00Z npx vitest run` (= 22h30 em Brasília) → `Tests 5 failed | 282 passed` (L07, Y01, Y04, Y07, "a job that closes by itself"); com `02:59:00Z` (23h59) → os mesmos 5; com `2026-10-29T13:00:00Z` (10h00) → 287 passam.
- Sonda do ramo condicional (Y02) numa cópia: `BC-4995 start 2026-11-02 today 2026-10-30 branch runs: true`.
- Buscas: `.skip|.only|.todo|xit|fit(` em `src/__tests__` e `e2e` → nenhuma ocorrência; `toBeTruthy` 4, `toBeDefined` 4, `toBeGreaterThan(0)` 7; `waitForTimeout` 1 (`08-cadastro-google.spec.ts:27`); `setTimeout(r, N)` em `remote.test.ts` 974/1073/1100/1419/1420.

## Cobertura (cópia em `$S/cov/web`, repositório intocado)

- `tar` de `web/` (sem `dist`) para `$S/cov/web`, `legal/` ao lado; `npm i --no-save @vitest/coverage-v8@3.2.7`; `npx vitest run --coverage --coverage.provider=v8 --coverage.reporter=json-summary --coverage.include='src/**/*.{ts,tsx}' --coverage.exclude='src/**/__tests__/**' --coverage.exclude='src/types/**'`.
- Total: linhas 37,7% (8.962/23.767), ramos 77,5%. Por pasta na matriz-testes.md §2.

## Testes SQL

- Não rodei: `docker info` → "Cannot connect to the Docker daemon"; `psql` existe, não há servidor Postgres.
- `ok()`/`fails()` provados em PGlite (`$S/pglite/harness.mjs`, `@electric-sql/pglite@0.3.14` instalado no scratchpad): `ok(true)` passa; `ok(false)`, `ok(NULL)`, `ok(bool_and sobre tabela vazia → NULL)` falham; `fails($$select 1/0$$,'22012')` passa; com outro SQLSTATE falha; SQL que tem sucesso falha; `delete` de 0 linhas esperando recusa falha; erro solto no meio do arquivo falha. `ok(not exists (…))` sobre conjunto vazio passa (verdade vazia — esperado).
- Contagens: `grep -o 'pg_temp.ok(' tests/[a-z]*.sql` 368; `pg_temp.fails(` 194 (`BC409` 26, `BC422` 56, `BC401` 19, `42501` 76, `23505` 2, `23514` 10); linhas com `sqlerrm` 4. `exception when others` só em `u48:24` (re-lança se a mensagem difere); `commit`: nenhuma ocorrência.
- RPC × testes: `$S/rpc_authenticated.txt` (62, via `pg_proc` do staging: `has_function_privilege('authenticated'|'anon')`), `$S/rpc_service_only.txt` (35); cruzamento por `grep -w` → `$S/rpc_coverage_auth.tsv`, `$S/rpc_coverage_svc.tsv` (colunas: nome, arquivos SQL, arquivos Vitest, arquivos E2E).
- RLS: `select relname, relrowsecurity, count(policy) from pg_class …` no staging: 39 tabelas (7 legadas), todas com RLS; tabelas × arquivos de teste em `$S/rls_tables_tests.tsv`.

## Staging (somente leitura)

- `select count(*) …`: `auth.users` 13, com e-mail `%+e2e-%` 0; `accounts` 12; `jobs` 11 (nenhuma "E2E"); `reports` 0; `blocks` 0; `staff_members` 0; `storage.objects` 326; `staff_actions` 265 (aprovar_identidade 70, reativar_conta 65, suspender_conta 65, aprovar_construtora 65; 19/10 a 24/10).

## GitHub Actions

- `web.yml` master run 40117686113 (24/10): `checks` e `sql` success; job `e2e` success **com todos os passos de trabalho `skipped`** (segredos `E2E_*` ausentes).
- `staging.yml` run 40117427320 (24/10): `migrations`, `funcoes` e `e2e` success; "E2E (Playwright)" 17:51:28 → 17:55:17.

## Observações

- `legal.test.ts` lê `../../../legal/*.md`: rodar a suíte só com `web/` copiado dá 2 falhas por causa do layout, não do código.
- Nada foi escrito dentro de `/home/user/Constru-o-Civil`; o `git status` ficou limpo (verificado depois da primeira execução e antes do fim).
