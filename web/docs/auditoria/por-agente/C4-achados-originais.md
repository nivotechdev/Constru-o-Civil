# C4 — Telas do trabalhador, da empresa e /admin (auditoria AUD)

Transcrito pelo consolidador a partir do relatório final do agente C4 (o agente não conseguiu gravar o arquivo). Leu por inteiro os 32 arquivos de `web/src/pages/{worker,recruiter,admin}`; nada foi executado no navegador (só leitura de código), então a confiança é "provável". Contagem: S0 0, S1 0, S2 4, S3 11, M 1. Caminhos relativos a `web/src/`.

### C4-001 — Mural vazio diz "Nenhuma vaga com esse filtro" sem filtro; "Limpar filtros" não faz nada

- Área: UX
- Severidade: S2
- Esforço: P
- Confiança: provável
- Onde: `pages/worker/feed/FeedParts.tsx:54-75` (`NoJobsState`; chamado em `MobileFeed.tsx:85` e `DesktopFeed.tsx:34`)
- Prova: na cidade do perfil a função devolve sempre o texto de filtro, porque não recebe `chips`. A produção tem 0 vagas, então é o que o primeiro usuário vê (a empresa também vê o mural).
- Impacto: o primeiro trabalhador (e a primeira empresa) a abrir o app vê uma mensagem errada, que manda limpar um filtro que não existe.
- Causa raiz: `NoJobsState` não distingue "sem vagas" de "sem vagas com esse filtro".
- Correção recomendada: passar `chips.length`; sem filtro, mostrar "Ainda não tem bico em {cidade}" e, para a empresa, "Publicar vaga".
- Critério de aceite: teste: 0 vagas e sem filtro não contém a palavra "filtro".
- Dependências: nenhuma

### C4-002 — "Bicos fechados" (`/historico`) abre a aba "Abertas"

- Área: bug
- Severidade: S2
- Esforço: P
- Confiança: provável
- Onde: `pages/recruiter/History.tsx:6` (passa `tab:'encerradas'`); `MyJobs.tsx:30-35,49-51` (só conhece `todas|abertas|cheias` e cai em `'abertas'`); `layouts/accountMenu.ts:22`; `RateWorker.tsx:22`
- Prova: a aba Encerradas do L07 (`DECISOES.md:763`) foi removida e a rota ficou; `RateWorker` manda para o mesmo lugar depois de avaliar.
- Impacto: a empresa que quer rever os bicos que já fez cai nos que estão abertos; depois de avaliar um trabalhador, não vê o resultado.
- Causa raiz: aba removida sem ajustar quem aponta para ela.
- Correção recomendada: `tab:'todas'`, ou recriar a aba filtrando por `jobOutcome`.
- Critério de aceite: `/historico` mostra as vagas encerradas.
- Dependências: nenhuma

### C4-003 — O formulário de publicar vaga se perde ao sair da tela ou recarregar, sem aviso

- Área: UX
- Severidade: S2
- Esforço: M
- Confiança: provável
- Onde: `pages/recruiter/CreateJob.tsx:94` (usa `useScreenUI`, que apaga o estado ao desmontar, `hooks/useStore.ts:49`); `services/store.ts:30-39` (só guarda o id da sessão no aparelho); `CreateJob.tsx:425-429` (sem seta de voltar ao publicar)
- Prova: leitura do código; um toque no menu de baixo, ou o celular descarregar a página ao voltar da câmera, perde título, endereço, descrição de até 1000 letras e fotos.
- Impacto: a empresa preenche tudo de novo; num celular simples, a câmera costuma recarregar a página.
- Causa raiz: estado do formulário só em memória, sem rascunho.
- Correção recomendada: rascunho em `sessionStorage` com try/catch, ou confirmar ao sair.
- Critério de aceite: recarregar a página no passo 2 restaura os campos.
- Dependências: nenhuma

### C4-004 — Pagamento do impulso: três estados sem tela (risco de cobrança em dobro no cartão em análise)

