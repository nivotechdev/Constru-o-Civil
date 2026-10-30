# O1 — Processo, CI, deploy, observabilidade e documentação (auditoria AUD)

Transcrito pelo consolidador a partir do relatório final do agente O1 (o agente não conseguiu gravar o arquivo). Contagem: S0 0, S1 0, S2 8, S3 8, M 0. Fatos úteis: repositório PÚBLICO; 2 colaboradores (nivotechdev admin, GuiFlorezz write); 5 branches sem proteção; master=5bddd2c (24/10), trabalho em claude/eloquent-heisenberg-y5hwt6=67d9ffb (6 commits à frente); 287 testes em 35 arquivos; nenhum segredo na árvore nem no histórico (padrões testados).

### O1-001 — O token da conta Supabase guardado no CI alcança a produção, e as mitigações do X30 não cobrem o ataque que importa

- Área: segurança
- Severidade: S2
- Esforço: M
- Confiança: provável
- Onde: `.github/workflows/staging.yml:65,135` (SUPABASE_ACCESS_TOKEN); `.github/workflows/staging-fotos.yml:28`; `web/docs/DECISOES.md:2496-2501` (X30); `web/docs/STAGING.md:20`; `web/docs/CHECKLIST-LANCAMENTO.md:20`
- Prova: o token é "pessoal" (CHECKLIST:20). Staging e produção estão na MESMA organização: STAGING.md:20 diz `cdbmayszwthxqckwozjg` e `get_project` da produção devolve o mesmo `organization_id`. Logo o token enxerga os dois projetos (banco, segredos de função, Auth, chaves service_role). Mitigações do X30: (1) `::add-mask::` existe (staging.yml:165, staging-fotos.yml:39) mas só evita vazamento acidental; (2) staging-fotos é só `workflow_dispatch`, porém quem tem escrita pode editar o workflow numa branch nova (um `on: push` novo roda com os segredos); (3) "rotacionar periodicamente": `grep -rniE 'rotacion|rotate|rotaç'` em CHECKLIST, IMPLANTACAO, SUPABASE e STAGING = 0 ocorrências. Nenhum job usa `environment:` com revisor/restrição de branch; as 5 branches estão `protected:false`; repositório público com 2º colaborador com escrita. A trava `CONFIRMO_PRODUCAO` (configurar-auth.mjs:25, publicar-funcoes.sh:11) é checada pelo próprio script do repositório.
- Impacto: quem rodar código num workflow (conta comprometida ou colaborador) leva o token e controla também a produção.
- Causa raiz: um token de conta serve a dois projetos; o controle de uso é só convenção.
- Correção recomendada: (a) tirar o staging da organização da produção (usuário Supabase membro só de uma organização "staging" e token dele no CI); (b) `environment: staging` restrito à branch master, com os segredos nele; (c) item "rotacionar token" no checklist com dono e data.
- Critério de aceite: `GET https://api.supabase.com/v1/projects` com o token do CI não lista `ppnxdajiihsjaojxokzh`; branch nova com workflow que lê o segredo recebe vazio; rotação aparece no checklist com data.
- Dependências: ação do responsável. Revisa a decisão X30 (a decisão é que não fecha o risco).

### O1-002 — O site de teste público (GitHub Pages) tem captcha de teste e manda e-mail de verdade pelo remetente da produção, sem aviso de "ambiente de teste" e sem noindex

- Área: segurança
- Severidade: S2
- Esforço: P
- Confiança: provável (staging inacessível daqui; a cadeia está no repositório)
- Onde: `.github/workflows/site.yml:32-36,60`; `staging.yml:93-97,108,112-114`; `web/scripts/configurar-auth.mjs:46-57`; `web/scripts/staging/conferir-funcoes.sh:52`; `web/docs/STAGING.md:73`; `web/public/robots.txt`
- Prova: site.yml publica em `https://nivotechdev.github.io/Constru-o-Civil/` o app em modo REAL apontando ao staging (não é a demonstração; a trava site.yml:60 funciona) com a chave anon no JS e `VITE_TURNSTILE_SITE_KEY=1x00000000000000000000AA` (teste, sempre passa). O staging recebe `TURNSTILE_SECRET` de teste (staging.yml:93-97,108): aceita qualquer token. conferir-funcoes.sh:52 exige cadastro aberto. configurar-auth.mjs:46-57: com `BREVO_SMTP_USER` envia pela Brevo com `SMTP_SENDER` ou, por padrão, `nao-responda@nivotech.com.br`, "o mesmo da produção" (STAGING.md:73). `robots.txt` = "Allow: /"; `grep` em `web/src` não acha faixa de ambiente de teste. Consulta read-only no staging: 13 contas, todas dos últimos 30 dias, 12 com @gmail.com.
- Impacto: qualquer pessoa/robô cadastra e-mails de terceiros no site de teste; os e-mails saem do domínio da Bicos (reputação do remetente da produção e cota diária da mesma conta Brevo). Quem achar o site no Google pode cadastrar CPF/WhatsApp reais num ambiente com texto legal em rascunho.
- Causa raiz: staging desenhado "igual à produção" ganhou um site público sem repensar captcha, remetente e identificação.
- Correção recomendada: remetente próprio do staging (ou sem SMTP); `<meta robots noindex>` e `Disallow: /` quando `VITE_SENTRY_ENVIRONMENT=staging`; faixa fixa "AMBIENTE DE TESTE — não use dados reais"; captcha real de staging ou lista de e-mails permitidos.
- Critério de aceite: o site mostra a faixa; `robots.txt` do Pages devolve `Disallow: /`; remetente do e-mail de cadastro no staging ≠ produção; token de captcha inválido é recusado no staging.
- Dependências: nenhuma (ação do responsável só para a chave Turnstile de staging)

