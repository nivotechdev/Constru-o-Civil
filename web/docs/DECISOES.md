# Decisões de produto e de implementação

Decisões tomadas onde o pedido não definia o comportamento. Regra usada: a opção mais simples e segura
para quem usa o app. Cada item diz de qual ID do plano veio.

## B09 — Sessão e guardas de rota

- **Uma conta = um lado.** O papel (trabalhador ou construtora) vem da conta e não muda no login. Quem
  quiser os dois lados cria duas contas (F14 tira a frase "Dá para trocar depois").
- **Contas de demonstração:** `trabalhador@bicos.demo` (perfil Jorge Mendes) e `construtora@bicos.demo`
  (Construtora Meridiano), senha `bicos123`. Ficam listadas num quadro discreto no fim do login; tocar
  numa conta preenche os campos.
- **Login aceita e-mail, CPF ou CNPJ** (como o campo já dizia). O serviço resolve o documento para a
  conta. As mensagens de erro distinguem conta inexistente e senha errada (L13 completa o resto).
- **"Continuar com o Google" e "Continuar com o celular"** ainda não têm fluxo (L13). Até lá, tocar neles
  mostra o aviso "Na demonstração, entre com e-mail e senha", em vez de entrar numa conta qualquer.
- **Sessão persistida no `localStorage`** (chave `bicos.sessao`, só o id da conta, com `try/catch`).
  Os dados do mock continuam só em memória: depois de recarregar a página, só as contas de demonstração
  voltam logadas; uma conta criada no cadastro some com o recarregamento (como o resto do mock).
- **Sem sessão**, qualquer rota interna leva ao login; depois de entrar, a pessoa volta para o endereço
  que tentou abrir. A raiz `/` mostra a Splash sem sessão e o mural com sessão.
- **Onboarding obrigatório:** com e-mail não confirmado, a única tela que abre é "Confirme seu e-mail";
  com perfil incompleto, só "Completar perfil" do próprio lado. Termos, privacidade e recuperação de
  senha abrem sempre.
- **"Abrir meu e-mail"** faz, na demonstração, o papel do link de confirmação (aviso na própria tela).
- **Rotas por lado:** perfil de candidato com contexto de vaga (`/trabalhador/:id/:jobId`) é só da
  construtora; perfis públicos (`/trabalhador/:id`, `/construtora/:id`), mural, detalhe da vaga,
  notificações e configurações abrem para os dois.
- **Sair da conta** pede confirmação num diálogo único (menu, Configurações, Editar perfil e a tela de
  confirmar e-mail) e apaga todo o estado de telas da sessão. O "voltar" do navegador não volta para
  dentro da conta.
- **Tabela `profiles` virou `accounts`** em `types/supabase.ts`, com e-mail, documento, WhatsApp e as
  datas de confirmação. O arquivo de tipos agora declara cada linha uma vez e deriva insert/update. O SQL
  em `web/supabase/` é o rascunho anterior e **não** foi atualizado (o pedido proíbe migrations nesta
  etapa); o back-end escreve as migrations a partir de `docs/CONTRATO-BACKEND.md` e de `types/supabase.ts`.

## B10 — Carregamento, erro, vazio e offline

- **Interruptor de falha da demonstração:** abrir o app com `?falhar=1` antes do `#` (ex.:
  `index.html?falhar=1#/mural`) ou ligar **Configurações › Demonstração › Simular falhas de conexão**. Com
  ele ligado, toda chamada de serviço do mock é rejeitada. "Sair da conta" continua funcionando (a sessão
  é encerrada no aparelho mesmo sem rede).
- **Sem internet** (`navigator.onLine` falso), as chamadas também falham, com a mensagem de offline, e uma
  faixa no topo avisa enquanto durar.
- **Leituras passam por serviço com cache por sessão:** cada tela pede o que mostra com uma chave
  (`feed`, `job:ID`, `worker:ID`…). O primeiro acesso mostra esqueleto; os seguintes abrem na hora (o
  store já tem os dados). Em erro, a tela mostra "Tentar de novo" e, em telas cheias, "Voltar ao início".
  Sair da conta limpa o cache.
- **Salvar vaga é otimista:** a bandeirinha muda na hora e volta se a chamada falhar, com um aviso.
- **Erros de ação** aparecem junto do botão (ou dentro do diálogo, que continua aberto); avisos curtos de
  sucesso aparecem num toast no rodapé, anunciado a leitores de tela.
- **Erros de serviço têm código** (`offline`, `falha_demo`, `nao_autorizado`, `nao_encontrado`,
  `conflito`, `validacao`) e mensagem pronta em português; o back-end real deve mapear seus erros para
  esses códigos (ver `services/errors.ts`).

## B07 — Catálogo único de ofícios

- **14 ofícios** em `data/oficios.ts` (servidos por `services/catalog.ts`), cada um com `id` estável,
  nome e sinônimos. Vaga e trabalhador guardam só o `oficioId`; a tabela `oficios` entra em
  `types/supabase.ts`.
- **"Pedreiro" e "Pedreiro de acabamento" são ofícios distintos**; o filtro do mural compara o id exato
  (filtrar por Pedreiro não traz Pedreiro de acabamento). A busca por texto encontra os dois.
- **Título da vaga é opcional** (até 60 caracteres). Sem título, a vaga aparece com o nome do ofício.
- **Busca ignora acento e maiúsculas** e encontra vagas e trabalhadores por nome do ofício ou sinônimo
  ("hidráulica" acha os encanadores).
- **"Servente e ajudante"** (texto livre do seed) virou o ofício Servente.
- **Testes de paridade com o app antigo** para o store e para a mensagem pronta do WhatsApp foram
  aposentados: o modelo mudou de propósito (ids de catálogo, e nas próximas etapas datas reais e status
  explícitos). As regras passaram a ser testadas diretamente (`store.test.ts`, `oficios.test.ts`). Os
  testes de paridade das máscaras, textos de status e busca de cidades continuam.

## B06 — Endereço, cidade, localização e datas reais

- **Vaga guarda o endereço inteiro** (CEP, rua, número, complemento, bairro, cidade, UF, latitude e
  longitude) e as **datas reais** (início e fim em `YYYY-MM-DD`, horários `HH:MM`). "Hoje", "Amanhã",
  "Sex, 25 set" e "Hoje até 27 set" são calculados na hora de mostrar (`utils/jobInfo.ts`).
- **CEP na demonstração:** uma tabela pequena de CEPs reais (`services/address.ts`: 03307-000, 03104-000,
  01310-100, 13010-111, 20040-002). Outro CEP válido aparece como "não encontrado" e a pessoa preenche rua
  e bairro e escolhe a cidade no seletor. No back-end, a busca vai para ViaCEP/BrasilAPI por uma função.
- **Coordenadas no mock:** o ponto do CEP conhecido, ou o centro da cidade escolhida, mais um pequeno
  deslocamento fixo por rua e número (para duas vagas da mesma cidade não ficarem no mesmo ponto).
- **Datas:** início não pode ser no passado; fim igual ou depois do início; uma vaga cobre no máximo 60
  dias. "Data a combinar" é um interruptor; ligado, a construtora informa quantas diárias.
- **Diárias** são contadas pelas datas e pelos dias escolhidos (semana, fim de semana ou qualquer dia). Se
  nenhum dia do período cair nos dias escolhidos, o formulário avisa.
- **Horário** continua opcional, agora com minutos (início antes do fim).
- **Distância** é calculada em linha reta (Haversine) a partir de: (1) a posição do GPS, quando a pessoa
  usou "Usar minha localização"; (2) a casa do trabalhador, quando o mural está na cidade dele; (3) o
  centro da cidade escolhida. O filtro "Até X km" e a ordem "Mais perto" usam esse cálculo.
- **O mural abre na cidade do trabalhador** (a do perfil). "Limpar filtros" volta para ela. Para a
  construtora, abre em São Paulo (cidade das vagas de demonstração).
- **Vaga com data final passada sai do mural** sozinha (e da lista de vagas abertas da construtora).
- **Trabalhador** guarda cidade (rótulo do seletor), bairro (quando conhecido) e coordenadas; o texto
  "Tatuapé, SP" é montado na hora. Mudar de cidade no perfil move o ponto para o centro da nova cidade.
- **Datas do seed são relativas ao dia em que o app abre**, para a demonstração sempre ter vagas "Hoje",
  "Amanhã" e na semana que vem, e um histórico no passado.
- **Tela carregada sob demanda:** o carregamento das telas marca a promessa do código como resolvida e
  sempre chama `use()`, removendo um aviso do React sobre `use()` condicional.

## B02 — Máquina de status da candidatura

- **Uma tabela única** (`services/applicationMachine.ts`) diz de qual status para qual, e quem pode
  (trabalhador, construtora ou sistema). Só ela muda o status; o back-end deve aplicar a mesma tabela (está
  em `docs/CONTRATO-BACKEND.md`).
- **"Avaliada" deixou de ser status.** A candidatura fica "concluída" e cada lado tem seu indicador
  (`workerReviewed`, `companyReviewed`).
- **Histórico:** cada candidatura guarda `events[]` (status, quando, quem, motivo) e `statusChangedAt`.
  "Contato liberado em" mostra a data real em que a construtora aprovou.
- **Abrir o perfil de um candidato novo** muda "enviada" para "em análise" e avisa o trabalhador.
- **Recusa automática ao preencher a última vaga** fica marcada (`autoRejected`). Se a construtora desfizer
  aquela aprovação, os recusados automaticamente voltam para "em análise" (antecipa parte da L01). Ao
  encerrar a vaga, a recusa vira definitiva.
- **Desfazer aprovação** retira o aviso "Você foi pré-selecionado" se o trabalhador ainda não o viu.
- **Conclusão automática:** uma contratação cuja vaga já passou da data final vira "concluída" sozinha
  (no mock, sempre que as candidaturas são lidas; no back-end, uma rotina diária) e os dois lados recebem o
  pedido de avaliação.
- **Desistir e cancelar pedem motivo** (lista curta + "Outro motivo" escrito); o motivo vai na notificação
  para o outro lado. Marcar falta pede só confirmação.
- **Notificações agora são dados**: cada uma é de um trabalhador ou de uma construtora, nasce na mesma
  transação da mudança que avisa, tem destino (abre a tela certa) e é marcada como lida ao abrir.
- **Testes de paridade dos rótulos de status** com o app antigo foram aposentados (há status novos).

## B01 — WhatsApp nos dois sentidos

- **Número privado dos dois lados.** `Worker.whatsapp` e `Company.whatsapp` existem no modelo (espelham as
  colunas do banco), mas nenhuma tela lê esses campos: o número só sai de `contacts.getContact(id da
candidatura)`, que exige candidatura pré-selecionada ou contratada e que quem pede seja um dos dois
  lados. No back-end, isso vira uma RPC que confere o mesmo antes de ler a coluna privada.
- **Botão "Falar no WhatsApp"** pede o contato na hora de aparecer (com "Carregando contato…" e "Tentar de
  novo" se falhar). Aparece para a construtora na lista de candidatos (aprovado/contratado), no perfil do
  candidato com contexto de vaga e na tela da equipe; para o trabalhador em Minhas candidaturas e em
  "Você avançou".
- **Depois da conclusão o contato fecha** (a regra pede só pré-selecionado/contratado). Se precisar
  reabrir para combinar algo depois, é uma decisão a revisitar.
- **Mensagens prontas** usam o nome do ofício (não o título) e o código da vaga: "Olá! Vi sua vaga de
  {ofício} ({código}) na Bicos e fui aprovado…" e "Olá, {primeiro nome}! Aqui é da {construtora}, sobre a
  vaga de {ofício} ({código}) na Bicos…".

## B03 — Construtora avalia o trabalhador

- **Nova rota** `/avaliar-trabalhador/:jobId/:workerId` (só construtora), espelho de "Avaliar a diária":
  nota de 1 a 5 (nenhuma estrela marcada no início), pontos prontos ("Chegou no horário", "Trabalho
  caprichado", "Usou EPI", "Respeitou a equipe", "Deixou o local limpo") e comentário de até 300
  caracteres. Só abre com a diária concluída e se a construtora ainda não avaliou; senão mostra "Essa
  avaliação não está disponível".
- **Entradas:** Histórico (item "Avaliar"), notificação "Avalie o trabalhador", perfil do candidato
  (botão "Avaliar {nome}") e tela da equipe do bico.
- **Avaliação vira registro** (`Review`: candidatura, direção, autor, nota, pontos, comentário, data) e o
  trabalhador ganha `reviewCount`. A nota nova entra na média com uma casa decimal. As avaliações antigas
  do seed foram convertidas (sem candidatura ligada).

## B04 — Avaliar a diária grava de verdade

- **"Avaliar a diária" usa o mesmo formulário da construtora** e `reviews.submitReview`: a avaliação vai
  para o perfil da construtora, a nota e a contagem são recalculadas e o lado do trabalhador fica marcado
  como avaliado.
- **Guarda:** só com a diária concluída e uma vez; fora disso, a tela "Essa avaliação não está
  disponível" (com "Voltar").
- **Nota começa vazia** (nada de 5 estrelas e "Pagou no dia" pré-marcados); o botão fica desativado até
  escolher a nota; comentário em caixa de texto com limite de 300 caracteres e contador (antecipa P02/P03).
- **Estrelas do trabalhador mostram a quantidade de avaliações** (`reviewCount`), não de bicos feitos
  (antecipa parte da L09).

## B05 — Editar vaga

- **`/vaga-editar/:id` reaproveita o formulário de publicar** (`JobFormScreen` em modo edição), já
  preenchido. Só o dono edita, e só com a vaga aberta (encerrada ou excluída mostra o motivo).
- **Data de início no passado** é aceita se for a mesma de antes (vaga em andamento); trocar para outra
  data passada não.
- **Pessoas:** não dá para pedir menos que o número de aprovados/contratados. A aprovação também passou
  a recusar quando a vaga já está cheia (o teste da edição achou esse caso).
- **Aviso aos candidatos:** mudar valor, data/horário ou endereço com candidatos ativos (pendentes,
  aprovados ou contratados) mostra "Os candidatos serão avisados da mudança" antes de salvar e envia a
  notificação "A vaga mudou" a cada um. Mudar só a descrição, fotos ou requisitos não avisa ninguém.
- **Requisitos próprios** da vaga (fora da lista padrão) aparecem marcados na edição, para não sumirem.

## B08 — Impulsionamento com pagamento (simulado)

- **Fluxo:** escolher o plano → `/impulsionar/:id/:plano` → PIX ou cartão. A vaga só fica impulsionada
  com o pagamento **confirmado**, até `boostEndsAt` (24h ou 3 dias, conforme o plano). `boosted` deixou de
  existir: "impulsionada" é `boostEndsAt` no futuro, e acaba sozinho.
- **PIX:** código "copia e cola" e QR fictícios (marcados como demonstração), válidos por 30 minutos, com
  contagem; "Simular pagamento confirmado" faz o papel do banco. Código vencido vira "expirado" e a tela
  oferece gerar outro. No back-end, a confirmação vem do webhook do provedor de pagamento.
- **Cartão:** número, nome, validade e código com máscara e validação (dígito verificador, validade
  futura). Na demonstração qualquer cartão válido é aprovado e um número terminado em 0000 é recusado,
  com a mensagem do banco. No back-end, o cartão é tokenizado no navegador pelo provedor (o número nunca
  passa pelo nosso servidor).
- **Pagamentos são registros** (`BoostPayment`: plano, forma, valor, status aguardando/confirmado/
  recusado/expirado, datas) — base para a tela de cobranças (F11).
- **Gerenciar vaga:** selo "Impulsionada até {data, hora}" e botão "Impulsionar vaga" sempre que a vaga
  estiver aberta e não impulsionada. Vaga encerrada, cheia, vencida ou já impulsionada não pode ser
  impulsionada (a tela explica).
- **Textos:** saiu "cartão cadastrado" e a promessa de reembolso (não há tela de reembolso ainda; volta
  com a F11). Confirmar o pagamento gera a notificação "Vaga impulsionada" para a construtora.
- **Ordem do mural** ainda usa o "urgente"; o impulsionamento ativo no topo e os selos no cartão da vaga
  são a L08.

## B11 — Termos de uso e Política de privacidade

- **`/termos` e `/privacidade`** abrem com ou sem login, em tela cheia, com faixa "Rascunho para revisão
  jurídica", versão e data. O texto-modelo está em `services/legal.ts` (no back-end, servido de uma tabela
  para o aceite ficar ligado à versão mostrada).
- **A política de privacidade (texto) é separada de "Privacidade e dados"** (`/configuracoes/privacidade`,
  onde a pessoa exporta ou exclui os dados).
- **No cadastro**, o aceite único cobre os dois documentos ("Li e aceito os Termos de uso e a Política de
  privacidade"); os links abrem as telas e o "voltar" retorna ao passo do cadastro, sem perder o que foi
  digitado. A conta guarda `termsVersion` e `termsAcceptedAt`.
- **Configurações › Sobre** aponta para as duas telas (os dois botões estavam sem ação).

## B12 — Exclusão de conta real

- **Fluxo:** Configurações › Privacidade e dados › "Excluir minha conta" abre `/configuracoes/excluir-conta`:
  senha → lista do que acontece com os bicos em andamento → caixa "Entendo e confirmo…" (só quando há
  bicos pré-selecionados/contratados; com link para resolver antes) → diálogo final → `account.deleteAccount`
  → sessão encerrada → `/conta-excluida` (tela pública).
- **Trabalhador:** desiste das diárias pré-selecionadas/contratadas (a construtora é avisada e a vaga
  reabre) e as candidaturas pendentes são retiradas.
- **Construtora:** contratações em andamento são canceladas (o trabalhador é avisado) e as vagas abertas
  são encerradas (candidatos avisados), como no "Encerrar vaga".
- **Dados:** a conta some (o login deixa de funcionar); posts e notificações da pessoa são apagados; o
  perfil fica anônimo ("Conta excluída") para que avaliações e históricos do outro lado continuem
  coerentes, sem nome nem WhatsApp. No back-end, uma RPC faz o mesmo numa transação e apaga o usuário do
  Auth.
- **Diárias que já passaram** são concluídas antes de montar a lista (não aparecem como "em andamento").

## Ligação com o Supabase (front novo no banco do app antigo)

- **Mesmo projeto, tabelas novas ao lado das antigas.** O front novo usa o projeto que o app antigo já
  usa, com tabelas no formato do contrato (`accounts`, `workers`, `companies`, `jobs`, `applications`…),
  sem renomear nem alterar as do app antigo — que continua funcionando. Os dois dividem o Auth, o
  segredo do CPF/CNPJ (Vault) e os buckets. Migrations só acrescentam.
- **Regras no banco.** Tudo que muda mais de um registro é uma RPC `security definer` que repete as
  regras do modo de demonstração (mesmas mensagens) numa transação; o cliente só lê pelo RLS e grava
  diretamente apenas o que é seu e simples (vaga salva, post, lido/não lido, campos do próprio perfil).
- **WhatsApp privado de verdade.** As colunas de WhatsApp não têm privilégio de leitura; o número só sai
  pela RPC `get_contact`, para os dois lados do bico, a partir da pré-seleção.
- **Contagem sem expor candidatos.** O trabalhador não lê candidaturas de outros; o mural sabe se a vaga
  lotou pela RPC `job_stats` (só números).
- **Ids de vaga curtos** (`BC-5001`…): aparecem no link e na mensagem pronta do WhatsApp.
- **Entrar com CPF/CNPJ por Edge Function**, para nunca devolver ao navegador o e-mail de um documento.
- **Links do e-mail** (confirmação e nova senha) no fluxo `implicit`, tratados antes do roteador — o
  mesmo jeito comprovado do app antigo (o `#access_token` e o roteador usam o mesmo `#`).
- **E-mail incorreto ou senha incorreta** viram uma mensagem só ("E-mail ou senha incorretos"): o
  Supabase Auth não diz qual dos dois, de propósito.
- **Sem provedor de WhatsApp/pagamento ainda**: o passo do código de WhatsApp sai do cadastro no modo
  real (o número fica sem confirmação, sem fingir que um código foi enviado); o pagamento do
  impulsionamento é registrado e confirmado no servidor, com a confirmação do PIX simulada até integrar
  um provedor. O número do cartão nunca sai do aparelho (só os 4 últimos dígitos).
- **Exportar dados** no modo real baixa o arquivo no aparelho (não há envio de e-mail configurado); a
  tela diz isso.
- **Contas antigas** recebem a conta nova com o perfil a completar; o aceite dos termos só é registrado
  quando a pessoa aceitou de fato (cadastro no app novo), nunca em nome de quem não viu.
- **Excluir vaga** também a encerra (quem esperava é avisado), para ninguém ficar com candidatura presa
  numa vaga que sumiu.
- **Diária concluída** soma 1 em `jobs_done` do trabalhador (o modo de demonstração não somava).
- **Ajustes mínimos de tela** (só no modo real, sem mudar o visual): esconder as dicas de demonstração;
  "Abrir meu e-mail" vira "Já confirmei meu e-mail" e mostra o motivo quando ainda não confirmou;
  mensagem do login para e-mail/senha incorretos; contagem de candidatos no perfil da construtora
  vinda do servidor.

---

# Rodada 2 — pronto para produção

Decisões da rodada que deixa o app pronto para uso real (prompt "bicos-v2"). Cada item diz o ID.

## Como o banco é atualizado

- **Migrations novas ficam prontas e testadas, aplicadas pelo painel.** O conector do Supabase usado no
  desenvolvimento exige uma aprovação manual para qualquer comando com `DROP`/`DELETE` (mesmo dentro de
  função), e essa aprovação não chega numa sessão automática. Contornar essa trava não é uma opção. Então
  cada migration é testada num Postgres igual ao do Supabase (`supabase/tests/local/setup.sh`, imagem
  `supabase/postgres` 17.6 + as migrations do app antigo e do novo) e a ordem para aplicar está em
  `supabase/APLICAR.md`.
- **Testes SQL** (`supabase/tests/*.sql`) rodam cada RPC como o app chama, com a sessão de uma conta
  (`pg_temp.login`), e terminam em `rollback`: dá para rodar no banco de verdade sem deixar rastro.
- **O app antigo (`app/`) será desligado.** O front novo substitui o antigo; as funções antigas abertas a
  visitantes são fechadas (Z08) mesmo que o antigo deixe de conseguir excluir conta ou reiniciar cadastro.

## Z01 — RPCs de candidatura, vaga e conta

- `APLICAR-NO-SQL-EDITOR.sql` saiu do repositório: virou a migration `20261010000100_z01_rpcs_candidatura.sql`,
  já com as correções Y02, Y03, Y05, Y06, Y08 e Y15 do lado do banco (o modo de demonstração recebe as
  mesmas regras na Fase B).
- **Posição ocupada** = pré-selecionado, contratado **ou concluído** (`job_holding`). Assim uma diária
  concluída não "abre" a vaga de novo no mural.
- **Excluir conta exige login de até 5 minutos** (o `amr` do token). O app já confere a senha logo antes
  (o que renova o login); quem chamar a RPC com um token velho recebe "confirme sua senha de novo".

## Z04 — Salvar vaga

- **`insert` simples**, e "já estava salva" (código 23505) conta como sucesso: a tabela não tem permissão
  de UPDATE, então `upsert` era recusado.

## Z02 — Impulsionar só pagando

- **Provedor: Mercado Pago** (PIX e cartão). Ainda não há conta configurada: no modo real o Impulsionar
  fica **escondido** (`services/features.ts` › `FEATURES.payments`, ligado por `VITE_PAGAMENTOS=mercadopago`
  e `VITE_MP_PUBLIC_KEY`). Os botões "Impulsionar" somem do Gerenciar vaga e da tela "Vaga publicada", o
  texto "Você paga só se impulsionar" vira "Publicar é grátis" e as rotas `/impulsionar/…` mostram
  "Impulsionar ainda não está disponível".
- **No banco não existe mais simulação**: `simulate_pix_paid`, `pay_with_card` e `start_pix_payment` (que
  gerava um PIX de mentira) foram apagadas. Abrir, gravar e confirmar cobrança são funções só do
  `service_role`, chamadas pelas Edge Functions `criar-cobranca` e `webhook-pagamento`.
- **Cartão**: no modo real, o formulário é o do próprio Mercado Pago (Card Payment Brick, campos em
  iframes do provedor); o app recebe só um token de uso único. À vista (1 parcela), sem débito.
- **PIX**: QR code e "copia e cola" do provedor, válidos por 30 min; a tela consulta o pagamento a cada 5 s
  e muda sozinha quando o webhook confirma (X08).
- **Um pagamento aguardando por vaga** (Y13): gerar outro código cancela o anterior (status `cancelado`).
  Se o código cancelado for pago mesmo assim, o dinheiro entrou: o destaque soma a partir do fim do atual.
- **Pagamento confirmado com a vaga já fechada/cheia/vencida** vira `reembolso_pendente`, a construtora é
  avisada ("Pagamento será devolvido") e a devolução é feita pelo painel do Mercado Pago (F11 mostra o
  status). Reembolso automático fica para quando houver conta no provedor.
- **Os dados do cartão da demonstração** ficam no estado da própria tela (somem ao sair), nunca no store (Y14).
- **Suporte**: WhatsApp `54 9473-1661` e `nivotech.dev@gmail.com`, como informado. O número parece ter um
  dígito a menos para um celular (são 10 dígitos com o DDD); confira e ajuste em `VITE_SUPORTE_WHATSAPP`.

## Z07 — Ninguém descobre quem tem conta pelo CPF/CNPJ

- **Sem pergunta separada sobre o documento.** `document_available` não é mais chamável pelo app; o banco
  confere o CPF/CNPJ dentro do próprio cadastro (gatilho antes de gravar a conta no Auth). Documento de
  conta confirmada → o cadastro falha e o app diz só "Não deu para criar a conta com esses dados", com
  "Entrar" e "Recuperar senha". Documento preso num cadastro nunca confirmado → o cadastro antigo é
  liberado (o que `reiniciar_cadastro_pendente_*` fazia, agora só dentro de um cadastro de verdade).
- **Login: uma resposta só** para "não existe" e "senha errada", nos dois modos: "E-mail, CPF/CNPJ ou senha
  incorretos".
- **Login por documento**: a Edge Function confere a senha no banco (`document_login_email`, com o hash
  bcrypt do Auth) e só então devolve o e-mail da própria conta; o app entra normalmente com e-mail e senha,
  a partir do aparelho da pessoa (antes, todo login por documento saía do IP da função e esbarrava no
  limite do Auth). Limite: 5 tentativas por documento e 20 por IP a cada 15 minutos (`auth_attempts`).
- **Captcha: Cloudflare Turnstile**, no login e no último passo do cadastro, no modo "só pede quando
  desconfia". Escondido até configurar (`VITE_TURNSTILE_SITE_KEY` no app, `TURNSTILE_SECRET` nas Edge
  Functions e o captcha do próprio Supabase Auth ligado com a mesma chave). O conector do Cloudflare desta
  sessão não cria widgets do Turnstile: o passo a passo está no `SUPABASE.md`.
- **Google e celular** só aparecem no login quando o provedor está configurado (`VITE_LOGIN_GOOGLE`,
  `VITE_LOGIN_CELULAR`); no modo real, hoje, os botões somem (o fluxo completo é a L13).

## Z08 — App antigo desligado

- **O app antigo (`app/`) deixa de funcionar com o banco**: todas as funções dele perdem a permissão de
  execução para visitante e conta logada, e as tabelas dele (`profiles`, `vagas`, `candidaturas`,
  `avaliacoes`, `vagas_salvas`, `publicacoes_trabalhador`, `consentimentos`) deixam de ser lidas ou
  gravadas direto. Os dados ficam: o app novo usa o que precisa por funções do banco (conta antiga vira
  conta nova no primeiro login; o aceite dos termos continua em `consentimentos`). O app novo não lia
  essas tabelas nem chamava essas funções (conferido no código).
- **Cadastro nunca confirmado** é apagado depois de **7 dias** (o app antigo apagava em 2 horas, antes de
  muita gente abrir o e-mail). A rotina `expirar-vagas-diario` do app antigo foi desligada.

## Z09 — CPF fora dos metadados do Auth

- O documento ainda vai no cadastro dentro dos metadados (é como o gatilho recebe), mas o gatilho que roda
  **antes** de gravar a conta o retira e o guarda só durante a transação; o gatilho seguinte cifra em
  `accounts`. O CPF/CNPJ nunca chega a ser gravado em `auth.users`. As contas existentes foram limpas.
- Efeito colateral aceito: o perfil do app antigo (`profiles`) deixa de receber o documento das contas
  novas (o app antigo está desligado; o login por documento usa `accounts`).

## Z06 — Endereço da obra só para quem está no bico

- **Antes da aprovação**: bairro, cidade e distância ("2,3 km de você"), com a frase "O endereço completo
  aparece quando a construtora aprovar você". **Depois** (pré-selecionado ou contratado) e para a própria
  construtora: rua, número, complemento, CEP e "Abrir no Google Maps" / "Waze" (no detalhe da vaga e em
  "Você avançou").
- **No banco**: `select` em `jobs` não devolve rua, número, complemento, CEP nem o ponto exato (privilégio
  por coluna). Todo mundo lê `area_lat`/`area_lon`, o ponto arredondado em 2 casas (~1 km), usado na
  distância e no filtro de raio. O endereço exato sai só por `get_job_addresses`, que confere se a conta é
  a dona ou foi escolhida. Depois de concluída, desistida ou cancelada, o endereço fecha de novo.
- **No modo de demonstração** os dados estão no aparelho; quem esconde é a tela (`canSeeExactAddress`), com
  a mesma regra.
- A distância antes da aprovação é aproximada (até ~1 km de diferença); a tela não promete precisão.

## Z05 — Menu da conta no celular

- **Engrenagem no topo do próprio perfil** (só abaixo de 770 px, onde não há a barra de cima). Ela abre a
  folha "Sua conta" com as mesmas entradas do menu do computador: Vagas salvas (trabalhador) ou Bicos
  fechados (construtora), Notificações, Configurações, Ajuda e Sair da conta. As entradas ficam num lugar
  só (`layouts/accountMenu.ts`).
- **Tela "Ajuda"** (`/ajuda`, abre com ou sem conta; adianta a F05): perguntas frequentes por lado e
  "Falar no WhatsApp" / "Mandar e-mail" com o suporte da NivoTech.

## Z10 — Sem tela branca

- **Error Boundary em dois níveis**: o app inteiro (tela cheia) e cada tela (dentro do layout, com a
  navegação funcionando). O cartão diz "Essa tela não abriu" (ou "Sem internet") com "Tentar de novo" e
  "Recarregar o app".
- **Tela que não baixou** (internet caiu no meio) é esquecida e baixada de novo no "Tentar de novo" ou na
  próxima visita. Se o arquivo sumiu porque saiu uma versão nova, o app recarrega sozinho (no máximo uma
  vez por minuto, para não entrar em laço).
- **Link com `%` quebrado** não derruba o roteador: o pedaço fica como foi digitado.
- **Erros vão para `services/monitoring.ts`** (adianta a X21): no console na demonstração; no modo real,
  para o Sentry se `VITE_SENTRY_DSN` estiver configurado, sem dados pessoais (a rota vai sem ids).

## Z11 — Abertura rápida e sem cair no login por falta de sinal

- **Splash no `index.html`**, sem depender do JavaScript (aparece na hora, mesmo com o celular lento); o
  React o troca pela splash dele enquanto a sessão é restaurada.
- **O app abre na hora para quem volta**: a conta e o perfil da própria pessoa ficam guardados no aparelho
  (`bicos.conta`, apagados ao sair); com eles o app abre logo e confere com o servidor em segundo plano.
  Sem nada guardado, espera o servidor no máximo ~10 s.
- **Sem conexão com uma sessão no aparelho**: tela "Sem conexão com a Bicos — sua conta continua aqui",
  com "Tentar de novo"; o app tenta sozinho quando a internet volta (evento `online`). Nunca cai no login
  por causa da rede.
- **Conta sem cadastro no app** (Y27): sai da sessão quebrada e avisa "Não achamos o cadastro dessa conta"
  (antes mostrava "confira sua internet" a cada abertura).
- **Sessão vencida ou encerrada em outro lugar** (Y27): qualquer pedido que receba o erro de token
  (PGRST301/302/303, "JWT expired", erros de refresh do Auth) mostra "Sua sessão terminou. Entre de novo
  para continuar.", sai da sessão no aparelho e abre o login com o e-mail preenchido e esse aviso (antes:
  "Sua conta não pode fazer isso").
