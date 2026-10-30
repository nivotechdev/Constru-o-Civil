# Comandos e provas — C2 (resumo; sem dado pessoal nem segredo)

- Leitura: `Read` por inteiro dos 33 arquivos de `lists/C2.txt` (ver coverage.tsv). Apoio lido: `utils/image.ts`, `utils/media.ts`, `build/env.ts`, `vite.config.ts`, trechos de `WorkerPosts.tsx`, `JobMap.tsx`, `ErrorBoundary.tsx`, `busy.ts`, `auth.ts` (signOut/telefone), `App.tsx` (OfflineStart), `main.tsx`, `boot.ts`.
- Logs da Frente 1 consultados: `$SCRATCH/f1/knip.log` (exports sem uso: RELEASE, notificationGroup, DEFAULT_PREFS, isLocalMedia, storagePath), `madge.log` (24 ciclos, todos em services/), `typecheck.log`/`lint.log`/`unused.log` (limpos).
- `git log -p -- web/src/services/legal.ts | grep -E "^[+-]\s+(version|updatedAt):"` → só a criação (`'2.0'`, `'2026-10-15'`); commits d065387, aa87ea2, a5c76d7 (21/10) mudaram o corpo.
- Build de produção simulado (modo real, env fictício): `VITE_SUPABASE_URL=https://x.supabase.co VITE_SUPABASE_ANON_KEY=anon VITE_SITE_URL=… VITE_TURNSTILE_SITE_KEY=k VITE_SENTRY_DSN=… VITE_SUPORTE_WHATSAPP=… npx vite build --mode e2e --outDir $SCRATCH/dist-c2` → exit 0, 2 avisos legais e 4 avisos `dynamically imported … but also statically imported` (log em `build-e2e.log`). `grep -l bicos123 dist-c2/assets/*.js` → só `index-Qs53pM_j.js` (653 KB, 202 KB gzip); supabase-js em chunk próprio (`index-DaueY-7D.js`, 224 KB).
- Reproduções com o falso Supabase do projeto (config própria fora do repositório: `repro-vitest.config.ts`, rodar dentro de `web/` com `npx vitest run --config <caminho>`):
  - `repro-respostas-tardias.test.ts` → `AFTER LOGOUT: session= null notifications in store= 3 unreadTotal= 3 query state= ready` e `B session= u-obra bell badge for B= 3 B notices listed= 0` (C2-005).
  - `repro-sair-durante-checagem.test.ts` → `right after Sair: session= null cache= false` / `900 ms later: session= u-ana cache saved again= true` (C2-005, prova 2).
  - `repro-edge-function-offline.test.ts` → `RESULT code= falha_demo …` e `expected 'falha_demo' to be 'offline'` (C2-009; o teste falha de propósito).
- `node -e` com 3 e 12 posts do mesmo dia e o comparador de `postsForWorker` → `a,b,c,old` e `p1,p2,…,p12` (ordem invertida) (C2-011).
- `grep -rn reportError web/src` → só ErrorBoundary.tsx:57 (C2-006). `grep -rn disablePush web/src` (C2-008). `grep -rn drivingRoute` → só JobMap.tsx:54; `JobDetail.tsx:274 home={workerHome(db)}` (C2-001). `grep -c -i firebase web/src/services/legal.ts` → 0 (C2-014).
- Migrations conferidas: `20261014000300_x03_push.sql:27-62` (upsert reatribui `account_id`), `20261010000700_z12_fotos.sql:20-60,100-107` (buckets e triggers de URL), `20261022000300_u65_valor_minimo.sql` (feed_jobs sem `blocks`).
- Não rodei nada contra produção nem staging (nenhuma consulta ao banco; esta frente é só código do cliente).
- Os scripts ficam no scratchpad (`$SCRATCH/c2test/`); nada foi criado no repositório (`git status` limpo para arquivos versionados; `web/dist` e `dist-standalone` já existiam e são ignorados).
