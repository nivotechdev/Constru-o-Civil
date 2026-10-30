# O2 — Frente 7: qualidade e cobertura dos testes (Vitest, E2E, SQL)

Commit auditado: 67d9ffb (branch claude/auditoria). Suíte medida: 35 arquivos / 287 testes Vitest (CLAUDE.md §5 ainda diz 282/34 — doc defasada, ver O2-010).

## Achados

### O2-001 — 5 testes de candidatura falham entre 21h e 23h59 no horário de Brasília (e o dia todo em fusos à frente de UTC)

- Área: testes
- Severidade: S2
- Esforço: P
- Confiança: confirmado (reproduzido com o relógio emulado)
- Onde: `web/src/__tests__/applications.test.ts:96` (`expire`), `:239` (Y01), `:254` (Y04), `:269` (Y07), `:305` (hire/conclude)
- Prova: o app calcula "hoje" no fuso do aparelho (`web/src/utils/dates.ts:11-16`, `todayISO` = `getFullYear/getMonth/getDate`), mas o teste calcula "hoje" em UTC: `new Date().toISOString().slice(0, 10)`. Reprodução (comandos em `comandos.md`):
  - `TZ=Asia/Tokyo npx vitest run` (agora, 04:37 em Tóquio = 19:37 UTC): `Tests 1 failed | 286 passed` — `applications.test.ts:242 expected 'vencida' to be 'cheia'` (Y01). Mesmo resultado com `TZ=Pacific/Kiritimati`, e com `--sequence.shuffle` nos dois fusos.
  - `TZ=America/Sao_Paulo` com o relógio deslocado para 22:30 locais (2026-10-30T01:30Z): `Tests 5 failed | 282 passed` — L07, Y01, Y04, Y07 e "a job that closes by itself…". Às 23:59 locais: os mesmos 5. Às 10:00 locais: 287 passam.
  - `TZ=UTC` e `TZ=America/Sao_Paulo` (hora real do contêiner, 16h local), `TZ=America/Los_Angeles`: 287 passam.
- Impacto: quem desenvolve no Brasil (os três sócios + a IA) vê a suíte ficar vermelha toda noite depois das 21h sem que nada tenha mudado, e aprende a ignorar vermelho; já o CI (GitHub, fuso UTC) nunca pega. O mesmo erro de "dia" pode esconder um bug real de fuso do app, que os testes não conseguem separar do bug do teste.
- Causa raiz: o teste mistura dois relógios (UTC no teste, local no app). Além disso `vi.useFakeTimers()` sem `setSystemTime` deixa o teste depender da hora real em que roda.
- Correção recomendada: nos testes, usar `todayISO()`/`addDays()` de `utils/dates` (o mesmo relógio do app) em vez de `toISOString().slice(0,10)`; fixar a data com `vi.setSystemTime('2026-10-15T15:00:00-03:00')` no `beforeEach`; rodar o CI uma vez com `TZ=America/Sao_Paulo` e outra com `TZ=Asia/Tokyo` (matriz de fusos).
- Critério de aceite: `for tz in UTC America/Sao_Paulo Asia/Tokyo Pacific/Kiritimati; do TZ=$tz npx vitest run; done` verde, e verde também com o relógio em 23:59 locais.
- Dependências: nenhuma

### O2-002 — Nenhuma Edge Function tem teste; a assinatura do webhook de pagamento e as 10 funções só são conferidas com chamadas sem login

