# Limpeza do repositório (C01–C12)

> Objetivo: deixar o projeto mais leve e mais fácil de entender **sem mudar nada que o usuário vê** nem como o app
> funciona. Regra de ouro: comportamento idêntico antes e depois. Este documento guarda a linha de base (C01), o
> inventário (C02) e, ao fim, a comparação (C10–C12).
>
> Ponto de partida: branch `claude/front-novo-supabase` no commit `845c9c8` (U04). A tag `antes-da-limpeza` **não
> pôde ser criada**: o GitHub recusou o envio da tag e de uma branch-âncora fora do padrão `claude/*` nesta sessão.
> A âncora é o próprio commit `845c9c8`, já no GitHub, no branch `claude/front-novo-supabase`, que esta rodada não
> reescreve. Trabalho em `claude/limpeza`.

## Antes (C01)

### Contagens (arquivos rastreados pelo Git, sem `node_modules`, `dist`, `.git`)

- **709 arquivos**, **104.626 linhas**.
- Por pasta de primeiro nível: `web/` 510 arquivos; `archive/` 192; `.github/` 3; `legal/` 2; `CLAUDE.md` e
  `README.md` na raiz.
- Por tipo (topo): 153 `.ts`, 118 `.tsx`, 118 `.sql`, 76 `.js`, 65 `.svg`, 56 `.jpg`, 37 `.md`, 17 `.css`,
  16 `.png`, 11 `.mjs`, 11 `.json`, 9 `.html`, 8 `.sh`.

### Checagens (web/)

