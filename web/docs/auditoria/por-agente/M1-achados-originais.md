# M1 — Achados (Frentes 2 e 3: máquina de status e paridade demo × real)

### M1-001 — Vaga oculta pela equipe e conta suspensa ainda aprovam, contratam e convidam

- Área: segurança
- Severidade: S2
- Esforço: P
- Confiança: confirmado (reproduzido no staging, transação desfeita)
- Onde: `transition_application` (staging `pg_get_functiondef`; fonte `web/supabase/migrations/20261021000500_u48_publico_geral.sql`) — ramos `aprovar`/`contratar`/`recusar`/`concluir`: só conferem `v_job.company_id = my_company_id()`, `deleted_at`/`closed` e vagas livres; `invite_worker` (20261013000300_f13_convite.sql) usa `job_is_open` e `own_job_for_update`, que não olham `accounts.suspended_at`. Gatilhos de suspensão só existem em INSERT de `jobs` e de `applications` (`refuse_suspended_job`, `refuse_suspended_application`).
- Prova: transação com 3 contas de teste (DO + `raise exception` para desfazer tudo): (1) `update jobs set hidden_at = now()` (o que `admin_hide_job` faz) e, como a empresa, `transition_application(job, w2, 'aprovar')` → **PERMITIDO**, w2 ficou `pre_selecionado` (e `get_contact` abre o WhatsApp dos dois); (2) `update accounts set suspended_at = now()` na empresa (o que `admin_suspend_account` marca; o token ainda válido) e, como ela, `aprovar`, `contratar` e `invite_worker` → os três **PERMITIDOS**. `get_contact` com conta suspensa responde BC404 (R03), então o número não vaza, mas o estado muda e o trabalhador é avisado "Você foi pré-selecionado… O WhatsApp está liberado". `DECISOES.md` (L06, linha ~1259): ocultar vaga "sai do mural, do link público e das candidaturas novas; a dona e quem já se candidatou continuam vendo" — não diz que a dona segue decidindo candidatos.
- Impacto: uma vaga derrubada pela equipe por golpe/perigo ainda pode escolher e contratar quem já tinha se candidatado (e mandar a pessoa ir ao local); uma empresa recém-suspensa ainda age por até a vida do token de acesso (padrão 1 h).
- Causa raiz: a trava da ocultação/suspensão foi posta na entrada (publicar, candidatar), não nas decisões sobre candidaturas já existentes.
- Correção recomendada: em `transition_application` (ações `aprovar`, `contratar`, `desfazer_aprovacao`; e `undo_reject`) recusar com BC409 se `v_job.hidden_at is not null` ou a conta da empresa estiver suspensa; em `invite_worker` e `update_job` recusar se a conta estiver suspensa (a vaga oculta já é recusada por `job_is_open` no convite). Manter `recusar`, `cancelar_contratacao`, `desistir` liberados (sair do compromisso deve ser sempre possível). Escrever o teste SQL junto.
- Critério de aceite: teste SQL (novo, em `web/supabase/tests/`) que oculta a vaga/suspende a empresa e confirma BC409 em `aprovar`, `contratar`, `invite_worker`, sem quebrar `r03_suspensao_completa.sql`.
- Dependências: nenhuma.

### M1-002 — "Não vou poder ir" não tem janela: depois do dia do bico o faltoso troca "falta" por "desistência"

- Área: produto
- Severidade: S3
- Esforço: P
- Confiança: confirmado (staging, transação desfeita)
- Onde: `tabela TRANSITIONS.desistir` (`web/src/services/applicationMachine.ts:72`) e `application_next_status` (`desistir`: pre_selecionado/contratado, sem data); ramo `desistir` de `transition_application`.
- Prova: contratado numa vaga com `end_date` = ontem; como o trabalhador, `transition_application(job, w, 'desistir', 'nao fui')` → permitido; depois, como a empresa, `marcar_falta` → BC409 "Essa candidatura mudou de situação" (`status` final `desistiu`). Só `contratado` aceita `marcar_falta` (tabela). A empresa só tem do dia do bico até +2 dias para marcar a falta; o trabalhador pode antecipar-se até o sistema concluir.
- Impacto: o registro de falta (peso maior no perfil que a desistência: `worker_track_record` conta os dois separados) fica a critério de quem faltou, se ele agir primeiro; a empresa recebe só "não vai poder ir… a vaga já estava encerrada".
- Causa raiz: `desistir` não depende da data do bico (o front também não esconde o botão depois do dia).
- Correção recomendada: recusar `desistir` quando `job_started(job)` e a data do último dia já passou (ou, a partir do dia do bico, tratar como falta); ou contar `desistiu` depois do dia como falta em `worker_track_record`. Decidir com os sócios; o mínimo é BC409 com mensagem "O bico já passou. Fale com a empresa." para `contratado` depois de `last_day`.
- Critério de aceite: teste SQL em `y01_y04_ciclo.sql`/novo: `desistir` com `end_date < hoje` falha; `marcar_falta` continua possível.
- Dependências: decisão do responsável (regra de produto).

