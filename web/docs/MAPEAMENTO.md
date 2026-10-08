# Mapeamento do front-end legado (`app/`) — passo 1 da migração

Levantamento feito **antes** de escrever qualquer código React, lendo 100% dos arquivos de
`app/js/**`, `app/css/**`, `app/index.html` e `app/tailwind.config.js`.

## 0. Achado crítico: não existe Firebase no repositório

O pedido de migração descreve um app integrado ao Firebase (Auth + Realtime Database, schema
`/usuarios/{uid}` com `nome, email, documento, tipo, criadoEm`, login Google via Firebase,
verificação obrigatória de e-mail, tradução de erros do Firebase para PT-BR e resiliência via
`localStorage`/`sessionStorage`/parâmetros de URL).

**Nada disso existe no código atual.** Buscas por `firebase`, `initializeApp`, `getAuth`,
`getDatabase`, `usuarios`, `localStorage`, `sessionStorage`, `auth/` retornam zero ocorrências
em `app/`. O app real é:

- Um SPA em JavaScript puro (ES modules empacotados com esbuild em `js/bundle.js`), estilizado
  com **Tailwind CSS 3.4** (+ `tokens.css` e `base.css`), não "CSS3 puro".
- Todos os dados vêm de um **banco mock em memória** (`js/store.js` semeado por
  `js/data/seed.js`). Nada persiste entre recarregamentos.
- Login, cadastro, "Google", "celular", verificação de e-mail, recuperação de senha e
  exportação de dados são **simulações** com `setTimeout` (500–900 ms).

Seguindo a regra "replique o comportamento atual e apenas sinalize", a migração mantém a
camada de dados mock (agora tipada e isolada em `src/services/`) e **não inventa** uma
integração Firebase que não existe hoje. Ver `docs/VALIDACAO.md` → "Observações".

## 1. Arquitetura atual

| Peça          | Arquivo                                                           | Comportamento                                                                                                                                                                                                                                                                                                            |
| ------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Helper de DOM | `js/dom.js`                                                       | `h()` estilo hyperscript; `mount()` substitui **todo** o DOM de `#app`.                                                                                                                                                                                                                                                  |
| Roteador      | `js/router.js`                                                    | Hash router (`#/rota`), padrões `:param`, pilha de "voltar" própria (`goBack(fallback)`), `navigate(path, {replace})`.                                                                                                                                                                                                   |
| Shell         | `js/main.js`                                                      | Tabela de rotas, shell (nav + `<main>`), larguras por tela no desktop (`NARROW_SCREENS`), telas de fluxo de autenticação sem shell, `/` → `/splash`, 404, `scrollTo(0,0)` e fecha o menu da conta a cada troca de rota, re-render completo a cada mudança do store (com restauração de foco/cursor via `data-focus-id`). |
| Store         | `js/store.js`                                                     | Estado em memória: `role` (conta "logada" de demonstração), `db` (vagas, candidaturas, salvas, excluídas, posts) e `ui` (sacola de estado por tela, **persistente entre navegações**). `subscribe/notify`.                                                                                                               |
| Dados         | `js/data/seed.js`, `js/data/cidades.js`                           | 8 construtoras, 11 trabalhadores, 33 vagas, 19 candidaturas, listas de opções, 3 posts; 5.571 municípios (IBGE).                                                                                                                                                                                                         |
| Ícones        | `js/utils/icons.js`, `js/utils/iconData.js`                       | Lucide como `mask-image` com data-URI (funciona em `file://`); "G" do Google como SVG inline.                                                                                                                                                                                                                            |
| Estilo        | `css/tokens.css`, `css/base.css`, Tailwind (`tailwind.config.js`) | Tokens do design system, keyframes, `.icon`, `.tile-grid`, `.mural-frame`, `.page-x`, `.app-island` etc. Breakpoints `sm 640`, `lg 770`, `xl 1280`, `2xl 1536`.                                                                                                                                                          |

## 2. Telas (33 padrões de rota, 30 módulos de tela)

### Fluxo de entrada / autenticação (sem shell de navegação)