| Checagem                                                        | Resultado                                                                                                                                                               |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`                                             | OK                                                                                                                                                                      |
| `npm run lint`                                                  | OK                                                                                                                                                                      |
| `npm run format:check`                                          | OK                                                                                                                                                                      |
| `npx vitest run`                                                | **25 arquivos, 217 testes passando**                                                                                                                                    |
| `vite build --mode demo`                                        | OK                                                                                                                                                                      |
| `vite build --mode staging`                                     | OK                                                                                                                                                                      |
| `vite build --mode standalone`                                  | OK                                                                                                                                                                      |
| Testes SQL locais (`supabase/tests/local/setup.sh` + `run.mjs`) | **47 arquivos passando**                                                                                                                                                |
| axe (WCAG 2.1 AA, 14 telas, `scripts/a11y-check.mjs`)           | OK                                                                                                                                                                      |
| Lighthouse mobile, 3 rodadas (`scripts/lighthouse-check.mjs`)   | **desempenho 80** (meta 85; rodadas 88, 80, 80); acessibilidade 100; boas práticas 100                                                                                  |
| E2E (Playwright) local                                          | **não rodado nesta sessão**: o Supabase local de E2E não estava de pé. Último resultado: job `e2e` do staging no commit `845c9c8`, verde (13 testes, run `39313626464`) |

O desempenho 80 é uma medição **local** (máquina de sessão, não o runner do CI). Fica registrado como linha de base;
não é alterado nesta rodada.

### Peso do app (chunks de `dist/`, bruto e gzip)

| Build   | Arquivos (JS/CSS/HTML) | Total bruto | Total gzip |
| ------- | ---------------------- | ----------- | ---------- |
| demo    | 98                     | 2.651.730 B | 760.763 B  |
| staging | 98                     | 2.652.379 B | 761.150 B  |

Maiores chunks (demo): `index-DjlrP-Um.js` 628.312 B (194.157 gzip); `index-DaueY-7D.js` 224.501 B (58.512 gzip);
`index-CUiwdXoZ.css` 47.008 B (9.204 gzip); `WorkerProfileScreen-A4-znaxa.js` 23.483 B; `workbox-35e397ac.js` 21.777 B.
Lista completa (cada arquivo, bruto e gzip): `/tmp/claude-0/…/scratchpad/base-sizes-demo.txt` (fora do repositório).

### Fotografia de todas as telas (C01)

Script: `web/scripts/limpeza/fotografar.mjs` (`FOTOS=<pasta fora do repositório> node scripts/limpeza/fotografar.mjs <rótulo>`).
Abre **cada uma das 54 rotas** de `src/routes.ts` no modo demonstração, em 360×800 e 1280×800, com a sessão que a rota
pede (sem login, trabalhador, construtora). Resultado: **108 prints, 0 erros**. Os prints e o `rotas.json` ficam em
`/tmp/claude-0/fotos/antes/`, fora do repositório. Os estados de "lista vazia", "modal aberto" e "erro de formulário"
não foram capturados de forma sistemática nesta passada: a fotografia cobre as rotas, não cada estado.

## Inventário (C02)

### Método

1. **Ferramentas** (sem alterar o `package.json`): `knip@5` (arquivos, exports, tipos), `depcheck`,
   `tsc --noUnusedLocals --noUnusedParameters` (**0 alertas**) e busca de tokens CSS em `src/styles/tokens.css`.
   Tudo o que apontaram virou candidato, não veredito.
2. **Referências manuais** para cada candidato: `rg` e `git grep` por nome, por nome sem extensão e por caminho,
   incluindo `vite.config`, `vite-plugin-pwa`, `_headers`, `playwright.config`, workflows e scripts.
3. **Por categoria**: raiz, `archive/`, migrations, documentos, imagens, scripts, restos de sistema.
4. **Revisão adversária**: um subagente separado, que não viu este raciocínio, recebeu só os candidatos a remoção
   e a tarefa de provar que cada um é usado. Ele confirmou os 3 símbolos a remover e derrubou falsos positivos do knip
   (listados abaixo como classe C).

**Achados que a ferramenta não enxerga** (são usos reais): `postcss.config.js` (lido pelo Vite), `pwaStub.ts`
(alias do build standalone), `push-sw.js` (`importScripts` do workbox), `legacy.d.ts` (deixa o typecheck aceitar os
testes de paridade, que importam `archive/app/*.js`), `e2e/limpeza.ts` (globalTeardown do Playwright), as funções do
Supabase (entradas do Deno) e os scripts de linha de comando (usados pelo CI ou pelos documentos operacionais).

### Resumo

| Classe                 | Quantidade                                  | O que é                                                                    |
| ---------------------- | ------------------------------------------- | -------------------------------------------------------------------------- |
| A, remover             | 3 símbolos, 4 tokens CSS, 1 arquivo         | código que as quatro passadas não acharam usado                            |
| A, tirar `export`      | 37 símbolos                                 | usados só dentro do próprio arquivo: sai a palavra `export`, o código fica |
| A, corrigir comentário | 2 comentários                               | citam `LegacyRerender.tsx`, que já não existe                              |
| B, remover com ajuste  | 0                                           |                                                                            |
| C, manter              | 16 símbolos e os arquivos de tooling abaixo | usados por um caminho que a ferramenta não vê                              |
| D, decidir             | 12 símbolos, 1 script, pastas de histórico  | dependem da sua decisão                                                    |

### Símbolos exportados sem uso (knip: 68)

| Símbolo                      | Origem                                   | Classe | Prova                                                                                               | Ação                                              |
| ---------------------------- | ---------------------------------------- | ------ | --------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `DEMO_MODES`                 | export (build/env.ts)                    | A      | Interno=interno=2, fora do arquivo=0 em web/src, e2e, scripts, supabase, build                      | Tirar a palavra export (uso só dentro do arquivo) |
| `E2E_MODE`                   | export (build/env.ts)                    | A      | Interno=interno=2, fora do arquivo=0 em web/src, e2e, scripts, supabase, build                      | Tirar a palavra export (uso só dentro do arquivo) |
| `PRODUCTION_ENV`             | export (build/env.ts)                    | A      | Interno=interno=2, fora do arquivo=0 em web/src, e2e, scripts, supabase, build                      | Tirar a palavra export (uso só dentro do arquivo) |
| `PILOT_WITHOUT_LEGAL_REVIEW` | export (build/env.ts)                    | A      | Interno=interno=3, fora do arquivo=0 em web/src, e2e, scripts, supabase, build                      | Tirar a palavra export (uso só dentro do arquivo) |
| `salvar`                     | export (e2e/apoio.ts)                    | D      | Usado fora do arquivo (fora=5 arquivo(s)); conferir se é uso real ou só texto em docs/archive       | Decidir                                           |
| `StarPicker`                 | export (src/components/ReviewForm.tsx)   | A      | Interno=interno=2, fora do arquivo=0 em web/src, e2e, scripts, supabase, build                      | Tirar a palavra export (uso só dentro do arquivo) |
| `TileSkeleton`               | export (src/components/Skeleton.tsx)     | A      | Interno=interno=2, fora do arquivo=0 em web/src, e2e, scripts, supabase, build                      | Tirar a palavra export (uso só dentro do arquivo) |
| `REGIOES_TRABALHADOR`        | export (src/data/seed.ts)                | D      | Só a declaração em src/data/seed.ts; mesmo nome em outro arquivo; dúvida sobre dados futuros        | Decidir (constante de dados)                      |
| `REGIOES_RECRUTADOR`         | export (src/data/seed.ts)                | D      | Só a declaração em src/data/seed.ts; mesmo nome em outro arquivo; dúvida sobre dados futuros        | Decidir (constante de dados)                      |
| `MAX_DAYS`                   | export (src/pages/recruiter/jobForm.ts)  | A      | Interno=interno=4, fora do arquivo=0 em web/src, e2e, scripts, supabase, build                      | Tirar a palavra export (uso só dentro do arquivo) |
| `MAX_PAY`                    | export (src/pages/recruiter/jobForm.ts)  | A      | Interno=interno=3, fora do arquivo=0 em web/src, e2e, scripts, supabase, build                      | Tirar a palavra export (uso só dentro do arquivo) |
| `MIN_DESCRIPTION`            | export (src/pages/recruiter/jobForm.ts)  | A      | Interno=interno=3, fora do arquivo=0 em web/src, e2e, scripts, supabase, build                      | Tirar a palavra export (uso só dentro do arquivo) |
| `formPoint`                  | export (src/pages/recruiter/jobForm.ts)  | A      | Interno=interno=3, fora do arquivo=0 em web/src, e2e, scripts, supabase, build                      | Tirar a palavra export (uso só dentro do arquivo) |
| `DEFAULT_CITY`               | export (src/pages/worker/feed/feedUI.ts) | D      | Usado fora do arquivo (fora=6 arquivo(s)); conferir se é uso real ou só texto em docs/archive       | Decidir                                           |
| `ALL_CITY`                   | export (src/pages/worker/feed/feedUI.ts) | A      | Interno=interno=7, fora do arquivo=0 em web/src, e2e, scripts, supabase, build                      | Tirar a palavra export (uso só dentro do arquivo) |
| `ALERTS_PER_DAY`             | export (src/services/alerts.ts)          | C      | Usado: passada 4 (adversária) localizou o uso; o knip não vê o uso interno/por tipo                 | Manter                                            |
| `alertMatches`               | export (src/services/alerts.ts)          | C      | Usado: passada 4 (adversária) localizou o uso; o knip não vê o uso interno/por tipo                 | Manter                                            |
| `REGIOES_RECRUTADOR`         | export (src/services/catalog.ts)         | D      | Só a declaração em src/services/catalog.ts; mesmo nome em outro arquivo; dúvida sobre dados futuros | Decidir (constante de dados)                      |
| `REGIOES_TRABALHADOR`        | export (src/services/catalog.ts)         | D      | Só a declaração em src/services/catalog.ts; mesmo nome em outro arquivo; dúvida sobre dados futuros | Decidir (constante de dados)                      |
| `RELEASE`                    | export (src/services/monitoring.ts)      | D      | Usado fora do arquivo (fora=2 arquivo(s)); conferir se é uso real ou só texto em docs/archive       | Decidir                                           |
| `notificationGroup`          | export (src/services/notifications.ts)   | A      | Interno=interno=2, fora do arquivo=0 em web/src, e2e, scripts, supabase, build                      | Tirar a palavra export (uso só dentro do arquivo) |
| `DEFAULT_PREFS`              | export (src/services/notifications.ts)   | A      | Interno=interno=2, fora do arquivo=0 em web/src, e2e, scripts, supabase, build                      | Tirar a palavra export (uso só dentro do arquivo) |
| `vapidKeyBytes`              | export (src/services/push.ts)            | C      | Usado: passada 4 (adversária) localizou o uso; o knip não vê o uso interno/por tipo                 | Manter                                            |
| `saveSubscription`           | export (src/services/push.ts)            | C      | Usado: passada 4 (adversária) localizou o uso; o knip não vê o uso interno/por tipo                 | Manter                                            |
| `dropApplication`            | export (src/services/remote/merge.ts)    | A      | Sem uso em web/ (knip + busca; confirmado pela passada 4)                                           | Remover o símbolo                                 |
| `clearAccountCache`          | export (src/services/remote/session.ts)  | A      | Interno=interno=2, fora do arquivo=0 em web/src, e2e, scripts, supabase, build                      | Tirar a palavra export (uso só dentro do arquivo) |
| `MissingAccountError`        | export (src/services/remote/session.ts)  | A      | Interno=interno=6, fora do arquivo=0 em web/src, e2e, scripts, supabase, build                      | Tirar a palavra export (uso só dentro do arquivo) |
| `isLocalMedia`               | export (src/services/remote/storage.ts)  | C      | Usado: passada 4 (adversária) localizou o uso; o knip não vê o uso interno/por tipo                 | Manter                                            |
| `storagePath`                | export (src/services/remote/storage.ts)  | C      | Usado: passada 4 (adversária) localizou o uso; o knip não vê o uso interno/por tipo                 | Manter                                            |
| `safeDecode`                 | export (src/services/router.ts)          | A      | Interno=interno=2, fora do arquivo=0 em web/src, e2e, scripts, supabase, build                      | Tirar a palavra export (uso só dentro do arquivo) |
| `RELATIONSHIPS`              | export (src/types/supabase.ts)           | A      | Sem uso em web/ (knip + busca; confirmado pela passada 4)                                           | Remover o símbolo                                 |
| `IN_PROGRESS`                | export (src/utils/applicationStatus.ts)  | A      | Interno=interno=2, fora do arquivo=0 em web/src, e2e, scripts, supabase, build                      | Tirar a palavra export (uso só dentro do arquivo) |
| `MAX_SIDE`                   | export (src/utils/image.ts)              | A      | Interno=interno=2, fora do arquivo=0 em web/src, e2e, scripts, supabase, build                      | Tirar a palavra export (uso só dentro do arquivo) |
| `isHeic`                     | export (src/utils/image.ts)              | A      | Interno=interno=2, fora do arquivo=0 em web/src, e2e, scripts, supabase, build                      | Tirar a palavra export (uso só dentro do arquivo) |
| `fitsDias`                   | export (src/utils/jobInfo.ts)            | C      | Usado: passada 4 (adversária) localizou o uso; o knip não vê o uso interno/por tipo                 | Manter                                            |
| `TO_ARRANGE_DAYS`            | export (src/utils/jobInfo.ts)            | C      | Usado: passada 4 (adversária) localizou o uso; o knip não vê o uso interno/por tipo                 | Manter                                            |
| `fullAddressText`            | export (src/utils/jobInfo.ts)            | C      | Usado: passada 4 (adversária) localizou o uso; o knip não vê o uso interno/por tipo                 | Manter                                            |
| `WAGE_PAYMENTS`              | export (src/utils/jobInfo.ts)            | A      | Interno=interno=2, fora do arquivo=0 em web/src, e2e, scripts, supabase, build                      | Tirar a palavra export (uso só dentro do arquivo) |
| `MAX_PHOTO_MB`               | export (src/utils/media.ts)              | C      | Usado: passada 4 (adversária) localizou o uso; o knip não vê o uso interno/por tipo                 | Manter                                            |
| `MAX_VIDEO_MB`               | export (src/utils/media.ts)              | C      | Usado: passada 4 (adversária) localizou o uso; o knip não vê o uso interno/por tipo                 | Manter                                            |
| `MAX_VIDEO_SECONDS`          | export (src/utils/media.ts)              | C      | Usado: passada 4 (adversária) localizou o uso; o knip não vê o uso interno/por tipo                 | Manter                                            |
| `Conta`                      | export (e2e/apoio.ts)                    | D      | Usado fora do arquivo (fora=30 arquivo(s)); conferir se é uso real ou só texto em docs/archive      | Decidir                                           |
| `Estado`                     | export (e2e/apoio.ts)                    | A      | Interno=interno=7, fora do arquivo=0 em web/src, e2e, scripts, supabase, build                      | Tirar a palavra export (uso só dentro do arquivo) |
| `Call`                       | export (src/**tests**/fakeSupabase.ts)   | A      | Interno=interno=3, fora do arquivo=0 em web/src, e2e, scripts, supabase, build                      | Tirar a palavra export (uso só dentro do arquivo) |
| `FakeOptions`                | export (src/**tests**/fakeSupabase.ts)   | A      | Interno=interno=2, fora do arquivo=0 em web/src, e2e, scripts, supabase, build                      | Tirar a palavra export (uso só dentro do arquivo) |
| `ReviewFormValues`           | export (src/components/ReviewForm.tsx)   | A      | Interno=interno=2, fora do arquivo=0 em web/src, e2e, scripts, supabase, build                      | Tirar a palavra export (uso só dentro do arquivo) |
| `SelectOption`               | export (src/components/Select.tsx)       | A      | Interno=interno=2, fora do arquivo=0 em web/src, e2e, scripts, supabase, build                      | Tirar a palavra export (uso só dentro do arquivo) |
| `Action`                     | export (src/hooks/useAction.ts)          | A      | Interno=interno=2, fora do arquivo=0 em web/src, e2e, scripts, supabase, build                      | Tirar a palavra export (uso só dentro do arquivo) |
| `MenuEntry`                  | export (src/layouts/accountMenu.ts)      | A      | Interno=interno=2, fora do arquivo=0 em web/src, e2e, scripts, supabase, build                      | Tirar a palavra export (uso só dentro do arquivo) |
| `EditLimits`                 | export (src/pages/recruiter/jobForm.ts)  | A      | Interno=interno=3, fora do arquivo=0 em web/src, e2e, scripts, supabase, build                      | Tirar a palavra export (uso só dentro do arquivo) |
| `FeedFilters`                | export (src/pages/worker/feed/feedUI.ts) | A      | Interno=interno=3, fora do arquivo=0 em web/src, e2e, scripts, supabase, build                      | Tirar a palavra export (uso só dentro do arquivo) |
| `RouteDef`                   | export (src/routes.ts)                   | A      | Interno=interno=8, fora do arquivo=0 em web/src, e2e, scripts, supabase, build                      | Tirar a palavra export (uso só dentro do arquivo) |
| `AdminData`                  | export (src/services/admin.ts)           | A      | Interno=interno=4, fora do arquivo=0 em web/src, e2e, scripts, supabase, build                      | Tirar a palavra export (uso só dentro do arquivo) |
| `BootStatus`                 | export (src/services/boot.ts)            | A      | Interno=interno=4, fora do arquivo=0 em web/src, e2e, scripts, supabase, build                      | Tirar a palavra export (uso só dentro do arquivo) |
| `SentryFrame`                | export (src/services/monitoring.ts)      | A      | Interno=interno=4, fora do arquivo=0 em web/src, e2e, scripts, supabase, build                      | Tirar a palavra export (uso só dentro do arquivo) |
| `SentryEvent`                | export (src/services/monitoring.ts)      | A      | Interno=interno=4, fora do arquivo=0 em web/src, e2e, scripts, supabase, build                      | Tirar a palavra export (uso só dentro do arquivo) |
| `AccountRow`                 | export (src/services/remote/merge.ts)    | D      | Usado fora do arquivo (fora=1 arquivo(s)); conferir se é uso real ou só texto em docs/archive       | Decidir                                           |
| `WorkerRowRead`              | export (src/services/remote/merge.ts)    | A      | Interno=interno=2, fora do arquivo=0 em web/src, e2e, scripts, supabase, build                      | Tirar a palavra export (uso só dentro do arquivo) |
| `CompanyRowRead`             | export (src/services/remote/merge.ts)    | A      | Interno=interno=2, fora do arquivo=0 em web/src, e2e, scripts, supabase, build                      | Tirar a palavra export (uso só dentro do arquivo) |
| `ReviewRow`                  | export (src/services/remote/merge.ts)    | D      | Usado fora do arquivo (fora=2 arquivo(s)); conferir se é uso real ou só texto em docs/archive       | Decidir                                           |
| `Bucket`                     | export (src/services/remote/storage.ts)  | D      | Usado fora do arquivo (fora=3 arquivo(s)); conferir se é uso real ou só texto em docs/archive       | Decidir                                           |
| `SupabaseConfig`             | export (src/services/supabase.ts)        | A      | Interno=interno=2, fora do arquivo=0 em web/src, e2e, scripts, supabase, build                      | Tirar a palavra export (uso só dentro do arquivo) |
| `Toast`                      | export (src/services/toast.ts)           | D      | Usado fora do arquivo (fora=1 arquivo(s)); conferir se é uso real ou só texto em docs/archive       | Decidir                                           |
| `DbEnum`                     | export (src/types/supabase.ts)           | A      | Sem uso em web/ (knip + busca; confirmado pela passada 4)                                           | Remover o símbolo                                 |
| `Gen`                        | export (src/types/supabase.ts)           | C      | Usado: passada 4 (adversária) localizou o uso; o knip não vê o uso interno/por tipo                 | Manter                                            |
| `ColumnCheck`                | export (src/types/supabase.ts)           | C      | Usado: passada 4 (adversária) localizou o uso; o knip não vê o uso interno/por tipo                 | Manter                                            |
| `SchemaDrift`                | export (src/types/supabase.ts)           | C      | Usado: passada 4 (adversária) localizou o uso; o knip não vê o uso interno/por tipo                 | Manter                                            |
| `SchemaInSync`               | export (src/types/supabase.ts)           | C      | Usado: passada 4 (adversária) localizou o uso; o knip não vê o uso interno/por tipo                 | Manter                                            |