### O1-003 — Nada segura um commit com CI vermelho: master sem proteção, staging e site de teste não esperam o CI, e o plano de produção liga o Cloudflare Pages ao master

- Área: processo
- Severidade: S2
- Esforço: M
- Confiança: confirmado (execuções) / provável (plano de produção, não executado)
- Onde: `.github/workflows/web.yml:8-18`; `staging.yml:10-14`; `site.yml:8-12`; `web/docs/CHECKLIST-LANCAMENTO.md:83`; `web/docs/IMPLANTACAO.md:98-104`; `CLAUDE.md:37-42`; `web/scripts/deploy.sh:23-24`
- Prova: os 3 workflows disparam em paralelo no mesmo push, sem `needs`/`workflow_run`. Commit 1f202ee (24/10, 17:43:40): web run 40117427286 = cancelled; staging run 40117427320 = success (migrations, funções, E2E); site run 40117427366 = success (Pages no ar). web.yml:16-18 tem `cancel-in-progress:true`: runs 148, 150, 151 (commits 1f202ee, 0cd502e, 4d9ea34) foram cancelados e nunca validaram aqueles commits. As 5 branches estão `protected:false`; CLAUDE.md:37-39 manda push direto no master, sem PR. CHECKLIST:83 manda criar o Cloudflare Pages "Connect to Git … branch de produção master" e IMPLANTACAO:98 repete "a partir do master": Pages com Git publica a cada push sem consultar o Actions — contradiz CLAUDE.md:40-42 ("master não mexe na produção; produção só com pode"). `deploy.sh` roda só typecheck e `vite build` (sem lint nem testes).
- Impacto: um erro enviado ao master pode ir ao staging e ao site de teste antes de o CI ficar verde — e, se o plano do checklist for seguido, direto ao site de verdade sem o "pode" prometido.
- Causa raiz: CI e deploys são workflows independentes; a regra "só com pode" vive só em texto.
- Correção recomendada: proteger o master exigindo os checks `checks` e `sql`; staging e site via `workflow_run` (sucesso) ou `needs`; no Cloudflare Pages usar Direct Upload (`deploy.sh producao`) ou branch `producao` com merge manual, nunca o master; `deploy.sh producao` rodar lint+testes e conferir árvore limpa.
- Critério de aceite: push com teste quebrado não dispara migration, função nem Pages; o runbook diz qual gatilho publica.
- Dependências: O1-008

### O1-004 — CI que fica verde sem rodar nada: job e2e do web.yml e passos de segredos do staging.yml

- Área: testes
- Severidade: S2
- Esforço: P
- Confiança: confirmado
- Onde: `.github/workflows/web.yml:142-164`; `staging.yml:37-46,69-78,139-148`; `CLAUDE.md:40,179-181`
- Prova: run 40117686113 (web, master, 24/10), job e2e = success com TODOS os passos (checkout, setup-node, npm ci, build, "E2E (Playwright)") = skipped (faltam `E2E_SUPABASE_URL`/`E2E_SERVICE_ROLE_KEY`; web.yml:159-164 só emite `::warning::`). staging.yml: os 3 jobs (migrations, funcoes, e2e) terminam success com aviso se faltar `STAGING_DB_URL`/`SUPABASE_ACCESS_TOKEN`/`BREVO_SMTP_USER`. Hoje o E2E real roda (run 40117427320, 3 min 49 s), mas só dentro do staging.yml, que não dispara em branches de trabalho. CLAUDE.md:40 e :181 mandam "conferir o CI web e staging: verde" sem avisar que verde pode ser "pulado".
- Impacto: se um segredo expirar ou for apagado, E2E e conferência do staging param e o painel continua verde.
- Causa raiz: "pular com aviso" foi escolhido para funcionar sem segredos (fork, 1ª montagem) e nunca virou falha.
- Correção recomendada: no master, falhar (`exit 1`) se o segredo faltar; apagar o job e2e duplicado do web.yml; resumo "rodou/pulou" no fim do run; dizer isso no CLAUDE.md.
- Critério de aceite: remover `BREVO_SMTP_USER` num fork de teste deixa o run vermelho; web.yml sem job verde com todos os passos skipped.
- Dependências: nenhuma