- Área: testes
- Severidade: S2
- Esforço: M
- Confiança: confirmado
- Onde: `web/supabase/functions/*/index.ts` (10 funções, 1.279 linhas com `_shared/`); `web/supabase/functions/_shared/mercadopago.ts:60-83` (`validSignature`); `web/scripts/staging/conferir-funcoes.sh:27-37`; `web/e2e/fluxos/08-cadastro-google.spec.ts:1-5,57-66`; `web/e2e/local/servidor.mjs:11`
- Prova:
  - `grep -rn "supabase/functions" web/src/__tests__` acha só 3 helpers: `_shared/confirm.ts`, `_shared/origin.ts` (+ leitura de texto dos `index.ts` em `edgeOrigin.test.ts:33-55`) e `_shared/firebase.ts`. Nenhum `index.ts` é importado por teste; não há `*.test.*` nem `deno.json` em `functions/`. O CI só roda `deno check` (tipos).
  - `_shared/mercadopago.ts` (HMAC `x-signature`, janela de 15 min, comparação em tempo constante), `captcha.ts`, `http.ts` (`requestUser`, `rpcError`) e `monitoring.ts` não têm nenhum teste, embora `validSignature` seja uma função pura (precisa só de `Deno.env`, que um teste Vitest pode simular).
  - `conferir-funcoes.sh` (único teste automático das funções publicadas, roda no `staging.yml` › `funcoes`) chama cada função com corpo `{}` e só aceita recusas: `webhook-pagamento "503|401"`, `criar-cobranca "401|503"`, `codigo-whatsapp "401|404|503"`, `enviar-push`/`limpar-arquivos "401"`. Nenhum caminho feliz, nenhuma assinatura válida, nenhuma idempotência.
  - O E2E também não as exercita: o fluxo 8 diz no cabeçalho que "a janela do Google não abre em robô" e cria o usuário direto com `admin.createUser` (`08-…spec.ts:57-66`): `entrar-com-firebase` nunca roda de verdade (só o ping `{aquecer:true}` do script). `servidor.mjs` do E2E local só sobe 3 funções (`entrar-com-documento`, `excluir-conta`, `verificar-cnpj`). `codigo-whatsapp`, `criar-cobranca`, `webhook-pagamento`, `enviar-push`, `limpar-arquivos` só levam a chamada de recusa do script de fumaça.
- Impacto: quando os pagamentos, o código por WhatsApp e o push forem ligados (hoje desligados), o dinheiro e o login passam por código que nunca foi executado por um teste; uma regressão na assinatura pode aceitar aviso falso (cobrança "paga" sem pagar) ou recusar todos os avisos verdadeiros (empresa paga e a vaga não sobe) sem o CI perceber.
- Causa raiz: as funções foram escritas para o Deno e o projeto só tem o runner Vitest/Node; a checagem de fumaça foi pensada para "a função está no ar", não para "faz o certo".
- Correção recomendada: (1) `deno test` no CI (já há `setup-deno`) com testes de `validSignature` (assinatura certa, errada, `ts` velho, `ts` em ms, sem segredo), `captcha`, `requestUser`; (2) um teste por handler com `Request` simulado e cliente administrativo falso, começando por `webhook-pagamento` (idempotente, valor errado, pagamento de outra empresa), `criar-cobranca`, `excluir-conta`; (3) no E2E, `entrar-com-firebase` com um ID token de teste assinado pelo emulador do Firebase ou, no mínimo, o ramo `sem-conta` pelo `fetch`.
- Critério de aceite: `deno test supabase/functions` verde no CI; pelo menos 5 casos de `validSignature`; cada `index.ts` com um teste de recusa e um de sucesso.
- Dependências: nenhuma (relacionado a D3a-007, que lista o lado SQL dos pagamentos)

### O2-003 — As telas só são abertas no build de demonstração (axe e rolagem); o modo real só é visto pelo E2E pós-merge, sem visitante, sem rede ruim e só em Chromium Pixel 7