### M1-003 — O corpo demo deixa passar o que o banco recusa (candidatura, convite, presença, aviso, cadastro, avaliação)

- Área: testes
- Severidade: S3
- Esforço: M
- Confiança: confirmado (leitura dos dois lados; definições do banco no staging)
- Onde: demo `web/src/services/applications.ts:282-316` (`submitApplication`) e `:502-530` (`confirmPresence`); `invites.ts:55-84` (`inviteWorker`); `alerts.ts:121-143` (`saveJobAlert`); `auth.ts:161-176` (`isFreeForSignUp`) e `:205-218` (`createAccount`); `reviews.ts:101` (tags); `payments.ts:44-50` (`boostBlocker`). Banco: `submit_application`, `limit_application_spam`, `refuse_blocked_application`, `refuse_suspended_application`, `confirm_presence`, `invite_worker`, `refuse_blocked_invite`, `save_job_alert`, `signup_taken`, `submit_review`.
- Prova (função × demo × banco):
  - candidatura: demo não exige perfil completo, nem checa bloqueio, conta suspensa, vaga oculta, limite de 30 por dia e 3 por vaga por dia; banco recusa todos (BC409/BC401, texto "Complete seu perfil antes de se candidatar", "Não é possível se candidatar a essa vaga.", "Você já se candidatou… muitas vezes hoje").
  - convite: demo não tem o limite de 20 por dia, nem recusa trabalhador "Conta excluída" nem bloqueio; banco tem os três.
  - confirmar presença: banco recusa bico que já passou ("Esse bico já passou."); demo confirma; a notificação do banco leva a data ("· 12/11"), a do demo não.
  - aviso de bico novo: demo só confere cidade/UF e raio; banco exige lat/lon dentro do Brasil e ofício existente (BC422). O limite de 5 por dia é por dia UTC no demo (`at.slice(0,10)`) e por dia de Brasília no banco (`notified_on`).
  - cadastro: `isFreeForSignUp`/`createAccount` do demo contam contas ainda não confirmadas como "já existe"; o banco (`signup_taken`) só considera conta com e-mail confirmado ("uma conta nunca confirmada libera o documento").
  - avaliação: o demo grava as etiquetas como vieram (`tags: input.tags`); o banco descarta as que não estão na lista permitida.
  - vaga oculta: `boostBlocker`/`jobState` do demo não conhecem `hidden_at`; o banco trata vaga oculta como fechada (`job_is_open`).
  - Nenhum teste compara o corpo demo com o RPC: `remote.test.ts` só confere a forma das chamadas com um falso Supabase cujos RPCs são funções escritas à mão (`fakeSupabase.ts`), e os testes SQL não rodam o front.
- Impacto: um bug de regra (por exemplo, o limite de candidaturas ou o bloqueio) não aparece no modo demonstração nem nos testes de serviço; só aparece com o banco. O demo mostra à equipe um comportamento mais folgado que o real.
- Causa raiz: as regras vivem duas vezes (TypeScript do demo e SQL), e só a tabela de status tem teste de paridade.
- Correção recomendada: (a) levar para o demo as regras baratas (perfil completo, bloqueio, convite 20/dia, presença de bico passado, tags permitidas, conta não confirmada não segura documento); (b) acrescentar um teste de contrato que roda os mesmos cenários nos dois modos, ou, no mínimo, uma lista de mensagens/condições por função em `CONTRATO-BACKEND.md` conferida por teste; (c) não precisa replicar spam/suspensão no demo se ficar documentado.
- Critério de aceite: cenários `candidatar com perfil incompleto`, `candidatar a empresa bloqueada`, `convidar 21 vezes`, `confirmar presença de bico passado` dão o mesmo código (`conflito`/`nao_autorizado`) nos dois modos em teste.
- Dependências: nenhuma.

### M1-004 — Mural no modo real: o app refiltra e reordena o que o servidor mandou com regras ligeiramente diferentes