### O1-005 — Acessibilidade e desempenho no CI medem a demonstração, e duas telas varridas pelo axe são "Página não encontrada"

- Área: acessibilidade
- Severidade: S2
- Esforço: P
- Confiança: confirmado (reproduzido)
- Onde: `web/scripts/a11y-check.mjs:27,33`; `web/src/routes.ts:154-155`; `.github/workflows/web.yml:47-48,89-109`; `web/vite.config.ts:155`; `web/scripts/lighthouse-check.mjs:6`; `web/docs/RELATORIO-FINAL.md:21-23`
- Prova: a11y-check.mjs abre `/candidaturas` e `/salvas`; as rotas reais são `/minhas-candidaturas` e `/vagas-salvas` (routes.ts:154-155). Reproduzido com dist-demo e o login do script (`$SCRATCH/o1work/pw/rotas.cjs`): "/candidaturas -> Página não encontrada", "/salvas -> Página não encontrada", "/minhas-candidaturas -> Minhas candidaturas", "/vagas-salvas -> Vagas salvas". O script não confere que a tela abriu. web.yml:92 roda `vite preview` sem `--outDir`, servindo `dist/` = `build:demo` (vite.config.ts:155; o build real do CI vai para `dist-real`). Lighthouse, axe (claro/escuro) e sem-rolagem medem a demonstração; nada do modo real (widget Turnstile, botão Firebase, passo do código de 6 números, `/v/:slug`, `/cadastro/*` com erro do servidor, `/admin`) passa pelo axe. Metas Lighthouse 85/95/95 (lighthouse-check.mjs:6) vs. medido 96/100/100: 11 pontos de folga; sem meta de SEO.
- Impacto: as telas mais usadas do trabalhador depois do mural (candidaturas e vagas salvas) nunca foram varridas pelo axe do CI; o "axe em 14 telas" dá mais confiança do que merece.
- Causa raiz: rotas renomeadas sem atualizar o script; o script não valida o que carregou.
- Correção recomendada: corrigir os 2 caminhos; falhar se o h1 for "Página não encontrada" ou a URL final divergir; servir também o build real (modo staging/E2E) e incluir páginas públicas; subir meta de desempenho para ~90.
- Critério de aceite: renomear uma rota sem mudar o script deixa o CI vermelho; o axe lista as páginas públicas.
- Dependências: nenhuma

### O1-006 — O roteiro de produção (IMPLANTACAO.md) parou na migration u12: 13 migrations ficam de fora, sem "desfazer", e há passos que não funcionam como escritos

- Área: processo
- Severidade: S2
- Esforço: M
- Confiança: confirmado
- Onde: `web/docs/IMPLANTACAO.md:28,35-40,47-48,51-64,69-72,98-106`; `web/supabase/APLICAR.md:52,464-470,618-632`; `web/scripts/staging/publicar-funcoes.sh:2,17-18`; `web/.env.example`; `web/build/env.ts`; `CLAUDE.md:156`
- Prova: IMPLANTACAO:47-48 "#39 a #50" e :28 "falta exatamente … lanc06 … u12". O APLICAR.md vai até a #63: ficam de fora u24, u30, u32, u37, u49, u48, u51, u52, u53, u62, u63, u65, u67 (13). A conferência final do passo 4 ("igual aos arquivos") não fecharia. A tabela "Desfazer" (:51-64) não tem linha para as destrutivas: u32 (apaga 4 colunas do trabalhador), u63 (apaga `companies.contact_name`), u62 (apaga linhas de `addresses`), u24 (troca `anonymize_account`); o APLICAR.md as marca destrutivas. IMPLANTACAO:69 "Republicar as 8 funções"; publicar-funcoes.sh:2 publica 10; a tabela de conferência do passo 5 não tem `verificar-cadastro` nem `entrar-com-firebase`. Passo 3 não cita `FIREBASE_PROJECT_ID` e passo 7 não cita `VITE_FIREBASE_*`; `.env.example` e `build/env.ts` também não (grep = 0): o build de produção não exige e sairia SEM login do Google sem erro, enquanto CLAUDE.md:156 afirma que o Google está "Ligado". O roteiro não diz com que ferramenta aplicar migrations: aplicar-banco.sh recusa produção; APLICAR.md:52 diz `supabase db push`; APLICAR-TUDO.sql no SQL Editor não grava `schema_migrations`, e o conferir-migrations.sh do fim do passo 4 falharia. `git grep IMPLANTACAO` só acha workflows, checklist, LIMPEZA e conferir-funcoes.sh — não é citado no CLAUDE.md nem nos READMEs.
- Impacto: seguir o roteiro à risca deixaria a produção com metade das migrations, sem saber desfazer as destrutivas, sem login do Google e sem registro de histórico.
- Causa raiz: escrito no R09 (17/10) e não atualizado nas 18 migrations seguintes.
- Correção recomendada: regenerar o passo 4 a partir do APLICAR.md; "Desfazer/backup obrigatório" nas destrutivas; uma única ferramenta (ex.: `supabase db push` depois do `repair`); completar Firebase e lista de 10 funções; citar o arquivo no CLAUDE.md §8.
- Critério de aceite: teste/CI que compara os #n do APLICAR.md com o IMPLANTACAO.md e falha se divergir; CLAUDE.md aponta para o roteiro.
- Dependências: D1-009 (números), D3b-003 (trava de backup da migration destrutiva)