- Área: bug
- Severidade: S2
- Esforço: M
- Confiança: provável
- Onde: `pages/recruiter/BoostPayment.tsx:188-242`; `services/remote/actions.ts` (`payWithCard`); `supabase/functions/criar-cobranca/index.ts` (fim); `webhook-pagamento`; `pages/recruiter/Payments.tsx:96-103`; `BoostPayment.tsx:63`
- Prova: (1) cartão que o Mercado Pago deixa em análise (`in_process`) fica `aguardando`, mas a tela desenha o formulário de novo; a empresa toca outra vez e é cobrada em dobro (os dois destaques somam em `confirm_boost_payment`). (2) PIX `recusado` ou `cancelado` cai em `PixWaiting` ("Aguardando… muda sozinha") com a leitura periódica já parada; só `expirado` é tratado. (3) `ui.paymentId` mora em memória; depois de recarregar, "Ver pagamento" mostra "Gerar código PIX" em vez do código já gerado.
- Impacto: cobrança duplicada, pagamento "aguardando" para sempre e código perdido ao recarregar: dinheiro e confiança.
- Causa raiz: a tela só conhece os estados feliz e `expirado`.
- Correção recomendada: tela "pagamento em análise" que esconde o formulário, "gerar novo código" para qualquer status que não vale mais, e `paymentId` vindo de `db.boostPayments`.
- Critério de aceite: teste de tela com status `in_process`, `recusado`, `cancelado` e recarga.
- Dependências: ligar `FEATURES.payments` é ação do responsável; corrigir antes

### C4-005 — Busca do mural mostra só a primeira página (30), sem "Carregar mais"

- Área: bug
- Severidade: S3
- Esforço: P
- Confiança: provável
- Onde: `pages/worker/feed/MobileFeed.tsx:39-53`, `DesktopFeed.tsx:69-80,101-120`, `FeedSheets.tsx:105`
- Prova: não têm `<LoadMore>`; só o ramo de navegação tem. "N vagas encontradas" e "Ver N vagas" contam só as carregadas.
- Impacto: sem efeito com poucas vagas hoje; com mais de 30 resultados o resto fica inalcançável.
- Causa raiz: paginação só em um dos ramos.
- Correção recomendada: incluir `LoadMore` e usar "30+".
- Critério de aceite: busca com 31 resultados mostra "Carregar mais".
- Dependências: nenhuma

### C4-006 — Os dois campos de horário do passo 2 de publicar vaga não têm nome acessível

- Área: acessibilidade
- Severidade: S3
- Esforço: P
- Confiança: provável
- Onde: `pages/recruiter/CreateJob.tsx:341-363`; `components/Input.tsx`; `web/scripts/a11y-check.mjs:39`
- Prova: "Horário" é um `<span>` e `Input.tsx` não aceita `aria-label`. O axe do CI só abre `/criar-vaga` no passo 1.
- Impacto: leitor de tela anuncia dois campos sem nome.
- Causa raiz: componente sem suporte a `aria-label` e CI sem cobrir o passo 2.
- Correção recomendada: `aria-label` nos dois campos e axe no passo 2.
- Critério de aceite: axe sem violação no passo 2.
- Dependências: nenhuma

### C4-007 — Escolhas visuais sem estado para leitor de tela

- Área: acessibilidade
- Severidade: S3
- Esforço: P
- Confiança: provável
- Onde: `pages/worker/feed/MobileFeed.tsx:67-78` (ordenar); `pages/recruiter/BoostJob.tsx:93-110` (plano); `pages/worker/VerifyIdentity.tsx:37-59` (foto da identidade fica sem nome); abas `role="tab"` sem painel nem setas em `Admin`, `MyJobs`, `CreateJob`, `BoostPayment`
- Prova: o `Tag` já tem `aria-pressed`; esses não usam.
- Impacto: quem usa leitor de tela não sabe qual opção está escolhida.
- Causa raiz: sem componente de escolha segmentada acessível.
- Correção recomendada: um componente `Segmented` com `aria-pressed`/`radiogroup`.
- Critério de aceite: axe sem violação e estado anunciado.
- Dependências: nenhuma

### C4-008 — Recarregar "Vaga publicada" mostra "vaga não encontrada"

- Área: bug
- Severidade: S3
- Esforço: P
- Confiança: provável
- Onde: `pages/recruiter/JobPublished.tsx:15-17`
- Prova: lê só o store e não chama `loadJob`.
- Impacto: a empresa acha que a vaga não foi criada e pode publicar de novo (ver C1-001).
- Causa raiz: a tela depende de dado em memória.
- Correção recomendada: chamar `loadJob(id)` na montagem.
- Critério de aceite: recarregar `/vaga-publicada/:id` mostra a vaga.
- Dependências: C1-001