| Rota                      | Tela            | Regras                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                       | —               | redireciona (replace) para `/splash`                                                                                                                                                                                                                                                                                                                                                                                          |
| `/splash`                 | Splash          | "Entrar" → `/login`; "Criar minha conta" → `/escolha-perfil`                                                                                                                                                                                                                                                                                                                                                                  |
| `/login`                  | Login           | campos "E-mail, CPF ou CNPJ" + senha (olho mostrar/ocultar); seletor "Entrar como (demonstração)" Trabalhador/Recrutador; **Entrar / Google / celular** fazem o mesmo: loading 500 ms → `setRole` → `/mural` (sem validação). Links "Esqueci minha senha", "Criar minha conta".                                                                                                                                               |
| `/escolha-perfil`         | ChooseProfile   | RadioCards trabalhador/recrutador (padrão trabalhador) → `/cadastro/:role`                                                                                                                                                                                                                                                                                                                                                    |
| `/cadastro/:role`         | Signup          | Wizard de 4 passos (trabalhador: nome, CPF, e-mail, senha; recrutador: nome da empresa, CNPJ, e-mail, senha). Máscaras CPF/CNPJ ao digitar, validação por passo, confirmação de senha, medidor de força, aceite dos termos, loading 700 ms, documento sentinela `111.111.111-11` / `11.111.111/1111-11` → volta ao passo do documento com erro "já tem conta". Sucesso → guarda `authFlow {role,email}` → `/verificar-email`. |
| `/verificar-email`        | VerifyEmail     | mostra e-mail do cadastro; "Abrir meu e-mail" → `/completar-perfil/:role`; "Reenviar o link" não faz nada                                                                                                                                                                                                                                                                                                                     |
| `/completar-perfil/:role` | CompleteProfile | 2 passos. Trabalhador: foto (opcional) + cargo (obrigatório) → região + especialidades (≥1). Recrutador: capa/logo (opcionais) → tipo de obra + região. Concluir → `setRole` → `/mural`.                                                                                                                                                                                                                                      |
| `/esqueci-senha`          | ForgotPassword  | valida e-mail, loading 600 ms, tela "Link enviado" → `/redefinir-senha`                                                                                                                                                                                                                                                                                                                                                       |
| `/redefinir-senha`        | ResetPassword   | senha ≥ 8, confirmação igual, medidor de força, loading 600 ms, tela "Senha redefinida" → `/login`                                                                                                                                                                                                                                                                                                                            |

### Área logada (com shell: pílula flutuante no celular, barra superior "ilha" ≥ 770 px)