### O1-007 — O `--mostrar` do configurar-auth.mjs não mostra o estado atual, mas o roteiro usa isso como "desfazer" do Auth

- Área: processo
- Severidade: S2
- Esforço: P
- Confiança: confirmado
- Onde: `web/scripts/configurar-auth.mjs:10,90-103`; `web/docs/IMPLANTACAO.md:96`
- Prova: IMPLANTACAO:96 "Desfazer: configurar-auth.mjs com os valores anteriores (o --mostrar antes de aplicar imprime o estado atual)". No script, `--mostrar` (:97) só imprime o objeto `config` que SERIA enviado (:90-96); não há `GET /v1/projects/<ref>/config/auth` em lugar nenhum e o `PATCH` (:99-103) sobrescreve Site URL, uri_allow_list, SMTP, templates e captcha sem guardar o que havia.
- Impacto: erro na configuração do Auth da produção (Site URL, SMTP, captcha) derruba cadastro e login para todos e não há como voltar ao estado anterior.
- Causa raiz: o script grava mas nunca lê.
- Correção recomendada: antes do PATCH fazer `GET …/config/auth`, salvar em arquivo fora do repositório (a API não devolve segredos) e imprimir o diff "atual → novo"; documentar que o rollback é reaplicar esse arquivo.
- Critério de aceite: `--mostrar` com token imprime atual → novo por campo; o roteiro cita o arquivo de backup.
- Dependências: nenhuma (ponto bom no mesmo script: recusa produção sem `CONFIRMO_PRODUCAO=sim`, :25)

### O1-008 — Seis commits (X30–X32, correção do VAPID, limpeza) estão numa branch lateral: staging e site de teste não têm a correção do X31, e a regra "tudo no master" não foi seguida

- Área: processo
- Severidade: S3
- Esforço: P
- Confiança: confirmado
- Onde: `CLAUDE.md:37-42`; `.github/workflows/staging.yml:12`; branches do GitHub
- Prova: master=5bddd2c (24/10); `claude/eloquent-heisenberg-y5hwt6`=67d9ffb (26/10), 6 commits à frente (0cd502e, 600f46c, 4d9ea34, 5054cd9, b5b78cc, 67d9ffb). Nessa branch só o `web` roda (staging/site só disparam em master e `claude/front-novo-supabase`), então as correções do X31 e do X32 nunca foram publicadas nem exercitadas pelo E2E no staging. O gatilho `claude/front-novo-supabase` (staging.yml:12) aponta para branch parada em 845c9c8 (19/10); há mais 2 branches antigas.
- Impacto: baixo hoje (funções não estão na produção), mas o staging deixa de ser o ensaio do que vai à produção e o CLAUDE.md descreve um fluxo que não é o real.
- Causa raiz: a rodada de auditoria foi feita em branch de sessão; ninguém fez o merge.
- Correção recomendada: merge no master (depois do O1-003), apagar as 3 branches antigas, tirar `claude/front-novo-supabase` do staging.yml.
- Critério de aceite: `git log master..claude/eloquent-heisenberg-y5hwt6` vazio; lista de branches só com master.
- Dependências: O1-003

### O1-009 — O "backup manual antes de qualquer mudança" do X30 é uma frase: sem script, sem teste de restauração e sem cópia da chave que decifra os CPFs