- Área: testes
- Severidade: S2
- Esforço: M
- Confiança: confirmado (cobertura medida)
- Onde: `web/vite.config.ts` (`test.environment: 'node'`, `include: ['src/**/*.test.ts']`); `web/e2e/playwright.config.ts:19-21` (`devices['Pixel 7']`); `web/e2e/fluxos/*`
- Prova: cobertura v8 da suíte inteira, numa cópia em `$SCRATCH/out/O2/cov` (`comandos.md`): linhas 37,7% (8.962/23.767), ramos 77,5%. Por pasta: `src/pages` 3,3% (9.350 linhas), `src/components` 6,8% (3.835), `src/hooks` 0% (290), `src/layouts` 0% (392), `App.tsx` 0%, `main.tsx` 0%, contra `src/services` 84,6% (7.461), `src/utils` 78,3%, `routes.ts` 95%. Telas grandes com 0%: `Signup.tsx` (542), `CreateJob.tsx` (485), `Admin.tsx` (402), `BoostPayment.tsx` (402), `JobManage.tsx` (364), `JobDetail.tsx` (302), `Login.tsx` (233), `PublicJob.tsx` (156). Nos serviços do modo real: `remote/applications.ts` 50%, `remote/profiles.ts` 52%, `remote/jobs.ts` 52%, `remote/storage.ts` 55% (ramos 30%: envio de foto, HEIC, nova tentativa do U69), `remote/actions.ts` 56%.
  O E2E (só pós-push no `staging.yml`) usa um perfil único: Chromium, Pixel 7, `locale pt-BR`, rede sem estrangulamento. O CI abre telas de verdade só nos scripts `a11y-check.mjs` e `sem-rolagem.mjs`, e no build de DEMONSTRAÇÃO (dados falsos, `web.yml` › `checks`), sem conferir comportamento. No E2E real, os únicos passos sem sessão são `/login`, `/escolha-perfil` e o cadastro: não há teste de visitante abrindo `/v/<slug>` ou `/ajuda` — foi assim que o C3-001 (tela de erro para quem não tem conta) passou com CI verde. Também sem E2E: offline/PWA instalado, impulsionar, foto de perfil/portfólio pela tela, editar vaga, cancelar contratação, filtros do mural pela tela (só `feed_jobs` por RPC), código do WhatsApp, push.
- Impacto: o público-alvo (celular simples, internet ruim) é exatamente o que não é testado; um erro de tela, de foco ou de rolagem só aparece para o usuário. C3-001 e C5-020 são sintomas disto.
- Causa raiz: a suíte rápida foi montada só para serviços; o E2E é caro (precisa de staging, e-mail e chaves) e roda depois do merge.
- Correção recomendada: (1) um Playwright "sem backend" no job `checks` (sem segredos): build real (`--mode staging` já existe) com `page.route` respondendo ao Supabase; casos: visitante em `/v/<slug>`, `/ajuda`, `/login`, `/mural` sem conta, rede offline (`context.setOffline`) e 3G lento; (2) perfil extra no `playwright.config.ts` (Android pequeno 360×640 com `cpuThrottling` + WebKit); (3) testes de componente com jsdom para `Modal/Sheet/Button/Input` (ver C5-020); (4) subir um piso de cobertura no CI (hoje não há medição).
- Critério de aceite: o caso "visitante abre o link público" falha no commit anterior ao conserto do C3-001 e passa depois; relatório de cobertura publicado no CI com piso por pasta.
- Dependências: C3-001, C5-020 (este achado é o lado de testes dos dois)

### O2-004 — O job `e2e` do `web.yml` passa vazio e duplica o do `staging.yml`; LEIA.md, E2E.md e relatorio.ts descrevem o que não roda