### Arquivos sem importação estática (knip: 29)

| Arquivo                                                                                                                  | Classe         | Prova                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------ | -------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `web/src/utils/list.ts` (`toggleItem`)                                                                                   | **A, remover** | O único uso era em `CreateJob.tsx`, removido na U01 (`0a344c9`). Passada 4 confirmou: sem uso.                                          |
| `web/postcss.config.js`                                                                                                  | C              | O Vite carrega sozinho; `src/styles/tailwind.css` usa `@tailwind`. Passada 4.                                                           |
| `web/public/push-sw.js`                                                                                                  | C              | `vite.config.ts:129` (`importScripts`) e `public/_headers`. Passada 4.                                                                  |
| `web/src/services/pwaStub.ts`                                                                                            | C              | `vite.config.ts:149` (alias `virtual:pwa-register` no standalone). Passada 4.                                                           |
| `web/src/__tests__/legacy.d.ts`                                                                                          | C              | `utils.parity.test.ts:3` importa `archive/app/js/utils/format.js`; sem o `.d.ts` o typecheck dá TS7016. Passada 4.                      |
| `web/src/env.d.ts`                                                                                                       | C              | Declara `ImportMetaEnv`; `tsconfig.app.json` inclui `src`.                                                                              |
| `web/e2e/limpeza.ts`                                                                                                     | C              | `e2e/playwright.config.ts:17` (globalTeardown). Passada 4.                                                                              |
| `web/e2e/local/serve-fn.ts`, `web/e2e/local/servidor.mjs`                                                                | C              | Servidor local do E2E; citado em `e2e/LEIA.md` e `e2e/apoio.ts`.                                                                        |
| `web/scripts/a11y-check.mjs`, `aplicar-tudo.mjs`, `configurar-auth.mjs`, `lighthouse-check.mjs`, `sentry-sourcemaps.mjs` | C              | Usados pelo CI (`web.yml`, `staging.yml`) ou por `deploy.sh`.                                                                           |
| `web/scripts/limpeza/fotografar.mjs`                                                                                     | C              | Criado nesta rodada (C01); é a prova de que a interface não mudou.                                                                      |
| `web/scripts/make-icons.mjs`                                                                                             | **D**          | Nenhum uso no código, no CI ou no `package.json`. Só o cabeçalho e o `DECISOES.md` (com caminho quebrado) citam. Passada 4: uso manual. |
| `web/supabase/functions/*` (9 funções) e `_shared/*`                                                                     | C              | Entradas do Deno, publicadas com `supabase functions deploy`; `_shared` é importado por elas.                                           |
| `web/supabase/tests/run.mjs`                                                                                             | C              | Executor dos testes SQL (CI e `APLICAR.md`).                                                                                            |

