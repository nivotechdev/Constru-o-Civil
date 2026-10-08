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