- Área: testes
- Severidade: S3
- Esforço: P
- Confiança: confirmado
- Onde: `.github/workflows/web.yml:142-207`; `.github/workflows/staging.yml:128-201`; `web/e2e/LEIA.md:4,21-27`; `web/docs/E2E.md:3,7`; `web/e2e/relatorio.ts:8-16`; `web/e2e/local/servidor.mjs:11`
- Prova: run `40117686113` (`web`, master, 24/10): job `e2e` com conclusão `success`, mas só "Segredos do staging" executou; checkout, npm, build e "E2E (Playwright)" ficaram `skipped` (faltam os segredos `E2E_*`). Run `40117427320` (`staging`, 1f202ee): o `e2e` rodou de verdade (`E2E (Playwright)` 17:51:28→17:55:17, sucesso), buscando as chaves em tempo de execução pela API do Supabase. Ou seja: o E2E real só acontece no `staging.yml`; o do `web.yml` é um verde vazio. A documentação (`LEIA.md` "No staging (CI, job e2e)") descreve o do `web.yml` (segredos `E2E_SUPABASE_URL`, `E2E_ANON_KEY`…). Além disso: `LEIA.md` diz "Sete arquivos" e lista oito; `E2E.md` (gerado) diz "13 testes… 16/10/2026" e não tem o fluxo 8, porque `relatorio.ts` só conhece f1–f7 (hoje há 15 testes); o comentário de `staging.yml:128` ainda diz "os 13 testes"; `servidor.mjs` (E2E local) só sobe 3 funções, mas os fluxos 1 e 2 chamam `verificar-cadastro` — o roteiro "local" do `LEIA.md` não passa mais. Se os segredos `E2E_*` forem criados um dia, os dois jobs rodam ao mesmo tempo contra o mesmo staging.
- Impacto: dá a impressão de "E2E verde em todo push" quando ele só roda quando o `staging.yml` é acionado (caminhos `web/src/**`, `web/e2e/**`, migrations, funções) e nunca antes do merge; a equipe pode apagar o job errado ou confiar em documento defasado.
- Causa raiz: dois workflows nasceram para o mesmo fim em momentos diferentes (L03 e R08); o relatório e a documentação não acompanharam os fluxos novos.
- Correção recomendada: apagar o job `e2e` do `web.yml`; atualizar `LEIA.md` para o fluxo do `staging.yml`; incluir `f8` em `relatorio.ts`; trocar "13 testes" por contagem calculada; ou remover a seção "Local" se não for mais mantida.
- Critério de aceite: só um job `e2e`; `E2E.md` gerado lista os 8 fluxos e a contagem real.
- Dependências: nenhuma

### O2-005 — O E2E deixa lixo e mexe em dados que não são dele no staging

- Área: testes
- Severidade: S3
- Esforço: P
- Confiança: confirmado
- Onde: `web/e2e/fluxos/04-diaria-avaliacao.spec.ts:46`; `web/e2e/fluxos/07-equipe.spec.ts:144-154`; `web/e2e/limpeza.ts:17-30`; `web/e2e/apoio.ts:59-64`; `web/e2e/playwright.config.ts:17`
- Prova: consulta no staging (somente leitura): `public.staff_actions` tem 265 linhas (aprovar_identidade 70, reativar_conta 65, suspender_conta 65, aprovar_construtora 65; de 19/10 a 24/10) — o registro de auditoria do fluxo 7 sobrevive à exclusão das contas, uma leva por execução. Contas de teste: 0 restantes (`auth.users where email like '%+e2e-%'` = 0), então a limpeza de contas funciona. Outros pontos: (1) o fluxo 4 chama `conclude_finished_jobs()` sem filtro (linha 46) — conclui/encerra qualquer vaga vencida do staging, não só a do teste (mesma causa do D3a-008, agora no E2E); (2) `limpeza.ts` engole erros (`.catch(() => undefined)`) e imprime "N contas de teste apagadas" mesmo quando nenhuma foi apagada; (3) o estado entre fluxos fica em `e2e/resultados/estado.json` e nada o apaga antes da próxima execução local (`estado()` reaproveita o arquivo; só `globalTeardown`, sem `globalSetup`); (4) cada execução dispara 3 e-mails reais (2 confirmações de cadastro e 1 recuperação de senha) para a caixa `nivotech.dev+e2e-…@gmail.com`, usando a cota do Brevo.
- Impacto: o staging acumula registros de auditoria falsos e o E2E pode alterar vagas de exemplo usadas por outras pessoas; erros de limpeza passam em silêncio.
- Causa raiz: a limpeza apaga contas (cascata) mas não o log de equipe; a conclusão por cron global foi usada como atalho para "o tempo passa".
- Correção recomendada: usar `conclude_finished_jobs` com filtro (como sugerido no D3a-008) ou conferir só a vaga do teste; no `limpeza.ts` contar sucessos e falhar (ou avisar) se algum `deleteUser` der erro, e apagar `staff_actions` das contas do teste pela service_role; `globalSetup` que apaga `estado.json`.
- Critério de aceite: depois de uma execução, `select count(*) from staff_actions` volta ao valor de antes; a limpeza sai com erro se uma conta não foi apagada.
- Dependências: D3a-008