- **Uma leitura da conta por login** (X20): o login e o aviso do Auth que vem logo depois dividem a mesma
  leitura e o mesmo canal de tempo real.

## Z12 — Fotos de perfil, capa e logo salvas de verdade

- **No modelo**: `Worker.photoUrl`/`coverUrl` e `Company.logoUrl`/`coverUrl` (colunas `photo_url`, `cover_url`,
  `logo_url` que o banco já tinha). Saem os estados de tela que guardavam as fotos só no aparelho.
- **Envio**: a foto é reduzida no próprio celular (até 1600 px, WebP ou JPEG, ~0,82 de qualidade; HEIC do
  iPhone é convertido por uma biblioteca baixada só quando precisa), vai para o bucket `avatars` na pasta
  da conta, com barra de progresso no lugar da foto e no botão ("Enviando fotos… 40%"). A foto trocada é
  apagada do Storage (sem arquivo órfão).
- **Onde aparece para todos**: perfis, lista de candidatos, cards da busca no mural, detalhe da vaga
  (logo), "Você avançou", confirmar candidatura, histórico, bico fechado e o menu da conta. Componente
  único `components/Avatar.tsx` (foto, ou iniciais/ícone da empresa).
- **Editar perfil/empresa** usa um rascunho da própria tela: abre sempre com os dados salvos, "Cancelar" e
  sair descartam (inclusive as fotos escolhidas). Saiu o botão "Sair da conta" de dentro dessas telas
  (adianta a P01 e parte da Y21).
- **Completar perfil**: as fotos escolhidas são salvas junto com o perfil; se o envio falhar, o perfil fica
  completo e o aviso diz para tentar de novo em Editar perfil.
- **No banco** (adianta a X09): o banco só aceita URL do Storage deste projeto, do bucket certo e da pasta do
  dono (`app_config.storage_public_base`, trocar no staging); ninguém lista arquivos dos buckets; foto de
  vaga só por conta de construtora e portfólio só por trabalhador; limites de tamanho e tipo por bucket.

## Z03 — Impulsionar muda a ordem do mural

- **Ordem do mural**: impulsionada (paga, ainda no prazo) → urgente (grátis) → a ordem escolhida (mais perto,
  mais cedo, maior valor). A construtora vê as próprias vagas antes de tudo. No modo real a mesma ordem
  passa para o servidor na X01.
- **Selos no card**: "Impulsionada" (foguete, azul) e "Urgente" (raio, vermelho), quando o card não tem um
  selo de situação (como em Minhas candidaturas).
- **"Vaga urgente" é um interruptor grátis** no formulário de publicar/editar.
- **O plano "24h + aviso por WhatsApp" (R$ 39) saiu** até o envio existir; ficaram 24 h (R$ 12) e 3 dias
  (R$ 28). O valor `whats` continua no tipo do banco só para registros antigos e é recusado na cobrança.

---

# Fase B — falhas de lógica

## Y01 — Estados da vaga

- **Cinco estados**, calculados num lugar só (`selectors.jobState`): **aberta** (recebe candidatos), **cheia**
  (todas as posições ocupadas: sai do mural, mas continua editável e encerrável), **encerrada**, **excluída** e
  **vencida** (passou do último dia).
- **Posição ocupada** = pré-selecionado, contratado ou concluído (nos dois modos).
- **A vaga encerra sozinha** quando toda a equipe conclui (posições ocupadas por diárias concluídas e ninguém
  escolhido/contratado ainda para trabalhar): vai para o histórico e conta como bico concluído.
- **Gerenciar vaga**: "Editar" em vaga aberta ou cheia; "Encerrar" também na vencida; vaga encerrada mostra
  "Ver resumo do bico". Aprovar a última posição não leva mais à tela de bico fechado (a vaga só ficou
  cheia); encerrar leva (Y09). O perfil da construtora lista as vagas abertas e cheias ("Suas vagas").
- **Aumentar o número de pessoas** numa vaga que lotou devolve para análise quem tinha sido recusado
  automaticamente (mesma regra do Y03).

## Y02 — Concluir e marcar falta só a partir do dia

- Os botões "Marcar diária como concluída" e "Não compareceu" só aparecem a partir do primeiro dia do bico
  (antes, a tela diz a partir de quando). O serviço e o banco recusam antes disso. Vaga "a combinar" não
  tem data: vale a qualquer momento depois da contratação.

## Y03/Y05/Y06/Y08 — no modo de demonstração

- As mesmas regras que o Z01 colocou no banco: recusados automáticos voltam ("A vaga reabriu") quando
  uma posição libera numa vaga aberta; desfazer aprovação em vaga encerrada é recusado; o texto da
  desistência diz se a vaga volta ao mural; excluir vaga com equipe é recusado e quem esperava é avisado
  ("Vaga removida"). A exclusão também está em Gerenciar vaga ("Excluir vaga", só sem equipe).
- Diária concluída soma 1 em "bicos realizados" também na demonstração.

## Y04 — Vaga vencida

- Rotina das vagas cujo prazo acabou (de hora em hora no banco; nas leituras na demonstração): quem esperava
  vira "não selecionado" (aviso "Vaga vencida"); pré-selecionado sem contratação vira **"expirada"** (status
  novo, aviso aos dois); a diária contratada é concluída sozinha **2 dias depois do fim** (até lá dá para
  marcar falta); sem ninguém para trabalhar, a vaga encerra.
- **Vaga "a combinar" vence 30 dias depois de publicada** (`Job.createdAt`). Na demonstração, as vagas
  ganharam a data de publicação (dois dias antes do início).

## Y07 — Vaga indisponível no detalhe

- Faixa no topo do detalhe: "Vaga preenchida", "Vaga encerrada", "Vaga vencida" ou "Removida pela
  construtora" (L02/L03), e no lugar de "Quero esse bico" o botão "Ver outros bicos".
- "Confirmar candidatura" faz a mesma conferência (link antigo, vaga que lotou no meio do caminho).
- A demonstração recusa a candidatura com as mesmas mensagens do servidor (`submit_application`).

## Y09 — Resumo do bico (antes "Bico fechado")

- A tela `/fechado/:id` virou **"Resumo do bico"**: título conforme a situação ("Fulano foi pré-selecionado",
  "está contratado", "concluiu a diária", "Bico concluído", "Vaga encerrada sem contratação"), a equipe com
  o status de cada um, o que falta (confirmar contratação, avaliar) e o **total = diária × diárias ×
  pessoas** ("A combinar" sem valor).
- Encerrar a vaga leva para essa tela; ela também abre em Gerenciar vaga ("Ver resumo do bico") e é só da
  construtora dona.
- **"Publicar de novo"** (adianta a F03) numa vaga encerrada, excluída ou vencida: abre o formulário já
  preenchido (ofício, endereço, valor, pessoas, requisitos, descrição, fotos), com as datas em branco.

## X01 + Y10/Y11/L17 — Mural paginado no servidor

- O mural lê a RPC **`feed_jobs`** em páginas de 30 (cursor por posição, sem `offset`), já filtrado no banco:
  só vagas abertas com posição livre e dentro do prazo; da cidade escolhida ou do raio (coluna
  `area_geog` + índice GiST; o raio usa o centro da área da vaga, nunca o ponto exato); ofício, "Hoje",
  "Amanhã", "Semana"; busca sem acento no título, ofício, bairro e construtora.
- **Ordem: impulsionadas → urgentes → a ordem escolhida** (perto, recentes, maior diária) — a mesma regra
  em `feedUI.orderJobs` para a demonstração.
- "Carregar mais" no fim da lista (`services/paging.ts` + `hooks/usePaging.ts`). A página volta do zero ao
  trocar filtro, cidade, busca ou conta.
- **Y10**: ao abrir a primeira página, as vagas da cidade que o aparelho ainda mostrava e o servidor não
  devolveu são relidas; as que sumiram (excluídas) saem da tela, as encerradas/lotadas ficam marcadas como
  tal e saem do mural pelos filtros.
- **Y11**: a busca procura na cidade escolhida (ou no raio); "Buscar em todas as cidades" amplia. A tela diz
  onde está procurando.
- **L17**: a busca de pessoas mostra construtoras para todos e trabalhadores só para construtoras.
- **"Carregar mais" também em** Minhas candidaturas (as em andamento vêm todas; as encerradas em páginas de
  30, das mais recentes), Minhas vagas › Encerradas (as abertas vêm todas) e Notificações (páginas de 30; o
  número do sino é o do servidor, X03). Cursor por data + ids da última data (sem `offset`).
- No mural, o **carrossel de fotos de cada cartão só é montado quando o cartão chega perto da tela**
  (`IntersectionObserver`, 400 px de folga); antes disso, só o fundo do cartão.

## Y12 — Aviso de candidatura atualiza as telas

- Aviso que chega pelo Realtime (exceto impulsionamento e alerta de bico novo) relê em segundo plano as telas
  de candidatura já abertas: minhas candidaturas, histórico, vaga e candidatos (`queries.refreshCandidacies`).
- Abrir um aviso relê essas telas **com carregamento**, antes de mostrar: "Você avançou" nunca abre com o
  status de antes do aviso. Na demonstração o store já tem o status novo.

## Y15 — Exclusão de conta completa

- O app exclui a conta pela Edge Function **`excluir-conta`** (depois de conferir a senha, o que renova o
  login). Ela chama `delete_my_account` **com o token do usuário** — a RPC exige login de no máximo 5
  minutos (`session_authenticated_at`, pelo `amr` do token), recusa bico em andamento sem confirmação,
  avisa o outro lado, anonimiza perfil e `reviews.author_label` e apaga a conta de acesso numa transação —
  e só então apaga a pasta `<id>/` do usuário em `avatars`, `portfolio` e `vagas` e limpa `jobs.photos`
  das vagas dele.
- Se apagar os arquivos falhar depois de a conta ter saído, o erro fica no log da função (a conta não
  volta); os arquivos já não estão ligados a nenhum perfil.
- A RPC continua liberada para `authenticated` (ela só apaga a própria conta); quem a chamasse direto
  deixaria só os próprios arquivos para trás. O app nunca faz isso.
- As telas dizem o que de fato acontece: perfil, fotos e contatos apagados; avaliações e histórico ficam
  sem o nome.

## Y16 + Y17 — Documento válido e CPF fora do perfil da empresa

- CPF e CNPJ conferidos pelo dígito verificador no app (`utils/document.ts`) e no banco (`cpf_valid`,
  `cnpj_valid`, `document_valid_for`). O gatilho do cadastro no Auth recusa conta de trabalhador ou
  recrutador **sem documento válido**; `create_account_for` recusa documento inválido.
- **Recrutador pode se cadastrar com CPF** (quem trabalha por conta própria): o campo virou "CNPJ ou CPF".
  O CPF fica só cifrado em `accounts`; `companies.cnpj` recebe apenas CNPJ (o começo, mascarado). A
  migration limpa os CPFs mascarados que já estavam lá.
- Conta criada pelo Google (sem lado) ainda não tem documento: completa em "Escolher perfil" quando o
  login com Google for ligado (L13); até lá o botão fica escondido.
- O texto do cadastro deixou de prometer "conferimos o CNPJ antes de liberar a publicação" (Y24).
- Na demonstração, os documentos "já cadastrados" agora são válidos (`111.444.777-35`,
  `11.222.333/0001-81`) e a construtora de exemplo ganhou um CNPJ válido.

## Y18 — Média das notas sem erro acumulado

- No banco, um gatilho em `workers`/`companies` recalcula `rating = round(avg(value), 1)` e `review_count`
  a partir de `reviews` sempre que a contagem ou a nota mudam (`submit_review` não precisou mudar); a
  migration recalcula todos os perfis. Valor escrito à mão não fica.
- Na demonstração, `ratingWith` faz a mesma conta quando o perfil tem todas as avaliações na lista; os
  perfis de exemplo listam só as últimas, e para eles vale a média arredondada até ali.

## Y19 — E-mail não confirmado

- Entrar com a senha certa e o e-mail sem confirmar **não cria mais uma sessão "pendente" inventada** (sem
  token e com o lado errado): o login responde `email-nao-confirmado` e mostra "Falta confirmar seu e-mail.
  Abra o link que enviamos para …" com "Reenviar o link" (para aquele e-mail).
- Depois do cadastro (sessão pendente com o lado certo), "Já confirmei meu e-mail" sem sessão do Auth no
  aparelho leva ao login com o e-mail preenchido e a frase "Se já confirmou o e-mail, entre com sua senha".
  Com sessão, confere no Auth e entra; sem confirmação, "Ainda não recebemos a confirmação".
- O título "Conta criada. Confirme seu e-mail" só aparece vindo do cadastro; nos outros casos, "Confirme seu
  e-mail".

## Y20 — Erros do cadastro

- Toda falha do cadastro (criar a conta, mandar e conferir o código do WhatsApp) mostra a mensagem do
  `ServiceError` (sem internet, muitas tentativas, senha fraca, captcha…), não mais "confira sua internet"
  para tudo.
- A recusa do documento continua **genérica de propósito** (Z07: dizer "esse CPF já tem conta" revelaria
  quem tem conta). O servidor não diz "documento já cadastrado", então a tela nunca afirma isso: volta ao
  passo do documento com "Não deu para criar a conta com esses dados" e os caminhos (entrar, recuperar a
  senha, falar com a gente).

## Y21 + Y22 — Estado de tela que não fica velho nem passa para a próxima pessoa

- `useScreenUI(key, defaults)` (hooks/useStore.ts): o estado é da visita à tela — criado do dado real ao
  abrir, apagado ao sair (inclusive ao salvar ou cancelar). Revisadas **todas** as chaves de `useUI`:
  - passaram a `useScreenUI`, com a chave pelo item quando há item: Editar/Publicar vaga
    (`edit-job:<id>`, `create-job`, `create-job:de:<id>`), Gerenciar vaga (`job-manage:<id>`), detalhe da
    vaga (`job-detail:<id>`), Impulsionar (`boost-job:<id>`), excluir vaga no perfil, posts do perfil
    (`worker-posts:<id>`), Esqueci a senha (não fica mais preso em "Link enviado"), Nova senha,
    Privacidade, Confirme seu e-mail, Escolher perfil;
  - Editar perfil e Editar empresa já usam estado local (rodada anterior);
  - continuam em `useUI` de propósito: mural (filtros), menus, diálogo de sair, seletor de cidade (zera
    ao fechar), pagamento em andamento (`boost-pay:<id>:<plano>`, só método e id do pagamento) e
    Completar perfil (o usuário não sai dessa tela sem sair da conta).
- **Senha nunca fica no estado global**: login e cadastro guardam a senha só no estado local da tela. Abrir
  os Termos no meio do cadastro mantém o rascunho e pede a senha de novo.
- **O rascunho do cadastro some ao sair do fluxo** (qualquer tela que não seja o próprio cadastro, Termos ou
  Privacidade), ao entrar e ao sair da conta: entrar com outra conta, ou sair, apaga todo o estado de tela
  (`setSessionAccount`).

## Y23 — Especialidades num formato só

- `components/SpecialtiesField.tsx` é o único campo de especialidades, em "Completar perfil" e em "Editar
  perfil": sugestões do catálogo para tocar, texto livre com "Adicionar"/Enter, e qualquer uma pode ser
  removida (as livres deixaram de sumir na edição). Sem repetir (ignora maiúsculas), até 10, até 40
  caracteres cada (`utils/specialties.ts`).

## Y24 (+ L10) — Selo "Verificada" de verdade