### Tokens CSS sem uso (`web/src/styles/tokens.css`: 33 variáveis)

Quatro não são lidas em lugar nenhum (`rg` em `web/` inteiro, sem contar a definição):

| Token                                                  | Classe         | Prova                                    |
| ------------------------------------------------------ | -------------- | ---------------------------------------- |
| `--blue-500`, `--blue-600`, `--blue-700`, `--gray-100` | **A, remover** | Nenhuma ocorrência fora de `tokens.css`. |

Os outros 29 são lidos em `base.css`, `tailwind.css` ou em componentes.

**Não verificado nesta passada:** seletores CSS sem uso (classes em `*.css` que nenhum `.tsx` usa). Fica para a C05.

### Dependências (`depcheck`)

Só três "ausentes", todos falsos positivos: `jsr:@supabase` e `npm:web-push` (importados pelas funções do Deno, fora
do `package.json`) e `virtual:pwa-register` (módulo virtual do plugin). **Nenhuma dependência do `package.json` está
sem uso.**

### Passada 3, por categoria

- **Raiz**: `README.md` (do produto, R06), `CLAUDE.md`, `archive/`, `legal/`, `.github/`, `web/`. O roteiro cita
  `app/`, `chats/`, `project/` e `SETUP-SUPABASE.md` na raiz; desde o R06 eles estão em `archive/`. Os caminhos
  abaixo são os reais.