### O2-006 — Os testes Vitest não restauram globais/ambiente sozinhos: uma asserção que falha contamina os testes seguintes

- Área: testes
- Severidade: S3
- Esforço: P
- Confiança: provável (verificado por leitura; as execuções com ordem embaralhada passam enquanto nada falha)
- Onde: `web/vite.config.ts` (`test:` sem `unstubGlobals`, `unstubEnvs`, `restoreMocks`); `web/src/__tests__/remote.test.ts:655,931,1030,1230,1242,1311,1489` (cada `vi.stubGlobal/stubEnv` é desfeito na última linha do próprio teste); o `describe('remote: data and actions', …)` (linhas 503-1333) não tem `afterEach`; `firebaseSignIn.test.ts:93` (tem `afterEach`, bom)
- Prova: em `remote.test.ts` os testes de pagamento fazem `vi.stubEnv('VITE_PAGAMENTOS','mercadopago')` (1193) e só chamam `vi.unstubAllEnvs()` na linha 1230, depois de 8 `expect`; se um deles falhar, `FEATURES.payments` fica ligado para o teste 1233 (que espera desligado) e para `fetch`/`navigator` dos seguintes. Há também esperas por relógio: `setTimeout(r, 40)` (1073), `setTimeout(r, 0)` ×4 (974, 1100, 1419, 1420), e um teste com `.catch(() => undefined)` (1444). Resultado das execuções: com 5 sementes de `--sequence.shuffle`, 2 repetições, 5 fusos e 2 combinações embaralhado+fuso, os mesmos testes passam ou falham pelo mesmo motivo (O2-001) — não achei dependência de ordem hoje.
- Impacto: quando um teste real quebrar, aparecerão vários vermelhos de causa única, escondendo o culpado.
- Causa raiz: limpeza manual no fim do teste em vez de `afterEach`/opção do runner.
- Correção recomendada: `test: { unstubGlobals: true, unstubEnvs: true, restoreMocks: true }` no `vite.config.ts` e trocar as esperas fixas por `vi.waitFor`.
- Critério de aceite: forçar uma falha no meio do teste de pagamento não derruba o teste 1233.
- Dependências: nenhuma

### O2-007 — Asserções frouxas, ramos condicionais e um arquivo com nome enganoso

- Área: testes
- Severidade: S3
- Esforço: P
- Confiança: confirmado
- Onde: `web/src/__tests__/supabase.test.ts:187-196`; `contacts.test.ts:105-106`; `services.test.ts:404`; `applications.test.ts:304-308`; `remote.test.ts:975,1444`; `utils.parity.test.ts:1-3`; `address.test.ts:70`
- Prova: (1) `supabase.test.ts:195` `expect(typeof typed).toBe('function')` é só um marcador: o `expectTypeOf` dentro de `typed` nunca roda (só o `tsc` o vê); (2) `contacts.test.ts:106` `if (!app) return;` — o teste W09 passa sem afirmar nada se a semente deixar de ter candidatura aprovada; (3) `services.test.ts:404` `if (other) expect(...)`; (4) `applications.test.ts:305` a verificação Y02 ("só a partir do dia") está dentro de `if (start > hoje)` — hoje roda (a semente BC-4995 começa em hoje+3: confirmado com sonda em 29/10), mas some sem aviso quando a semente mudar; (5) `remote.test.ts:975` `toBeTruthy()` no `readAt`; contagem geral: `toBeTruthy` 4, `toBeDefined` 4, `toBeGreaterThan(0)` 7; (6) `remote.test.ts:1444` o `completeGoogleSignUp` falha em silêncio (`.catch(() => undefined)`) e o teste só olha as chamadas anteriores. Nenhum `skip/only/todo` no repositório (verificado por busca). O arquivo `utils.parity.test.ts` se chama "paridade", mas desde a limpeza de 26/10 os valores são fixos e não há mais o app antigo para comparar (cabeçalho do arquivo): ainda servem como teste de regressão de máscaras, dinheiro e datas (são correspondências exatas, nada gerado em tempo de execução), mas o nome promete uma comparação que não existe, e o conjunto de CPF/CNPJ (`:101-110`, 3 CPFs e 2 CNPJs válidos) não é o mesmo conjunto usado nos testes SQL `cpf_valid/cnpj_valid` e no gerador do E2E (`apoio.ts:101-127`) — são três implementações sem vetores em comum.
- Impacto: pequeno; os testes parecem cobrir mais do que cobrem.
- Correção recomendada: trocar `if (...) return` por `expect(app).toBeDefined()` + falha explícita; renomear para `format.test.ts`; criar uma tabela única de vetores de CPF/CNPJ (JSON) lida pelo Vitest, pelo E2E e colada no teste SQL.
- Critério de aceite: nenhum `if` envolvendo `expect`/`return` precoce nos testes; um conjunto de vetores usado nas três camadas.
- Dependências: nenhuma