- Construtora tem `verification_status`: **pendente** (toda conta nova), **verificada** ou **reprovada**.
  Só a equipe da Bicos muda, pela função `set_company_verification` (service_role — SQL Editor do painel
  até existir uma área de admin), que manda o aviso "Empresa verificada" ou "Não conseguimos verificar a
  empresa". O selo (`verified`) e a data (`verified_at`) acompanham o status por gatilho; a construtora não
  consegue mudar nenhum dos dois.
- No próprio perfil: "Verificada · Conferida em <data>", "Verificação pendente" (pode publicar; o selo
  aparece quando terminarmos) ou "Não verificada" (falar com a gente). Acabou o "conferido em undefined".
- Recrutador com CPF vê "Documento: CPF (não aparece no perfil)" no lugar do CNPJ.
- O cadastro deixou de prometer conferir o CNPJ antes de liberar a publicação (Y17).

## Y25 — Trocar o WhatsApp (os dois lados)

- Tela própria **"Trocar WhatsApp"** (`/whatsapp`), aberta pelo "Trocar" em Editar perfil e Editar
  empresa (o trabalhador antes não conseguia trocar; a construtora salvava "abc" vazio). Máscara, celular
  com DDD (11 números) no app e no banco (`whatsapp_valid`; o cadastro também passou a exigir celular).
- Com o código ligado, o número só troca depois de confirmado pelo código (reaproveita `WhatsAppCode`); sem
  o código, troca e fica "sem confirmação". **Trocar sempre zera `whatsapp_verified_at`**, a não ser que o
  número novo tenha acabado de ser confirmado (vale uma vez, por 30 minutos).
- O código real é a Edge Function **`codigo-whatsapp`** (Twilio Verify, canal WhatsApp ou SMS; limites
  por número e por IP; captcha quando ligado). Fica **escondida até configurar**: sem `TWILIO_ACCOUNT_SID`,
  `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SID` nas secrets e `VITE_CODIGO_WHATSAPP=1` no app, o passo do código
  some (cadastro e troca), como antes. O código confirmado no cadastro faz a conta nascer confirmada.

## Y26 — Saída do "Completar perfil"

- Os dois passos do "Completar perfil" (trabalhador e construtora) têm "Sair e entrar com outra conta", que
  abre o mesmo diálogo de sair da conta. Falha ao salvar mostra a mensagem real do erro.

## Y28 — "Avisar quando aparecer bico novo" funciona

- O interruptor nos Filtros (só para trabalhador) **salva um aviso no servidor** (`job_alerts`): a cidade
  escolhida — ou o raio, a partir do mesmo ponto do mural — e o ofício do filtro, se houver. Um por pessoa;
  desligar apaga. Se os filtros mudarem com o aviso ligado, aparece "Usar estes filtros no aviso".
- Cada vaga nova que bate gera a notificação "Bico novo perto de você" (gatilho `notify_job_alerts`; mesma
  regra em `services/alerts.ts` para a demonstração), **no máximo 5 por dia** por pessoa. O push no celular
  entra com o X03.
- A busca por raio usa o centro da área da vaga (nunca o endereço exato), como o mural.

## Fase C — pendências antigas

### P08, F14, L16 — Textos

- Indicador de força da senha num componente só (`PasswordStrength`): campo vazio mostra "8 caracteres ou
  mais", nunca "Senha fraca" (cadastro, nova senha). A tela de nova senha guarda a senha só no estado local.
- "Escolher perfil" não promete mais "Dá para trocar depois no seu perfil" (não dá).
- Configurações e Privacidade não falam mais de "mensagens" nem de "bicos urgentes" (não existem como tal).

### P04, P06

- "Confirmar candidatura" mostra o ofício e as estrelas com o número de avaliações (ou "Novo na plataforma"),
  não mais "Pedreiro · 4.8".
- Publicar/editar vaga: além da lista pronta, "Outro item" para escrever um requisito (até 60 caracteres,
  sem repetir, até 12 no total; o banco confere o mesmo limite).

### L18 — Pagamento da diária como campo da vaga; sem métricas inventadas

- Publicar/editar vaga pergunta **"Como você paga a diária"**: PIX no fim de cada diária, PIX no fim do bico,
  dinheiro ou outro jeito (com explicação de até 80 caracteres). Detalhe da vaga e Gerenciar mostram o que foi
  escolhido no lugar do texto fixo "Pagamento em PIX no fim da diária".
- As vagas que já existiam ficam com "PIX no fim de cada diária" — era o que o app mostrava para todas.
- Mudar a forma de pagamento avisa os candidatos ("mudou pagamento"), como mudar o valor.
- O mural (`feed_jobs`) não traz o pagamento; o detalhe lê a vaga inteira, e o merge não apaga o pagamento
  quando a mesma vaga volta pelo mural.
- Perfil da construtora: saíram "N diárias pagas pela plataforma" (a plataforma não paga diárias) e o tempo
  de resposta (não é calculado). Ficam os números reais: bicos concluídos, vagas abertas, avaliações.

### L01 + L22 — "Aprovado · Desfazer" e "Recusado · Desfazer"

- Aprovar ou recusar (na lista do Gerenciar vaga ou no perfil do candidato) mostra o toast com **Desfazer** por
  7 segundos. A decisão vale na hora (o WhatsApp libera na hora), e desfazer tira o aviso do trabalhador se
  ele ainda não viu; se viu, ele recebe "Sua candidatura voltou para análise" — o aviso é sempre coerente.
  Preferimos isso a atrasar a decisão: uma decisão "pendurada" no aparelho se perderia se o app fechasse.
- Desfazer recusa é a transição nova `desfazer_recusa` (RPC `undo_reject`): só a recusa feita pela própria
  construtora, até 10 minutos depois, com a vaga aberta.

### L09 — Quem vê quais avaliações

- Cada um vê as próprias avaliações a partir do próprio perfil ("Ver avaliações", voltando para o perfil).
  Além disso, construtoras veem as de trabalhadores e trabalhadores veem as de construtoras.
- "Ver avaliações" só aparece onde a pessoa pode ver e quando há avaliação (antes levava a um cadeado).

### L11 + L12 — Editar perfil e empresa

- Mesma conferência nos dois modos (`profileErrors`): nome completo (trabalhador com nome e sobrenome), ofício
  e cidade da lista, até 80 caracteres; o erro aparece **no campo**. Só o que mudou é conferido e enviado (os
  perfis antigos não travam por um campo que a pessoa não mexeu). O banco também recusa nome fora de 3–80 e
  mais de 10 especialidades.
- Já estavam feitos: foto e capa (Z12), especialidades (Y23), Cancelar descarta (Y21), WhatsApp com código
  (Y25).
- **L12**: "Editar empresa" escolhe a cidade das obras na lista (`CityPicker`), como no "Completar perfil",
  no lugar do texto livre "Região onde você contrata".

### L15 + F08 — Senha, e-mail e WhatsApp nas Configurações

- Configurações › Conta: **Trocar e-mail**, **Trocar WhatsApp** (Y25) e **Trocar senha**.
- Trocar senha pede a senha atual e a nova duas vezes (com o medidor de força); a atual é conferida de novo no
  Auth antes de `updateUser`. Antes o item levava ao "Esqueci minha senha".
- Trocar e-mail pede o e-mail novo e a senha; no modo real o Supabase manda um link para o endereço novo e
  **nada muda até ele ser aberto** (a tela diz isso). Ao abrir, o app avisa "E-mail trocado" e o gatilho
  `on_auth_user_updated_v2` copia o e-mail para `accounts`. Na demonstração troca na hora.
- "Confirme seu e-mail": **Corrigir e-mail** (sai do cadastro pendente e começa de novo; o cadastro nunca
  confirmado é limpo depois e o documento fica livre — Z07/Z08) e reenvio só depois de **60 segundos**, com a
  contagem no botão. O reenvio do código do WhatsApp também passou a 60 segundos (L14).

### L14 — Cadastro

- Caixa **"Tenho 18 anos ou mais"** (os termos exigem), separada do aceite dos termos; o servidor recusa o
  cadastro sem ela (`maior_de_idade` nos metadados, conferido no gatilho do Auth).
- Dígito verificador: Y17. Reenvio do código em 60 s, com limite de tentativas no servidor (Y25:
  3 códigos por número e 10 por IP a cada hora; 8 conferências por número a cada 15 min).
- **Duplicidade no próprio passo: decidido não fazer para o documento.** Conferir "esse CPF já tem conta"
  antes de criar a conta é exatamente a enumeração que o Z07 fechou. O documento é conferido na criação, e a
  recusa volta ao passo do documento com a mensagem genérica. O e-mail repetido é dito na criação (o Supabase
  já revela isso no cadastro) e volta ao passo do e-mail. WhatsApp repetido é permitido (a mesma pessoa pode
  ter conta de trabalhador e de construtora com o mesmo celular).

### L05 + F12 — "Precisa de você" e confirmar presença

- "Minhas candidaturas" abre com o grupo **Precisa de você**: diária concluída para avaliar, pré-seleção para
  falar com a construtora e contratação para hoje/amanhã ainda sem confirmação. Depois "Em andamento" e
  "Encerradas".
- **Confirmar presença**: em "Você avançou", o contratado vê "Confirmar que vou" (e o "Não vou poder ir" que já
  existia). A construtora recebe o aviso e vê o selo "Confirmou que vai" no candidato. Na véspera, às 18h,
  quem ainda não confirmou recebe "Amanhã tem bico" (rotina diária no banco; a demonstração não tem relógio
  de rotina, então não manda lembrete). Mudar as datas da vaga zera as confirmações.

### P07 — Mensagem pronta do WhatsApp

- A mensagem que abre no WhatsApp diz quem escreve, para quem, a vaga e a data: "Olá, Construtora Meridiano!
  Aqui é Jorge, da Bicos. Fui aprovado para a vaga de Pedreiro de acabamento (BC-4821) do dia 12/10…" — e
  "fui contratado" / "você foi contratado" quando a contratação já foi confirmada. Data a combinar ou vários
  dias aparecem como tal.

### F15 — Responsável da construtora

- Cadastro de recrutador ganhou o passo "Quem vai falar com os candidatos?" (nome do responsável), editável em
  "Editar empresa". Quem foi aprovado vê **"Falar com Ana"** no botão do WhatsApp, e a mensagem pronta começa
  por "Olá, Ana!". Sem nome, continua "Falar no WhatsApp" / o nome da empresa.

### F01 + L07 — "Minhas vagas" e histórico por vaga

- Aba nova **Vagas** na navegação da construtora (`/minhas-vagas`), com **Abertas · Cheias · Encerradas** e a
  contagem de cada. Cada cartão: vaga, data, valor, "x de y vagas preenchidas" ou o desfecho, candidatos novos,
  a equipe e o que falta ("2 candidatos novos", "Falta confirmar 1 contratação", "Falta avaliar 1 pessoa").
  Tocar abre o Gerenciar (aberta/cheia) ou o Resumo do bico (encerrada); encerradas têm "Publicar de novo". O
  mural continua em "Início".
- **L07**: "Bicos fechados" (`/historico`) virou a aba Encerradas, **por vaga** e não por pessoa, com todos os
  desfechos (`jobOutcome`): concluída, encerrada com/sem contratação, prazo acabou com/sem equipe, excluída.
- **Rascunhos: adiado.** Um rascunho de vaga que sobrevive a sair da tela contraria a regra do Y21 (formulário
  é da visita) e, para valer entre aparelhos, pede uma tabela de rascunhos no servidor. Fica para depois do
  lançamento; hoje "Publicar de novo" cobre o caso mais comum (repetir uma vaga).

### L10 — Verificação da construtora (o resto)

- Status `pendente | verificada | reprovada`: Y24.
- **Verificação automática**: ao concluir o perfil (e pelo botão "Verificar agora" enquanto pendente), a Edge
  Function **`verificar-cnpj`** consulta o CNPJ na BrasilAPI (dados públicos da Receita, sem chave): situação
  "ATIVA" → verificada (selo e aviso); baixada/inapta/suspensa/nula → reprovada; CPF, CNPJ não encontrado ou
  serviço fora → continua pendente para a equipe. Até 5 consultas por dia por construtora. O CNPJ completo sai
  do banco só para a função (`company_cnpj_for_check`, service_role). Na demonstração, CNPJ válido verifica na
  hora.
- **Reprovada não publica** (o banco recusa com "Fale com a gente pela Ajuda").
- **Decisão: pendente publica normalmente**, em vez de deixar a vaga "em análise". A conferência manual depende
  de uma pessoa da equipe e o recrutador com CPF (autônomo) não tem CNPJ para a checagem automática; segurar as
  vagas deixaria o mural vazio no lançamento. O selo "Verificada" é o que diferencia; se a equipe quiser
  segurar as vagas de pendentes, é só uma linha em `publish_job` / `feed_jobs`.

### L13 — Entrar com o Google (atrás de flag); celular adiado

- **"Continuar com o Google"** aparece só com `VITE_LOGIN_GOOGLE=1` e o provedor Google ligado no Supabase Auth
  (SUPABASE.md). Na demonstração e sem configurar, o botão some (antes aparecia e só mostrava aviso).
- Quem entra pelo Google pela primeira vez não tem lado: o app mantém a sessão e abre **"Completar cadastro"**
  (lado, nome, CPF/CNPJ, WhatsApp, responsável da construtora, 18+ e termos) → RPC `create_my_account`, com as
  mesmas regras e a mesma recusa genérica do documento (Z07) → segue para o "Completar perfil" de sempre.
- **Entrar pelo celular: adiado.** Precisa do provedor de SMS no Supabase Auth e de ligar o telefone às contas
  que já existem (no Supabase, uma conta por telefone é outro usuário); sem isso, cada login pelo celular
  criaria uma conta nova. O celular já é confirmado por código (Y25), e o login continua por e-mail ou CPF/CNPJ.
  O botão não aparece.

### F18 — Membros da construtora (só o modelo)

- Tabela `company_members` (empresa, pessoa, papel `dono` ou `recrutador`), com a própria conta de cada
  construtora como dona (as novas entram por gatilho). Sem tela agora: hoje a conta da construtora continua
  sendo a empresa (`accounts.company_id = id`), e `my_company_id()` não mudou. Quando houver "convidar
  pessoa", ela passa a ler desta tabela e as políticas das vagas aceitam qualquer membro.

### F09 — Compartilhar vaga e página pública