- Área: processo
- Severidade: S2
- Esforço: M
- Confiança: confirmado (ausência); consequência sobre o Vault em "Hipóteses"
- Onde: `web/docs/DECISOES.md:2488-2495`; `web/docs/IMPLANTACAO.md:9-19,143-146`; `web/scripts/exportar-app-antigo.sh:17-21`; `web/docs/LGPD.md:65`
- Prova: `ls web/scripts` não tem script de backup da produção; exportar-app-antigo.sh só exporta as 7 tabelas do app antigo. O único comando está em IMPLANTACAO:14 (`pg_dump -Fc` com a senha dentro da URL) e a "conferência" (:19) é `pg_restore -l | head` — lista, não restaura. Nenhum documento manda guardar `nivotech_documento_key` fora do Vault (LGPD.md:65 só diz "não pode ser apagada"); sem ela `accounts.document_cipher` é ilegível. O arquivo do exportar-app-antigo.sh tem dados pessoais e é criado com a permissão padrão (sem `umask 077`, :20).
- Impacto: se uma migration destrutiva (u32, u63, u12) der errado no Free (sem backup diário), a restauração nunca foi ensaiada e pode não recuperar os documentos.
- Causa raiz: o X30 trata backup como regra de conduta, não como procedimento verificável.
- Correção recomendada: `scripts/backup-producao.sh` (pg_dump + data/hora + `umask 077` + conferência de tamanho), ensaio de restauração no staging registrado em documento, e registrar onde a chave do documento fica guardada fora do Supabase (cofre dos sócios).
- Critério de aceite: o roteiro chama o script; existe registro "restaurado no staging em <data>, N tabelas, CPF decifrado ok".
- Dependências: ação do responsável (cofre; decisão Pro do X30)

### O1-010 — O checklist de lançamento não tem dono nem prazo em nenhum item, e o estado "feito/falta" está desatualizado

- Área: processo
- Severidade: S2
- Esforço: P
- Confiança: confirmado
- Onde: `web/docs/CHECKLIST-LANCAMENTO.md` (linhas 18,20,47-48,77,83,139-140,223); `web/docs/DECISOES.md:2484-2501`; `web/docs/VOLUME.md:47`; `web/docs/TESTE-MANUAL.md`
- Prova: as tabelas têm só "Feito pela IA | Ação do responsável"; mais de 70 itens `[ ]` sem responsável nem data. Os gatilhos do X30 — "Pro antes de receber pessoas reais" (só um `[ ]` solto em :77), "advogado revisa" (:47-48,139-140) e "rotacionar o token" (não existe, ver O1-001) — não têm prazo nem um critério único de "pronto para o público". Estado velho: :18 e :20 ainda pedem senha do banco e token do staging (os segredos existem: os runs passam); :223 diz "Falta (R08): funções no staging, Auth, site de teste, E2E 13/13, volume, teste manual" com o staging já tendo 67 migrations, funções, Auth e site; VOLUME.md:47 diz "o staging ainda não tem o banco montado"; TESTE-MANUAL.md tem a tabela de resultado vazia. Os `{{…}}` dos textos legais bloqueiam inclusive o piloto fechado (.env.example:43-46) e o pedido dos dados aos sócios (:139) não tem dono nem data (ver D5-005).
- Impacto: ninguém sabe o que bloqueia o lançamento nem quem destrava.
- Causa raiz: o documento é registro de tarefas da IA, não lista de responsabilidades dos sócios.
- Correção recomendada: colunas "Dono" e "Até quando"; seção "Bloqueia o lançamento" no topo (Pro, advogado, dados da empresa, DNS, Brevo SPF/DKIM, Turnstile, Sentry/healthchecks, WhatsApp do suporte); marcar o que já foi feito; registrar a data do teste manual.
- Critério de aceite: cada `[ ]` com nome e data; o topo lista os bloqueadores e é a única definição de "pronto".
- Dependências: ação do responsável (decidir donos)

### O1-011 — Em produção nada avisa ninguém quando algo quebra (e o staging também não): Sentry e monitor de fora desligados, alerta do cron sem destino

- Área: processo
- Severidade: S2
- Esforço: M
- Confiança: confirmado (configuração documentada)
- Onde: `CLAUDE.md:127-128,156-158`; `web/docs/SUPABASE.md:137-150`; `.github/workflows/site.yml:37-38`; `staging.yml:177`; `web/docs/ADVISORS.md:15`
- Prova: CLAUDE.md:127 faltam no Vault `bicos_sentry_dsn` e `bicos_heartbeat_url`; :157-158 "Desligado: … Sentry …". SUPABASE.md:139 "sem os dois itens abaixo ele só registra o alerta em cron_alerts (ninguém é avisado)". No staging o DSN é `https://publica@sentry.invalid/1` (site.yml:38) e `…e2e@sentry.invalid/1` (staging.yml:177): erros do site de teste também não vão a lugar nenhum. SUPABASE.md:142-148 são "ação do responsável" sem data e não são bloqueadores no checklist (O1-010). Sem monitor de disponibilidade do site nem da API; `funnel_daily` só pelo SQL Editor; o plano Free pausa por inatividade (X30) e o único alarme previsto é o heartbeat não configurado. (Defeitos do alerta em si: D3b-006; limpeza que não roda: D5-001.)
- Impacto: o primeiro sinal de falha em produção será um usuário reclamando no WhatsApp do suporte.
- Causa raiz: observabilidade foi construída no código (L05, L12) e deixada "para ligar depois" sem dono nem data.
- Correção recomendada: tornar Sentry (front e funções) e `bicos_heartbeat_url` bloqueadores do lançamento, com e-mail dos sócios; monitor de disponibilidade grátis no domínio e no `/auth/v1/health`; Sentry real no staging.
- Critério de aceite: `select * from cron_health()` e um erro forçado (IMPLANTACAO:138-141) chegam por e-mail em < 1 h.
- Dependências: ação do responsável; D3b-006