### O2-008 — O Supabase falso e o modo demo aceitam o que o servidor real recusaria; a fidelidade só é provada em outro lugar

- Área: testes
- Severidade: S3
- Esforço: M
- Confiança: confirmado
- Onde: `web/src/__tests__/fakeSupabase.ts:157-162,66-78,29-52`; testes do modo demo (`applications.test.ts`, `services.test.ts`, `payments.test.ts`, `contacts.test.ts`, `reviews.test.ts`, `deleteAccount.test.ts`, `session.test.ts`); `web/src/types/database.generated.ts` (`feed_jobs`/`public_job_card` retornam `Json`, `transition_application` recebe `p_action: string`)
- Prova: (1) `fakeSupabase.rpc` responde `ok(null)` para qualquer RPC que o teste não configurou (linha 159-160) — o PostgREST real responderia 404 `PGRST202`; (2) `insert(...).select().single()` devolve `null` em vez da linha (o `answer()` retorna no primeiro verbo, linhas 66-78); (3) não há RLS nem grants por coluna, e as cláusulas não suportadas (`or`, `gte`) seriam ignoradas ou dariam erro (hoje nenhum serviço as usa: `grep` vazio); (4) a forma do JSON de `feed_jobs` (`_rank`, `_key`, `_km`, `public_slug`) e de `public_job_card` é escrita à mão em `remote.test.ts:119-124` e `publicLink.test.ts:22-48`, e o gerador de tipos só diz `Json`; (5) cerca de 70 dos 287 testes (applications, services, payments, contacts, reviews, deleteAccount e parte de session) rodam o modo demo, que é uma segunda implementação das regras (desfazer recusa em 10 min, prazo vencido, vaga cheia, avaliação uma vez): só a tabela de transições tem paridade provada com o banco (`r03_suspensao_completa.sql:39-45` compara as 21 linhas; ver "Bom e deve ser preservado").
- Impacto: uma mudança no formato do JSON do mural ou numa regra do banco que não passe pela tabela de transições não derruba nenhum teste do app; o erro aparece só no E2E (pós-merge) ou para o usuário.
- Causa raiz: duas implementações (demo e real) mais um falso escrito à mão.
- Correção recomendada: (1) o falso deve falhar para RPC não configurada (`PGRST202`); (2) gerar, a partir de uma consulta real ao staging, fixtures do JSON de `feed_jobs`/`public_job_card` e usá-las nos testes; (3) teste SQL que compara chaves do JSON com a lista que o app lê; (4) estender o espelhamento do r03 para as demais regras duplicadas (janela de 10 min, limites).
- Critério de aceite: chamar uma RPC inexistente num teste falha; fixture do mural gerada do banco confere com o que `jobFromRow` lê.
- Dependências: nenhuma

### O2-009 — O harness dos testes SQL: `fails()` só confere o SQLSTATE e `run.mjs` sai com 0 sem `DATABASE_URL`