- Botão **Compartilhar** no detalhe da vaga e no Gerenciar (vaga aberta): abre o menu de compartilhar do
  celular (Web Share API) ou, sem ele, o WhatsApp com o texto pronto ("Pintor em Tatuapé · R$ 200 por diária.
  Vi na Bicos: <link>").
- O link é **`/v/<id>`** (era `#/v/<id>` antes do X17; os links antigos continuam abrindo), uma página que abre **sem login** (RPC `public_job_card`, liberada para anon): título,
  valor, área (bairro/cidade), datas, horário, pagamento, descrição, a construtora com nota e selo. Nunca o
  endereço exato nem contato. "Entrar para me candidatar" e "Criar minha conta" voltam para a vaga depois do
  login. Quem já está logado vai direto para a vaga. Vaga excluída: "Essa vaga não existe mais".

### F10 — Perfil profissional do trabalhador

- "Editar perfil" ganhou: **Sobre você** (até 280 caracteres), **dias que você pode** (semana, fim de semana,
  qualquer dia), **anos de experiência**, **diária que você pede** e **até onde você vai** (5/10/20/50 km).
- Os "fatos" do perfil passam a vir desses campos ("12 anos de experiência", "Diária a partir de R$ 200", "Vai
  até 20 km de casa", "23 bicos concluídos na Bicos"). Os fatos antigos escritos à mão ("diárias pagas pela
  plataforma", "RG e CPF conferidos…") deixaram de aparecer — não eram verdade no app.
- A construtora (e a própria pessoa) vê **faltas e desistências** (RPC `worker_track_record`), como o diálogo
  de falta promete. Perfil sem nada preenchido mostra ao dono um convite para completar.

### F11 — Pagamentos da construtora

- Configurações › **Pagamentos** (só construtora e só com pagamento ligado): os impulsionamentos com plano,
  data, valor e status (aguardando, pago, recusado, PIX venceu, cancelado, reembolso em análise). Pago →
  **"Baixar recibo"** (arquivo de texto com plano, valor, forma, datas e "não substitui nota fiscal");
  aguardando → volta ao pagamento; reembolso → fala com a gente.
- **Dados de faturamento / nota fiscal: adiado** — a NivoTech ainda não tem CNPJ para emitir nota; quando
  tiver, entram o formulário de dados de faturamento e a nota pelo provedor de pagamento.

### F13 — Convidar trabalhador para uma vaga

- No perfil de um trabalhador (vindo da busca), a construtora tem **"Convidar para uma vaga"**: lista as vagas
  abertas dela com "Convidar", "Convidado", "Aceitou/Recusou" ou "Já se candidatou". Até 20 convites por dia.
- O trabalhador recebe o aviso e, no detalhe da vaga, o cartão "<construtora> convidou você" com **Aceitar
  convite** (vira candidatura, com as mesmas regras de "Quero esse bico") ou **Recusar**. A construtora é
  avisada da resposta.

### F04 — Denunciar e bloquear

- Bandeira no detalhe da vaga (trabalhador) e nos perfis de construtora e trabalhador: **Denunciar** (motivo:
  golpe, ofensa, informação falsa, trabalho perigoso, spam, outro + detalhes) e **Bloquear**. Avaliações e
  posts têm "Denunciar". A denúncia vai para `reports` (a equipe lê pelo painel); repetir atualiza; até 20 por
  dia.
- Bloquear (`blocks`): as candidaturas e convites pendentes entre os dois saem, e o banco recusa novas
  candidaturas e convites nos dois sentidos (gatilhos). O app tira os bloqueados do mural e da busca. Lista em
  Configurações › **Contas bloqueadas**, com "Desbloquear".
- Uma contratação já confirmada não é desfeita pelo bloqueio (a pessoa pode estar indo trabalhar); para isso
  existem cancelar e desistir.

### F06 — Preferências de aviso

- Configurações › **Avisos**: no app, "Bicos novos e convites" pode ser desligado (o banco deixa de gravar esses
  avisos para a conta: `notify()` respeita `notification_prefs`). O andamento do próprio bico (aprovado,
  contratado, cancelado, lembretes) **sempre chega** — silenciar isso faria a pessoa perder trabalho.
- "No celular" (um interruptor por grupo) aparece quando o push estiver ligado (X03); a escolha já fica salva em
  `push_groups`. O pedido de permissão explicado antes do pedido do navegador entra com o X03.
- E-mail por tipo: adiado — o app ainda não manda avisos por e-mail (só os do Auth).

### F16 — Portfólio

- Tocar num post abre a **tela cheia**, com deslizar (ou as setas / teclado) para o próximo; o dono **edita a
  legenda** ali. Legenda com até 280 caracteres e contador (banco confere).
- Ao escolher o arquivo: **foto até 10 MB** (comprimida antes de enviar, Z12) e **vídeo até 60 segundos e 50
  MB** (a duração é lida no aparelho; o Storage recusa acima de 50 MB). O botão mostra o **progresso do envio**.

### F07 — Verificação de identidade do trabalhador

- Perfil › cartão **Verificar identidade** (`/perfil/verificar`): selfie (câmera frontal) + foto do documento
  (câmera traseira). Estados: não enviado, **em análise**, **verificado**, **recusado** (com o motivo e "enviar
  de novo").
- As fotos vão para o bucket **privado** `identidade`, na pasta da própria conta; ninguém lê pelo app (só a
  equipe, com `service_role`). A decisão é `set_identity_status(worker, status, motivo)` — chamada pelo painel
  da equipe / SQL Editor; o trabalhador recebe um aviso no sino. Sem verificação automática por terceiros
  (serviço pago; fica para depois, com bandeira).
- O selo "Verificado" (`workers.verified`) passa a significar exatamente "identidade verificada" (gatilho
  mantém os dois em sincronia). "Novo na plataforma" **não esconde** mais "Verificado": os dois aparecem no
  perfil, e a lista de candidatos mostra o escudo ao lado do nome.
- Demonstração: um botão "Aprovar (demonstração)" faz o papel da equipe; não existe no modo real.

### Fase C — itens resolvidos junto com outros IDs

| ID  | Onde ficou                                                                                                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------- |
| L03 | Coberto pelo Y07 (vaga indisponível sem "Quero esse bico"; mesma checagem no banco).                                            |
| L04 | "Você avançou" mostra o endereço completo e **Abrir no mapa** (Google Maps / Waze) — Z06, `MapLinks`.                           |
| L06 | Coberto pelo Y09 (resumo do bico com texto por situação e total certo).                                                         |
| L08 | Coberto pelo Z03 (impulsionada/urgente no topo, sem o plano de WhatsApp).                                                       |
| L19 | Coberto pelo Z06 (endereço exato só para a dona e para quem foi escolhido).                                                     |
| L21 | Coberto pelo Z12 (fotos de perfil, capa e logo no Storage, com compressão e progresso).                                         |
| F03 | **Publicar de novo** numa vaga encerrada abre o formulário preenchido, com datas novas (commit do Y09).                         |
| F05 | Tela **Ajuda** (`/ajuda`): perguntas frequentes, WhatsApp e e-mail do suporte; os textos "fale com o suporte" apontam para ela. |
| P05 | Perfil da construtora: "Suas vagas" e "Excluir vaga".                                                                           |
| P06 | Requisito escrito livre além da lista (commit P04/P06).                                                                         |

---

# Fase D — qualidade de app profissional

### X02 — App instalável e leve (PWA)

- `vite-plugin-pwa`: **manifest** (nome, ícones 192/512 e maskable, `theme-color` azul, `display: standalone`) e
  **service worker** que guarda o app no celular (scripts, estilos, fontes, ícones). Sem sinal, o app abre e
  mostra as telas de "sem internet" (Z11) em vez da página de erro do navegador — essa é a "página offline":
  mais útil que uma página estática, porque mostra o que já estava carregado.
- Fotos (buckets públicos do Storage e as da demonstração): cache no aparelho (até 300, 30 dias). Banco, Auth e
  Edge Functions **sempre** vão à rede (nada de dado velho de vaga ou candidatura).
- Versão nova publicada: um aviso "Tem uma versão nova da Bicos — **Atualizar**" (`services/pwa.ts`); nada é
  trocado debaixo de uma tela aberta. O app aberto por dias confere de hora em hora.
- Ícones e a imagem de prévia são desenhados por `scripts/make-icons.mjs` (martelo branco no azul da marca).
  Prévia do link (`og:` + `twitter:card`) com a imagem 1200×630; a URL absoluta vem de `VITE_SITE_URL`. A
  prévia **por vaga** (título e diária no WhatsApp) precisa de renderização no servidor (Cloudflare Worker ou
  Edge Function lendo `public_job_card`) — adiado até o domínio existir.
- **Fontes servidas pelo próprio app** (`@fontsource`, só o subconjunto latino e os pesos usados), sem Google
  Fonts; as duas da primeira tela vão com `preload`.
- A tela de carregamento do `index.html` agora **é igual** à tela inicial (mesmo nome, mesma frase, mesmos
  tamanhos): a primeira pintura já é a maior, e a troca para o React não mexe nada.
- `robots.txt`. A prévia `standalone` (file://) não tem service worker.
- **Lighthouse (celular, `vite preview`)** — com limitação real de rede/CPU (`--throttling-method=devtools`):
  Desempenho **96**, Acessibilidade **100**, Boas práticas **100**, SEO **100** (com o robots.txt). Com a
  limitação simulada (padrão) o Desempenho sai **81**: o simulador atribui a maior pintura ao React porque,
  sem limitação, o app monta antes da primeira pintura. O Lighthouse 12 não tem mais a categoria "PWA"; a
  instalação foi conferida pelo manifest + service worker ativo (teste com Playwright: registra, abre sem rede).

### X17 — URLs de verdade

- Servido por HTTP, o roteador usa **caminhos reais** (History API): `/mural`, `/vaga/BC-4821`, `/v/BC-4821`
  — links compartilháveis e indexáveis. A prévia `standalone` aberta do disco (file://) continua com `#/`.
- Os arquivos são referenciados a partir da raiz (`base: '/'`, ou `VITE_BASE` se o app ficar numa pasta).
- **Servidor**: todo caminho que não for arquivo responde com `index.html`. Cloudflare Pages faz isso sozinho
  (sem `404.html` ele trata o projeto como SPA); no Netlify, `/* /index.html 200` em `_redirects`; no nginx,
  `try_files $uri /index.html`. O service worker (X02) também responde as navegações com o app.
- Links antigos (`/#/vaga/BC-1`, já enviados no WhatsApp) abrem e são reescritos como caminho.
- Links de e-mail do Auth: voltam para a raiz com `#access_token=…`; o app guarda a sessão e troca a URL pela
  rota (`/redefinir-senha` ou `/`) antes de o roteador começar. Em _Redirect URLs_ do painel: o domínio e
  `domínio/**` (SUPABASE.md).
- A pilha própria de "voltar" continua (o "Voltar" do app não sai do app); o botão voltar do navegador
  funciona pelo `popstate`.

### X16 — Processo

- **CI** (`.github/workflows/web.yml`): a cada push/PR que mexe em `web/` — typecheck, lint, format, testes,
  os três builds (demonstração, modo real com variáveis de mentira, prévia `standalone`), **Lighthouse** no
  perfil de celular (falha abaixo de 85/95/95, `scripts/lighthouse-check.mjs`) e os **testes SQL** num Postgres
  igual ao do Supabase com todas as migrations.
- `web/preview/index.html` saiu do Git: a prévia que abre do disco é o artefato **bicos-preview** do CI (ou
  `npm run build:standalone`).
- `.env.example` completo, com o que é público e onde ficam os segredos.
- **Histórico de migrations**: o banco tem as três primeiras em 10 partes com outras versões; `APLICAR.md`
  traz os `supabase migration repair` que deixam o histórico igual aos arquivos (só a tabela de histórico).
- **Staging separado: adiado (decisão do dono do projeto)** — criar um segundo projeto Supabase (gratuito) só
  para testes, aplicar as mesmas migrations e apontar um build de staging para ele (`VITE_SUPABASE_URL` do
  staging). Não criei porque um projeto novo entra na conta/cobrança da organização. O "Branching" do
  Supabase é a alternativa paga. Os testes SQL já rodam isolados no CI, sem tocar o banco de produção.

### X13 — Avisos de segurança do Supabase

- Advisors rodados no banco real e anexados em `docs/ADVISORS.md`, com o que resolve cada um.
- Migration `x13_avisos_seguranca`: **PostGIS reinstalado em `extensions`** (o PostGIS não aceita mudar de
  schema; o banco não tinha nenhum ponto gravado na coluna antiga — conferido — e `jobs.area_geog` é
  calculada); `search_path` fixo nas três funções antigas; **visitante não executa nenhuma função security
  definer** além da vaga pública; funções novas do `postgres` nascem fechadas (cada migration dá o grant que
  precisa).
- O aviso de funções security definer executáveis por quem está logado **não se aplica**: é o desenho exigido
  (regras no banco, via RPC com `search_path` fixo). "Leaked password protection" é uma chave do painel
  (plano Pro) — SUPABASE.md.

### X15 — RLS sem função por linha e limite contra spam

- `applications`: a construtora vê as candidaturas por `job_id in (select my_job_ids())` (calculado uma vez por
  consulta), não mais `is_my_job(job_id)` por linha; `application_events` pelo mesmo critério. `my_job_ids` é
  security definer para não reaplicar a política de `jobs`, que olha `applications` (seria recursão).
- Índices das chaves estrangeiras que faltavam. As políticas das tabelas do app antigo saíram (já estavam
  fechadas desde o Z08; sem política a RLS recusa tudo) — zera os avisos de desempenho delas.
- **Spam**: cada candidatura enviada fica registrada (`application_attempts`, sem acesso pela API, limpa todo
  dia). Até **30 por dia** e **3 vezes a mesma vaga por dia** (candidatar → retirar → candidatar avisava a
  construtora a cada vez). A mensagem aparece no app como qualquer recusa do servidor.

### X14 — Tipos do banco gerados do SQL

- `src/types/database.generated.ts` sai do próprio banco (todas as migrations aplicadas) por
  `scripts/gen-db-types.mjs`, no mesmo formato do `supabase gen types typescript` (o comando oficial precisa
  baixar uma imagem Docker que este ambiente não alcança; com Docker livre, dá o mesmo resultado). O CI
  regenera e falha se o arquivo commitado estiver velho.
- `types/supabase.ts` continua escrito à mão (enums com os tipos do domínio, colunas que o app lê), mas agora
  **é conferido contra o gerado no `typecheck`**: tabela, coluna, tipo, nulidade e RPC diferentes do SQL viram
  erro com o nome do que divergiu. A conferência achou `jobs.area_lat/area_lon` (colunas geradas, o Postgres
  as declara anuláveis) — corrigido no mapeador.
- **Colunas protegidas**: o `update` de cada tabela só aceita as colunas com grant (perfil, legenda do post,
  `read_at` do aviso); qualquer outra (nota, selo, status, impulsionamento) é erro de tipo — elas mudam só
  pelas RPCs, e o banco também recusa.

### X03 — Notificações

- **Sino certo em qualquer aparelho**: o número vem do servidor (`my_unread_count`, não só dos 100 avisos
  carregados); abrir um aviso num aparelho tira dos outros (Realtime de UPDATE em `notifications`); ao voltar
  o sinal, ao reabrir o app (aba visível) ou quando o canal do Realtime cai e volta, a lista e o número são
  relidos.
- **Push (Web Push com VAPID)**: Configurações › Avisos › "Ativar neste aparelho" abre **uma explicação antes**
  do pedido do navegador (o que chega, que dá para desligar); só então o navegador pergunta. O aparelho vai
  para `push_subscriptions` (por RPC; um aparelho fica com a última conta que entrou nele). Sair da conta
  desliga o aparelho. Estados mostrados: ligado, desligado, bloqueado no navegador (como liberar), sem suporte
  (no iPhone, só com o app na tela de início).
- Envio: cada aviso novo chama a Edge Function **`enviar-push`** pelo `pg_net` (gatilho no banco; só se a conta
  tem aparelho). A função respeita os grupos escolhidos (F06), manda título, texto e a tela do aviso (nada
  além do que o sino mostra) e apaga aparelhos que o navegador diz que não existem mais. Tocar na notificação
  abre o app na tela certa (`public/push-sw.js`, importado pelo service worker do X02).
- **Escondido até configurar** (`VITE_VAPID_PUBLIC_KEY`). Para ligar: gerar as chaves
  (`npx web-push generate-vapid-keys`); em Edge Functions › Secrets, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
  `VAPID_SUBJECT` (`mailto:nivotech.dev@gmail.com`) e `PUSH_WEBHOOK_SECRET` (um texto aleatório longo);
  publicar `enviar-push` com `--no-verify-jwt`; ligar a extensão **pg_net**; no SQL Editor, guardar no Vault
  a URL da função e o mesmo segredo:
  `select vault.create_secret('https://ppnxdajiihsjaojxokzh.supabase.co/functions/v1/enviar-push', 'bicos_push_url');`
  e `select vault.create_secret('<o mesmo PUSH_WEBHOOK_SECRET>', 'bicos_push_secret');`; por fim
  `VITE_VAPID_PUBLIC_KEY` no build. A chave privada nunca vai para o front.

### X04 — Formulários

- Login num `<form>` de verdade (gerenciadores de senha reconhecem), `autocomplete` em todos os campos de conta:
  `username` + `current-password` no login, `email`, `name`/`organization`, `tel`, `new-password` no cadastro,
  na nova senha e na troca, `one-time-code` no código do WhatsApp; **CPF/CNPJ com `autocomplete="off"`** (o
  navegador não deve sugerir o documento de outra pessoa) e teclado numérico. Enter envia em todos os campos
  (login, cadastro passo a passo, esqueci a senha, nova senha, excluir conta, telas de Configurações).

### X11 — Recuperar senha

- "Já abri o link" só existe na demonstração (lá não há e-mail); no modo real a tela diz para abrir o link do
  e-mail e oferece **Voltar ao login**.
- A nova senha segue **a mesma regra do cadastro** (8+ caracteres, letras e números) — `utils/password.ts`,
  usado também em Trocar senha; o serviço confere antes de chamar o servidor.
- **Sessão de recuperação abandonada é encerrada**: sair da tela sem salvar encerra a sessão curta do link; e se
  a pessoa fechou a aba no meio, na próxima abertura o app encerra essa sessão em vez de entrar na conta
  (marcador `bicos.recuperacao` no aparelho). Recarregar a própria tela de nova senha continua valendo.

### X05 — Acessibilidade (WCAG 2.1 AA)

- **Diálogos e folhas** (`Dialog`, `Sheet`, tela cheia do portfólio): `role="dialog"`/`alertdialog`, título
  ligado por `aria-labelledby`, foco entra ao abrir, **Tab fica preso dentro**, **Esc fecha** e o foco **volta
  para o botão que abriu** (`hooks/useModal.ts`; só o de cima responde quando há um sobre o outro).
- Erros já ligados ao campo (`aria-invalid` + `aria-describedby`) em `Input`/`PasswordInput`.
- **Cartão de vaga**: deixou de ser um `role="link"` com o botão de salvar dentro. O cartão inteiro continua
  abrindo a vaga com toque/clique; para teclado e leitor de tela, o **título é o botão** (com o resumo da vaga)
  e "Salvar vaga" é outro botão — Enter no salvar só salva.
- A barra de navegação **não é mais recriada a cada mudança de dados** (`AppShell`, `key={storeVersion}`) — isso
  tirava o foco do teclado da barra. **`LegacyRerender` foi removido**: ele imitava o app antigo (tirava o foco
  do botão clicado, cortava transições e reiniciava animações a cada mudança); o comportamento normal do React
  é melhor para acessibilidade.
- **Alvos de toque ≥ 44 px**: botões, chips, ícones, "salvar vaga" e setas do carrossel ganham uma área de toque
  invisível de pelo menos 44 × 44 px (`.tap-target`), sem mudar o desenho. No cartão de vaga o alvo de toque é o
  cartão todo.
- **Contraste**: textos em `concrete-400` (3,1:1) passaram para `concrete-500` (≥ 4,5:1). As fotos dentro do
  cartão são decorativas para o leitor de tela (o título já descreve a vaga).
- Conferência automática: `scripts/a11y-check.mjs` roda o **axe** (WCAG 2.1 A/AA) em 14 telas (trabalhador e
  construtora, celular) — **0 problemas** — e entra no CI; Lighthouse de Acessibilidade 100.

### X06 — Situação da candidatura no detalhe da vaga

- Quem se candidatou vê, no alto do detalhe da vaga, **"Sua candidatura"**: a situação (mesmo selo de Minhas
  candidaturas), quando enviou, desde quando está assim e o **motivo** que a construtora (ou o sistema, como na
  recusa automática por vaga cheia) informou. Quando o próximo passo é em outra tela (WhatsApp, avaliar), o
  botão leva até lá.

### X07 — "Candidatura enviada" sem sucesso falso

- A tela de "Candidatura enviada" lê a vaga e a candidatura quando é aberta direto (recarregar, link antigo) e,
  **sem candidatura, volta para o detalhe da vaga** em vez de dizer que enviou.
- Tocar de novo em "Quero esse bico" numa vaga em que já se candidatou responde **"Você já se candidatou a essa
  vaga"** e volta para o detalhe (`submitApplication` diz `enviada` ou `ja_enviada`), sem segunda notificação.

### X08 — PIX atualiza sozinho

- Feito junto com o Z02: o PIX aguardando é relido a cada 5 s (o webhook confirma no servidor) e um pagamento já
  terminado não fica preso na tela para o próximo impulso (`BoostPayment.tsx`).

### X09 — Fotos e mídia

- Progresso, compressão (1600 px, WebP/JPEG), HEIC convertido, banco aceitando só URL do próprio Storage na pasta
  do dono, buckets sem listagem e foto de vaga só por construtora: feitos no Z12/F16.
- **Arquivos órfãos**: além de apagar a foto trocada e o post excluído na hora, uma limpeza diária
  (`limpar-arquivos`, chamada pelo pg_cron às 4h40) apaga pela API do Storage o que nenhuma linha usa há mais de 1
  dia (envio que não chegou a ser gravado, foto tirada de uma vaga) e as **fotos de identidade 30 dias depois da
  decisão** (F07, guardar só o necessário). Arquivos de antes do app novo ficam.
- Para ligar: publicar `limpar-arquivos` com `--no-verify-jwt`, segredo `CLEANUP_SECRET` em Edge Functions ›
  Secrets e no Vault `bicos_cleanup_url` (URL da função) e `bicos_cleanup_secret` (o mesmo segredo).

### X10 — Endereço ao editar a vaga

- Editar a vaga sem mexer no endereço (CEP, rua, número, cidade) **mantém o ponto salvo**; mudou o endereço, ele é
  localizado de novo.
- Ao abrir a edição, o **CEP é consultado de novo** (o ponto de uma rua/número novo vem dele); os campos ficam como
  salvos.
- Cidade que o mapa não conhece (fora da lista e sem CEP achado) **não vira (0, 0)**: o passo 1 pede para escolher a
  cidade da lista.

### X12 — Textos que prometiam o que não existe

- Procurados todos os textos de promessa. Corrigidos: "É por aqui (e-mail) que avisamos…" no cadastro (o app não
  manda avisos por e-mail; agora: "é com ele que você entra e recupera a senha"); "em até 2 dias úteis" na
  verificação de identidade (sem prazo prometido); "Avisamos quando der para colocá-la no topo" com o impulso
  desligado; "O link vale por 24 horas" (o prazo é configuração do Auth: agora "vence depois de um tempo; peça
  outro aqui").
- Já corrigidos antes: "Pagamento em PIX no fim da diária" fixo (L18, forma de pagamento da vaga), "a falta fica
  registrada no perfil" (agora é verdade: F10 mostra faltas e desistências), plano de "aviso por WhatsApp" (Z03).
  Não há "mensagens", "diárias pagas pela plataforma", "responde em poucas horas" nem "dá para trocar depois" no
  app (conferido por busca).

### X18 — WhatsApp só celular

- Feito no Y25: tela, serviço e banco aceitam só celular (DDD + 9 + 8 números). Agora o serviço de cadastro também
  confere antes de criar a conta (nos dois modos).

### X19 — Distância honesta e mural que acompanha o perfil

- "X km **de você**" só quando a distância é medida da posição da pessoa ("Usar minha localização"). Medida do bairro
  do perfil: "X km **do seu bairro**"; da cidade escolhida: "X km **do centro de** Campinas".
- Trocou a cidade no perfil: o mural que estava na cidade antiga passa para a nova (uma cidade escolhida à mão no
  mural continua escolhida).

### X20 — Login lê a conta uma vez

- Feito no Z11 (`enterSession` divide a mesma leitura entre o login e o aviso `SIGNED_IN` do Auth, e o canal do
  Realtime é aberto uma vez). Agora há teste que simula os dois chegando juntos (com o banco lento) e confere uma
  leitura da conta e um canal; o teste falha se a divisão for removida.

### X21 — Observabilidade

- **Erros no app**: já existia (`services/monitoring.ts`): com `VITE_SENTRY_DSN`, erros não tratados e os da tela de
  erro vão para o Sentry com a rota sem ids e sem dados pessoais; sem a variável, nada sai do aparelho.
- **Erros nas Edge Functions**: todas passam por `monitored()` (`_shared/monitoring.ts`): erro não tratado vira
  500 com mensagem amigável, vai para o log da função e, com o segredo `SENTRY_DSN`, para o Sentry — sem corpo do
  pedido nem cabeçalhos; e-mails e números longos (CPF, telefone) são apagados da mensagem.
- **Funil**: `funnel_daily(de, até)` no banco conta por dia cadastros iniciados (Auth), e-mails confirmados,
  cadastros concluídos, vagas publicadas, candidaturas, aprovações, contratações, diárias concluídas,
  impulsionamentos pagos e a receita — **a partir dos dados que o banco já guarda, sem rastrear pessoas** (por isso
  não depende de consentimento; nenhuma ferramenta de terceiros). Só service_role (painel/SQL Editor).
- A Política de privacidade ganhou uma linha dizendo isso (contagem sem identificar ninguém e registro de erros sem
  dados pessoais). É um esclarecimento, sem mudar a versão aceita no cadastro — se o jurídico preferir, sobe a versão
  em `services/legal.ts` e todos aceitam de novo.
- Analytics de navegação (telas vistas, cliques) por pessoa: **adiado** — exigiria banner de consentimento e uma
  ferramenta; o funil acima responde às perguntas do produto sem isso.

---

# Fase E — polimento

### W01–W04

- **W01** valores com centavos só quando há centavos ("R$ 180", "R$ 180,50").
- **W02** vaga que já começou e ainda vai: "Até 16 out" (ou "Até hoje"), em vez de "Ontem até 16 out".
- **W03** total da vaga (diária × diárias) no detalhe, na confirmação da candidatura e no Gerenciar, quando há
  mais de uma diária e valor fixo ("Total R$ 660 por 3 diárias").
- **W04** "O que precisa levar" some quando a vaga não pede nada.
- Achado junto: os cartões da diária no detalhe e no Gerenciar ainda diziam "Pago no fim da diária" fixo (resto
  do L18/X12) — agora mostram a forma de pagamento da vaga.

### W05–W07

- **W05** depois de publicar, botão **Gerenciar vaga**. No perfil da própria construtora, quem já teve vagas
  (todas encerradas) não é mandado a publicar "seu primeiro bico"; vagas cheias continuam listadas em "Suas
  vagas"; "1 vaga aberta" no singular.
- **W06** aprovar/recusar na lista de candidatos: um de cada vez, com o indicador de envio no lugar dos botões
  (sem duplo toque).
- **W07** "O contato por WhatsApp abre depois que você aprovar" só aparece enquanto o contato ainda está fechado
  para aquela candidatura.

### W08 — Limites de publicar e de pagar

- **Diária até R$ 5.000** (acima é quase sempre erro de digitação) — formulário e banco.
- **Descrição de 20 a 1000 letras**, com contador — formulário e banco. As vagas antigas da demonstração já passam.
- **CEP coerente com a cidade**: se o CEP é de outra cidade, o passo 1 avisa ("Esse CEP é de …").
- **Turno que passa da meia-noite** (22h–6h) aceito no formulário e no banco, e mostrado como "22h–6h (vira a
  noite)"; só início igual ao fim é recusado.
- **Cartões de 15 a 19 dígitos** (Amex e outros); antes só 16.

### W09 — Demonstração

- Código da vaga nova na demonstração: o **próximo número** depois do maior já usado (vagas existentes e excluídas),
  sem colisão (antes era um número aleatório).
- O contato de WhatsApp é guardado **por candidatura e situação** (pré-selecionado → contratado muda a mensagem
  pronta) e por conta: o segundo toque não lê de novo. Vale nos dois modos; sair da conta limpa.

---

# Rodada de lançamento (L01–L14)

> Os IDs desta rodada repetem números da Fase C (L01–L22 de antes). Aqui eles aparecem como "L01 (lançamento)";
> as migrations e os testes novos usam o prefixo `lancNN_` (ex.: `lanc06_backoffice`) para não se confundir com `l10_cnpj.sql` e afins.

## L01 (lançamento) — Build de produção nunca sai em modo demonstração

**Problema**: `npm run build` sem `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` gerava, sem aviso, o app de
demonstração (vagas inventadas). Um deploy com uma variável esquecida publicaria dados falsos.

**O que foi feito**: o modo passou a ser explícito. `npm run build` é produção e, antes de empacotar, confere as
variáveis obrigatórias (`build/env.ts`, plugin `bicos-production-env` no `vite.config.ts`); faltando alguma — ou
com endereço sem `https://` — o build para com a lista do que falta. A demonstração é `npm run build:demo`
(modo `demo`, que zera as variáveis do Supabase como a prévia `standalone`). O CI usa `build:demo` para
Lighthouse/axe, prova que o build de produção sem variáveis falha e faz o build real com valores de exemplo.

**Por quê**: a falha tem de acontecer na hora do build (barato, visível no deploy), não no navegador do usuário.
Qualquer outro modo (`--mode staging`, por exemplo) também é tratado como produção — só os modos nomeados de
demonstração escapam da conferência.

## L02 (lançamento) — Staging

**Problema**: não havia ambiente entre o falso Supabase dos testes e a produção.

**O que foi feito**: scripts para montar um projeto novo igual à produção (`scripts/staging/aplicar-banco.sh`,
`publicar-funcoes.sh`), modelos de variáveis (`.env.staging.example`, `supabase/functions/.env.staging.example`),
`npm run build:staging` e o passo a passo em `docs/STAGING.md`. A criação do projeto espera o "pode".

**Por quê assim**: (1) `APLICAR-TUDO.sql` sozinho não monta um banco vazio — as migrations do app novo ainda leem
as tabelas do app antigo (`public.profiles` na `bicos_v2_rules`, por exemplo), então o script aplica primeiro
`/supabase/migrations/0*.sql`, como o setup dos testes. (2) Cada migration do app entra no histórico com a versão
do **arquivo** (não a hora), que é o que a produção terá depois do `repair`; assim `list_migrations` compara
igual. (3) Os dois scripts recusam o ref/conexão da produção.

## L05 (lançamento) — Anti-abuso e observabilidade ligados

**Problema**: captcha e Sentry eram opcionais (sem configurar, sumiam em silêncio), as funções respondiam CORS `*`
sem `APP_ORIGIN`, e o "esqueci a senha" nem pedia captcha.

**O que foi feito**:

- **Captcha**: o build de produção exige a site key (L01); cadastro, login (e-mail ou documento) e "esqueci a
  senha" pedem o token e **não enviam sem ele** (`captchaToken` em `services/remote/auth.ts`, teste em
  `captcha.test.ts`). No servidor, `_shared/captcha.ts` passou a **recusar** quando falta `TURNSTILE_SECRET`
  (antes deixava passar); `CAPTCHA_OPCIONAL=1` só para desenvolvimento. Para o Auth (cadastro, login, recuperação)
  quem confere é o próprio Supabase: Attack Protection › Captcha (ação do responsável).
- **Sentry**: `services/monitoring.ts` ganhou `beforeSend` (tira e-mail, CPF, CNPJ, telefone, JWT/tokens, ids e
  `BC-n` de mensagem, tags e extras), quadros da pilha de verdade (para o Sentry usar os source maps), `release` =
  commit (`vite.config.ts` › `commitRelease`) e `environment`. O build de produção gera source maps **ocultos**
  (`sourcemap: 'hidden'`, sem o comentário que aponta para eles); `scripts/sentry-sourcemaps.mjs` envia ao Sentry
  e apaga os `.map` de `dist/` antes de publicar. Continua sem SDK (o bundle não cresce).
- **APP_ORIGIN**: `_shared/http.ts` não sobe sem ele (erro no log da função). Aceita lista e `https://*.dominio`
  para prévias por PR; `monitored()` devolve a origem do pedido quando ela está na lista (`_shared/origin.ts`,
  testado no Vitest). O CI passou a rodar `deno check` nas funções.

**Por quê**: falhar fechado. Esquecer um segredo agora quebra a função de forma visível no deploy/staging, em vez
de deixar a porta aberta em produção sem ninguém perceber.

**Pendente com o responsável**: código do WhatsApp (Twilio Verify) obrigatório antes da 1ª candidatura **ou**
validação de formato + aviso — ver `CHECKLIST-LANCAMENTO.md`.

## L06 (lançamento) — Back-office mínimo

**Problema**: verificar identidade, aprovar construtora e tratar denúncia só era possível por SQL no painel.

**O que foi feito** (migration `lanc06_backoffice`, tela `pages/admin/Admin.tsx`, serviço `services/admin.ts`):

- **Equipe**: tabela `staff_members` (entra só pelo SQL Editor com `add_staff_member`), `is_staff()` e
  `staff_guard()` no começo de cada RPC `admin_*` (BC401 para quem não é). Nenhuma chave `service_role` no
  navegador: o app chama as RPCs com a sessão comum, e o banco decide.
- **Filas**: identidades em análise (selfie e documento por **URL assinada de 5 min** — o bucket continua privado;
  a única política de leitura nova é "Equipe lê as fotos de identidade"); construtoras pendentes com o CNPJ inteiro
  e o que a Receita respondeu (`companies.cnpj_check`, gravado agora pela `verificar-cnpj`); denúncias com o
  conteúdo, a conta responsável e o histórico dela (idade, nota, vagas/candidaturas, denúncias, ações da equipe).
- **Ações**: aprovar/recusar (motivo obrigatório na recusa, avisa a pessoa), arquivar denúncia, ocultar vaga
  (`jobs.hidden_at`: sai do mural, do link público e das candidaturas novas; a dona e quem já se candidatou
  continuam vendo, como na vaga excluída), suspender conta e desfazer as duas últimas. Resolver uma denúncia
  resolve as outras abertas sobre o mesmo conteúdo.
- **Suspensão**: `accounts.suspended_at`; o Auth recusa o login (`banned_until` = agora + 100 anos; `infinity` quebra o GoTrue — achado pelo E2E) e as sessões abertas
  são apagadas; gatilhos impedem publicar vaga e se candidatar mesmo com um token ainda válido; as vagas abertas
  da construtora saem do mural e as candidaturas pendentes do trabalhador saem. O login mostra "Sua conta está
  suspensa".
- **Auditoria**: `staff_actions` (quem, ação, alvo, motivo, quando), sem acesso direto; a aba "Registro" lê por
  `admin_actions()`.

**Por quê**: tudo no banco, como o resto do app — a tela é só uma porta. Os testes SQL (`lanc06_backoffice.sql`)
provam que conta comum e visitante não leem nem chamam nada do admin e que a suspensão vale no banco.

**Demonstração**: não há equipe no modo demo; `/admin` explica que a área é só da equipe.

## L07 (lançamento) — LGPD e jurídico prontos para revisão

**Problema**: política genérica, marcada como rascunho; sem consentimento próprio para a selfie (dado biométrico);
termos novos não pediam novo aceite; as tabelas do app antigo continuavam lá — e a varredura mostrou que **ainda
recebiam dados** (gatilho `on_auth_user_created` copiando cada cadastro para `profiles`; aceites indo para
`consentimentos`).

**O que foi feito**:

- Textos 2.0 em `services/legal.ts` (fonte única; `/legal/*.md` gerado e conferido por `legal.test.ts`):
  controlador e DPO com campos `{{...}}`, selfie/documento como dado sensível (art. 11: finalidade, base, quem
  acessa, 30 dias), operadores e transferência internacional, retenção por tipo de dado, direitos, segurança.
  `LEGAL_REVIEWED = false` mantém o aviso de rascunho até a revisão do advogado.
- Migration `lanc07_aceites`: `terms_acceptances` (cada aceite com versão e hora; cópia do que estava em
  `consentimentos` e em `accounts`), `accept_terms`, `create_account_for` sem tocar no app antigo,
  `submit_identity` exigindo a versão do consentimento (gravada em `identity_submissions`), e `export_my_data`
  com aceites e verificações.
- Tela de verificação com um quadro de consentimento destacado e caixa própria (`IDENTITY_CONSENT`); o envio só
  sai com ela marcada (no app e no banco).
- `Session.termsCurrent` + `homeFor` → `/aceitar-termos` quando `TERMS.version` muda.
- **Pendente de "pode"**: `supabase/pendentes/…_lanc07_apagar_app_antigo.sql` (apaga as 7 tabelas, o gatilho e
  as funções antigas; testado com todos os testes SQL) e `scripts/exportar-app-antigo.sh` para guardar os dados
  antes. Não está em `migrations/` para não ser aplicado por engano.

**Por quê não apagar a chave do Vault**: `nivotech_documento_key` cifra o CPF/CNPJ das contas **atuais**
(`accounts.document_cipher`). Apagá-la, como o pedido sugeria, tornaria esses documentos ilegíveis.

**Mapa completo**: `docs/LGPD.md` (dado → onde → finalidade → base legal → prazo, operadores, achados).

## L04 (lançamento) — E-mail transacional que chega

**Problema**: o SMTP padrão do Supabase só entrega para a equipe do projeto, com cota mínima; os e-mails eram os
textos padrão em inglês.

**O que foi feito**: os 4 e-mails do Auth em português (`supabase/email-templates/`), num layout único só com
tabela e estilos na linha (sem imagem remota, sem script — o que mais derruba a entrega), botão grande e o mesmo
link em texto para celular simples. `scripts/configurar-auth.mjs` aplica, pela Management API, SMTP da Brevo,
templates, assuntos, Site URL/Redirect URLs, senha mínima e captcha — o mesmo comando para staging e produção
(esta só com `CONFIRMO_PRODUCAO=sim`). Os registros de DNS e o teste de entrega estão no checklist.

**Por quê**: configurar à mão no painel, duas vezes, é onde staging e produção começam a divergir. A validade dos
links fica em 1 hora (padrão do Supabase, vale para todos os tipos); a tela "Confirme seu e-mail" já tem
"Reenviar o link".

**Não feito (depende do responsável)**: autenticar o domínio na Brevo e criar os registros no DNS; o aceite
"chega na caixa de entrada do Gmail e do Outlook" só pode ser conferido depois disso.

## L08 (lançamento) — Infraestrutura de produção

**O que foi feito**: `public/_headers` (Cloudflare Pages) com CSP restrita ao que o app carrega (Supabase,
Turnstile, Mercado Pago, Sentry, BrasilAPI/ViaCEP), HSTS de 1 ano, `X-Content-Type-Options`, `X-Frame-Options`,
`Referrer-Policy`, `Permissions-Policy` e cache longo para `/assets/*`. O build publicado não tem mais script
inline (o aviso "abra pelo servidor" do `index.html` só existe no código-fonte — plugin `bicos-drop-dev-script`),
então a CSP não precisa de `'unsafe-inline'` em scripts; estilos ainda precisam (o CSS crítico do `index.html`).
`headers.test.ts` confere os cabeçalhos e que cada endereço externo do código está liberado. Deploy num comando:
`scripts/deploy.sh` (`npm run deploy:staging|deploy:producao`), que se recusa a publicar a demonstração (armadilha 1).

**Câmera**: o pedido falava em liberar a câmera só na tela da selfie. Como a selfie usa `<input capture>` (o app
de câmera do próprio celular), a página não precisa da permissão `camera` em nenhuma tela; ela fica bloqueada em
todas (`camera=()`). Além disso, num app de página única a política vale para o documento inteiro: uma regra por
caminho não funcionaria ao navegar dentro do app.

**Depende do responsável**: plano Pro, backups/PITR, leaked password protection, URL Configuration, limites do
Auth, alerta de uso, projeto no Cloudflare Pages com domínio, e a nota A no securityheaders.com (checklist).

## L03 (lançamento) — E2E num backend de verdade

**Problema**: os critérios de aceite 1–6 só tinham rodado contra mocks e o falso Supabase.

**O que foi feito**: Playwright em `web/e2e/` (7 arquivos, 13 testes): os 6 fluxos pedidos e o da área da equipe
(L06). Tudo pela tela do app, como a pessoa faz; a Admin API (service_role, só no Node do teste) entra para o que
o teste não consegue fazer pela tela — o link do e-mail de confirmação/recuperação, criar o "outro lado" de um
fluxo, fazer o tempo passar (datas da vaga) e rodar a rotina do cron. Contas com e-mail `+e2e-<execução>`, apagadas
no fim pela `excluir-conta`. Cada etapa vira um print em `docs/E2E.md`. Job `e2e` no CI contra o staging (segredos
`E2E_*`); sem eles, avisa e não falha.

**Onde rodou**: o staging ainda não existe (L02 espera o "pode"), então a suíte foi desenvolvida e rodada contra
um **Supabase local completo** (`supabase start`: Postgres 17, GoTrue, PostgREST, Storage, Kong) com todas as
migrations e as Edge Functions no Deno — 13/13 verdes. Sem Realtime (não sobe neste ambiente) e com o Turnstile
falso (token de teste da Cloudflare). O modo de build `e2e` exige as variáveis da produção (L01), mas aceita
`http://localhost`.

**Achados**: (1) a Z12 fixa o endereço do Storage da produção em `app_config` — num projeto novo toda foto é
recusada; o script do staging agora troca. (2) `banned_until = 'infinity'` quebra o GoTrue — corrigido no L06.
(3) A rotina conclui a diária 2 dias depois do último dia (prazo para marcar falta) — o teste respeita isso.

## L09 (lançamento) — `pg_net` fora do `public` e histórico de migrations conferido

**Problema**: o `pg_net` foi ligado na produção pelo conector (migration `20261012033541_habilitar_pg_net`, que
não estava no repo) e caiu no `public` (aviso `extension_in_public`). E nada impedia o histórico do banco de
divergir dos arquivos de novo.

**O que foi feito**: (1) o arquivo `20261012033541_habilitar_pg_net.sql` entrou no repo com a mesma versão e o
mesmo comando gravado na produção — o histórico passa a bater sem `repair` para ele. (2) `lanc09_pg_net` apaga e
recria o `pg_net` no `extensions` (não é relocável); sem `cascade`, para não levar nada junto. As funções ficam em
`net.*` e as duas que chamam a rede (push e limpeza) usam `execute`, então não dependem do objeto e não mudam.
Testado num Postgres com o `pg_net` no `public`, como a produção. (3) `conferir-migrations.sh` compara o
histórico com os arquivos (falta e sobra) e o workflow `staging` aplica e confere a cada migration no `master`.

**Por que pelo GitHub e não pelo conector**: o conector do Supabase pede aprovação manual a cada comando com
`drop`, e as migrations recriam políticas e funções com `drop … if exists`; sem alguém aprovando na hora, a
chamada expira. Montar o staging pelo workflow (com a senha do banco num segredo do GitHub) é repetível e não
depende de uma sessão aberta. O script também passou a decidir pelo `accounts` (app novo) se roda as migrations
antigas, para completar um banco que parou no meio delas.

## L10 (lançamento) — link público pelo slug, com limite por IP

**Problema**: os IDs das vagas são sequenciais (`BC-1`, `BC-2`…) e `public_job_card`, a única RPC para visitante,
abria qualquer um: dava para baixar o mural inteiro sem conta, uma vaga atrás da outra.

**O que foi feito**: cada vaga ganha `public_slug` (12 caracteres aleatórios de um alfabeto de 31 sem `0/o/1/l/i`,
~59 bits; gerado pelo banco, único) e o link compartilhado é `/v/<slug>`. A RPC só abre pelo slug; o BC-n continua
sendo o ID e aparece na página ("Vaga BC-12"). Limite de 60 consultas a cada 10 minutos por IP (BC409 com a mensagem
pronta), contadas em `public_link_hits` só com o hash do IP com a data — apagadas no dia seguinte pela limpeza das
4h17. Links antigos (`/v/BC-12`): logado vai direto para a vaga; visitante vê "Entre para ver a vaga BC-12" e o
login devolve para ela.

**Por que assim**: 59 bits tornam adivinhar um slug inviável mesmo sem o limite; o limite segura a raspagem de quem
já tem links. O IP vem do `cf-connecting-ip` (posto pela Cloudflare na frente do Supabase, o cliente não forja); os
outros cabeçalhos só de reserva. Não há links antigos de verdade (a produção tem 0 vagas), mas o caminho existe para
não dar erro em quem guardou um link de teste. O front novo tem de ir junto com a migration (o parâmetro da RPC
mudou de nome).

## L11 (lançamento) — WhatsApp do suporte obrigatório e conferido

**Problema**: o número do suporte tinha um padrão no código (`5494731661`, 10 dígitos — um a menos para celular) e
o botão "Falar no WhatsApp" da Ajuda levaria a um número que não existe.

**O que foi feito**: `VITE_SUPORTE_WHATSAPP` entrou nas variáveis obrigatórias do build de produção (L01), com
conferência de formato: celular com DDD (DDD + 9 + 8 dígitos), com ou sem `55` e pontuação. O padrão saiu; na
demonstração não há número e a Ajuda oferece só o e-mail. De quebra, `whatsappUrl` passou a decidir o `55` pelo
tamanho do número: antes, um celular do DDD 55 (Santa Maria e região, RS) sem o código do país era tratado como se
já tivesse o `55` e o link abria o número errado — valia para todos os botões de WhatsApp do app.

## L12 (lançamento) — rotinas vigiadas e push desligado de propósito

**Problema**: as rotinas do pg_cron (concluir diárias, vencer PIX, lembrete, limpezas) falhavam em silêncio — o erro
ficava em `cron.job_run_details`, que ninguém olha, e o histórico crescia sem limite. E o push dependia de dois
segredos no Vault que não estavam documentados passo a passo.

**O que foi feito**: `check_cron_failures()` de hora em hora: rotina com as 2 últimas execuções falhadas vira um
alerta em `cron_alerts` e um evento no Sentry pela API "store" (a mesma que o app usa, sem SDK), com a mensagem
sem e-mail nem sequência longa de dígitos e cortada em 300 caracteres; no máximo um alerta por rotina a cada 24 h.
`cron_health()` mostra o estado de todas no SQL Editor. O vigia também manda um "sinal de vida" a um monitor de fora
(healthchecks.io, grátis), porque o caso mais provável no plano Free — projeto pausado — o banco não tem como
avisar. Push: **fica desligado no lançamento** (escondido sem `VITE_VAPID_PUBLIC_KEY`; o gatilho não chama nada sem
`bicos_push_secret`), com o passo a passo para ligar em `docs/SUPABASE.md` › 5.2.

**Por que pelo banco e não por uma Edge Function**: tudo o que o vigia precisa já está no banco (pg_cron, pg_net,
Vault); uma função a mais seria mais um segredo e mais um ponto para falhar. O e-mail sai pela regra de alerta do
Sentry, que já é ação do responsável no L05.

## L13 (lançamento) — teste de volume do mural

**Problema**: o mural nunca tinha rodado com volume. Meta: 2.000 vagas e 20.000 candidaturas com p95 < 300 ms.

**O que foi feito**: `scripts/volume/` popula dados sintéticos marcados (pelos mesmos gatilhos do app), mede 6
cenários × 50 chamadas e apaga tudo no fim (conferindo que não sobrou nada). Medido no Postgres local igual ao do
Supabase: antes, p95 de 37 a 275 ms (passava, com pouca folga para a instância do plano Free); o gargalo era
`job_is_open` chamada por vaga (~50 µs cada, porque função com `search_path` fixo não é "aberta" pelo planejador).
Depois da `lanc13_mural_volume` (coluna calculada `last_day` + índice parcial; o mural compara com o "hoje" uma vez;
texto da busca normalizado uma vez): p95 de 14 a 133 ms. Resultados em `docs/VOLUME.md`.

**Por que a regra "aberta" ficou escrita no mural em vez de chamar `job_is_open`**: é a única forma de o planejador
usar o índice e não pagar a chamada por linha. Para não divergir, o teste `lanc13_mural_volume.sql` compara, vaga a
vaga (datas, "a combinar" vencida, encerrada, excluída, oculta, cheia), o mural com `job_is_open`; e
`last_day` com `job_last_day`.

**Pendente**: rodar no staging (precisa do banco montado — segredos do L02). **Achado**: apagar conta pela tela do
Auth deixa o perfil público para trás; a regra é usar a exclusão do app (registrado em `docs/VOLUME.md`).

## R01 — Build de produção não publica texto jurídico incompleto

**Problema**: `npm run build` passava com `{{RAZAO_SOCIAL}}`, `{{CNPJ}}`, `{{DPO_EMAIL}}`… em `legal.ts` e com
`LEGAL_REVIEWED = false`: o público veria "CNPJ {{CNPJ}}" e o aviso de rascunho.

**O que foi feito**: `build/env.ts › legalProblems` confere os textos (termos, política e consentimento da selfie)
antes do build. Produção: campo `{{…}}` ou falta de revisão param o build. Staging e E2E: só avisam. Escape único,
para piloto fechado e só por decisão registrada da empresa: `BICOS_PILOTO_SEM_REVISAO_JURIDICA=1` libera a falta de
revisão (o aviso de rascunho continua na tela), nunca os campos em branco. O CI prova que o build de produção para e
passou a fazer o build real em modo `staging`.

**Por que o escape não cobre os `{{…}}`**: um piloto pode começar antes do advogado, mas nunca sem dizer quem é a
empresa, o CNPJ e o canal do encarregado de dados — a LGPD exige isso de qualquer tratamento.

## R02 — Funções servidor-a-servidor não dependem de `APP_ORIGIN`

**Problema**: desde o L05, `_shared/http.ts` lia `APP_ORIGIN` ao carregar e derrubava **toda** função sem ele — também
`webhook-pagamento` (Mercado Pago), `enviar-push` (banco) e `limpar-arquivos` (cron), que ninguém chama do navegador.
Um segredo esquecido derrubaria o webhook e o cron juntos.

**O que foi feito**: `requireAppOrigin()` lê e confere `APP_ORIGIN`; só as 5 funções do navegador o chamam no topo do
arquivo (sem ele, não sobem, como no L05). O CORS (`preflight`, `withCors`) só aparece depois disso; nas outras 3,
nenhuma resposta leva cabeçalho CORS. Teste (`edgeOrigin.test.ts`) confere a lista das 8 funções e quem chama o quê;
`deno check` verde; conferido subindo as funções sem `APP_ORIGIN` (as 3 servidor-a-servidor sobem e respondem 401
sem CORS; `excluir-conta` e `verificar-cnpj` não sobem).

## R03 — Suspensão completa

**Problema**: suspender (L06) apagava só as candidaturas pendentes e tirava as vagas do mural. Quem já estava
pré-selecionado ou contratado ficava num bico que não ia acontecer: a posição continuava ocupada, ninguém era avisado
e o WhatsApp do suspenso continuava abrindo.

**O que foi feito**: status novo `cancelado_pela_equipe` e a transição do **sistema** `cancelar_por_suspensao`
(de pré-selecionado ou contratado), nos dois lados (`applicationMachine.ts` e `application_next_status`); a tabela
inteira é conferida igual nos dois (teste Vitest e teste SQL com a mesma lista). Trabalhador suspenso: cada bico é
cancelado com motivo "conta suspensa", a construtora recebe "Bico cancelado pela equipe" e a posição libera (quem
foi recusado automaticamente volta para análise, como na desistência). Construtora suspensa: cada trabalhador
aprovado/contratado nas vagas dela recebe "Bico cancelado pela equipe… Não vá até a obra". `get_contact` recusa
(BC404) quando qualquer um dos lados está suspenso. Telas: selo "Cancelado pela equipe" para os dois lados.

**Por que um status novo e não `cancelado_pela_construtora`**: a construtora não cancelou; o histórico e a nota dela
ficariam errados. Reativar a conta não desfaz os cancelamentos — o bico já foi avisado como cancelado aos dois lados.

## R04 — Conta apagada pelo painel não deixa perfil órfão

**Problema** (achado do L13): apagar o usuário em Authentication › Users removia `accounts` (cascata), mas `workers`
e `companies` continuavam com nome, foto e nota à vista; as vagas da construtora seguiam abrindo pelo link; e a selfie
da verificação ficava guardada.

**O que foi feito**: a limpeza da exclusão pelo app virou `anonymize_account(conta, motivo)`, usada pelo
`delete_my_account` (que continua exigindo login recente e a confirmação dos compromissos) e por um gatilho
**BEFORE DELETE** em `auth.users` — antes da cascata, enquanto a `accounts` ainda existe. Nos dois caminhos agora
também: vagas da construtora ocultas (fora do mural, da busca e do link público) e sem fotos, e os envios de
verificação de identidade apagados (a selfie de uma verificação ainda não decidida ficava para sempre). Os arquivos
ficam sem uso e `orphan_storage_objects` (limpeza diária) os pega — conferido no teste. Cadastro nunca concluído
continua com a limpeza do Z01 (o perfil vazio sai). Conferido também com o `deleteUser` do Auth de verdade.

**Por que limpeza completa e não só ocultar**: é o mesmo resultado que a pessoa teria pelo app, testado há várias
rodadas; um segundo comportamento só para o painel seria mais um caminho para manter. A exclusão pelo app marca a
transação (`bicos.conta_ja_limpa`) para o gatilho não repetir a limpeza.

## R05 — Staging montável do zero sem tabela exposta

**Problema**: o staging ficou com `public.profiles` **sem RLS** — sobra de uma montagem pelo conector que parou no meio
(a tabela foi criada; o `enable row level security` da mesma migration não chegou a rodar). Sem RLS, a tabela inteira
sai pela API.

**O que foi feito**: `scripts/staging/aplicar-banco.sh` já completa as migrations antigas enquanto o app novo não
existe (L09) — o que liga a RLS da `profiles` — e agora termina com duas conferências que fazem o script falhar: toda
tabela do `public` com RLS (o equivalente em SQL do ERROR `rls_disabled_in_public` do advisor) e o histórico igual
aos arquivos (`conferir-migrations.sh`). Rodado num Postgres vazio com a `profiles` desprotegida, como o staging:
50 migrations, 37 tabelas, todas com RLS; com uma tabela sem RLS criada de propósito, o script para e diz qual.

## R06 — Higiene do repositório

**Problema**: a raiz ainda era o "handoff bundle" do Claude Design (README falando de protótipos), com o app legado,
as conversas de design e as migrations antigas misturados com o app de verdade; `web/README.md` descrevia a migração
de 2026-09 (hash router, Supabase "não conectado").

**O que foi feito**, em quatro passos com os testes verdes entre eles: (1) README da raiz descreve o produto;
(2) migrations 000–012 em `web/supabase/legado/` (setup dos testes SQL, `aplicar-banco.sh` e CI ajustados — elas
continuam necessárias para montar um banco do zero); (3) `app/`, `chats/`, `project/` e `SETUP-SUPABASE.md` em
`archive/` com um `LEIA.md`; (4) `web/README.md` reescrito a partir do que existe hoje.

**Por que os testes de paridade ficaram**: `utils.parity.test.ts` ainda pega diferença de formatação (valores,
datas, telefone) em relação ao app que as pessoas já usaram, e custa nada no CI; só passou a importar
`archive/app`. O `npm run parity` (visual) continua manual.

## R07 — Pequenos acertos

- O comentário da `lanc10_link_publico` dizia alfabeto de 32 caracteres (~60 bits); são 31 (sem `0/o`, `1/l/i`),
  ~59 bits. Só o comentário mudou (a função está certa); a migration ainda não foi aplicada em lugar nenhum.
- `docs/ADVISORS.md` ganhou o estado **esperado** depois das migrations `lanc*` e `r*`, calculado com as mesmas
  consultas do advisor num Postgres igual ao do Supabase — para o R08 e o R10 compararem com o real. A lista das 55
  funções `security definer` executáveis por `authenticated` foi conferida uma a uma: nenhuma interna exposta
  (as de limpeza, alerta e anonimização são só do dono do banco).

## R08 — Conferir a senha também manda o captcha

O E2E no staging (o primeiro ambiente com o captcha do Auth ligado) mostrou que **excluir a conta, trocar a senha e
trocar o e-mail** conferiam a senha com um `signInWithPassword` sem `captchaToken`. Com o Turnstile ligado no Auth, o
Supabase recusa esse login ("no captcha_token found") e o app dizia "senha incorreta" para a senha certa — as três
telas quebrariam na produção assim que o captcha fosse ligado. Agora `checkPassword` recebe o captcha como os outros
formulários públicos (`useCaptcha` nas três telas, widget acima do botão), e os logins feitos pelo Node no E2E mandam
o token de teste (`CAPTCHA_TESTE`). O teste do `fakeSupabase` confere que o token chega ao Auth.

Na segunda rodada no staging apareceram mais dois pontos. (1) Na tela "Excluir minha conta" o captcha nunca
aparecia: a tela mostra primeiro o "carregando" e só depois o formulário, e o `useCaptcha` procurava a caixa do
widget no primeiro instante. Agora o widget é montado quando a caixa aparece (ref por estado). (2) O teste do limite
de 5 tentativas chamava a função só com `apikey`; no Supabase de verdade a porta das funções com JWT responde 401
antes da função rodar, então o limite nunca era contado. O teste agora manda o `Authorization`, como o app.

## R08 — Site de teste no GitHub Pages

O responsável publicou pelo GitHub Pages (`nivotechdev.github.io/Constru-o-Civil`), que mostrava só o README: o
Pages servia os arquivos do repositório, não o app. O workflow `site` faz o build do staging com
`VITE_BASE=/Constru-o-Civil/` (o roteador já sabia viver numa pasta) e publica o `dist/`. O Pages não reescreve
caminhos, então o `404.html` é o próprio app (com `<base>` para os ícones): `/Constru-o-Civil/vaga/BC-1` abre a tela
certa, só que com status 404 (irrelevante para o teste). Os `_headers` (CSP) não valem no Pages — por isso ele é só
o site de **teste**; a produção continua no Cloudflare Pages. No workflow `staging`, `APP_ORIGIN` passou a ser só o
domínio do site (as funções recusam origem com caminho).

## R08 — "Sua conta não pode fazer isso" sem login era mensagem errada

No site de teste, uma conta confirmada pelo link do Gmail num iPhone (navegador interno do app do Google, `GSA` no
`user_agent` da sessão) chegou ao "Completar perfil", mas as chamadas seguintes ao banco saíram como visitante
(`permission denied for function finish_sign_up`, `my_unread_count`, tabela `notifications`: o `authenticated` tem
permissão, o `anon` não). O app traduzia o `42501` como "Sua conta não pode fazer isso", o que não ajuda ninguém.
Agora, se o banco nega por permissão **e** o cliente não tem sessão, o app trata como sessão terminada ("Sua sessão
terminou. Entre de novo para continuar.") e leva ao login. Com sessão, a recusa continua com a mensagem genérica.
Causa do navegador interno perder a sessão: não confirmada; no roteiro de teste, abrir o link do e-mail no Safari/Chrome.

## U01 — Cadastro de vaga simplificado (teste com os amigos)

Pedido dos sócios depois de testar o site: menos campos para a construtora. **Passo 1** ("Serviço, local e data"):
sem ofício, sem número e complemento, sem data de início e fim (toda vaga nova é "data a combinar", com os dias da
semana, as diárias e o horário opcional), sem "vaga urgente"; o **título passa a ser obrigatório** e o campo
"Pessoas" começa vazio e é obrigatório. **Passo 2** ("Valor e requisitos"): sem "como você paga a diária" e sem "o
que o trabalhador precisa levar" (com o "outro item"); cada passo abre no topo da tela. **Minhas vagas** não tem mais
o botão "Publicar" no topo (continua na barra de baixo e no aviso de lista vazia).

Consequências decididas com o responsável: sem ofício na vaga, **o filtro de ofício sai do mural** e todo trabalhador
vê todas as vagas; o alerta de bico novo chega a todos da região; a capa de vaga sem foto vem do título; a mensagem
pronta do WhatsApp cita o título ("para a vaga \"Reboco da fachada\""). No banco (`u01_vaga_simples`): `oficio_id`
aceita null, título obrigatório (até 60), número opcional, sem pagamento = null ("Pagamento combinado direto" na
tela, em vez de prometer PIX no dia). Vagas antigas não mudam, e editar uma delas mantém o que ela tinha (ofício,
datas, pagamento, requisitos) — os campos continuam no formulário, só não aparecem. Com "data a combinar", o último
dia da vaga é 30 dias depois de publicada (Y01): a diária contratada é concluída sozinha 2 dias depois disso, ou antes,
quando a construtora marca "concluída" — a avaliação dos dois lados continua acontecendo.

## U02 — Textos de ajuda do cadastro de vaga enxutos

Pedido do responsável ao ver a tela no celular: interface limpa. Saíram as frases que só repetiam o campo ou
explicavam o que não precisa ser explicado: "É o que o trabalhador lê primeiro no mural" (título), "Quantos
trabalhadores você precisa" (pessoas), "Data a combinar com o trabalhador" e "Em branco: horário a combinar", "Antes
de aprovar alguém, os candidatos veem só o bairro e a cidade…" (endereço), "Quanto mais claro…" (descrição), a dica do
CEP antes de digitar e "O trabalhador vê esse valor no mural" (valor). Ficam as mensagens que pedem uma ação ou
confirmam algo: erros, "Endereço encontrado" / "Não achamos esse CEP", "Mínimo de R$ 80", o aviso de "a combinar" e o
contador da descrição. A regra de privacidade (candidato vê só bairro e cidade até a aprovação) não mudou: está no
produto, não precisava estar na tela.

## U03 — Cadastro de vaga e cards de "Minhas vagas" no padrão

Pedido do responsável depois de ver as telas no celular. **Publicar vaga:** sem a seta de voltar (o menu de baixo já
leva para fora; a edição de uma vaga continua com seta). O "1" e o "2" viraram um seletor em pílula, que troca de
tela; quem chega ao "Publicar" com erro na tela 1 volta para ela. Diárias, horário e pessoas saíram da tela 1 e foram
para a tela 2 ("Valor e pessoas"), junto com a validação (`validateStep2`). **Minhas vagas:** cada card é o mesmo
`JobTile` das outras listas (foto, avisos sobre a foto, linhas de bairro, data e valor); o que falta fazer virou avisos
na foto, e os trabalhadores aparecem como fotos redondas ao lado do valor. Vagas encerradas mantêm "Publicar de novo"
no canto. **Lixeira do perfil:** botão menor e avisos com espaço para ele não encostar.

## U04 — Cards sem pílulas; "Minhas vagas" com candidatos; valor da diária

Pedido do responsável: tirar as "bandeiras" (pílulas com status, Urgente, Impulsionada, "Sua vaga") de cima das fotos
em toda a plataforma. O ícone de salvar do mural continua (é uma função, não um aviso). Em "Minhas vagas": abas
**Todas · Abertas · Cheias** (as encerradas aparecem em Todas, com "Publicar de novo" no canto); o card mostra só o
título da vaga e, embaixo, até 3 fotos sobrepostas dos candidatos em aberto (aguardando ou contratados), com os
primeiros nomes e "e mais N candidatos" quando houver mais. Consequências a confirmar: o status da candidatura, que
ficava na pílula, agora aparece como texto embaixo do título em "Minhas candidaturas"; "Urgente" e "Impulsionada"
deixaram de aparecer na foto (a ordenação do mural não muda). **Passo 2:** "Valor da diária" virou um seletor
("Definir valor" / "A combinar") e um campo com "R$". **Passo 2 só abre com o passo 1 completo** (pílula ou "Continuar"),
e o erro aparece no passo 1.

## U05 — "Minhas vagas": fotos dos candidatos sem nomes, "e mais N"; borda que abraça a foto

Pedido do responsável. No card, embaixo do título, ficam até 3 fotos dos candidatos em aberto e, só quando há mais de
3, "e mais N" (N = os que não aparecem). Os nomes saíram (o leitor de tela ouve "N candidatos"). A borda branca das
fotos sobrepostas ficava num elemento por fora da foto e parecia maior que ela; agora é desenhada na própria foto
(`ring` em `components/Avatar.tsx`, padrão `AVATAR_BORDER`) e é mais fina (1,5 px).

## U06 — Sem "Encerrar vaga": só editar e excluir

Pedido do responsável: a construtora não quer mais encerrar a vaga à mão. Em "Sua vaga", uma vaga aberta ou cheia
mostra só **Editar vaga** e **Excluir vaga**. Saíram o botão, a confirmação "Encerrar essa vaga?", `closeJob` (demo e
real) e a RPC `close_job` (migration `u06_sem_encerrar_vaga`); a mensagem de "não dá para excluir" deixou de mandar
encerrar. **O que não saiu, de propósito:** a vaga **fechada** continua existindo, porque ela fecha sozinha quando a
equipe termina (Y01), quando o prazo passa (Y04) ou quando a conta da construtora é excluída. Por isso ficam o estado
"encerrada", a tela de resumo do bico (`/fechado/:id`, com "Ver resumo do bico" e as avaliações) e "Publicar de novo".
A regra da Y08 também fica: com gente escolhida ou contratada, a vaga não é excluída (o botão Excluir não aparece);
ela segue até fechar sozinha. Os testes que usavam o encerramento para chegar a uma vaga fechada passaram a fechá-la
pelo prazo ou direto no store (o teste "fechar torna as recusas definitivas" agora usa o prazo); continuam 217.

## U07 — Borda das fotos de perfil mais fina e igual no app todo

Pedido do responsável: a borda branca das fotos de perfil (candidato, trabalhador, construtora) levemente mais fina e
padronizada. Havia três espessuras: 4 px nos cabeçalhos dos perfis, 2 px no logo da construtora sobre a capa da vaga e
2 px nas fotos sobrepostas de "Minhas vagas". Agora todas têm **1,5 px**, definidos num lugar só
(`components/Avatar.tsx`: `AVATAR_BORDER` para a borda desenhada na foto e `AVATAR_FRAME` para a moldura em volta dela).
O tamanho de cada foto não mudou (o círculo do cabeçalho continua com 96 px, e a foto ganha o espaço que a borda
grossa ocupava). Fotos em listas, que não têm borda, continuam sem borda.

## U08 — "Valor da diária" refeito

Pedido do responsável: a pílula "Definir valor / A combinar" (U04) ficou feia e sem título. Agora o passo 2 abre com
um campo só, com título **Valor da diária**: o valor em letra grande entre "R$" e "por diária" (é o número que o
trabalhador mais olha) e "Mínimo de R$ 80" embaixo. "A combinar" virou um interruptor logo abaixo, **Combinar o valor
com o trabalhador**: ligado, o campo fica no lugar, apagado e escrito "A combinar" (nada pula na tela), com "No mural
aparece "A combinar"" embaixo; desligado, volta a pedir o valor. O erro de campo vazio passou a citar a escolha que
existe na tela ("ou escolha combinar com o trabalhador"). Regras, mínimo, máximo e o que vai para o banco não mudaram;
o campo mantém o id `create-job-valor` (usado pelo E2E).

## U09 — Telas de cadastro com a altura da tela e o botão sempre à vista

O responsável viu, no Android, o botão "Continuar" do cadastro escondido atrás dos botões do celular. Causa: as telas
usavam `min-h-screen` (`100vh`), e no celular `100vh` conta também a barra do navegador — a página ficava mais alta
que a área visível e o botão, que vinha no fim dela, saía da tela. Agora as telas de conseguir uma conta (escolher o
lado, cadastro, confirmar e-mail, completar perfil, completar cadastro do Google) usam um layout só
(`components/FlowLayout.tsx`): altura exata da área visível (`100dvh`, com `100vh` para navegador antigo), cabeçalho
em cima, só o meio rola e os botões ficam presos embaixo, acima dos botões do celular (`env(safe-area-inset-bottom)`,
que funciona porque o `index.html` já tem `viewport-fit=cover`). No tablet deitado e no computador continua um cartão
centralizado.

## U10 — E-mail, CPF/CNPJ e WhatsApp de uma conta só, conferidos no passo do cadastro

Pedido do responsável: quem digitava um CPF, CNPJ ou e-mail que já tinha conta só via o erro no fim, depois de
preencher tudo; e o WhatsApp podia se repetir entre contas. **O que mudou:** cada um desses passos pergunta ao servidor,
ao tocar em "Continuar", se o dado já é de outra conta, e para ali mesmo com a mensagem certa ("Esse CPF já tem conta
na Bicos…", com "Entrar na conta" e "Recuperar senha"). O WhatsApp passou a ser único no banco (índice
`accounts_whatsapp_key`), com a mesma regra do documento: um cadastro nunca confirmado libera o número; o de conta
confirmada é recusado — no cadastro, no cadastro pelo Google e na troca do número.
**O que pesou:** a Z07 escondia de propósito se um CPF tinha conta (perguntar isso permite descobrir quem usa a Bicos).
O responsável preferiu o aviso no passo. Para não virar uma consulta aberta, a pergunta passa por uma Edge Function
(`verificar-cadastro`) que só responde sim ou não, conta só contas confirmadas e limita a 30 perguntas por IP e 10 por
valor a cada 15 minutos (as mesmas tabelas do `entrar-com-documento`). O login continua com uma resposta só para "não
existe" e "senha errada". Os testes passaram a dar um celular diferente para cada conta de teste (SQL, E2E, volume).

## U11 — Confirmação de e-mail por código de 6 números

Pedido do responsável: confirmar o e-mail digitando um código, com um jeito simples de copiar do e-mail e colar no
app, e corrigir o e-mail digitado errado sem refazer o cadastro. **O e-mail** (`email-templates/confirmacao.html`,
assunto "Seu código de confirmação da Bicos"): o código grande, numa caixa que se seleciona inteira com um toque
(`user-select: all`), e também na prévia do e-mail — aparece na lista e na notificação do celular sem abrir.
Botão de "copiar" de verdade dentro do e-mail não existe: os programas de e-mail não rodam script; o toque que seleciona
tudo (e o "Copiar código" que o Gmail e o iPhone mostram sozinhos para códigos) é o equivalente. O link de um toque
continua como alternativa ("Prefere não digitar?"). **No app** (`/verificar-email`): seis caixas sobre um campo só, que
aceita colar o código de uma vez (até "Seu código: 123 456" vira 123456), o preenchimento automático do celular e o
botão **Colar código**; o sexto número já confirma (`verifyOtp`, tipo `email`) e a pessoa segue para completar o perfil.
"Reenviar código" a cada 1 minuto. **Corrigir e-mail** abre um campo na própria tela: o cadastro é refeito com o novo
endereço e os mesmos dados (que ficam só na memória enquanto o app está aberto; a senha nunca é gravada) e o código vai
para ele; a conta com o e-mail errado, nunca confirmada, libera o CPF/CNPJ e o WhatsApp para a nova (regra da Z07 e da
U10). Se o app foi recarregado e esses dados se perderam, "Corrigir" volta ao cadastro, como antes. **No login**, quem
acerta a senha de uma conta não confirmada digita o código ali mesmo. O campo de código saiu da tela do WhatsApp para
`components/CodeInput.tsx` (as duas usam o mesmo). `configurar-auth.mjs` passa a fixar o código em 6 números.

## U12 — Completar perfil numa tela só; sem ofício, especialidades e tipo de obra

Pedido do responsável: em vez de duas telas, uma só, com a capa, a foto de perfil (logo, para a construtora) e um
botão de **localização atual**; os outros campos saem da tela, do banco e de qualquer outro lugar. **A tela:** a capa
com a foto sobre o canto (como o perfil mostra), as duas opcionais; e "Usar minha localização atual"
(`components/CurrentLocationField.tsx`), obrigatória para concluir. O GPS dá o ponto e a cidade é o município mais
perto da lista do IBGE (`services/location.ts`); o ponto é guardado arredondado a 2 casas (~1 km), para mostrar bicos
perto sem guardar onde a pessoa mora. Se o celular não der a localização (não liberada, GPS desligado, computador
sem GPS), aparece "Escolher a cidade na lista" — só nesse caso, para ninguém ficar travado no cadastro. **O que saiu:**
o ofício principal e as especialidades do trabalhador e o tipo de obra da construtora — das telas (cadastro, edição
de perfil, perfil, listas de candidatos e trabalhadores, busca, área da equipe), dos dados de demonstração, das
colunas (`u12_perfil_simples`) e da política de privacidade (é menos dado; ninguém precisa aceitar de novo). Onde o
ofício aparecia ao lado do nome, fica a cidade/bairro; a avaliação passa a ser assinada "Jorge M.". **O que ficou:**
o ofício das vagas antigas (`jobs.oficio_id`, a U01 já tinha tirado da tela de publicar) e o do alerta de bico
(`job_alerts.oficio_id`), que não são do perfil.

## U13 — A localização do perfil vale no app todo

Pedido do responsável: o lugar salvo ao criar o perfil tem de ficar sempre salvo — o mural abre nele, e a construtora
já começa uma vaga nova nele —, mudando só em "Editar perfil"; os filtros continuam trocando a cidade quando quiser,
mas ao sair e voltar ao app volta o lugar salvo. **O erro de "sempre São Paulo"** tinha três causas: o completar perfil
começava com São Paulo marcado (a U12 tirou: a localização é obrigatória e vem do botão), o mural da construtora abria
sempre em São Paulo (fixo no código) e a vaga nova começava em São Paulo. **Agora:** `homeCity` (mural) usa a cidade do
perfil para os dois lados; a vaga nova (`emptyForm`) começa na cidade da construtora, e o CEP continua trocando a
cidade sozinho; em "Editar perfil" (trabalhador e construtora) a localização muda pelo mesmo botão "Usar minha
localização atual" (o trabalhador grava cidade e ponto). O filtro do mural já vivia só na memória: a cada entrada na
conta e a cada abertura do app ele volta ao lugar salvo — nada disso é gravado no aparelho. Se o lugar salvo não for
uma cidade da lista (dado antigo de demonstração), o mural abre na cidade padrão, nunca quebrado. **Contas antigas**
que ficaram com São Paulo continuam assim até a pessoa atualizar em Editar perfil (a produção só se mexe com "pode").

## U16 — Excluir a própria conta, com ou sem senha

Pedido do responsável: um botão para excluir a conta, que só sirva para a própria conta. A exclusão já existia (Y15),
mas ficava escondida em "Privacidade e dados" e **só funcionava com a senha** — quem criou a conta com o Google não tem
senha e não conseguia excluir. **Agora:** "Excluir minha conta" fica em Configurações, logo abaixo de "Sair da conta";
a tela pede a senha ou, para conta sem senha (e para quem esqueceu), um **código de 6 números enviado ao e-mail da
própria conta** (`sendSecurityCode`: `signInWithOtp` com `shouldCreateUser: false`; o código é conferido com
`verifyOtp` logo antes de excluir, o que renova o login como a `delete_my_account` exige). **Só a própria conta:** a
tela não recebe id nenhum — a Edge Function e a RPC pegam a conta do token da sessão, como antes. O e-mail do código
é o template "Magic link" do Supabase Auth, que o app não usava: virou "Seu código de segurança" (sem link — o código
só vale dentro do app, na conta já logada).

## U17 — "Copiar código" no e-mail

Pedido do responsável: no e-mail do código, um ícone que copie o código com um toque (o público pode não saber
copiar). **Um e-mail não roda nada** — nenhum programa de e-mail deixa um botão mexer na área de transferência. Então
o botão "📋 Copiar código" (nos dois e-mails de código: cadastro e segurança) é um link para a página da Bicos
`/copiar-codigo#123456`: ela copia sozinha quando o navegador deixa (o Chrome do Android, que é a maioria, deixa),
mostra "Código copiado", tem o botão "Copiar de novo" e o "Voltar para a Bicos", onde a pessoa toca em "Colar código".
O código vai **depois do `#`**, parte do endereço que não chega ao servidor nem aos registros, e a página tira o
código do endereço assim que lê (não fica no histórico). A página abre para qualquer um, logado ou não: só mostra o
que veio no próprio link. O endereço sai do `{{ .SiteURL }}` do Auth, que o `configurar-auth.mjs` grava com a barra
no fim.

## U18 — "Continuar com o Google" no cadastro

Pedido do responsável: o botão de entrar com o Google, profissional e funcionando, na tela de cadastro. O login com o
Google já existia (L13), mas só na tela de entrar, com um botão comum, e a tela de "Completar cadastro" depois do
Google era simples demais (lado em etiquetas, sem conferir CPF/WhatsApp repetidos). **Agora:** um `GoogleButton` no
padrão visual que o Google pede para o botão claro (fundo branco, borda #747775, o "G" colorido, "Continuar com o
Google"), no login, em "Criar minha conta" e no primeiro passo do cadastro. Quem sai do cadastro leva o lado já
escolhido (no armazenamento da aba, lido uma vez na volta); "Completar cadastro" abre com esse lado marcado, com o
nome que veio do Google, mostra o e-mail da conta Google, usa as mesmas regras e mensagens do cadastro por e-mail e
confere CPF/CNPJ e WhatsApp contra outras contas (U10) antes de criar. **Continua escondido** enquanto o Google não
estiver configurado (`FEATURES.googleLogin`): nenhum botão que não funcione. Para ligar: Client ID/Secret do Google
Cloud nas secrets `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` do GitHub — o `configurar-auth.mjs` liga o provedor no
staging e o site de teste passa a mostrar o botão sozinho; na produção, o provedor já é usado (há contas Google) e o
build do site precisa de `VITE_LOGIN_GOOGLE=1`. A demonstração não tem Google (não há OAuth sem servidor).

## U20 — O e-mail do código no jeito do GitHub

Pedido do responsável (com print): o código num cartão como o do GitHub/Gmail, com o botão "Copiar código" que reage
ao mouse e ao clique. **Agora**, nos dois e-mails de código: um cartão cinza "Código solicitado" com os 6 números em
caixas brancas (cada número sai do template com `{{ slice .Token i i+1 }}`, conferido com o `html/template` do Go,
que é o que o Supabase Auth usa) e o botão azul arredondado "Copiar código". O hover (azul mais escuro, sombra e
leve subida) e o clique (afunda um pouco) ficam num `<style>` no cabeçalho: valem onde o programa de e-mail aceita CSS
(Gmail no navegador, Apple Mail, Outlook.com); nos outros o botão aparece igual, só sem a animação. **Copiar de
verdade dentro do e-mail não é possível** (nenhum programa de e-mail roda código): o botão abre a página
`/copiar-codigo` (U17), que copia. Embaixo fica "Código: 735343" em texto inteiro — é o que o Gmail reconhece para
mostrar o próprio "Copiar código" dele (o cartão da print é do Gmail) e o que se copia segurando o dedo.

## U21 — Tema claro e escuro

Pedido do responsável: em Configurações, um botão-pílula com sol, lua e uma bola sobre o tema ativo, que rola para
o lado tocado; tema escuro profissional, que mantenha o azul principal. **Como funciona:** todas as cores das classes
Tailwind viraram variáveis (`tailwind.config.js` → `styles/tokens.css`); no tema claro os valores são exatamente os
hex de antes (nada muda), e `<html data-theme="dark">` troca os valores. A escolha fica no aparelho (`services/theme.ts`,
`localStorage`) e vale antes da primeira tela. **A paleta escura**, pensada a partir do azul #1D4BED (que continua nos
botões, seleções e na bola do botão): neutros de ardósia azulada (matiz ~220, o mesmo do azul) em vez de cinza puro,
para o azul "morar" nela — página #0D121B (a camada mais funda), cartões e campos #161C27, bordas #2B3343; texto
#F2F5F9/#D1D7E0/#A1ABBA; links e azul de texto #93ABFB; status verde/âmbar/vermelho clareados. Contraste conferido
par a par: corpo 11,8:1, secundário 7,4:1, links 7,7:1, status acima de 6:1 — igual ou melhor que o tema claro; branco
sobre os fundos sólidos ≥ 4,7:1. Onde uma cor tinha dois papéis (texto e fundo), entrou um token próprio
(`brand-hover`, `brand-press`, `brand-logo`, `accent-hover`, `danger-solid`, `ink`) com o mesmo valor no claro.
Superfícies brancas viraram `concrete-0`; o que é branco de verdade fica branco (texto sobre azul, pontos das fotos,
os QR codes do PIX, o botão do Google, que usa o padrão escuro do próprio Google). **O botão** (`ThemeToggle`): pílula
de 84 × 44 px, sol à esquerda e lua à direita apagados no trilho, e a bola (branca com sol dourado; azul com lua
branca) que anda 40 px dando uma volta inteira, com um leve passo além no fim; a seção "Aparência" fica entre Conta
e Preferências. Teclado e leitor de tela: dois botões de opção ("Tema claro", "Tema escuro"), setas trocam; sem
animação para quem pede menos movimento. O axe roda nas 14 telas também no escuro (CI).

## U25 — O código do e-mail se copia sem abrir outra página

Pedido do responsável: o botão "Copiar código" do e-mail abria outra página (a `/copiar-codigo` da U17) — ele quer
só clicar e copiar. **Não existe, em nenhum programa de e-mail, um botão que copie ao clicar:** Gmail, Outlook e Apple
Mail tiram qualquer código de dentro da mensagem; um "botão" num e-mail só pode ser um link, e link abre página. O
"Copiar código" do print é do **próprio Gmail**, que o põe sozinho quando reconhece um código de verificação. Então:
saiu o botão (e a página `/copiar-codigo`, que não tem mais uso); os 6 números ficam no cartão dentro de um único
trecho selecionável — um toque (no computador) ou segurar o dedo (no celular) seleciona o código inteiro, sem espaços,
pronto para "Copiar"; e a frase "Seu código de verificação da Bicos é 735343." deixa o código em texto corrido, o
formato que o Gmail reconhece para mostrar o "Copiar código" dele. No app continua o "Colar código" (U11).

## U22 — Escolher qualquer cidade em "Editar perfil"

Pedido do responsável: em "Editar perfil" (os dois lados), o lugar salvo não pode depender só da localização atual —
a pessoa escolhe qualquer cidade, do mesmo jeito do filtro do mural. **Agora** o campo é o mesmo botão "Cidade ·
Escolher" do filtro, que abre a mesma lista de todas as cidades do Brasil, com busca e "Usar minha localização"
(`components/ProfileLocationField.tsx`, montado com `LocationButton` + `CityPicker`). Cidade da lista: o ponto é o
centro dela; localização do celular: o município mais perto e o ponto arredondado (~1 km), como no cadastro. Fica
salvo no perfil (banco), então vale em toda abertura do app até ser trocado de novo; ao salvar, o mural volta a abrir
nessa cidade na hora (o estado do mural é refeito). O completar perfil do cadastro continua pedindo a localização
atual (U12).

## U24 — Excluir a conta apaga tudo o que é dela

Pedido do responsável: quando uma conta é excluída, tudo ligado a ela sai do banco e do app. Antes (Y15/R04) o perfil
ficava anonimizado ("Conta excluída") e o histórico ficava para o outro lado (avaliações sem nome, vagas encerradas e
ocultas). **Agora** (`u24_exclusao_completa`, a mesma `anonymize_account` que a exclusão pelo app e pelo painel já
chamam): construtora — todas as vagas que publicou, com candidaturas e seus eventos, vagas salvas, convites e
impulsionamentos, as avaliações que fez e recebeu, notificações, equipe e a empresa; trabalhador — todas as
candidaturas (sai de todos os bicos), vagas salvas, publicações, alertas, convites, identidade enviada, avaliações e
o perfil. Quem estava num bico em andamento com a conta continua sendo avisado antes, e a vaga do trabalhador que saiu
reabre. Para o outro lado não ficar com número errado, a nota (`recount_rating`) e os bicos feitos (`jobs_done`) são
refeitos sem o que saiu. Denúncias feitas pela conta saem com o login; as feitas sobre o perfil, as vagas e as
publicações dela também (não há mais o que moderar). Os arquivos já saíam pela `excluir-conta` e pela limpeza diária.
**Pontos para a empresa saber:** (1) um trabalhador perde a avaliação que recebeu de uma construtora que saiu — é o
efeito do pedido; (2) os pagamentos de impulso apagados continuam registrados no Mercado Pago (o comprovante fiscal
fica lá); se o contador pedir esse histórico também na Bicos, dá para guardar só os valores, sem a vaga. A política de
privacidade foi ajustada ("apagamos na hora … as avaliações que você fez e recebeu").

## U26 — O tema escuro é da conta e só existe dentro do app

Pedido do responsável: com o tema escuro ligado, ao sair ou excluir a conta o login e o cadastro ficavam escuros, e
outra conta no mesmo celular herdava o escuro. **Agora** (`services/theme.ts`): a escolha é guardada por conta
(`bicos-tema:<id da conta>` no aparelho) e o tema segue a sessão do app sozinho — escuro só com uma conta logada, com
e-mail confirmado e perfil completo, e só se **essa** conta escolheu o escuro. Login, cadastro, "Confirme seu e-mail",
"Completar perfil" e tudo depois de sair ficam sempre no tema original; outra conta começa no claro; a mesma conta,
ao entrar de novo, volta no escuro. Excluir a conta apaga a escolha dela. A escolha antiga da U21 (uma só para o
aparelho) é descartada. Sem armazenamento (janela anônima), a escolha vale até fechar o app.

## U27 — O "Copiar código" do Gmail no e-mail da Bicos

Pedido do responsável (com print do GitHub no Gmail): um botão que copie o código num clique, sem abrir página. **O que
o print mostra é do Gmail, não do e-mail do GitHub**: o cartão "Código solicitado" com "Copiar código" (e o aviso
"Com base neste e-mail") é um recurso que o Gmail lançou em setembro de 2026 e mostra quando reconhece um código de
verificação. Nenhum e-mail consegue ter um botão próprio que copie — os programas de e-mail não rodam código. Então o
e-mail da Bicos segue o formato que o Gmail reconhece, o mesmo desses remetentes: assunto "Seu código de verificação
da Bicos" (os dois e-mails de código), o código como **um número inteiro** (as caixas separadas da U25 atrapalhavam o
reconhecimento) e a frase "Seu código de verificação da Bicos é 735343." na prévia e no corpo. **Não depende só de
nós:** o Gmail decide quando mostrar, e confia mais em remetente com domínio autenticado (SPF/DKIM/DMARC do
`nivotech.com.br` na Brevo — CHECKLIST L04). Onde o Gmail não mostrar, o número se seleciona inteiro com um toque.
Fontes: androidpolice.com e ghacks.net (set/2026) sobre o recurso.

## U28 — Entrar com o Google e com o celular pelo Firebase

Pedido do responsável (com o projeto Firebase `bicoapp-6cc68`): os botões do Google e do telefone funcionando no
cadastro e no login. **Como ficou:** o Firebase Authentication faz a parte que só ele faz bem e de graça para começar —
a janela do Google, o código por SMS e o reCAPTCHA invisível contra robôs — e devolve um ID token; a nova Edge
Function `entrar-com-firebase` confere esse token (assinatura RS256 com as chaves públicas do Firebase, projeto,
validade e login de no máximo 10 minutos — `_shared/firebase.ts`, sem biblioteca) e abre a sessão da Bicos no Supabase
Auth, onde as contas, regras e RLS continuam iguais. A sessão sai de um link de acesso gerado no servidor (nada vai
por e-mail) que o app troca pela sessão com `verifyOtp`; o Firebase sai logo em seguida, sem guardar sessão própria.
**Google:** entra na conta do e-mail confirmado pelo Google; sem conta, cria o login (marcado `via: firebase`) e o app
segue para "Completar cadastro" com o lado já escolhido (U18). **Celular:** "Continuar com o celular" → número → código
por SMS → entra na conta cujo WhatsApp é esse número (e marca o WhatsApp como confirmado); sem conta com o número, o
app oferece criar a conta e o cadastro já começa com o número preenchido. **Por que não mover as contas para o
Firebase:** todo o banco (contas, vagas, RLS, 40+ RPCs) é do Supabase; o Firebase entra só como "porteiro" do Google e
do SMS. **Peso:** só `@firebase/app` + `@firebase/auth` (o pacote `firebase` inteiro trazia o Firestore, que o app não
usa, com 4 alertas de segurança do `@grpc/grpc-js`), carregados só ao tocar no botão (36 KB; o app inicial cresceu
0,7 KB). **Sem Analytics:** o `getAnalytics` do exemplo do Firebase não entrou — a política de privacidade não prevê
rastreamento e a LGPD pediria consentimento. Os identificadores da configuração web (apiKey, appId…) são públicos por
natureza; a segurança está na conferência do token e nos domínios autorizados do console. CSP ajustada (Firebase e
reCAPTCHA). Botões só aparecem com o Firebase configurado no build (`VITE_FIREBASE_*`).

## U29 — A janela do Google abre dentro do toque

O responsável ligou o Google no Firebase e autorizou os domínios (conferido pela configuração pública do projeto),
mas o botão não funcionava: os registros do staging mostram que a `entrar-com-firebase` nunca foi chamada pelo
navegador. Causa: o app só carregava o SDK do Firebase **depois** do toque, e o navegador só deixa uma página abrir uma
janela (a do Google) dentro do próprio toque — depois de esperar o carregamento, ele bloqueia como propaganda.
**Agora** o Firebase é preparado assim que abre uma tela com os botões (login, "Criar minha conta", 1º passo do
cadastro, celular — `prepareSocialSignIn`), e no toque a janela abre na hora, sem nada esperado antes (teste
`firebaseSignIn`). Continua fora do pacote inicial: só baixa quando essas telas abrem. **SMS:** o Firebase respondeu
"SMS unable to be sent until this region enabled" — falta liberar o Brasil na política de regiões de SMS do console
(ação do responsável).

## U30 — O tema fica no banco: o mesmo em todo aparelho, trocado ao vivo

Pedido do responsável: a mesma conta aberta em dois navegadores e no celular ficava com temas diferentes, mesmo
atualizando. Causa: a U26 guardava a escolha no armazenamento **de cada aparelho**. **Agora** a escolha é da conta, no
banco (`u30_tema_da_conta`): tabela `account_prefs` (uma linha por conta, RLS: cada conta lê só a sua) e RPC
`set_my_theme`. Ao entrar, o app lê o tema junto com a conta (e guarda no cache da conta, para a primeira tela já
abrir certa); ao trocar, a tela muda na hora e o servidor grava — se não gravar, a tela volta e avisa (nunca um tema
aqui e outro no banco); os outros aparelhos abertos recebem a troca **ao vivo** pelo mesmo canal Realtime das
notificações e, se o canal tiver caído, ao voltar para a tela. A escolha antiga guardada nos aparelhos (U21/U26) é
apagada. Continua valendo da U26: escuro só dentro do app; login e cadastro sempre no tema original. A exclusão da
conta leva a linha junto (cascade). Por que tabela própria e não coluna em `accounts`: `accounts` tem permissão por
coluna e não está no Realtime; uma tabela pequena só de preferências entra no Realtime sem expor nada da conta.

## U32/U33/U34 — Descrição nos dois perfis, experiências no lugar dos números

Pedido do responsável: os dois perfis com uma descrição escrita pela própria pessoa; tirar do trabalhador "dias que
você pode", "anos de experiência", "diária que você pede" e "até onde você vai" — da tela **e do banco** — e pôr no
lugar uma lista de experiências (até 10, com limite de caracteres em cada uma, sem textão colado).
**Feito**: migration `u32_perfis` apaga as quatro colunas (e o check delas), cria `workers.experiences` (até 10 itens
de 2 a 80 caracteres, sem espaço nas pontas — regra numa função `valid_experiences` usada no check) e
`companies.about` (até 500); a bio do trabalhador sobe de 280 para 500. As regras ficam em `utils/profileText.ts`
(as mesmas nos dois modos) e o banco confere de novo. No app: "Sobre você" e "Sobre a empresa" com contador
(`AboutField`, o campo corta o que passar de 500, inclusive colado); "Suas experiências" com uma linha por
experiência (o campo corta em 80, quebra de linha vira espaço, Enter abre a próxima linha, lixeira em cada uma, aviso
ao chegar em 10; linhas vazias e repetidas somem ao salvar). Os perfis mostram "Sobre"/"Sobre a empresa" e
"Experiências" em blocos com título; o próprio dono vê um convite para preencher enquanto estiver vazio. Faltas e
desistências continuam visíveis para construtoras e para a própria pessoa. **Por que 80 e 10**: uma linha cabe na
tela do celular e lê-se de relance; 10 é o bastante para mostrar a trajetória sem virar currículo. **Por que apagar
as colunas** (e não só esconder): pedido explícito; na produção só há 1 trabalhador e ele não preencheu esses campos
— mesmo assim, backup manual antes (APLICAR #53).

## U35 — Minhas candidaturas: a situação de volta em cima da foto, e a descrição da vaga

Pedido do responsável: voltar com as "bandeiras" da situação em cima da imagem das vagas em "Minhas candidaturas" e
mostrar a descrição da vaga. A U04 tinha tirado toda pílula das fotos (e a situação virou texto embaixo do título).
**Agora** só nessa tela o card volta a ter a situação no canto de cima da foto (`JobTile` › `badge`: ícone colorido pelo
tom — análise, pré-selecionado, avaliar, não foi essa vez…; cinza quando encerrada, mas fora do cinza da foto para
continuar legível) e, embaixo do título, a descrição da vaga em até duas linhas e o valor da diária. Vaga antiga sem
descrição mostra bairro e data no lugar, para todos os cards terem a mesma altura. O mural continua sem pílulas (U04).

## U36 — Fotos reais nas 10 vagas de teste do staging

Pedido do responsável: fotos bonitas e reais nas vagas de teste (BC-5071 a BC-5080, só no staging). A rede desta
sessão não alcança bancos de imagem, então o workflow manual `staging-fotos` faz o trabalho
(`scripts/staging/fotos-vagas-teste.mjs`): só fotos **CC0 ou domínio público** do Wikimedia Commons (uso livre, sem
crédito obrigatório), em paisagem, já em 1280 px, enviadas ao bucket `vagas` na pasta da construtora de teste. A busca
automática errou nas primeiras rodadas (pintura de museu, astronauta "Foreman", adaptador de videogame), então as duas
fotos de cada vaga foram **escolhidas à mão** entre as candidatas que o modo `ensaio` lista; a busca fica só de
reserva, exigindo a palavra do ofício no nome do arquivo e barrando pintura, acervo histórico e militar. Cada rodada
grava com nome novo (sem foto velha no cache). O script recusa a produção.

## U37 — Cadastro com o Google pelo cadastro normal (sem e-mail e sem confirmação)

Pedido do responsável: o Google entrava na conta, mas não criava conta. Causa (vista no registro do staging): a
função `entrar-com-firebase` criava o login certinho, mas o app mandava a pessoa para uma tela separada ("Completar
cadastro") por um caminho frágil — o erro "conta não encontrada" era engolido e a ida para a tela dependia de um evento
do Auth que nem sempre chegava a tempo; a conta nunca era criada. **Agora** a troca do token devolve, para um login do
Google sem conta, o e-mail e o nome dele, e o app segue de forma determinística para o **mesmo cadastro passo a passo**
de todo mundo: o lado escolhido antes (ou "Como você vai usar o Bicos?" quando veio do login), nome (já preenchido com
o do Google, editável), CPF/CNPJ, WhatsApp (com código, quando ligado), senha, 18+ e termos — só saem o passo do
e-mail e a confirmação dele, porque o Google já confirmou o e-mail. Em todos os passos, um cartão mostra a conta do
Google, "E-mail confirmado pelo Google" e "Trocar" (sai do login do Google e volta ao cadastro com e-mail, sem perder
as respostas). No fim: a senha é gravada no login (assim a conta também entra por CPF/CNPJ ou e-mail e senha) e a
conta nasce pelo `create_my_account` (as mesmas regras do cadastro por e-mail), já com o e-mail confirmado, indo direto
para "Completar perfil". O lado escolhido fica guardado na aba até a conta existir, então recarregar a página no meio
não perde nada. A tela "Completar cadastro" (L13) saiu; o endereço antigo só redireciona. No banco
(`u37_cadastro_google`): um login do Google que nunca terminou o cadastro é apagado depois de 7 dias, como o cadastro
por e-mail nunca confirmado (contas do app antigo com perfil preenchido ficam).

## U38 — Experiências em pílulas

Pedido do responsável: o campo de experiências ocupava dez linhas. **Agora** são pílulas: um campo só adiciona (Enter
ou o botão "+"), cada experiência vira uma pílula com "×" para tirar (com "Desfazer" na mensagem, para um toque errado
não perder nada) e um toque na pílula a traz de volta ao campo para corrigir (✓ salva, Esc cancela). Sair do campo com
algo escrito já guarda. O contador "n de 10" fica no título; o de letras só aparece perto do limite de 80; repetida e
curta demais avisam na hora; ao chegar em 10 o campo dá lugar ao aviso. O perfil mostra as experiências nas mesmas
pílulas. Arrastar para reordenar ficou de fora: a ordem é a de inclusão, e o "×" já é o jeito mais rápido de tirar.

## U39 — Só o Google como outro jeito de entrar

Pedido do responsável: tirar o botão de entrar com o telefone do login. Saiu do login e também de "Criar minha conta"
e do 1º passo do cadastro, para não ficar um jeito de entrar numa tela e não na outra (o envio de SMS ainda depende de
liberar o Brasil no Firebase). A tela `/entrar-celular` continua no código, sem botão, para quando o SMS for ligado.

## U40 — Cadastro com o Google igual ao cadastro normal

Pedido do responsável: a tela de cadastro com o Google "não deve ser diferente da tela de cadastro normal". O registro
do staging mostrou que o fluxo do U37 funcionava, mas o cartão "E-mail confirmado pelo Google" com o "Trocar" deixava
a tela diferente e, tocado, desfazia o login do Google (aconteceu nas duas tentativas). **Agora** as telas são as
mesmas, na mesma ordem: só saem o passo do e-mail, a confirmação dele e o botão do Google; o nome do Google já vem no
campo. Voltar até o login (ou "Entrar na conta" com o CPF/WhatsApp de outra conta) encerra o login do Google pendente,
para nada ficar preso. No fim, a sessão da conta nova espera qualquer leitura anterior terminar — o evento da senha
gravada dispara uma leitura que podia responder "sem conta" antes de a conta existir. Plano: `docs/PLANO-CADASTRO.md`.

## U41 — Telas de cadastro sem rolagem

Pedido do responsável: nenhuma tela de cadastro pode rolar. Medição antes: a escolha do lado, a senha (até 146 px a
mais), o código do WhatsApp, a confirmação do e-mail, o completar perfil e o login rolavam num Android pequeno
(360×600, com a barra do navegador) e alguns também num iPhone (390×664). **Agora** todas cabem, de 360×600 ao
computador, inclusive com as mensagens de erro: a estrutura fixa (`FlowLayout`) ganhou a variante `short:` do
Tailwind (tela até 719 px de altura), que aperta espaços, título e ajuda sem tirar nada; a senha virou um campo só,
com o olho para ver o que foi digitado ("repita a senha" saiu — com o olho ela não evita erro nenhum e era o que mais
ocupava), com a força numa linha e os dois aceites com os links dentro do próprio texto; o CPF/CNPJ recusado pelo
servidor virou a mensagem do campo com "Entrar na conta"/"Recuperar senha" (sem o cartão vermelho grande); "Sair e
entrar com outra conta" virou um "Sair" no topo da confirmação do e-mail e do completar perfil; o login ficou fixo,
com "Esqueci minha senha" junto da senha e "Não tem conta? Criar minha conta" no pé. O meio só rola como último
recurso (aparelho menor que 360×600 ou letra gigante), para nenhum campo ficar inalcançável. De quebra: o aviso
"Demonstração: qualquer código confirma" do código do WhatsApp aparecia também fora da demonstração.

## U42 — Testes do cadastro: sem rolagem no CI e o Google de ponta a ponta no staging

Para o U40/U41 não voltarem atrás sem ninguém ver: `scripts/sem-rolagem.mjs` roda no CI (junto da acessibilidade) e
percorre o cadastro inteiro da demonstração — escolha do lado, todos os passos do trabalhador e da construtora,
código do WhatsApp, senha e aceites, confirmação do e-mail e completar perfil, mais os estados de erro que aumentam a
tela — a 360×600, 390×664 e no computador; falha se qualquer tela rolar (78 telas hoje). E o E2E do staging ganhou o
fluxo 8 (`08-cadastro-google`): a janela do Google não abre em robô, então o teste começa logo depois dela — um login
com o e-mail confirmado pelo Google e sem conta, o que `entrar-com-firebase` cria — e confere a escolha do lado sem o
botão do Google, o nome já preenchido, "Passo 1 de 4" sem o passo do e-mail, a conta criada no banco com o e-mail
confirmado, "Completar perfil" e o mural, a senha entrando sozinha, e que login, escolha do lado e cada passo não rolam
no celular do teste e a 360×600. O build do E2E passou a ter os identificadores públicos do Firebase (os mesmos do site
de teste), para o botão do Google aparecer como no site.

## U43 — Trocar o e-mail na própria tela do código

Problema relatado: na tela "Confirme seu e-mail", tocar em "Corrigir" para arrumar um e-mail digitado errado levava
de volta ao login. A causa era o "Sair" do topo (U41): a área de toque maior (`tap-target`, um `::after` invisível)
não tinha um elemento posicionado por perto e cresceu até cobrir a tela — o toque em "Corrigir" caía no "Sair". E,
quando o cadastro não estava mais na memória, "Corrigir" mandava refazer o cadastro. **Agora** o "Sair" e o botão de
experiências têm `relative` (e um teste varre o código: todo `tap-target` precisa estar posicionado), e "Trocar"
abre o e-mail ali mesmo, já preenchido com o cursor no fim; "Enviar código para esse e-mail" refaz o cadastro com o
endereço novo (os mesmos dados, guardados só na memória) e o código vai para ele na mesma hora — sem sair da tela e
sem perguntar nada de novo. O cartão passa a dizer "Enviado agora para <novo e-mail>", o tempo para pedir outro
código recomeça e o campo do código ganha o foco. Erros (e-mail inválido, o mesmo de antes, já tem conta, muitas
tentativas) aparecem embaixo do campo; nunca há navegação. A checagem de rolagem do CI passou a cobrir a troca (com um
e-mail que já tem conta e depois o código no novo).

## U44 — A engrenagem do perfil abre Configurações direto

Pedido do responsável: tocar na engrenagem do perfil (no celular) abria uma janelinha com o menu da conta; agora abre
a página Configurações de uma vez, e a seta de voltar de lá volta ao perfil. Nada se perdeu com a janelinha: o sino
das notificações fica no topo do mural, as vagas salvas em Minhas candidaturas, os bicos fechados na aba Encerradas
de Minhas vagas, e Ajuda e "Sair da conta" em Configurações. No computador continua o menu da conta no topo.

## U45 — "Carregando" que trava a tela, e o voltar do celular no cadastro

Problema relatado: tocar em "Continuar com o Google" não mostrava nada até a janela do Google aparecer e, depois de
escolher a conta, havia uma demora em que dava para mexer em tudo no login, sem nenhum sinal de carregamento — e o
avançar/voltar do cadastro com o Google tinha inconsistências. **Agora** há um bloqueio único para o app inteiro
(`services/busy.ts` + `components/BusyOverlay.tsx`): enquanto algo que a pessoa pediu está carregando, nenhum toque,
nenhuma tecla e nenhum "voltar" do celular chegam ao app.

- **Google**: do toque até a próxima tela aparece um cartão por cima da tela escurecida — "Esperando o Google…" ("Escolha
  sua conta na janela do Google", com **Cancelar**, para quem fechou a janela: o Firebase demora até ~18 s para notar a
  janela fechada) e, assim que a conta é escolhida, "Entrando na sua conta…". O app por trás fica `inert`. O cartão só sai
  depois que a próxima tela foi desenhada (sem piscar o login no meio). Se a pessoa cancelou, o que a janela responder
  depois é ignorado (sem entrar, sem erro). Um segundo toque enquanto carrega não faz nada.
- **Botões** (Continuar, Entrar, Criar minha conta, confirmar e trocar o e-mail, concluir perfil): uma camada invisível
  segura os toques enquanto o botão mostra o próprio "girando" (`useBusyWhile`). Ela não tira o foco do campo, para o
  teclado do celular não fechar entre os passos. O captcha, quando ligado, fica acima dela.
- **Nunca trava para sempre**: cada bloqueio termina sozinho (30 s nos botões, 10 min com a janela do Google aberta e
  o Cancelar sempre à mão).
- **Voltar do celular = voltar do app**: o roteador guarda em cada entrada do histórico de onde ela veio e o tamanho da
  pilha de volta; a seta do app passa a usar o voltar do próprio navegador quando a tela anterior é a mesma (antes ela
  trocava a entrada atual, e o voltar do celular depois disso repetia telas), e o voltar do celular mantém a pilha
  certa. No cadastro, o voltar do celular volta **uma pergunta** (antes saía do cadastro e perdia tudo o que foi
  digitado): enquanto há pergunta anterior, uma entrada extra fica no topo do histórico (`holdBack`, uma só — não
  uma por pergunta). Com "Trocar e-mail" aberto, o voltar fecha o editor.
- **Google sem conta**: de "Como você vai usar o Bicos?" o cadastro abre por cima (a seta volta para a escolha do lado,
  como no cadastro normal); voltar até o login pelo botão do celular também desfaz o login do Google pendente, como a
  seta do app já fazia (U40).

## U46 — Entrar com o Google mais rápido

Pedido do responsável: o carregamento do Google demorava muito. Para onde ia o tempo, depois de escolher a conta:
a função `entrar-com-firebase` "fria" (subindo do zero: 1,1–2,5 s medidos no staging), uma ida e volta a mais em toda
chamada de função (o navegador repetia a permissão de CORS — o "preflight" — porque ela não dizia por quanto tempo
vale), e, numa conta nova, três leituras que só respondiam "não tem conta". Antes de a janela abrir, no computador, o
Firebase ainda carregava o quadro auxiliar do Google só no primeiro toque. **Agora**:

- **Acordar a função**: quando abre uma tela com o botão do Google, o app manda `{ aquecer: true }` (no máximo uma vez a
  cada 3 minutos). A função responde 204 na hora, sem ler nem criar nada (não conta no limite de tentativas), e já
  busca as chaves públicas do Firebase. O toque de verdade encontra a função de pé.
- **Permissão de CORS guardada por 2 horas** (`Access-Control-Max-Age: 7200`, o máximo do Chrome) em todas as funções
  chamadas pelo navegador: some o OPTIONS antes de cada chamada — também em cada passo conferido do cadastro (CPF,
  e-mail, WhatsApp).
- **Na função**: o limite de tentativas e a conferência do token rodam ao mesmo tempo (as respostas continuam na mesma
  ordem), e a resposta diz se o e-mail já tem conta (`conta`). Sem conta, o app vai direto para o cadastro, sem as
  leituras inúteis. A checagem da sessão continua rodando por trás, então uma conta antiga do app legado ainda entra.
- **No app**: o Firebase começa só na memória (`initializeAuth` com `inMemoryPersistence` — ele não guarda nada, a
  sessão é a da Bicos), sem abrir o IndexedDB; a saída do Firebase não é mais esperada; no computador, o quadro do
  Google carrega quando a tela abre (o celular e o Safari já faziam isso), então a janela abre sem essa espera; e, ao
  entrar, o tema e o perfil são lidos juntos (uma ida e volta a menos para qualquer login).
- **Produção** (ação com "pode"): as funções da produção só ganham isso quando forem republicadas.

## U47 — Menu de baixo do celular com ícone e nome, e transição de tela

Pedido do responsável (com uma print de referência): no celular, o menu de baixo com cada aba sendo o ícone e, embaixo
dele, o nome da página, numa pílula mais "gordinha", mantendo a cor, a meia transparência e o desfoque do nosso. **Agora**
a barra tem 68 px de altura e uma aba de ~90 px para cada página (ícone de 22 px + nome); a aba aberta fica sobre uma
pílula azul (a cor da marca) que **desliza** até a aba tocada (440 ms, a mesma curva suave do menu do computador), e o
ícone e o nome ficam brancos quando ela chega. A barra continua com a superfície translúcida e desfocada (clara ou
escura, conforme o tema) e cabe a partir de 360 px de largura. "Minhas" virou "Candidaturas" (com o nome embaixo, o
texto precisa se explicar sozinho); "Vagas" e "Início" ganharam ícones de público geral (maleta e casa).

**Transição de tela**: entre as abas do menu, a tela nova entra deslizando 20 px do lado da aba (direita ou esquerda) com
um esmaecer, em 320 ms; nas outras telas, só esmaece (220 ms). Só esmaecer ali porque deslizar move a tela inteira, e uma
barra presa no pé dela ("Quero esse bico") seria arrastada junto enquanto dura. A primeira tela da visita não anima (nada
de atrasar a primeira pintura) e quem pediu menos movimento no celular não vê animação.

## U49 — Busca do mural só por vagas: serviço, bairro ou cidade

Pedido do responsável: o campo de busca da tela inicial só pode buscar vagas — pelo serviço, pelo bairro ou pela
cidade — nunca o trabalhador, a empresa ou qualquer pessoa; buscar um bairro ou uma cidade tem que trazer as vagas de
lá, e sem vaga tem que dizer que não existe vaga para aquela busca. Antes, a busca também achava empresas e (para quem
contrata) trabalhadores pelo nome, achava vagas pelo nome da empresa, e ficava presa na cidade do mural — digitar o
nome de outra cidade não achava nada. **Agora** (a mesma regra no servidor, migration `u49` › `feed_jobs`, e no app,
`feedUI.searchMatches`):

- Cada palavra digitada precisa estar na vaga — no serviço (o título ou o ofício, com sinônimos), no bairro ou na
  cidade —, sem diferença de acento nem de maiúscula; palavras de ligação ("de", "em", "para"…) não contam. Assim
  "garçom centro" acha garçom no Centro, e "cozinha em caxias do sul" acha cozinha em Caxias.
- A busca fica na cidade escolhida no mural ("Buscando em …", com "Buscar em todas as cidades"), mas quem digita o
  nome de outra cidade (ou o começo, a partir de 4 letras: com menos, "gar" de "garçom" puxaria Garibaldi) acha as
  vagas de lá. O bairro fica na cidade do mural (há "Centro" em toda cidade).
- Durante a busca, os filtros (distância, quando, ofício) não valem — a tela da busca não os mostra.
- Nome de empresa ou de pessoa não acha nada. Sem vaga: "Nenhuma vaga para “…”", dizendo onde se buscou, e "Limpar
  busca". O campo diz "Buscar por serviço, bairro ou cidade" para os dois lados.

## U48 — Público geral: nenhum texto ou ícone de construção

Pedido do responsável: a Bicos deixa de ser só para construtoras e pedreiros — é para o público geral, quem procura
bico e empresas ou pessoas que contratam qualquer serviço. Mudar **só textos e ícones**, no app inteiro, sem deixar
nenhuma palavra ou ícone do nicho de construção. **Agora**:

- **Vocabulário**: "construtora" → "empresa" (ou "quem contrata" nos termos, porque pessoa física também contrata);
  "obra" → "serviço"/"local do serviço"; "diárias de obra" → "bicos e diárias"; exemplos e placeholders de serviços
  gerais ("Garçom para evento de sábado"); "Quero pegar bico — Procuro bicos e diárias perto de mim" e "Quero contratar
  — Tenho uma empresa ou preciso de alguém para um serviço"; "Qualquer serviço" nos alertas.
- **Ícones**: a marca (logo, ícone do app, favicon e a imagem de prévia do link) trocou o martelo por uma **maleta**; as
  abas e os estados vazios usam maleta/casa/prédio; as capas ilustradas das vagas sem foto são de serviços gerais
  (limpeza, cozinha e garçom, eventos, entregas, estoque, jardim, cuidados, crianças, pets, beleza, roupa, carro,
  informática, aulas, loja, ajudante; padrão: maleta). Os ícones de obra saíram do conjunto (martelo, capacete, tijolo,
  pá, rolo de pintura, tomada, gotas, régua, cone) e entraram os novos, da mesma família Lucide.
- **Servidor** (migration `u48`, **produção só com "pode"**): as mensagens de erro, os avisos e as etiquetas das
  avaliações que o banco manda para a tela ("EPI no local" → "Local seguro", "Usou EPI" → "Cuidadoso") — 13 funções, só
  o texto, conferidas uma a uma com o staging antes; e "Construtora (conta excluída)" → "Empresa (conta excluída)" nos
  registros antigos. Edge Function `verificar-cnpj`, os 4 e-mails ("bicos e diárias"), título e descrição da página, o
  manifesto do app e os textos legais (termos e política, que ainda são rascunho para o advogado — a versão não mudou,
  então ninguém precisa aceitar de novo; quando o advogado revisar, decidir se sobe a versão).
- **Lista de serviços** (`data/oficios.ts`, que dá nome às vagas sem título e os sinônimos da busca): garçom, cozinha,
  limpeza, eventos, mudança, entregas, estoque, vendas, jardinagem, cuidador, babá, beleza, lavagem de carro, ajudante
  geral. A tabela `oficios` do banco não mudou (só vagas antigas a usam; as novas não têm ofício desde o U01).
- **Demonstração**: empresas, perfis, vagas, avaliações e avisos da demonstração viraram serviços gerais (ids, valores e
  datas iguais); as fotos de obra da demonstração saíram (as vagas mostram a capa ilustrada) e o login de demonstração
  da empresa é `empresa@bicos.demo`.
- **Staging**: as 10 vagas de teste viraram serviços gerais nos mesmos bairros de Caxias (garçom, cozinha, faxina,
  recepção, mudança, mercado, jardim, cuidadora, panfletos, loja) e a empresa de teste virou "Empresa Serra Gaúcha
  (teste)"; as fotos novas saem do workflow `staging-fotos` (buscas de serviços gerais, foto de obra recusada).
- **O que não mudou** (não aparece para ninguém, e mudar quebraria dados e links): os nomes internos — papel
  `recrutador`, lado `construtora` da candidatura, `para_construtora`, `cancelado_pela_construtora` — e o endereço
  `/construtora/<id>` do perfil da empresa (links já compartilhados continuam abrindo).

## U50 — Menu de baixo simples, sem brilho e sem sair do lugar

Pedido do responsável: o menu de baixo do celular estava "brilhando" e feio, saía da posição ao trocar de tela, e na
conta de trabalhador a pílula de "Candidaturas" ficava colada nas letras. **Agora**:

- **Simples**: uma barra na cor normal da superfície (branca no tema claro, a do cartão no escuro), borda fina e uma
  sombra leve — sem vidro, sem desfoque, sem brilho e sem gradiente. A aba aberta fica numa pílula azul-clara com o ícone
  e o nome em azul; as outras em cinza. O nome tem sempre o mesmo peso (negrito na aba aberta deixava o nome mais largo
  e empurrava as abas a cada troca).
- **Não sai do lugar**: a causa era a tela nova entrar deslizando de lado — no celular isso alargava a página por um
  instante e a barra fixa no pé acompanhava; e a pílula que deslizava de onde estava podia ficar no lugar velho. A tela
  nova agora só esmaece (180 ms, nada se move), a página nunca fica mais larga que a tela (`overflow-x: clip` na moldura
  do app), a barra é centralizada por margem (sem `translate` de meio pixel) e a pílula é desenhada na própria aba. Medido
  em 360, 390 e 412 px, trocando de aba duas voltas e abrindo/voltando de uma vaga: mesma posição em todas as telas.
- **Folga do nome**: cada aba tem a largura do seu nome mais uma parte igual do espaço que sobra, então "Candidaturas"
  ganha a mesma folga das abas curtas (28 px de cada lado a 360 px, antes 13 px). Vale para as duas contas (na de empresa
  os nomes são parecidos e quase nada muda).

## U51 — Endereço com CEP inteligente e distância de verdade até cada bico

Pedido do responsável: no cadastro (trabalhador e empresa) uma tela de endereço — CEP, rua, bairro e cidade —, com o
CEP se preenchendo sozinho quando a pessoa não sabe, sugestões reais enquanto digita (para não errar a rua) e, em todo
bico, a distância em metros ou km da casa do trabalhador, "o mais preciso possível", com o melhor provedor gratuito;
editar em Editar perfil; tirar o "Usar minha localização atual" do cadastro e do perfil dos dois lados. **Agora**:

- **Cadastro**: "Completar perfil" tem dois passos — primeiro **"Seu endereço"** ("Endereço da empresa"), depois capa e
  foto. Campos: CEP e cidade lado a lado, rua, bairro (só esses). O CEP preenche o resto; sem CEP, a cidade vem da lista
  do IBGE (no aparelho, na hora), a rua vem da lista dos Correios — cada sugestão com o bairro e o CEP —, e escolher a
  rua preenche o CEP. Digitar sem escolher também vale: no "Continuar" o app confere tudo e acha o CEP pela rua e pelo
  bairro. Cabe sem rolar num celular pequeno, inclusive com todos os campos apontando erro.
- **Editar perfil** (os dois lados): o mesmo bloco de endereço no lugar do botão de localização; só é conferido e salvo
  se mudou. O botão "Usar minha localização atual" e a tela de cidades por GPS saíram do cadastro e do perfil (o mural
  ainda tem o seu, para ver bicos perto de onde a pessoa está agora).
- **Provedores (todos gratuitos, sem chave, direto do celular)**: CEP → BrasilAPI (que muitas vezes traz o ponto do
  CEP) e ViaCEP; ruas → **ViaCEP, a busca por endereço com os dados dos Correios** (o CEP certo de cada rua e trecho;
  Photon/OpenStreetMap se o ViaCEP cair); bairros → Photon (OpenStreetMap) + os bairros das ruas sugeridas; o ponto no
  mapa → **Nominatim (OpenStreetMap)**, escolhendo o trecho da rua no bairro digitado (ruas longas têm vários), depois
  Photon, depois o ponto do CEP, depois o centro da cidade — e guardamos até onde chegou (`precision`: número, rua, CEP,
  bairro ou cidade). Por que esses: são os únicos bons de verdade que não pedem cartão nem chave; Google Maps seria o
  mais preciso por casa, mas exige conta com cartão (fica como troca futura, num arquivo só:
  `services/remote/address.ts`). Testados ao vivo em Caxias: o Nominatim acha a Rua Sinimbu em cada bairro com CEP e
  bairro certos; o AwesomeAPI (CEP com ponto) recusou por cota e ficou de fora. O Nominatim é chamado **uma vez por
  endereço salvo**, nunca enquanto digita (é a regra de uso dele); o que chega fica guardado na sessão. O mapa do
  OpenStreetMap é creditado na lista de sugestões que vem dele.
- **Privacidade**: o endereço fica numa tabela nova, `addresses`, que **só a própria conta lê**; ninguém escreve nela
  direto (só `set_my_address` e `finish_sign_up`). O perfil continua mostrando só a cidade (e, do trabalhador, o ponto de
  ~1 km que a empresa já via). Sai em "baixar meus dados" e vai embora com a exclusão da conta. A política de privacidade
  diz o que é guardado e quais serviços recebem o endereço digitado (sem nome nem conta).
- **Distância**: medida do endereço do trabalhador (o ponto da rua) até o ponto público da vaga. Antes esse ponto era o
  exato **arredondado a 2 casas** (erro de até ~800 m); agora é o exato **deslocado de 100 a 200 m numa direção
  sorteada uma vez** (gatilho no banco; muda só se o endereço da vaga mudar) — a distância erra no máximo ~200 m e o
  endereço da vaga continua escondido até a aprovação (ninguém consegue "tirar a média" porque o ponto não muda a cada
  leitura). Quem foi aprovado vê o endereço exato e a distância exata. Cada card do mural mostra a distância num selo
  na foto ("📍 1,2 km"); a vaga diz "A 1,2 km da sua casa". Conta antiga sem endereço: a distância sai da cidade do
  perfil, como antes, até ela completar o endereço.
- **Banco** (migration `u51`, **produção só com "pode"**): `addresses` + `set_my_address`; `finish_sign_up` aceita
  `p.address` (o formato antigo segue valendo); `jobs.area_lat/area_lon` deixam de ser colunas calculadas e `area_geog`
  passa a vir deles (`SET EXPRESSION` do Postgres 17 — apagar e recriar a coluna travava o painel do Supabase).

## U52 — Publicar vaga: cidade ligada ao CEP, número e tipo do local, os 7 dias, "a combinar" e o total

Pedido do responsável: na vaga, a cidade como campo de texto ligado ao CEP (sem botão de escolher), com o CEP se
preenchendo pela cidade, bairro e rua; número e tipo do local (casa, prédio, apartamento, condomínio…) opcionais; "que
dias pode ser" com todos os dias da semana, compacto e fácil de editar, e no card uma palavra só ("Durante a semana",
"Fim de semana", "Todos os dias"); sem data e sem horário, "data e horário a combinar"; com data e sem horário, a data e
"horário a combinar"; e o total (diária × dias) destacado só dentro da vaga. **Agora**:

- **Endereço**: o mesmo bloco do U51 (CEP e cidade lado a lado, rua, bairro, com as sugestões reais e o CEP achado pela
  rua), mais **Número (opcional)** e **Tipo do local (opcional)** — Casa, Apartamento, Condomínio, Prédio, Comércio,
  Outro. O número continua escondido até a aprovação (como a rua); o tipo do local todos veem. O endereço é achado no
  mapa ao sair do passo 1 (e de novo só se mudar); editar sem mudar o endereço mantém o ponto salvo.
- **Dias**: os sete dias numa linha (Seg … Dom), cada um liga e desliga, com atalhos "Seg a sex", "Fim de semana" e
  "Todos", e embaixo a palavra que vai para o mural. A regra da palavra: só dias de segunda a sexta (qualquer um deles)
  → "Durante a semana"; só sábado e/ou domingo → "Fim de semana"; os sete → "Todos os dias"; outra mistura → os dias em
  poucas letras ("Ter e sáb", "Sex a dom"). Na vaga aparecem por extenso ("Segunda, quarta e sexta"). Vaga antiga
  marcada "qualquer dia" continua "Qualquer dia".
- **Data**: o U01 tinha tirado as datas (sempre "a combinar"); para o caso "com data e sem horário" pedido agora, voltou
  **uma** data, opcional: a de início. O fim sai sozinho das diárias contadas nos dias marcados (ex.: sábado, 3 diárias,
  sexta a domingo → até a sexta seguinte), a data tem que cair num dos dias marcados e cabe em 60 dias. Sem data, a vaga
  fica "a combinar" como antes (e vence 30 dias depois de publicada).
- **Card**: "Data e horário a combinar"; "Sáb, 24 out · horário a combinar"; "Data a combinar · 7h–17h"; a linha do
  bairro leva a palavra dos dias ("Centro · Durante a semana") — o card não cresce.
- **Total**: dentro da vaga, logo abaixo da diária, um quadro verde "Total do bico — R$ 450 · 3 diárias de R$ 150"
  (também na coluna do computador). Não aparece no card nem quando o valor é "a combinar".
- **Banco** (migration `u52`, **produção só com "pode"**): `jobs.weekdays` (os dias marcados) e `jobs.place_type`; o
  `dias` antigo vira o resumo dos dias marcados, calculado no servidor — os filtros "Durante a semana"/"Fim de semana"
  do mural e as vagas antigas seguem iguais. Hoje/Amanhã e o lembrete de presença olham os dias marcados; mudar os dias
  ou o tipo do local avisa os candidatos.

## U53 — Endereço completo para todos, mapa do Google na vaga e o menu de baixo com "Inscrições"

Pedido do responsável: tirar a regra de só ver o endereço completo depois que a empresa aprova (Z06) — qualquer pessoa
vê onde é o bico; em toda vaga, abaixo da descrição, um mapa do Google (como o "Onde você estará" do Airbnb) com o local
do bico e onde o trabalhador está, para comparar a distância, que dá para mexer e abrir no Google Maps; no menu de
baixo do celular, "Candidaturas" vira "Inscrições", a pílula do item aberto do mesmo tamanho dos outros e no azul
principal do app, nos dois temas. **Agora**:

- **Endereço**: `grant select (cep, street, number, complement, lat, lon)` em `jobs` para `authenticated`, e o
  `feed_jobs` manda esses campos. "Qualquer usuário" = quem entrou na conta: o link público da vaga (sem conta,
  `public_job_card`) continua só com bairro e cidade, para o endereço não ficar aberto para robôs (os IDs das vagas são
  sequenciais, L10). O WhatsApp continua só depois da aprovação (`get_contact`). `get_job_addresses` fica (a tela
  "Selecionado" ainda usa) mas deixa de ser o único caminho. Textos de Ajuda, link público, criar vaga e a política de
  privacidade atualizados.
- **Mapa** (`components/JobMap.tsx`): o embed do Google Maps sem chave (`maps.google.com/maps?…&output=embed`) — não
  precisa de conta no Google Cloud nem de cobrança, e dá para arrastar e dar zoom. Com a localização da pessoa, o
  mapa mostra o caminho de onde ela está até o bico; se ela não liberou o GPS, a partir da casa salva no cadastro
  (U51); o texto diz a distância em linha reta. A localização só é pedida quando a pessoa toca em "Mostrar onde
  estou" (ou já tinha liberado antes); nada é guardado. O mapa só carrega quando a seção chega perto da tela (pesa na
  internet fraca). "Abrir no Google Maps" abre a rota no app ou no site. CSP: `frame-src` ganhou
  `https://maps.google.com`.
- **Menu**: o item "Inscrições", a pílula ativa em `bg-brand-500` com texto branco (o mesmo azul nos dois temas) e
  todas as abas com a mesma altura e o mesmo espaçamento.

## U54 — Mapa limpo e próprio, distância de carro e menu fosco

Pedido do responsável: o mapa do Google embutido vinha cheio de botões e caixas do Google e a distância (em linha
reta) não batia com a do Google Maps; queria o mapa limpo, mexer com um dedo só, a distância exata do trabalhador até
o bico como no Google Maps, e o menu de baixo do celular meio transparente e fosco, como o do Instagram. **Agora**:

- **Mapa** (`components/MapCanvas.tsx`): Leaflet com os mapas do OpenStreetMap — só o pino do bico, a bolinha azul de
  onde a pessoa está e o caminho em azul; botões redondos de aproximar, afastar e "ver o caminho todo". Um dedo move o
  mapa, dois dedos dão zoom. No tema escuro os mapas escurecem. O embed do Google não deixa tirar a interface dele
  nem controlar os dedos; a API de mapas do Google exige chave e cartão de crédito no Google Cloud — se o responsável
  quiser o mapa do próprio Google no futuro, é trocar esse arquivo e pôr a chave em `VITE_GOOGLE_MAPS_KEY`. O mapa é um
  pedaço separado (45 KB) que só baixa quando a seção chega perto da tela.
- **Distância** (`services/route.ts`): o caminho de carro e o tempo vêm do OSRM (gratuito, sem chave), com a posição do
  trabalhador (GPS) ou a casa salva — o mesmo tipo de número do Google ("3,2 km · 9 min de carro"), escrito como o
  Google escreve. Sem resposta, cai para a linha reta com "cerca de". Só as duas coordenadas saem do aparelho (nada de
  nome nem conta). Tiramos os números de distância em linha reta da vaga (linha "Onde" e resumo) para não aparecer
  um número diferente do mapa.
- **"Abrir no Google Maps"** abre a mesma rota de carro no app ou no site do Google.
- **CSP** (`public/_headers`): `img-src` ganhou `tile.openstreetmap.org`, `connect-src` ganhou `router.project-osrm.org`
  e o `frame-src` do Google Maps saiu (não há mais iframe).
- **Limite**: os servidores gratuitos do OpenStreetMap e do OSRM são para uso leve; com muito acesso, trocar por um
  provedor com plano (MapTiler, Stadia, Mapbox…) é só mudar a URL dos mapas e do caminho. O número pode diferir
  alguns metros do Google, porque os dois usam mapas de ruas e rotas próprios.
- **Menu de baixo**: a cor da superfície a 70% sobre um desfoque do que passa por trás (`backdrop-blur-xl`), borda
  clara e sombra suave; a aba aberta continua no azul da marca.