### O1-012 — CLAUDE.md descreve o projeto de 17/10 e uma IA nova não consegue operar só com ele

- Área: docs
- Severidade: S3
- Esforço: P
- Confiança: confirmado
- Onde: `CLAUDE.md:4-5,134,156,166,179-181,188,223-235`
- Prova (além do que D1-009 cobre: staging "sem migrations", 48 arquivos, 42 RPCs): (1) cabeçalho "Estado conferido em 17/10 (front-novo-supabase em 1b07bb6, master em dd8d0ad) … Rodada atual: R01–R12"; hoje master=5bddd2c, front-novo-supabase=845c9c8, trabalho em `claude/eloquent-heisenberg-y5hwt6`; as rodadas recentes são U01–U69 e X01–X32 (:188 ainda "L01–L14 nesta rodada"). (2) :134 "Edge Functions … todas publicadas" e :156 "todas as funções publicadas" contradizem a própria tabela (`verificar-cadastro` e `entrar-com-firebase` "ainda não publicada"). (3) :166 "282 testes (34 arquivos)"; `f1/test.log`: 287 testes em 35 arquivos; :180 "axe em 14 telas": o script varre 16 páginas, 2 delas 404 (O1-005). (4) §8 não lista IMPLANTACAO.md, LGPD.md, LIMPEZA.md, TESTE-MANUAL.md, PLANO-CADASTRO.md, web/e2e/LEIA.md, supabase/pendentes/LEIA.md. Falta para uma IA nova: inventário dos segredos/variáveis do GitHub Actions e o que ocorre quando faltam; dono de cada conta externa (Supabase, Firebase, Brevo, Cloudflare, Sentry, GitHub) e onde estão as credenciais; o que o CI faz e o que NÃO faz (O1-003/004/005); como aplicar e desfazer migration na produção (O1-006); versões das ferramentas (Node 22, Deno 2.5.4, Docker para SQL); que o repositório é público e o que isso proíbe; a ordem real dos ambientes (site de teste = staging; produção ainda sem front).
- Impacto: quem siga só o CLAUDE.md decide com o mapa velho e não sabe onde está o roteiro de produção.
- Causa raiz: números em prosa; arquivo editado por trechos.
- Correção recomendada: reescrever cabeçalho e §3–§5 com números atuais (ou remover), acrescentar seção "Operação" com os itens acima, corrigir §8.
- Critério de aceite: cada número do CLAUDE.md tem um comando que o confere (ou foi removido); IMPLANTACAO.md aparece em §8.
- Dependências: D1-009

### O1-013 — Dependências e actions: 9 vulnerabilidades em ferramentas de desenvolvimento sem `npm audit` no CI, sem Dependabot, actions por tag, Node 22 abaixo do que o Firebase pede

- Área: processo
- Severidade: S3
- Esforço: P
- Confiança: confirmado
- Onde: `.github/workflows/web.yml` (sem audit; `uses: …@v4`); `web/package.json:25-26`; `.github/` (sem `dependabot.yml`); `web.yml:101`
- Prova: `npm audit` (cópia de package.json+lock): 9 vulnerabilidades (1 baixa, 3 moderadas, 3 altas, 2 críticas): tinypool (crítica, gadget de RCE no executor do vitest), vite 7.0–7.3.6 (alta; servidor de desenvolvimento), source-map-js, zod, serialize-javascript, fast-uri, postcss-selector-parser, @vitest/mocker. `npm audit --omit=dev` = 0 (`f1/audit.log`): nada disso vai ao usuário. `npm audit fix` resolve a maioria sem quebrar. Actions por tag (checkout@v4, setup-node@v4, upload-artifact@v4, setup-deno@v2, deploy-pages@v4), não por SHA. `npm ci` (`f1/npm-ci.log`) avisa EBADENGINE: @firebase/app@0.16.3 e @firebase/auth@1.13.7 pedem Node >=24.12.0; o CI usa Node 22; sem `engines` nem `.nvmrc`. O axe é instalado fora do lock (web.yml:101). web.yml e staging.yml não declaram `permissions:`.
- Impacto: baixo hoje; vira dívida porque nada avisa quando uma dependência de produção ganhar uma falha.
- Causa raiz: sem rotina de atualização nem verificação automática.
- Correção recomendada: passo `npm audit --omit=dev --audit-level=high` no CI; Dependabot semanal (npm e actions); `permissions: contents: read` nos 2 workflows; `engines`/`.nvmrc` coerentes com o Firebase.
- Critério de aceite: CI falha com dependência de produção vulnerável; `npm ci` sem EBADENGINE.
- Dependências: nenhuma