### C4-009 — Candidato aprovado: "Desfazer aprovação" e "Cancelar" são quase iguais

- Área: UX
- Severidade: S3
- Esforço: P
- Confiança: provável
- Onde: `pages/recruiter/CandidateActions.tsx:114-141,280-293`
- Prova: o segundo abre "Cancelar a contratação?" e avisa o trabalhador com motivo, mas a empresa ainda não contratou (`desfazer_aprovacao` × `cancelar_contratacao`).
- Impacto: a empresa pode avisar o trabalhador de um cancelamento que não precisava existir.
- Causa raiz: duas saídas para o mesmo estado `pre_selecionado`.
- Correção recomendada: uma saída só em `pre_selecionado`.
- Critério de aceite: em `pre_selecionado` há uma única ação de sair.
- Dependências: nenhuma

### C4-010 — O mesmo status tem quatro nomes e o texto é no masculino

- Área: UX
- Severidade: S3
- Esforço: P
- Confiança: confirmado
- Onde: `utils/applicationStatus.ts:19,78`; `pages/recruiter/JobClosed.tsx:36`; `pages/worker/Selected.tsx`; `CandidateActions.tsx:269`
- Prova: `pre_selecionado` aparece como "Pré-selecionado", "Aprovado", "foi pré-selecionado" e "Você avançou"; também "Você foi contratado" e "perfil dele".
- Impacto: vocabulário confuso para um público com pouca familiaridade; texto no masculino para qualquer pessoa.
- Causa raiz: sem glossário único de status.
- Correção recomendada: um nome só por status e frases neutras; decisão do responsável.
- Critério de aceite: cada status tem um único rótulo em todas as telas.
- Dependências: decisão do responsável

### C4-011 — Digitar na busca troca a lista pelo esqueleto

- Área: UX
- Severidade: S3
- Esforço: P
- Confiança: provável
- Onde: `pages/worker/feed/Feed.tsx:55-62`, `MobileFeed.tsx:103`
- Prova: a chave da consulta inclui a busca, então chave nova é "loading"; offline aparece `ErrorState` mesmo com `found` pronto no aparelho.
- Impacto: a lista pisca a cada letra digitada; sem internet, perde-se o que já estava na tela.
- Causa raiz: estado "loading" por chave.
- Correção recomendada: só mostrar o esqueleto se `found` for vazio.
- Critério de aceite: digitar mantém a lista anterior até chegar a nova.
- Dependências: nenhuma

### C4-012 — "Todas · N" em Minhas vagas conta só as páginas carregadas

- Área: UX
- Severidade: S3
- Esforço: P
- Confiança: provável
- Onde: `pages/recruiter/MyJobs.tsx:52-60,82`
- Prova: contagem local.
- Impacto: número menor que o real.
- Causa raiz: contagem sobre o que foi carregado.
- Correção recomendada: "30+".
- Critério de aceite: com mais de 30 vagas mostra "30+".
- Dependências: nenhuma

### C4-013 — /admin: pequenos furos

- Área: UX
- Severidade: S3
- Esforço: P
- Confiança: provável
- Onde: `pages/admin/Admin.tsx:161-168,187-195,281-288,356-361,372,413-421,464`; `supabase/migrations/20261015000100_lanc06_backoffice.sql:287,322,363`
- Prova: os links de selfie e documento valem 5 min, mas a página os guarda para sempre; depois as imagens quebram e "Aprovar" segue ativo. `resolution.replace('_',' ')` mostra o verbo cru "arquivar"; o registro mostra `targetType` cru. Num cartão resolvido de vaga oculta com conta suspensa, só dá para reexibir a vaga. Aprovar empresa ou identidade é um toque só, sem confirmação. Filas limitadas a 200 no servidor, sem aviso de que há mais. A checagem de papel está certa: o front só pergunta `is_staff` e o banco decide.
- Impacto: risco de aprovar uma identidade sem ver a foto (link vencido); fila maior que 200 invisível.
- Causa raiz: tela de equipe sem acabamento.
- Correção recomendada: renovar links ao vencer e desabilitar "Aprovar" sem foto; confirmação ao aprovar; aviso de "há mais"; rótulos legíveis.
- Critério de aceite: com links vencidos o botão fica desativado até renovar.
- Dependências: nenhuma