- Área: código
- Severidade: S3
- Esforço: M
- Confiança: provável (código dos dois lados; não há vaga real para reproduzir)
- Onde: `web/src/pages/worker/feed/Feed.tsx:67-80` (`open` = todas as vagas do store, `passesFilters`, `orderJobs`), `feedUI.ts:140-162`; servidor: `feed_jobs` (u49/u52/u53/u65, staging).
- Prova: a lista mostrada vem do store inteiro (não da resposta do `feed_jobs`) e aplica de novo: (1) cidade **e** raio (`cityLabel(j) === location && distância <= raio`), enquanto o servidor aplica cidade **ou** raio (`st_dwithin` sem olhar a cidade — DECISOES.md:505 "da cidade escolhida ou do raio"); as opções da tela são 5/10/20 km e "Toda a cidade", então hoje o raio nunca alcança outra cidade e as vagas vizinhas que o servidor manda são jogadas fora (a página de 30 pode vir quase toda descartada, com "Carregar mais" ainda ligado); (2) "Durante a semana"/"Fim de semana": servidor trata `dias` nulo como "qualquer" (`coalesce`), o app exclui `dias` nulo (`feedUI.ts:147-148`); (3) "Hoje"/"Amanhã" e `isExpired` usam a data do aparelho, o servidor usa `bicos_today()` (America/Sao_Paulo); (4) o app põe as vagas da própria empresa na frente (rank 0), o servidor não; (5) a distância e o raio usam o ponto exato no app e o ponto de área arredondado no servidor.
- Impacto: pequeno hoje (poucas vagas, filtros simples), mas o mural pode mostrar ou esconder uma vaga em relação ao que o servidor decidiu, e quem mexer no filtro num lado esquece do outro.
- Causa raiz: a lógica do mural demo (que filtra tudo no aparelho) foi mantida por cima da leitura paginada do servidor (X01).
- Correção recomendada: no modo real, mostrar a lista pela ordem/pelos ids devolvidos por `feed_jobs` (guardar os ids da consulta) e deixar o filtro local só para o demo; ou apagar o filtro por cidade do `passesFilters` quando há raio e documentar que o raio é só dentro da cidade (e então tirar `p_radius_km` do servidor ou juntar `j.city = p_city`).
- Critério de aceite: teste que, com a consulta da tela, compara a lista do app com a ordem de `feed_jobs` para um conjunto de vagas incluindo `dias` nulo e uma vaga de outra cidade dentro do raio.
- Dependências: nenhuma.

### M1-005 — A versão de produção leva dentro os dados de demonstração e a senha da conta de exemplo

- Área: desempenho
- Severidade: S3
- Esforço: M
- Confiança: confirmado (build real gerado e examinado)
- Onde: `web/src/services/store.ts:8` e `selectors.ts:3` (`import … data/seed`), `auth.ts:7,44` (`ACCOUNTS`, `DEMO_PASSWORD`), `mode.ts:9` (`IS_DEMO` é `!isSupabaseConfigured()`, calculado em tempo de execução, não uma constante de build); `vite.config.ts:151` só faz `define` no demo.
- Prova: `VITE_… (valores falsos) npx vite build --mode e2e --outDir <scratchpad>/dist-real-m1` (modo que liga o Supabase, igual ao de produção). `grep` no `assets/index-*.js` (653.656 bytes, 202 KB gzip): contém `bicos123`, `trabalhador@bicos.demo`, "Eventos Meridiano", "Restaurante Alvorada", "Padaria Belém" (as empresas do `seed.ts`), num bloco contínuo perto do byte 320.000. Log: `out/M1/build-real.log`.
- Impacto: todo trabalhador baixa, em celular simples e internet ruim, um bloco de dados falsos que nunca usa; a senha do demo (`bicos123`) aparece em texto no pacote de produção (varreduras de segredo vão reclamar; nenhuma conta real a usa).
- Causa raiz: o modo é decidido na execução e o seed é importado no topo, então o empacotador não consegue descartá-lo.
- Correção recomendada: `IS_DEMO` virar constante de build (`define` ou expressão literal de `import.meta.env`) e o seed/contas carregados só com `import()` dentro de `if (IS_DEMO)`; conferir com o mesmo `grep` no CI (falhar se achar `bicos123` no build real).
- Critério de aceite: o `grep` acima não acha `bicos123`, "Meridiano" nem `@bicos.demo` no build real; tamanho do chunk principal menor.
- Dependências: nenhuma.

### M1-006 — Documentos e comentários descrevem a máquina de status de um jeito que já não é o do banco