### O1-014 — Dados pessoais dos sócios num repositório público

- Área: LGPD
- Severidade: S3
- Esforço: P
- Confiança: confirmado
- Onde: `.github/workflows/site.yml:40`; `staging.yml:178,190`; `web/docs/SUPABASE.md:163`; `web/docs/STAGING.md:17`; `web/supabase/functions/.env.staging.example:21`; `web/src/services/features.ts:47`; `web/src/services/payments.ts:283`; `web/e2e/apoio.ts:28`
- Prova: repositório público (private=false). Aparecem o celular do suporte (que o CLAUDE.md chama "o mesmo da produção") em 2 workflows; o Gmail de desenvolvimento em 10 pontos — padrão do E2E (staging.yml:190), `SUPPORT_EMAIL` do app (features.ts:47), texto em payments.ts:283 — e SUPABASE.md:163 manda usar esse Gmail como `VAPID_SUBJECT`, o que o commit 0cd502e acabou de tirar do código; e-mail do dono da organização Supabase (STAGING.md:17). O histórico guarda o `archive/` inteiro (192 arquivos; `git show 4d9ea34^:archive/…`). Busca de padrões de segredo (JWT service_role, sbp_, ghp_, chaves Brevo, Mercado Pago, chave privada, whsec_, sntrys_) no histórico inteiro: 0 resultados; a árvore só tem identificadores públicos (anon do staging, chave pública do Firebase).
- Impacto: facilita phishing e engenharia social contra quem administra as contas.
- Causa raiz: e-mail/telefone de teste virou padrão de configuração.
- Correção recomendada: trocar por endereços da empresa (suporte@, dev@nivotech.com.br); `E2E_EMAIL_BASE` sem padrão; corrigir SUPABASE.md:163; decidir se o telefone do suporte pode ser público já.
- Critério de aceite: `git grep` por esses valores = 0 fora de `.env` locais.
- Dependências: ação do responsável (escolher os endereços)

### O1-015 — Documentos da migração antiga e relatórios velhos confundem: mandam rodar comandos que não existem e descrevem telas que saíram

- Área: docs
- Severidade: S3
- Esforço: P
- Confiança: confirmado
- Onde: `web/docs/VALIDACAO.md:7,13,45,65,73,83`; `MAPEAMENTO.md:7-12`; `RELATORIO_PARIDADE.md` (728 linhas); `RELATORIO-FINAL.md:12-26`; `E2E.md` + `e2e-prints/*`; `CONTRATO-BACKEND.md:49,189`; `README.md:59-64`; `web/README.md:66,77-89`; `LIMPEZA.md:253-256`
- Prova: VALIDACAO.md manda `npm run build && npm run parity` e `scripts/parity/run.mjs` — removidos no commit 4d9ea34. MAPEAMENTO.md §0 "não existe Firebase no repositório" — hoje o login Google/celular usa Firebase (U28). RELATORIO-FINAL.md cita 167 testes, 36 migrations e "aplicar as 36 migrations"; reutiliza IDs L01–L09 que a rodada de lançamento usa de novo. E2E.md é de 16/10 e os 38 prints mostram "completar perfil ofício/especialidade" e "construtora", removidos pelos U12/U48. CONTRATO-BACKEND.md ainda lista `workers.oficio_id`. README.md:61-64 "Falta montar o staging … na branch claude/front-novo-supabase". web/README.md:66 cita script de "paridade" e a tabela :77-89 omite IMPLANTACAO, LIMPEZA, TESTE-MANUAL, PLANO-CADASTRO. LIMPEZA.md:253-256 deixa o D2 (apagar os 4 documentos) "decisão ainda não tomada".
- Impacto: ~1,3 mil linhas de ruído e instruções que falham; RELATORIO-FINAL e E2E.md mostram um produto que não existe mais.
- Causa raiz: documentos de fase mantidos como se fossem vivos.
- Correção recomendada: executar o D2 (apagar ou mover para `docs/historico/` com aviso); não versionar E2E.md/prints gerados (usar o artefato do CI) ou regerar; atualizar README.md e web/README.md.
- Critério de aceite: `links.mjs` sem citações quebradas; nenhum documento manda rodar comando inexistente.
- Dependências: decisão do responsável (D2 do LIMPEZA)

### O1-016 — Scripts de deploy: a trava de produção do deploy.sh é uma variável de ambiente, publica o que está no disco e não confere que o build é o da produção