- Área: testes
- Severidade: S3
- Esforço: P
- Confiança: confirmado
- Onde: `web/supabase/tests/_helpers.sql:84-98`; `web/supabase/tests/run.mjs:41-44`; `.github/workflows/web.yml:124-127`
- Prova: (1) `pg_temp.fails(sql, sqlstate)` compara só o código: dos 194 usos, 26 esperam `BC409`, 56 `BC422`, 19 `BC401`, 76 `42501`; só 4 linhas de todo o diretório conferem `sqlerrm`. Como um mesmo `BC409` vale para "vaga cheia", "prazo vencido", "já candidatou", "tem equipe", um teste pode continuar verde porque outra regra recusou (ex.: `z01_candidaturas.sql:107,138` esperam `BC409` para motivos diferentes). (2) `run.mjs` sem `DATABASE_URL` só imprime o SQL e `process.exit(0)` (linhas 41-44, 57): se a variável vier vazia no CI, o passo "Testes SQL" fica verde sem rodar nada; (3) `strip()` tira qualquer linha `begin;`/`rollback;` mas nada impede um `commit;` (hoje nenhum arquivo tem). O que está certo, provado: executei `ok`/`fails` num Postgres embutido (PGlite, `comandos.md`): `ok(false)` e `ok(NULL)` falham; `fails` falha quando o SQL tem sucesso, quando dá outro SQLSTATE; o `run.mjs` conta falha se o `psql` sair ≠ 0 ou se faltar o marcador final.
- Impacto: a rede de segurança do banco é mais frouxa do que o número de asserções (368 `ok`, 194 `fails`) sugere.
- Correção recomendada: `fails(sql, sqlstate, trecho_da_mensagem default null)` e usar nos testes de BC409/BC422; em `run.mjs` sair 2 se `DATABASE_URL` vazio e `CI=true`; recusar arquivo com `commit`.
- Critério de aceite: teste que muda a regra recusante e mantém o código passa a falhar.
- Dependências: D3a-007, D3b-010 (cobertura negativa que falta)

### O2-010 — Números e promessas dos documentos de teste estão defasados

- Área: docs
- Severidade: S3
- Esforço: P
- Confiança: confirmado
- Onde: `CLAUDE.md` §5 ("282 testes Vitest (34 arquivos)", "pode rodar até na produção sem deixar rastro"); `web/e2e/LEIA.md:4`; `web/docs/E2E.md:7`; `.github/workflows/staging.yml:128`
- Prova: `npx vitest run` no commit auditado: 35 arquivos / 287 testes. "Sem deixar rastro" é desmentido por D3a-008 e D3b-010. O restante está no O2-004.
- Impacto: baixo; quem confia nos números não percebe testes novos nem fora do esperado.
- Correção recomendada: contagem automática no CI (ou tirar o número do texto).
- Critério de aceite: nenhum número fixo de testes nos documentos.
- Dependências: O2-004

### O2-011 — Melhoria: matriz de fusos e medição de cobertura no CI (agora)

- Área: testes
- Severidade: M
- Esforço: P
- Confiança: confirmado
- Onde: `.github/workflows/web.yml` (job `checks`, passo `npm test`)
- Prova: o CI roda `npm test` uma vez, em UTC; o O2-001 só aparece com `TZ=Asia/Tokyo` ou entre 21h e 24h no Brasil. Não há `--coverage` no CI (medi numa cópia: `@vitest/coverage-v8@3.2.7`, 12 s).
- Impacto/ganho: pega o erro de data antes do usuário (o app guarda "o dia" no fuso do aparelho, e a empresa e o trabalhador podem estar em fusos diferentes ou o celular com o fuso errado); mostra para onde vão os próximos testes.
- Correção recomendada: `strategy.matrix.tz: [UTC, America/Sao_Paulo, Asia/Tokyo]` no passo `npm test`, mais `vitest run --coverage` com piso por pasta (services 80%).
- Critério de aceite: passo `npm test` rodando nos três fusos.
- Dependências: O2-001