- Área: docs
- Severidade: S3
- Esforço: P
- Confiança: confirmado
- Onde: `web/docs/CONTRATO-BACKEND.md:95-96` ("Rotina diária: contratado com `end_date < hoje` vai para concluída") — o banco conclui **2 dias depois** do último dia (`job_last_day + 2 <= hoje`) e roda **de hora em hora** (`bicos-concluir-diarias`, `7 * * * *`), com "a combinar" = criação + 30 dias; `CONTRATO-BACKEND.md:136` (`deleteJob`: "deleted_at = now()") — a RPC recusa se há pré-selecionado/contratado, recusa quem esperava com aviso e fecha a vaga; `web/src/services/applicationMachine.ts:3` cita `src/__tests__/applicationMachine.test.ts`, que não existe (o teste é `applications.test.ts`); `web/src/services/applications.ts:35` cita `run_job_routines`, que não existe (a função é `conclude_finished_jobs`); o contrato também não descreve `undo_reject`, `confirm_presence` nem as travas de bloqueio/suspensão/spam em `submit_application`.
- Prova: `select jobname, schedule, command from cron.job` no staging (`select public.conclude_finished_jobs();`, `7 * * * *`) e a definição de `conclude_finished_jobs` (`public.job_last_day(j) + 2 <= public.bicos_today()`).
- Impacto: quem seguir o contrato para mexer no banco ou no demo vai reintroduzir a regra antiga (concluir no dia seguinte, sem tempo de marcar falta).
- Causa raiz: o Y04 mudou a regra e o contrato do B-fase não foi atualizado.
- Correção recomendada: atualizar as quatro frases e acrescentar ao contrato a lista "condições e efeitos por ação" de `out/M1/maquina.md` (§2).
- Critério de aceite: grep de `end_date < hoje`, `applicationMachine.test.ts` e `run_job_routines` no repositório não acha nada.
- Dependências: nenhuma.

## Hipóteses não confirmadas

- H1 — Vaga "a combinar" + contratado: o sistema conclui a diária sozinho 32 dias depois de **publicada** (`job_last_day` = criação + 30; `+2`), mesmo que a data combinada com o trabalhador seja depois disso. Está dentro do Y04/Y02 ("a combinar vence 30 dias depois"), então não é bug; o risco é concluir (e pedir avaliação, somar `jobs_done`) um bico que ainda não aconteceu. Prova faltando: nenhuma vaga real "a combinar" com contratação tardia; reproduzível no SQL (`update jobs set created_at = now() - interval '33 days'`) mas é decisão de produto.
- H2 — Deadlock cron × ação do usuário: `conclude_finished_jobs` (1º laço) trava a candidatura e depois a vaga; `transition_application`/`undo_reject`/`delete_job` travam a vaga e depois a candidatura. Só aconteceria se a empresa marcar falta/cancelar a mesma candidatura na hora exata da conclusão automática; o Postgres derruba uma das duas (40P01) e a do cron roda de novo na hora seguinte. Não dá para provar com o conector (uma sessão por chamada).
- H3 — `block_account` não corta o contato por WhatsApp de um bico já aprovado/contratado (`get_contact` não consulta `blocks`; teste staging: continuou abrindo). É a decisão F04 ("contratação já confirmada não é desfeita pelo bloqueio") e o número já foi visto, então não é achado; vale reavaliar se "bloquear por assédio" deveria também cancelar o bico.
- H4 — `admin_suspend_account` de trabalhador **apaga** as candidaturas pendentes (sem evento, sem aviso à empresa; `delete from applications … status in ('enviada','em_analise')`). A empresa vê o candidato sumir; está dito no código ("as candidaturas pendentes saem") mas não no `DECISOES.md` R03.
- H5 — `update_job`/`significantChanges`: para vaga antiga (`weekdays` nulo, `dias='semana'`) o app manda `weekdays` derivado ([1..5]) e o banco compara com `weekdays` nulo → pode avisar "mudou a data" sem a empresa ter mexido nos dias. Sem vaga antiga para testar.
- H6 — A hora do aparelho decide botões como "Marcar diária como concluída" (`jobStarted(todayISO())`) e o selo "Vaga vencida"; o servidor decide por Brasília. Quem usa celular com data errada ou fuso de Manaus/Rio Branco vê o botão errado por algumas horas; o servidor sempre tem a palavra final.
- H7 — `submit_application` numa vaga oculta (acessada com o id) responde "O prazo dessa vaga já passou." (mensagem de prazo para um caso de ocultação); a RLS já esconde a vaga do trabalhador sem candidatura, então só aparece por chamada direta.

## Bom e deve ser preservado

- A tabela de transições está idêntica nos dois lados e tem teste nos dois (`applications.test.ts` e `r03_suspensao_completa.sql` comparam as mesmas 21 linhas). Quem mexer em uma ação precisa mexer nos dois testes.
- Toda decisão sobre candidatura passa por RPC `security definer` que trava a vaga (`for update`) antes de contar posições: aprovação dupla, candidatura dupla, excluir × candidatar e desfazer × aprovar não furam a lotação. `authenticated` só tem SELECT em `applications`/`application_events`.
- `job_holding` conta pré-selecionado + contratado + concluída nos três lugares (aprovar, candidatar, mural) e no `job_stats` usado pelo app; a vaga concluída não volta ao mural.
- O front usa `Record<ApplicationStatus,…>` e `switch` exaustivo nos rótulos: um status novo no banco quebra o `typecheck`, não a tela.
- Todas as mensagens de erro das RPCs de candidatura estão em português simples e o demo repete as mesmas frases.