- Área: processo
- Severidade: S3
- Esforço: P
- Confiança: confirmado
- Onde: `web/scripts/deploy.sh:17-19,23-24,27,33`; `web/scripts/sentry-sourcemaps.mjs:21-25`; `web/scripts/staging/aplicar-banco.sh:19-21,71-75`; `web/scripts/exportar-app-antigo.sh:13-16,20`
- Prova: `deploy.sh producao` só exige `CONFIRMO_PRODUCAO=sim`; roda typecheck e `vite build` (sem lint/testes); a conferência "não é demonstração" (:27) aceita QUALQUER `https://x.supabase.co` — um `.env.production.local` apontando ao staging passa (IMPLANTACAO:106 pede conferir `ppnxdajiihsjaojxokzh` à mão); `wrangler … --commit-dirty=true` publica alterações não commitadas e o release do Sentry usa o HEAD, que então não corresponde ao código; nenhuma tag registra o que foi publicado. O Vite lê `.env.local` em qualquer modo e pode misturar valores se faltar chave no `.env.production.local`. `aplicar-banco.sh`: trava por texto em `STAGING_DB_URL` (:19-21); `STAGING_URL` não é conferido; cada migration roda com `psql -f` sem transação (:71) e só entra no histórico depois (:72) — falha deixa o staging pela metade (idempotência: D3a-002). exportar-app-antigo.sh grava dados pessoais sem `umask 077` (:20).
- Impacto: um deploy de produção pode sair do commit errado, com variáveis do staging ou sem testes.
- Causa raiz: scripts escritos para quem sabe o que faz.
- Correção recomendada: `deploy.sh producao`: `git status --porcelain` vazio, commit conferido, `npm run lint && npm test`, exigir o ref da produção no JS, tag `deploy-AAAAMMDD-HHMM`, `--commit-dirty=false`; `umask 077` no export.
- Critério de aceite: rodar com `.env.production.local` do staging aborta; árvore suja aborta.
- Dependências: O1-003

## Hipóteses não confirmadas

- `GITHUB_TOKEN` padrão e aprovação de workflows de forks: web.yml e staging.yml sem `permissions:`; o proxy bloqueou `/actions/permissions` (HTTP 403 do proxy).
- Cloudflare Pages já ligado ao Git? Sem ferramenta aqui; o domínio ainda não está no ar. O1-003 vale se o checklist for seguido como escrito.
- Restaurar `pg_dump` em outro projeto: creio que os valores do `vault.secrets` (incl. `nivotech_documento_key`) não sejam decifráveis fora do projeto de origem (a chave mestra fica no Supabase); não testei. Se for verdade, O1-009 sobe para S1 no lançamento.
- Os 12 e-mails @gmail.com do staging (19–28/10) podem ser dos sócios; não separei equipe de terceiros nem sei se o site de teste está indexado.
- Chave de API do Firebase (AIza…, em site.yml) sem restrição de referrer no Google Cloud: não verificável daqui.
- `archive/` no histórico público tem 10 sequências com formato de CPF e alguns telefones, provavelmente dados de demonstração do app antigo; não verificado um a um.
- Colaborador `GuiFlorezz` (escrita): identidade e 2FA desconhecidos; relevante para O1-001.

## Bom e deve ser preservado

- Travas de produção por padrão: configurar-auth.mjs:25, publicar-funcoes.sh:11, aplicar-banco.sh:19-21, volume/rodar.sh:11-13, fotos-vagas-teste.mjs:13, deploy.sh:17.
- deploy.sh: build falha sem variável; trava contra publicar a demonstração (verificado: `dist-demo/assets/*.js` não contém nenhum `https://*.supabase.co`); apaga os `.map`.
- web.yml: prova que o build sem variáveis falha e que o build de produção para com textos legais incompletos; `deno check` das 10 funções; APLICAR-TUDO.sql e tipos "em dia"; testes SQL em imagem fixa; Lighthouse pela mediana de 3; ferramentas fixadas (lighthouse 12.8.2, supabase 2.48.3, wrangler 4.20.0, @sentry/cli 2.39.1, Deno 2.5.4, Playwright 1.56.1).
- staging.yml: aplica no staging ANTES da produção; confere histórico = arquivos; aplicar-banco.sh termina conferindo RLS em todas as tabelas do `public`; `concurrency` sem cancelar a montagem.
- Segredos: nenhum na árvore nem no histórico; `::add-mask::` antes de gravar no `GITHUB_ENV`; staging-fotos.yml e site.yml com `permissions` mínimas; `.gitignore` cobre `.env.*`, `dist-*`, `lighthouse*.json`, `e2e/resultados/`.
- `npm ci` funciona; `npm audit --omit=dev` = 0; pixelmatch/pngjs estão em uso (`scripts/limpeza/comparar.mjs`) apesar do knip.
- X31 e X32 dizem o que ficou de fora e o que fazer antes de publicar; X30 é coerente com CLAUDE.md §9.9 e o passo 1 do IMPLANTACAO. TESTE-MANUAL.md e conferir-funcoes.sh são bons ensaios; falta registrar resultado.