| Rota                                                     | Tela                 | Papel                                                                                                                                                                                                       |
| -------------------------------------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/mural`                                                 | Feed (mural)         | ambos — busca (vagas, construtoras, trabalhadores), filtros (cidade com GPS/busca IBGE, tipo, distância, quando, aviso), ordenação (perto/valor/cedo), salvar vaga, layouts celular e desktop distintos     |
| `/vaga/:id`                                              | JobDetail            | carrossel de fotos, resumo lateral no desktop, "Quero esse bico" / cancelar candidatura (diálogo)                                                                                                           |
| `/confirmar/:id`                                         | ConfirmApplication   | loading 600 ms → candidatura `enviada` → `/enviado/:id`                                                                                                                                                     |
| `/enviado/:id`                                           | ApplicationSent      | confirmação                                                                                                                                                                                                 |
| `/minhas-candidaturas`                                   | MyApplications       | atalho "Vagas salvas", grupos "Em andamento" / "Encerradas", WhatsApp nos escolhidos                                                                                                                        |
| `/vagas-salvas`                                          | SavedJobs            | vagas salvas; encerradas aparecem acinzentadas                                                                                                                                                              |
| `/selecionado/:id`                                       | Selected             | pré-selecionado/contratado, botão WhatsApp (`wa.me`)                                                                                                                                                        |
| `/avaliar/:id`                                           | RateJob              | estrelas, chips, comentário → status `avaliada`                                                                                                                                                             |
| `/perfil`, `/trabalhador/:id`, `/trabalhador/:id/:jobId` | WorkerProfileScreen  | perfil próprio (posts com foto/vídeo, publicar/excluir) ou de terceiro; com `jobId` e recrutador dono: aprovar/recusar/desfazer                                                                             |
| `/perfil/editar`                                         | EditWorkerProfile    | edita nome, cargo, região, especialidades, capa, foto                                                                                                                                                       |
| `/empresa`, `/construtora/:id`                           | CompanyProfileScreen | perfil próprio (posts = vagas abertas com status, excluir) ou de terceiro                                                                                                                                   |
| `/empresa/editar`                                        | EditCompanyProfile   | nome, tipo de obra, região, WhatsApp, capa, logo; CNPJ bloqueado                                                                                                                                            |
| `/avaliacoes/:type/:id`                                  | ReviewsScreen        | só construtora vê avaliações de trabalhador e vice-versa                                                                                                                                                    |
| `/notificacoes`                                          | Notifications        | listas fixas por papel                                                                                                                                                                                      |
| `/configuracoes`                                         | Settings             | links; "Termos"/"Política" sem ação                                                                                                                                                                         |
| `/configuracoes/privacidade`                             | Privacy              | exportar (900 ms) e excluir conta (diálogo → `/login`)                                                                                                                                                      |
| `/criar-vaga`                                            | CreateJob            | 2 passos: fotos (até 6), tipo, endereço, dias, data/horário opcionais, diárias, pessoas → valor (mín. R$ 80) ou "a combinar", requisitos, descrição, prévia do tile; loading 700 ms → `/vaga-publicada/:id` |
| `/vaga-publicada/:id`                                    | JobPublished         | confirmação, "Impulsionar"                                                                                                                                                                                  |
| `/vaga-gerenciar/:id`                                    | JobManage            | só a dona; fotos editáveis, status, vagas preenchidas, candidatos (aprovar/recusar), encerrar (diálogo)                                                                                                     |
| `/fechado/:id`                                           | JobClosed            | equipe contratada, total                                                                                                                                                                                    |
| `/impulsionar/:id`                                       | BoostJob             | 3 planos; impulsionar marca `boosted`/`urgent`                                                                                                                                                              |
| `/historico`                                             | History              | bicos fechados da empresa                                                                                                                                                                                   |
| qualquer outra                                           | 404                  | "Página não encontrada"                                                                                                                                                                                     |

## 3. Componentes reutilizados (`js/components/`)

AppNav (pílula + barra superior, menu da conta, sino, indicador deslizante), Badge, Button,
CandidateRow, Card, Checkbox, EmptyState, ErrorState*, IconButton, Input / PasswordInput,
JobCard* / JobCardFooter*, JobCover / SaveFlag / `jobPhotos`, JobTile / TileGrid, Logo,
Dialog / Sheet (Modal), PhotoCarousel / PhotoManager, PhotoSlot, RadioCard / Switch, Rating,
Select, Skeleton* / CardSkeleton* / RowSkeleton*, Tag, BackBar / NotificationBell (TopBar),
WhatsAppButton. (* = exportados mas não usados por nenhuma tela; migrados mesmo assim.)

## 4. Regras de negócio (store + utils)

- **Status da candidatura**: `enviada → em_analise → pre_selecionado → contratado → concluida → avaliada`; `nao_selecionado` terminal. Rótulos/ações em `utils/applicationStatus.js`.
- **Vagas**: `slots` (padrão 1); cheia quando aprovados (`pre_selecionado`+`contratado`) ≥ slots; fechada = `closed` ou cheia. Aprovar o último slot recusa automaticamente os pendentes. Encerrar vaga: `closed`, `semContratacao` se ninguém aprovado, pendentes → `nao_selecionado`. Excluir post = lista `deletedJobIds`.
- **Mural**: só vagas ativas e não fechadas; filtro de cidade (padrão "São Paulo, SP"), tipo, distância, quando; ordenação recrutador (suas vagas primeiro) → urgentes → critério.
- **Salvar vaga**: alterna em `savedJobIds`.
- **Validações**: nome com sobrenome, razão ≥ 3, CPF 11 / CNPJ 14 dígitos, e-mail regex, senha ≥ 8 com letra e número, confirmação igual, aceite dos termos; publicar vaga (tipo, endereço, dias, horário início/fim juntos, diárias ≥ 1, pessoas ≥ 1, valor ≥ 80 ou a combinar, descrição).
- **Formatação**: `maskCPF`, `maskCNPJ`, `formatBRL` (`R$ 1.234`), `formatPostDate`, `passwordStrength` (0–3), textos de data/horário/dias (`utils/jobInfo.js`), URL do WhatsApp.
- **Cidades**: busca sem acento, prioridade prefixo → palavra → qualquer; cidade mais próxima via GPS.

## 5. Mensagens de erro (PT-BR, todas preservadas literalmente)

"Informe o nome completo." · "Informe nome e sobrenome." · "Informe o nome da empresa." ·
"CPF inválido. Confira os 11 números." · "CNPJ inválido. Confira os 14 números." ·
"E-mail inválido. Confira se tem @ e o domínio." · "Senha curta. Use 8 caracteres ou mais." ·
"Misture letras e números na senha." · "As senhas não são iguais. Confira os dois campos." ·
"Aceite as condições para criar sua conta." · "Esse CPF/CNPJ já tem conta na Bicos." ·
"Selecione seu cargo ou especialidade principal." · "Selecione sua região de atuação." ·
"Escolha ao menos uma especialidade." · "Selecione o tipo de obra." · "Escreva o tipo de
serviço da vaga." · "Informe o endereço da obra." · "Escolha em que dias o bico pode
acontecer." · "Preencha o início e o fim, ou deixe os dois em branco." · "Informe quantas
diárias." · "Informe quantas pessoas a vaga precisa." · "Informe o valor da diária, ou marque
como a combinar." · "Informe um valor de R$ 80 ou mais." · "Descreva o serviço da vaga." ·
mensagens de GPS ("Seu navegador não liberou a localização…", "Não conseguimos achar sua
localização agora…").

Não há tradução de códigos de erro do Firebase porque não há Firebase.

## 6. Resiliência a recarregamento

Não existe. Só a rota sobrevive ao F5 (está no hash). Todo o estado (papel, dados, formulários)
volta ao seed. Replicado tal qual.
