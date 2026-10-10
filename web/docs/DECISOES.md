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