- **`archive/`** (192 arquivos): `app/` 1,9 MB (legado, com `bundle.js` de 487 KB, usado pelos testes de paridade);
  `project/` 1,5 MB (protótipos e design); `chats/` 116 KB; `LEIA.md`; `SETUP-SUPABASE.md` (antigo). **Classe D**: o
  roteiro propõe apagar as pastas de histórico, mas `app/` só sai junto com a C08 (testes de paridade).
- **Migrations legadas** (`web/supabase/legado/0*.sql`): já estão fora de `migrations/`; montam o banco do zero e são o
  setup dos testes. **Classe C.**
- **Documentos** (`web/docs/`): `TESTE-MANUAL.md` está vivo mas sem link no índice (a C09 o liga ao README).
  `RELATORIO-FINAL.md` é registro da rodada anterior (classe D). `VALIDACAO.md`, `MAPEAMENTO.md` e
  `RELATORIO_PARIDADE.md` são histórico da migração do legado, citados por três documentos cada (classe D).
  `DECISOES.md` (1.627 linhas) e `CONTRATO-BACKEND.md` são vivos (classe C).
- **Comentários que citam arquivo inexistente**: `src/services/store.ts:101` e `web/README.md` citam
  `components/LegacyRerender.tsx`, removido (`DECISOES.md:1046`). Classe A: corrigir o comentário, sem mudança de código.