### C4-014 — Higiene de código nas telas

- Área: código
- Severidade: S3
- Esforço: P
- Confiança: confirmado
- Onde: `pages/worker/JobDetail.tsx:95` (comentário Z06 invalidado pelo U53) e `:67` (`useAction` com callback vazio); `pages/recruiter/JobManage.tsx:286-294`; `JobClosed.tsx:63` (`as Worker`); `InviteSheet.tsx:65` (um único `loading` para todos os botões "Convidar"); `pages/worker/VerifyIdentity.tsx:43-49,70-74` (vaza `createObjectURL` ao refazer a foto); `CandidateActions.tsx:76-83` (diz "já foram preenchidas" também quando a vaga venceu ou foi encerrada); `services/payments.ts:283` (repete `SUPPORT_EMAIL`)
- Prova: leitura do código.
- Impacto: manutenção e mensagens imprecisas.
- Causa raiz: ajustes acumulados sem limpeza.
- Correção recomendada: corrigir cada ponto listado.
- Critério de aceite: ESLint/tsc limpos e testes verdes após os ajustes.
- Dependências: nenhuma

### C4-015 — O prazo de 30 dias da vaga sem data não é dito a quem publica

- Área: UX
- Severidade: S3
- Esforço: P
- Confiança: provável
- Onde: `pages/recruiter/CreateJob.tsx:321-327`
- Prova: só diz "fica com a data a combinar"; a vaga some do mural em 30 dias (`TO_ARRANGE_DAYS`, DECISOES U52).
- Impacto: a empresa é surpreendida quando a vaga some.
- Causa raiz: regra não informada.
- Correção recomendada: "fica 30 dias no mural".
- Critério de aceite: texto visível no passo de datas.
- Dependências: nenhuma

### C4-016 — (melhoria agora) Botão "Compartilhar no WhatsApp" na vaga publicada

- Área: produto
- Severidade: M
- Esforço: P
- Confiança: provável
- Onde: `pages/recruiter/JobPublished.tsx:39-56`
- Prova: `shareJob` já existe e o link público `/v/:slug` também; hoje "Impulsionar" fica escondido sem pagamentos.
- Impacto: ganho: a empresa traz os primeiros trabalhadores pelos próprios contatos (o mural começa vazio no piloto).
- Causa raiz: tela final sem chamada à ação de divulgação.
- Correção recomendada: botão que usa `shareJob`.
- Critério de aceite: botão abre o compartilhamento com o link `/v/:slug`.
- Dependências: C4-008, C3-001, C3-017

## Hipóteses não confirmadas

- `workerOf`/`companyOf` (`selectors.ts:53-63`) lançam `Error` dentro do render. Hoje `workers` e `companies` são legíveis por qualquer conta logada (`using (true)`), então só quebra se um carregador esquecer de trazer a linha.
- `ContactButton` só relê o contato quando muda `applicationId`, então o texto do `wa.me` fica o da fase anterior depois de contratar na mesma tela (ver C1-005).
- O switch "Avisar quando aparecer bico novo" promete notificação, mas com push desligado ela só existe no sino dentro do app.
- A contagem do PIX usa o relógio do aparelho contra `expiresAt` do servidor.
- O mural monta os layouts de celular e de computador ao mesmo tempo, com DOM duplicado (não medido).
- `Selected.tsx:106-111` mostra "Carregando o endereço…" para sempre se a vaga não tiver rua.

## Bom e deve ser preservado

- `useAction`: anti-toque duplo e o formulário não se perde em erro.
- Status da candidatura exaustivos pelo compilador (`candidateBadge`/`statusInfo`), e `CandidateActions` trata os 11 status com confirmação onde destrói.
- `decisionToasts` (desfazer por 7 s) e `JobManage.decide` (uma decisão por vez).
- Guardas de `ApplicationSent` (X07) e `ConfirmApplication` (Y07).
- `jobForm.ts` puro: valor em reais inteiros, impulso em centavos, `minSlots`, noite que passa da meia-noite, teto de 60 dias.
- `BoostPayment`: hooks antes dos `return`, intervalos com limpeza, cartão fora do store (Y14).
- `VerifyIdentity`: consentimento com versão.
- `Admin`: o servidor é quem decide o papel de equipe, links assinados de 5 min, recusa sempre com motivo.
