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
