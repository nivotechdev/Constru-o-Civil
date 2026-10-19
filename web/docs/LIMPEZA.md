# Limpeza do repositório (C01–C12)

> Objetivo: deixar o projeto mais leve e mais fácil de entender **sem mudar nada que o usuário vê** nem como o app
> funciona. Regra de ouro: comportamento idêntico antes e depois. Este documento guarda a linha de base (C01), o
> inventário (C02) e, ao fim, a comparação (C10–C12).

**Ponto de partida**: `master` em `c440e5d` (U04), mesmo conteúdo de `claude/front-novo-supabase` em `845c9c8`
(`git diff` vazio). Branch desta rodada: `claude/bicos-cleanup-optimization-lujwr7`, a única que esta sessão pode
enviar ao GitHub. **A tag `antes-da-limpeza` não foi criada**: o GitHub recusou o envio (HTTP 403 de política, duas
sessões seguidas). Ela é ação do responsável (ver "Itens D"). Até lá, o ponto de partida fica guardado no próprio
histórico do `master` (`c440e5d`), que esta rodada não reescreve.

Uma sessão anterior começou esta rodada na branch `claude/limpeza` (PR #10). Este documento a substitui. Ali havia
três erros que esta versão corrige: (1) os 4 tokens CSS dados como "sem uso" são lidos por outros tokens e não
podem sair; (2) a fotografia usava ids que não existem na demonstração (`BC-5001`, `w-ana`), então várias telas
eram só "não encontrado"; (3) itens marcados "conferir depois" foram conferidos agora.

## Antes (C01)

### Contagens (arquivos rastreados pelo Git no commit `c440e5d`)

Método: `git ls-tree -r -l` (arquivos e bytes) e `git grep -I -c ''` (linhas de arquivos de texto). Ficam de fora
`node_modules`, `dist*` e `.git`, que o Git não rastreia.

| Pasta     | Arquivos |     Linhas |         Bytes |
| --------- | -------: | ---------: | ------------: |
| (raiz)    |        2 |        303 |        23.115 |
| `.github` |        3 |        457 |        20.584 |
| `archive` |      192 |     27.752 |     3.008.513 |
| `legal`   |        2 |        156 |         9.060 |
| `web`     |      510 |     70.301 |     4.913.192 |
| **Total** |  **709** | **98.969** | **7.974.464** |

Dentro de `web/`: `src` 247 arquivos (1.597.043 B), `supabase` 139 (964.269 B), `docs` 53 (1.407.667 B, dos quais
~1 MB são os prints do E2E em `docs/e2e-prints/`), `public` 19 (433.314 B), `scripts` 20 (96.855 B), `e2e` 15
(56.028 B), `package-lock.json` 321.522 B.

Por tipo (arquivos): 153 `.ts`, 118 `.tsx`, 118 `.sql`, 76 `.js` (75 no `archive/`), 65 `.svg`, 56 `.jpg`,
37 `.md`, 17 `.css`, 16 `.png`, 11 `.mjs`, 11 `.json`, 8 `.sh`, 7 `.html` e outros 16.

### Checagens

| Checagem                                          | Resultado                                                                                                                                                                                                                                                       |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm ci`                                          | OK                                                                                                                                                                                                                                                              |
| `npm run typecheck`, `lint`, `format:check`       | OK                                                                                                                                                                                                                                                              |
| `npm test`                                        | **25 arquivos, 217 testes passando** (o `CLAUDE.md` ainda diz 207)                                                                                                                                                                                              |
| `build:demo`, `build:staging`, `build:standalone` | OK (o de staging com as variáveis falsas do CI)                                                                                                                                                                                                                 |
| Lighthouse mobile, mediana de 3                   | desempenho **99** (rodadas 99, 99, 97), acessibilidade **100**, boas práticas **100**                                                                                                                                                                           |
| axe (WCAG 2.1 AA, `scripts/a11y-check.mjs`)       | **14 telas sem problemas**                                                                                                                                                                                                                                      |
| Testes SQL locais                                 | **não rodados nesta sessão**: o Docker Hub devolveu 429 (limite de downloads) para `supabase/postgres:17.6.1.011`. Prova: job `sql` verde no `master` em `c440e5d` ([run 39314638895](https://github.com/nivotechdev/Constru-o-Civil/actions/runs/39314638895)) |
| E2E                                               | local bloqueado pelo mesmo 429. Prova: workflow `staging` verde em `c440e5d` ([run 39314638757](https://github.com/nivotechdev/Constru-o-Civil/actions/runs/39314638757))                                                                                       |

### Peso do app

Os builds embutem o commit (`VITE_RELEASE`). Para comparar antes e depois, os três builds são feitos com
`VITE_RELEASE=limpeza`. Assim ficam **determinísticos**: dois builds seguidos dão os mesmos bytes, exceto 1 byte
de gzip no `sw.js.map` do staging.

| Build      | Arquivos | Total bruto | Total gzip | Só JS/CSS/HTML (bruto / gzip)                            |
| ---------- | -------: | ----------: | ---------: | -------------------------------------------------------- |
| demo       |      132 |   3.335.728 |  1.346.007 | 97 arquivos, 2.651.757 / 759.829                         |
| staging    |      226 |   9.151.090 |  2.823.404 | 97 arquivos, 2.652.283 / 760.042 (+94 `.map`, 5.814.836) |
| standalone |       20 |   3.403.148 |  1.313.256 | 2 arquivos, 2.971.278 / 979.057                          |

Maiores chunks (demo, bruto/gzip): `heic2any` 1.352.965/339.330 (carregado só ao enviar foto HEIC); `index` (app)
628.339/194.393; `index` (supabase-js) 224.501/58.695; CSS 47.008/9.270; `WorkerProfileScreen` 23.483/7.260;
`workbox` 21.777/7.400. A lista de cada arquivo (bruto e gzip) fica fora do repositório. Ela é refeita a partir do
commit `c440e5d`, e é isso que a C10 usa se a sessão acabar.

### Fotografia de todas as telas

`web/scripts/limpeza/fotografar.mjs` abre **cada uma das 54 rotas** de `src/routes.ts` (58 endereços: algumas rotas
com dois exemplos, como vaga aberta e fechada), com **ids reais da demonstração**. Faz isso **nas três sessões**
(sem login, trabalhador, construtora; quando a rota não é da sessão, o print mostra para onde ela redireciona), em
**360×800 e 1280×800**, com a página inteira. Depois captura 7 estados que só aparecem com um clique:

- modal aberto: filtros do mural, "denunciar ou bloquear" na vaga, "convidar para uma vaga" no perfil;
- erro de formulário: login vazio, cadastro vazio, vaga vazia, "esqueci a senha" vazio.

O relógio do navegador fica parado em 19/10/2026 12h (horário de Brasília), porque a demonstração mostra datas
relativas a "hoje" e a comparação pode rodar em outro dia. Resultado: **362 prints, 0 erros**. A lista de rotas, com
a sessão e o endereço final de cada uma, fica no `rotas.json` junto dos prints, fora do repositório.

**Ruído medido**: duas fotografias seguidas, sem mudar nada, deram 357 de 362 prints idênticos byte a byte. Os 5
restantes diferem em 0–8 pixels, por no máximo 3 níveis de cor (antialiasing de cantos e do desfoque da barra do
topo). Refeitos com `SO=<regex>`, cada um saiu **idêntico byte a byte** a uma das duas capturas anteriores: o ruído
alterna entre duas versões do mesmo print. Regra da C10: um print conta como idêntico se, refeito até 3 vezes,
bater byte a byte com o "antes". `scripts/limpeza/comparar.mjs` mostra pixels e a maior diferença de cor de cada
print, sem tolerância.

### Links entre documentos

`web/scripts/limpeza/links.mjs` confere os links `[…](…)` e os caminhos citados entre crases nos `.md` (fora de
`archive/` e deste documento, que cita de propósito o que sumiu): 25 arquivos, 335 citações, **2 quebradas**. Uma é
`web/preview/index.html` em `DECISOES.md` (saída de build, fora do Git). A outra é `LegacyRerender.tsx` em
`VALIDACAO.md` (componente removido, ver `DECISOES.md` › "Fase C — pendências antigas").

## Inventário (C02)

### Como foi feito

1. **Ferramentas** (via `npx`, sem mexer no `package.json`): `knip@5` (30 arquivos, 39 exports e 30 tipos "sem
   uso"); `depcheck` (nenhuma dependência sem uso; 3 "ausentes" que são falsos positivos: `jsr:@supabase` e
   `npm:web-push` são das funções Deno e `virtual:pwa-register` é módulo virtual do plugin);
   `tsc --noUnusedLocals --noUnusedParameters` nos dois tsconfig (**0 alertas**); ESLint, que já barra variáveis e
   imports sem uso (`npm run lint` verde = nenhum).
2. **Referências à mão**: `git grep -w` de cada nome e caminho em todo o repositório, inclusive `vite.config.ts`,
   `vite-plugin-pwa`, `index.html`, `public/_headers`, configs, os três workflows (`web.yml`, `staging.yml`,
   `site.yml`), os scripts `.sh`/`.mjs`, o setup dos testes SQL e os documentos operacionais. **Achado**: o knip
   não vê exports de módulos importados com `import * as` ou com `await import(…)` nos testes. Por isso fiz uma
   varredura própria de **todos os 939 `export`** de `src/`, `build/` e `e2e/`, contando usos fora do arquivo.
   Ela achou o que o knip não achou (`getVersion`, `candidateCount`, `oficioFromRow`, `oficioToRow` e 24 exports
   usados só no próprio arquivo).
3. **Por categoria**: raiz, `archive/`, migrations, documentos, imagens (com hash), CSS e tokens, scripts, restos
   de sistema.
4. **Revisão adversária**: um subagente separado, sem ver este raciocínio, recebeu só a lista de candidatos e a
   tarefa de provar que cada um é usado. Ele usou `findReferences` do TypeScript em cada export e aplicou todas as
   remoções numa cópia (fora do repositório): `tsc`, ESLint e os 217 testes passaram, e o build de demonstração
   ficou 146 bytes menor, sem outra diferença. Ele derrubou um candidato (`SchemaInSync`, ver C) e achou os 4
   símbolos mortos e os exports internos que a lista não tinha. Também apontou "3 fotos da demonstração que não
   existem", mas isso **está errado**: `public/img/jobs/` tem as 9 fotos (`git ls-files`). A cópia dele estava
   incompleta.

### Resumo

| Classe                 | Itens                                                                                                    |
| ---------------------- | -------------------------------------------------------------------------------------------------------- |
| A, remover             | 1 arquivo (`utils/list.ts`), 9 símbolos mortos, 1 re-export, 1 contador; `.gitignore` de sistema na raiz |
| A, tirar `export`      | 83 símbolos usados só dentro do próprio arquivo (a palavra `export` sai, o código fica)                  |
| A, corrigir comentário | 2 comentários que citam arquivos que não existem                                                         |
| B, remover com ajuste  | `archive/` + teste e harness de paridade (C08), depende do D1                                            |
| C, manter              | tudo o que parece lixo mas é usado: lista abaixo                                                         |
| D, decidir             | 7 perguntas no fim                                                                                       |

Ganho estimado se A, B e os D recomendados forem aprovados (contado com `git ls-files` e `git grep -c` nos
caminhos que sairiam): **−200 arquivos** (201 saem, 1 `.gitignore` entra), **≈ −30.400 linhas** e **≈ −3,2 MB** no
repositório. Isso é 28 % dos arquivos, 31 % das linhas e 41 % dos bytes, quase tudo de `archive/` e dos 4 documentos
históricos. No app, **nenhuma mudança visível**. O build de demonstração fica ~150 bytes menor (código morto que
hoje entra no chunk principal); o restante já era descartado pelo Vite.

### A — código para remover (sem nenhuma referência)

| Item                                                                                             | Tipo         | Prova                                                                                                                              | Ação                                      |
| ------------------------------------------------------------------------------------------------ | ------------ | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `src/utils/list.ts` (`toggleItem`)                                                               | arquivo      | `git grep -w toggleItem`: só a definição. O único uso, `CreateJob.tsx`, saiu na U01 (`0a344c9`). Knip e subagente: sem uso.        | apagar                                    |
| `store.ts`: `getVersion()`, `let version`, `version++`                                           | função       | 0 usos, nem como `store.getVersion` (10 arquivos importam `* as store`; nenhum `store[…]`). `version` só é lido por ela.           | apagar as 3 linhas e o comentário         |
| `remote/merge.ts`: `dropApplication`                                                             | função       | só a definição; `merge.ts` só é importado por nome                                                                                 | apagar                                    |
| `types/supabase.ts`: `RELATIONSHIPS` e `fk`                                                      | constante    | só a definição; o comentário diz "para os testes", mas nenhum teste usa; já fica fora do build (o Vite descarta)                   | apagar (`Relationship` fica: `Table` usa) |
| `types/supabase.ts`: `DbEnum`                                                                    | tipo         | só a definição                                                                                                                     | apagar                                    |
| `selectors.ts`: `candidateCount`                                                                 | função       | só a definição (achado da varredura própria)                                                                                       | apagar                                    |
| `supabaseMappers.ts`: `oficioFromRow`, `oficioToRow`                                             | funções      | só a definição (idem)                                                                                                              | apagar                                    |
| `pages/worker/feed/feedUI.ts`: `export { DEFAULT_CITY };`                                        | re-export    | todos os usos importam de `services/defaults` ou `services/cities`                                                                 | apagar a linha (o `import` fica, é usado) |
| `REGIOES_TRABALHADOR`, `REGIOES_RECRUTADOR` (`data/seed.ts`, re-export em `services/catalog.ts`) | constantes   | só a definição e o re-export; nenhuma tela, teste ou script; já ficam fora do build. Antes eram "D (dados futuros)"; o Git guarda. | apagar                                    |
| `.gitignore` na raiz                                                                             | configuração | não existe; o de `web/` não cobre `.DS_Store`, `Thumbs.db`, `*.log`, `*.bak`, `*.orig`, `coverage/` (hoje nenhum versionado)       | criar com esses padrões (C03)             |

### A — tirar a palavra `export` (usados só no próprio arquivo)

Prova de cada um: 0 usos fora do arquivo (`git grep -w` em `src`, `e2e`, `scripts`, `build`, `vite.config.ts`),
≥ 1 uso dentro dele (então não vira variável sem uso), e o subagente com `findReferences` concordou. Nome igual em
outro lugar não é uso: `AccountRow`/`ReviewRow` (outros tipos locais), `RELEASE` (função Deno), `salvar`, `Conta`,
`Toast` (palavras em textos de tela).

| Arquivo                           | Símbolos                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `build/env.ts`                    | `DEMO_MODES`, `E2E_MODE`, `PRODUCTION_ENV`, `PILOT_WITHOUT_LEGAL_REVIEW`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `e2e/apoio.ts`                    | `salvar`, `Conta`, `Estado`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `e2e/relatorio.ts`                | `gerarRelatorio` (o Playwright usa o `export default`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `src/components/`                 | `ReviewForm.tsx`: `StarPicker`, `ReviewFormValues`; `Skeleton.tsx`: `TileSkeleton`; `Select.tsx`: `SelectOption`                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `src/hooks/`, `src/layouts/`      | `useAction.ts`: `Action`; `accountMenu.ts`: `MenuEntry`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `src/pages/`                      | `recruiter/jobForm.ts`: `MAX_DAYS`, `MAX_PAY`, `MIN_DESCRIPTION`, `EditLimits`, `formPoint`; `worker/feed/feedUI.ts`: `Sort`, `FeedFilters`, `ALL_CITY`; `routes.ts`: `RouteDef`                                                                                                                                                                                                                                                                                                                                                                                               |
| `src/services/`                   | `account.ts`: `DeletionImpact`; `admin.ts`: `AdminData`; `alerts.ts`: `ALERTS_PER_DAY`, `alertMatches`; `applications.ts`: `AUTO_CONCLUDE_AFTER_DAYS`, `UNDO_REJECT_MINUTES`; `boot.ts`: `BootStatus`; `guards.ts`: `GuardResult`; `legal.ts`: `LegalSection`; `monitoring.ts`: `RELEASE`, `SentryFrame`, `SentryEvent`; `notifications.ts`: `notificationGroup`, `DEFAULT_PREFS`; `payments.ts`: `CardCharge`; `push.ts`: `vapidKeyBytes`, `saveSubscription`; `queries.ts`: `QueryStatus`; `store.ts`: `emptyDatabase`; `supabase.ts`: `SupabaseConfig`; `toast.ts`: `Toast` |
| `src/services/remote/`            | `client.ts`: `FunctionRefusal`; `merge.ts`: `AccountRow`, `WorkerRowRead`, `CompanyRowRead`, `ReviewRow`; `session.ts`: `clearAccountCache`, `MissingAccountError`; `storage.ts`: `Bucket`, `isLocalMedia`, `storagePath`                                                                                                                                                                                                                                                                                                                                                      |
| `src/services/supabaseMappers.ts` | `reviewFromRow`, `accountToRow`, `companyToRow`, `workerToRow`, `companyReviewsToRows`, `workerReviewsToRows`, `applicationToRow`, `applicationEventsToRows`, `postToRow`, `notificationToRow`, `boostPaymentToRow` (usados só por `databaseToInserts` e por outros mapeadores do arquivo)                                                                                                                                                                                                                                                                                     |
| `src/types/supabase.ts`           | `Gen`, `ColumnCheck`, `SchemaDrift` (`SchemaInSync` fica, ver C)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `src/utils/`                      | `applicationStatus.ts`: `IN_PROGRESS`; `image.ts`: `MAX_SIDE`, `isHeic`; `jobInfo.ts`: `fitsDias`, `TO_ARRANGE_DAYS`, `fullAddressText`, `WAGE_PAYMENTS`; `media.ts`: `MAX_PHOTO_MB`, `MAX_VIDEO_MB`, `MAX_VIDEO_SECONDS`; `whatsapp.ts`: `MessageParts`                                                                                                                                                                                                                                                                                                                       |
| `src/__tests__/fakeSupabase.ts`   | `Call`, `FakeOptions`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

### A — comentários que citam arquivos que não existem

| Comentário                                                       | Prova                                                                                                              | Ação                                   |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------- |
| `src/services/store.ts:101` cita `components/LegacyRerender.tsx` | arquivo removido (`DECISOES.md` › "Fase C — pendências antigas")                                                   | sai junto com `getVersion`             |
| `src/services/push.ts:2` cita `pages/shared/PushPrompt.tsx`      | não existe; o pedido de permissão está em `pages/shared/NotificationSettings.tsx` (único que importa `enablePush`) | trocar o nome do arquivo no comentário |

(O `web/README.md` não cita mais o `LegacyRerender.tsx`: o R06 já corrigiu.)

### B — remover com ajuste (C08, se o D1 for "sim")

| Item                                      | Ajuste junto                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Por que não muda comportamento                                                                                                                                                                                                                                                             |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `archive/` inteiro (192 arquivos, 2,9 MB) | (1) `src/__tests__/utils.parity.test.ts`: os 3 testes que comparam com `archive/app/js/utils/format.js` passam a comparar com **valores fixos** (o que o app antigo devolvia, anotado do próprio arquivo). **O número de testes não cai: continuam 217.** (2) Apagar `src/__tests__/legacy.d.ts` (só serve para esse import). (3) Apagar `scripts/parity/` e o script `"parity"` do `package.json` (paridade visual manual com o app antigo; sem ele, não tem com o que comparar). (4) Tirar `scripts/parity/output` e `.font-cache` de `web/.gitignore`, `.prettierignore` e `eslint.config.js`. (5) Comentários que citam `archive/app`: `store.ts:1`, `router.ts:1`, `types/models.ts:2`, `styles/tokens.css:3`, `tailwind.config.js:2` (este ainda cita o caminho antigo `app/tailwind.config.js`), `supabase/legado/LEIA.md:3`. (6) Documentos: `CLAUDE.md` (mapa e armadilha 4), `web/README.md:38`, `CHECKLIST-LANCAMENTO.md:170` (C09/C11). | Nenhum arquivo de `archive/` entra no build, no CI ou no banco: `git grep "archive/"` só acha os pontos acima. O subagente apagou `archive/` numa cópia, com os ajustes 1–3: `tsc`, ESLint e 217 testes verdes. `formatBRL`/`formatPostDate` são determinísticos (não dependem de "hoje"). |

A C07 do roteiro (migrations legadas para `web/supabase/legado/`) **já foi feita no R06**: `supabase/tests/local/setup.sh`
e `scripts/staging/aplicar-banco.sh` já leem de lá. Nada a fazer; a pasta é classe C.

### C — manter (parece lixo, mas é usado)

| Item                                                                                                                                                                                            | Por quê                                                                                                                                                                                                                                                                             |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Os 33 tokens de `src/styles/tokens.css`                                                                                                                                                         | Todos lidos: os primitivos (`--blue-500/600/700`, `--gray-50/100`) só aparecem dentro do próprio arquivo, porque são lidos pelos semânticos (`--brand`, `--text-link`, `--skeleton-base`…), que as telas usam. **A C02 anterior mandava apagar 4 deles, o que quebraria as cores.** |
| As 16 classes próprias em `base.css`/`tailwind.css` (`skeleton`, `icon`, `tile-grid`, `app-header`…)                                                                                            | cada uma usada em ≥ 1 `.tsx`                                                                                                                                                                                                                                                        |
| `public/icons/*`, `public/img/jobs/*` (9 fotos), `push-sw.js`, `_headers`, `robots.txt`                                                                                                         | ícones no manifest/`index.html`; fotos no seed da demonstração; `push-sw.js` no `importScripts` do workbox (`vite.config.ts`); `_headers` e `robots.txt` são lidos pela hospedagem e pelos buscadores. Nenhuma duplicata por hash (`sha256sum` de todas as imagens do repositório). |
| `postcss.config.js`, `src/services/pwaStub.ts`, `src/env.d.ts`                                                                                                                                  | lido pelo Vite; alias de `virtual:pwa-register` no build standalone (`vite.config.ts`); tipos de `import.meta.env`                                                                                                                                                                  |
| `e2e/limpeza.ts`, `e2e/relatorio.ts`, `e2e/local/*`                                                                                                                                             | `globalTeardown` e reporter do `playwright.config.ts`; servidor local do E2E (`e2e/LEIA.md`)                                                                                                                                                                                        |
| `supabase/functions/*`, `supabase/tests/run.mjs`, `supabase/legado/`, `supabase/pendentes/`                                                                                                     | entradas do Deno (publicadas com `supabase functions deploy`); executor dos testes SQL (CI); migrations do app antigo (montam o banco do zero); `lanc07` guardada de propósito fora de `migrations/` até a exportação do app antigo (`pendentes/LEIA.md`)                           |
| `scripts/*` (a11y, lighthouse, aplicar-tudo, gen-db-types, configurar-auth, deploy, sentry-sourcemaps, exportar-app-antigo, staging/_, volume/_)                                                | cada um citado pelo CI, pelo `package.json` ou por um documento operacional (`SUPABASE.md`, `STAGING.md`, `IMPLANTACAO.md`, `VOLUME.md`, `pendentes/LEIA.md`)                                                                                                                       |
| `types/supabase.ts`: `export type SchemaInSync`                                                                                                                                                 | existe só para o `tsc` conferir que o schema escrito à mão bate com o gerado (X14). Sem `export`, o `tsc -b` falha com TS6196 (`noUnusedLocals`). Achado da revisão adversária.                                                                                                     |
| `supabaseMappers.ts`: `export { relativeTime }`                                                                                                                                                 | `src/__tests__/supabase.test.ts` importa por aqui                                                                                                                                                                                                                                   |
| `console.error` em `services/monitoring.ts`, `console.warn` em `vite.config.ts`, `console.log` nos scripts do E2E                                                                               | intencionais (relato de erro, aviso de build, saída de ferramenta). Nenhum `debugger`, nenhum `TODO`/`FIXME`, nenhum bloco de código comentado (`git grep`).                                                                                                                        |
| Dependências do `package.json`                                                                                                                                                                  | `depcheck`: todas usadas. `pixelmatch` e `pngjs` são usados por `scripts/parity/` e agora também por `scripts/limpeza/comparar.mjs` (ver D5).                                                                                                                                       |
| `docs/e2e-prints/` (38 prints, ~1 MB)                                                                                                                                                           | são as imagens do `docs/E2E.md`, regeradas por `E2E_RELATORIO=1 npm run e2e` e enviadas como artefato pelo CI                                                                                                                                                                       |
| Documentos vivos: `CHECKLIST-LANCAMENTO`, `SUPABASE`, `STAGING`, `IMPLANTACAO`, `CONTRATO-BACKEND`, `DECISOES`, `ADVISORS`, `LGPD`, `E2E`, `VOLUME`, `TESTE-MANUAL`, `APLICAR.md`, os `LEIA.md` | usados na operação. `TESTE-MANUAL.md` está vivo, mas **nenhum documento aponta para ele**: a C09 o põe no índice. O `CLAUDE.md` § 8 também não lista `IMPLANTACAO`, `LGPD` e `TESTE-MANUAL` (C11).                                                                                  |
| Telas                                                                                                                                                                                           | **nenhuma tela órfã**: as 54 rotas de `src/routes.ts` apontam para telas que existem, e todo arquivo de `src/pages` é alcançado por uma rota ou por import (knip e o resolvedor do subagente).                                                                                      |
| Restos de sistema                                                                                                                                                                               | nenhum `.DS_Store`, `Thumbs.db`, `*.log`, `*.bak`, `*.orig`, zip, cópia "(1)"/"-old", `dist/` ou `coverage/` versionado (`git ls-files`)                                                                                                                                            |

### D — precisa da sua decisão

| #   | Item                                                                                                                                                                                                               | Recomendação                                                                                                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1  | `archive/` (app antigo, conversas e protótipos do design, `SETUP-SUPABASE.md`)                                                                                                                                     | **apagar** (com os ajustes da tabela B). O conteúdo fica no histórico do Git e na tag.                                                                                         |
| D2  | `docs/VALIDACAO.md`, `MAPEAMENTO.md`, `RELATORIO_PARIDADE.md` (migração do legado, set/2026) e `RELATORIO-FINAL.md` (rodada 2; a parte "o que falta" está desatualizada e o `CHECKLIST-LANCAMENTO.md` a substitui) | **apagar** os quatro e tirar as citações (`CLAUDE.md` § 8, `web/README.md`). `DECISOES.md` continua contando o porquê de cada coisa.                                           |
| D3  | `scripts/make-icons.mjs` (nenhum uso no CI ou no `package.json`)                                                                                                                                                   | **manter** (vira C): é o gerador dos ícones do PWA, do OG e da Apple. A saída dele bate byte a byte com `public/icons/icon.svg`.                                               |
| D4  | `REQUISITOS_OPCOES` (`data/seed.ts` e `services/catalog.ts`): desde a U01, nenhuma tela usa; só um teste confere que o catálogo repassa a lista                                                                    | **manter**: tirar exige mudar teste, e a U01 deixou as vagas antigas com requisitos.                                                                                           |
| D5  | `web/scripts/limpeza/` depois desta rodada                                                                                                                                                                         | **manter**: é a ferramenta de "a tela não mudou" para mudanças futuras (e mantém `pixelmatch`/`pngjs` em uso quando `scripts/parity/` sair).                                   |
| D6  | Destino do PR: o roteiro pede `claude/front-novo-supabase`; o `CLAUDE.md` (19/10) diz que tudo vai para o `master` por PR                                                                                          | **`master`** (`claude/front-novo-supabase` está igual ao `master`). O PR #10 da sessão anterior (`claude/limpeza`) fica superado por este e pode ser fechado.                  |
| D7  | Tag `antes-da-limpeza`: esta sessão não consegue enviar tags (403)                                                                                                                                                 | você cria: GitHub › Releases › "Draft a new release" › tag `antes-da-limpeza` no commit `c440e5d` (ou `git tag antes-da-limpeza c440e5d && git push origin antes-da-limpeza`). |