## Hipóteses não confirmadas

- H-1 (bug, não de teste): o servidor decide "hoje" em `America/Sao_Paulo` (`bicos_today()`, `migrations/20261009000200_bicos_v2_rules.sql:103-106`), mas o app compara datas no fuso do aparelho (`web/src/utils/dates.ts:11-16`, `applications.ts:43,187`). Num celular com o fuso errado ou fora do Brasil, "a partir do dia", prazo e "vaga vencida" podem divergir do banco. Não provei com um aparelho; os testes de hoje não conseguem dizer (O2-001 mistura os dois relógios). Para quem cuida da frente de dados/datas: escrever o teste de regra com relógio fixo em cada fuso.
- H-2 (sem prova): o `sleep 3` fixo antes do E2E (`staging.yml:187`, `web.yml:193`) pode esperar pouco se o `vite preview` demorar; 1 execução vista (run 40117427320) passou. Sem evidência de falha.
- H-3 (sem prova): `idDaConta` (`e2e/apoio.ts:194-202`) lista até 20 páginas × 200 usuários; com o staging em 13 usuários não é problema, mas não escala se o staging virar base de teste de volume.

## Não pude verificar

- Testes SQL: não rodei (o contêiner não tem o daemon do Docker; `psql` existe mas não há Postgres). Usei o resultado do CI (job `sql` verde no run 40117686113, 24/10) e provei só as funções `ok`/`fails` num Postgres embutido (PGlite).
- E2E (Playwright): não rodei (precisa de staging com chaves e e-mail). Usei o histórico do GitHub Actions: `staging.yml` › `e2e` verde no run 40117427320; passos individuais não lidos (sem os logs).
- Cobertura dos testes SQL por linha/ramo: o Postgres não mede; a matriz usa correspondência de nomes (RPC citada em algum `tests/*.sql`), que pode errar para funções chamadas só por dentro de outra.

## Bom e deve ser preservado

- A tabela de transições da candidatura está espelhada nos dois lados com prova automática: `applications.test.ts:21-53` lista as 21 transições `estado -ação/ator-> destino`, e `r03_suspensao_completa.sql:39-45` monta a mesma lista a partir de `application_next_status` no banco. Mudou uma, o CI do outro lado falha.
- `_helpers.sql`/`run.mjs` são estritos: provado no PGlite que `ok(false)`, `ok(NULL)`, `fails` que passa sem erro e `fails` com SQLSTATE diferente derrubam o teste; `run.mjs` exige psql com código 0 mais o marcador "TODOS OS TESTES PASSARAM" e roda tudo em `begin … rollback`.
- A suíte Vitest não depende de ordem: 5 sementes de `--sequence.shuffle`, mais duas combinadas com fusos, e 2 repetições deram os mesmos resultados; não há `skip/only/todo`; nenhum teste usa `Math.random` sem fixar (`services.test.ts:118`).
- `remote.test.ts:1226` prova que o número do cartão digitado nunca sai do navegador (`JSON.stringify(fake.calls)` sem "4111"); `headers.test.ts:75-90` varre o código atrás de endereços externos e confere cada um na CSP; `edgeOrigin.test.ts` varre as funções atrás de `requireAppOrigin()`.
- `fakeSupabase` reproduz regras do banco quando o teste pede (`unique` → 23505, `noUpdate` → 42501), regras que explicam o Z04 (`upsert` em `saved_jobs`, `remote.test.ts:1173-1190`).
- A limpeza do E2E funciona: 0 contas `+e2e-` no staging depois de pelo menos 65 execuções do fluxo 7 (65 linhas `suspender_conta` no log); o E2E usa cabeçalhos iguais aos do app e `CAPTCHA_TESTE` para não contornar o captcha; o fluxo 6 prova o limite de tentativas (6ª = 429) e que a senha certa também é recusada depois.
- O fluxo 4 testa o ciclo inteiro com dinheiro de nota: presença → conclusão → duas avaliações → médias nos perfis (`rating 4`/`5`, `review_count 1`).