- **Imagens, fontes e ícones**: nenhum arquivo sem referência pelo nome. Duplicatas por hash: não verificadas nesta
  passada (C05).
- **Restos de sistema e cópias** (`.DS_Store`, `Thumbs.db`, `*.log`, `*.bak`, `*.orig`, zips, "(1)"): **nenhum**
  versionado. O `.gitignore` já cobre `node_modules`, `dist*`, `.env*`, `lighthouse*.json` e `e2e/resultados/`.

### Itens D que precisam da sua decisão

1. `archive/app/`, `archive/project/`, `archive/chats/`, `archive/SETUP-SUPABASE.md`: apagar (o histórico fica no Git).
   Depende da C08 e da sua aprovação. **Apagamos?**
2. `web/docs/VALIDACAO.md`, `MAPEAMENTO.md`, `RELATORIO_PARIDADE.md` e `RELATORIO-FINAL.md`: apagar ou manter como
   histórico? **Apagamos?**
3. `web/scripts/make-icons.mjs`: manter (regera os ícones do PWA, citado em `DECISOES.md`) ou apagar? **Mantemos?**
4. `REGIOES_TRABALHADOR` e `REGIOES_RECRUTADOR` (`src/data/seed.ts` e `src/services/catalog.ts`): constantes sem uso.
   **Apagamos ou guardamos para uso futuro?**
5. `salvar` e `Conta` (`e2e/apoio.ts`): sem importação de fora do arquivo; confirmo antes de tirar o `export`.
6. `AccountRow`, `ReviewRow`, `Bucket`, `Toast`: a ferramenta diz que não são importados, mas há menções em outros
   arquivos. Confirmo antes de mexer.
7. `src/env.d.ts`: classificado como C, mas o knip o marcou como não importado. Posso testar a remoção no typecheck
   antes de você decidir.

### Próximo passo

Espero o seu "pode" para a Fase 3. Pela regra do roteiro, nada é apagado antes disso. Os itens A entram em C03–C06,
cada grupo num commit, com typecheck, testes e comparação de telas depois de cada um.
