# Validação da migração (legado × React)

Duas rodadas, como pedido: (1) comparação tela a tela durante a migração e (2) revisão cruzada final
contra o mapeamento (`MAPEAMENTO.md`). Toda comparação é **automatizada e reproduzível**:

```bash
npm run build && npm run parity   # Playwright: legado (../app) × React (dist/), lado a lado
npm test                          # Vitest: regras de negócio e utilitários contra os módulos JS originais
```

## Como a comparação funciona

`scripts/parity/run.mjs` serve os dois apps, executa os mesmos roteiros (`scenarios.mjs`) em
**3 larguras** — celular 390×844, tablet 800×1024 (layout desktop, ≥ 770px) e desktop 1440×900 — e,
depois de cada passo, compara:

| Verificação                                                                             | O que pega                                                 |
| --------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| DOM de `#app` (tags, classes, atributos, estilos inline, textos, valores de formulário) | qualquer diferença de estrutura, texto, rótulo, ordem      |
| Estilo computado (~80 propriedades) e caixa (posição/tamanho) de **cada** elemento      | qualquer diferença de CSS, espaçamento, fonte, cor, layout |
| Foco (`document.activeElement` + posição do cursor), scroll e URL                       | microinterações, navegação, restauração de foco/cursor     |
| Screenshot da página inteira (viewport rolado e costurado), pixel a pixel               | o resultado visual final, como o usuário vê                |

A captura é feita rolando a página e costurando os quadros porque a captura de página inteira do
Playwright/Chrome redimensiona a janela para 1×1 por um instante — o carrossel dos dois apps trata isso
como redimensionamento e volta à primeira foto, ou seja, o próprio teste alteraria o estado.

Dados determinísticos nos dois lados: `Math.random`/`Date` fixos, fontes do Google servidas de um
cache local, animações reduzidas (exceto no cenário de microinterações, que roda com animações ligadas).
A tolerância de pixel (`threshold 0.01` do pixelmatch) só absorve ruído de ±1 nível num canal de cor
do rasterizador; além disso, até 16 pixels com diferença ≤ 24 níveis são classificados como ruído de
antialiasing **somente** quando DOM, estilos e caixas são idênticos (acontece na borda antialiasada de
ícones em máscara) — o relatório marca esses casos. Elementos não renderizados (dentro de `display:none`,
como a pílula do celular no desktop) têm tags, classes, atributos e textos comparados, mas não estilo
inline/caixa. DOM e estilos dos elementos renderizados são comparados com igualdade exata.

Os testes de unidade importam os módulos originais (`app/js/utils/*.js`, `app/js/store.js`) e
comparam saída a saída: máscaras de CPF/CNPJ, validação de e-mail, força de senha, BRL, datas, textos
de agenda, status de candidatura, links do WhatsApp, busca de cidades/GPS e sequências de ações no
store (candidatar, cancelar, aprovar até lotar, desfazer, recusar, encerrar com e sem contratação,
salvar, excluir post, avaliar, publicar, impulsionar, posts do trabalhador).

## Resultado

Execução final (`npm run build && npm run parity`):

|                     | Celular 390×844 | Tablet 800×1024 | Desktop 1440×900 | Total   |
| ------------------- | --------------- | --------------- | ---------------- | ------- |
| Capturas comparadas | 238             | 240             | 240              | **718** |
| Idênticas           | 238             | 240             | 239              | **717** |

- 20 roteiros, 57 rotas distintas, 91.363 elementos comparados um a um (DOM, ~75 propriedades de estilo
  computado, posição e tamanho), foco/cursor, rolagem e URL após cada passo; nenhum erro de execução.
- 9 das 717 tiveram de 1 a 3 pixels de ruído de antialiasing (com DOM, estilos e caixas idênticos) —
  marcadas no relatório.
- **A única captura não idêntica** (`desktop · recrutador-empresa · dois-aprovados`): 11 pixels numa
  linha vertical na borda direita de uma miniatura de foto em "Fotos da vaga", diferença de até 25 níveis
  de cor, com DOM, estilos e caixas idênticos. É reamostragem da imagem pelo rasterizador (o legado
  recriava o `<img>` a cada mudança de estado; o React o mantém) e é indistinguível a olho nu.
- Testes de unidade: 13/13 (Vitest), incluindo as comparações com os módulos originais.
- `npm run typecheck`, `npm run lint`, `npm run format:check` e `npm run build` sem erros ou avisos
  (exceto o aviso de `caniuse-lite` explicado nas Observações).

Relatório completo por captura: `docs/RELATORIO_PARIDADE.md` (cópia da execução final; cada `npm run
parity` gera um novo em `scripts/parity/output/`, com imagens de diff das capturas que diferirem).

## Revalidação — otimização e preparação para o Supabase

Depois da migração, o código passou por uma varredura de otimização (código morto, duplicações,
tipagem, componentização, render e bundle) e pela preparação para o Supabase sem conexão
(`docs/SUPABASE.md`). A regra era não mudar nada da interface, então cada lote só foi commitado depois
de passar pelos mesmos comandos deste documento e por uma comparação extra, mais estrita, contra o build
React de antes da refatoração (`PARITY_REFERENCE=<build anterior> npm run parity`: DOM, estilos
computados, caixas, foco, rolagem, URL e pixels do React novo contra o React antigo).

| Lote (commit)                                 | typecheck · lint · format · testes | × React anterior                         | × legado                       |
| --------------------------------------------- | ---------------------------------- | ---------------------------------------- | ------------------------------ |
| Código morto e dependência (`58f910f`)        | ✅ · ✅ · ✅ · 13/13               | 718/718                                  | 717/718, a mesma diferença     |
| Duplicações e tipagem (`5df3116`)             | ✅ · ✅ · ✅ · 13/13               | 718/718                                  | —                              |
| Componentização, render e bundle (`c5024ca`)  | ✅ · ✅ · ✅ · 13/13               | 718/718                                  | —                              |
| Acesso a dados só por `services/` (`275f089`) | ✅ · ✅ · ✅ · 21/21               | 718/718                                  | —                              |
| Estrutura do Supabase (`b97121d`)             | ✅ · ✅ · ✅ · 29/29               | build byte a byte igual ao lote anterior | —                              |
| **Final** (`npm run build && npm run parity`) | ✅ · ✅ · ✅ · 29/29               | idem                                     | **717/718**, a mesma diferença |

- O CSS gerado é byte a byte o mesmo desde o primeiro lote (que só removeu regras e tokens que nenhum
  elemento usa).
- Os atrasos simulados (500/600/700/900 ms) saíram das telas para `services/` com os mesmos valores, e
  agora têm testes com relógio falso (`services.test.ts`).
- Testes: os 13 originais continuam passando — o de regras do store só deixou de chamar
  `markConcluded`, removida por não ter nenhum chamador (nem no legado) — e 16 novos cobrem os
  serviços e a preparação do Supabase.
- O harness ganhou execução concorrente (`PARITY_CONCURRENCY`), referência configurável
  (`PARITY_REFERENCE`) e captura determinística dos estados transitórios ("Entrando…", "Publicando…"):
  os atrasos simulados ficam retidos até a captura e são liberados em seguida.

Execução final, pelo mesmo método do resultado acima: celular 238/238, tablet 240/240, desktop 239/240 —
**717/718**, com a mesma única captura não idêntica (`desktop · recrutador-empresa · dois-aprovados`,
11 pixels de reamostragem da miniatura, com DOM, estilos e caixas idênticos), os mesmos 91.363
elementos comparados e 9 capturas com 1 a 3 pixels de ruído de antialiasing. `docs/RELATORIO_PARIDADE.md`
é a cópia dessa execução.

## Mudanças de interface pedidas depois da revalidação

Estas mudanças são **intencionais** — a partir delas, a paridade contra o legado passa a mostrar as
diferenças abaixo (e só elas):

- Cards de bico centralizados no container em todas as telas que os listam (mural, salvas, minhas
  candidaturas, perfis): `.tile-grid` usa `auto-fit` + `justify-content: center`, então sobra de largura
  e colunas vazias não empurram os cards para a esquerda.
- Banner dos perfis (trabalhador e construtora) com 15rem de altura.
- Foto da vaga maior no celular (15rem → 18rem; tablet/desktop iguais).
- Olho de mostrar/ocultar senha visível em todos os campos de senha (ícones `eye`/`eye-off` incluídos).
- Cadastro: Enter avança para a próxima etapa (e põe o cursor no campo seguinte).
- Completar perfil: o mesmo botão de cidade do filtro do mural ("Onde você quer trabalhar" / "Onde ficam
  suas obras"), abrindo o mesmo seletor (GPS ou busca de cidade) — agora `components/CityPicker.tsx`,
  compartilhado pelos dois lugares.

Segunda leva de mudanças pedidas (também intencionais):

- Cadastro e "Completar perfil" cabem na janela no desktop (sem rolagem da página; se o conteúdo não
  couber, rola só o miolo do cartão).
- Cadastro dos dois perfis pede o WhatsApp e confirma o número com um código de 6 números (simulado em
  `services/auth.ts`: `sendWhatsAppCode` / `verifyWhatsAppCode`), com reenvio liberado a cada 15 s e
  "Corrigir" para voltar ao número. Campos com máscara mantêm o cursor no fim ao digitar.
- "Completar perfil": sem "Região de atuação"; o trabalhador escolhe capa e foto como o recrutador (a
  capa vira o banner do perfil ao concluir; capa e logo do recrutador idem) e digita as especialidades,
  que se somam em chips removíveis.
- Sino (barra do desktop e topo do mural no celular) abre um painel flutuante com as notificações, as
  não lidas destacadas, "Marcar como lidas" (o selo acompanha) e "Ver todas as notificações".

## Rodada 1 — tela a tela

Legenda: **L** layout/visual · **T** textos · **E** estados de erro/vazio · **N** navegação · **D** dados/regras.
Todas as linhas abaixo estão cobertas por capturas idênticas nos 3 tamanhos de tela.

| Tela (rota)                                                                                                                                                                      | Conferido | Cenários                                                                                  |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ----------------------------------------------------------------------------------------- |
| Splash `/splash` · redirecionamento de `/`                                                                                                                                       | L T N     | rotas-*, raiz-redireciona                                                                 |
| Login `/login` (demo trabalhador/recrutador, Google, celular, olho da senha)                                                                                                     | L T N D   | login-recuperar-senha, rotas-recrutador                                                   |
| Escolha de perfil `/escolha-perfil`                                                                                                                                              | L T N     | cadastro-*                                                                                |
| Cadastro `/cadastro/:role` — 4 passos, máscaras, cursor, 9 mensagens de erro, força da senha, aceite, CPF/CNPJ já cadastrado, voltar                                             | L T E N D | cadastro-trabalhador, cadastro-recrutador-cnpj-existente, mascara-cursor, microinteracoes |
| Verificar e-mail `/verificar-email`                                                                                                                                              | L T N     | cadastro-trabalhador                                                                      |
| Completar perfil `/completar-perfil/:role` (foto, cargo, região, especialidades, erros)                                                                                          | L T E N D | cadastro-trabalhador, rotas-*                                                             |
| Esqueci / redefinir senha                                                                                                                                                        | L T E N   | login-recuperar-senha                                                                     |
| Mural `/mural` — celular e desktop, busca (vagas/construtoras/trabalhadores), sem resultado, filtros, cidade (busca IBGE e GPS), ordenação, chips, salvar vaga, vazio por cidade | L T E N D | mural-busca-filtros, mural-salvar-carrossel, gps-cidade, rotas-*                          |
| Detalhe da vaga `/vaga/:id` (carrossel por setas/teclado, resumo lateral, candidatura, cancelar com diálogo, vaga inexistente)                                                   | L T E N D | candidatura, mural-salvar-carrossel, rotas-*                                              |
| Confirmar / candidatura enviada                                                                                                                                                  | L T N D   | candidatura                                                                               |
| Minhas candidaturas / Vagas salvas                                                                                                                                               | L T E N D | candidatura, mural-salvar-carrossel, avaliar-diaria                                       |
| Selecionado `/selecionado/:id` (pré-selecionado e contratado, WhatsApp)                                                                                                          | L T D     | rotas-*                                                                                   |
| Avaliar diária `/avaliar/:id`                                                                                                                                                    | L T N D   | avaliar-diaria                                                                            |
| Perfil do trabalhador (próprio, de terceiro, novo, com contexto de vaga: aprovar/recusar/desfazer), posts (publicar com foto, excluir)                                           | L T E N D | perfil-trabalhador-posts, recrutador-aprovar, rotas-*                                     |
| Editar perfil do trabalhador                                                                                                                                                     | L T N D   | perfil-trabalhador-posts                                                                  |
| Perfil da construtora (própria com posts e exclusão; de terceiro; inexistente)                                                                                                   | L T E N D | recrutador-empresa, rotas-*                                                               |
| Editar empresa (capa/logo, nome, tipo de obra, CNPJ bloqueado)                                                                                                                   | L T N D   | recrutador-empresa                                                                        |
| Avaliações `/avaliacoes/:type/:id` (permitido, bloqueado, vazio)                                                                                                                 | L T E     | rotas-*                                                                                   |
| Notificações, Configurações, Privacidade (exportar, excluir conta)                                                                                                               | L T N     | perfil-trabalhador-posts, rotas-*                                                         |
| Publicar vaga `/criar-vaga` — 2 passos, 8 validações, horário parcial, a combinar, requisitos, prévia do tile, fotos                                                             | L T E N D | recrutador-publicar                                                                       |
| Vaga publicada / Impulsionar                                                                                                                                                     | L T N D   | recrutador-publicar                                                                       |
| Gerenciar vaga (dona e não-dona, aprovar/recusar, lotação, encerrar com diálogo)                                                                                                 | L T E N D | recrutador-aprovar, recrutador-publicar, recrutador-empresa                               |
| Bico fechado / Histórico                                                                                                                                                         | L T E N D | recrutador-aprovar, recrutador-empresa, recrutador-publicar                               |
| Navegação: pílula do celular, barra "ilha" ao rolar, abas, menu da conta (abrir, Esc, itens, sair), sino                                                                         | L N       | navegacao-abas, menu-conta-desktop                                                        |
| 404                                                                                                                                                                              | L T       | rotas-*                                                                                   |

## Rodada 2 — revisão cruzada com o mapeamento

| Item do `MAPEAMENTO.md`                                                                                          | Status                                                                 |
| ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 33 padrões de rota / 30 telas                                                                                    | ✅ todas em `src/routes.ts`, todas capturadas nos dois papéis          |
| Telas sem shell no fluxo de autenticação; larguras por tela no desktop                                           | ✅ `routes.ts` (`isAuthFlow`) e `layouts/AppShell.tsx` (mesmas listas) |
| Pilha de "voltar" própria, fallback por tela, `/` → `/splash`, 404, rolar ao topo e fechar menu a cada navegação | ✅ `services/router.ts`, `App.tsx`                                     |
| Estado de UI por tela que sobrevive à navegação                                                                  | ✅ `useUI` (mesmas chaves do legado)                                   |
| Componentes (JobCard, ErrorState e Skeleton, sem uso também no legado, saíram na otimização — ver Revalidação)   | ✅ `src/components/`                                                   |
| Regras de negócio do store (status, lotação, fechamento, encerrar, salvar, posts)                                | ✅ testes de paridade do store                                         |
| Validações e mensagens de erro (todas as do mapeamento, §5)                                                      | ✅ textos idênticos; capturas de cada estado de erro                   |
| Máscaras, formatação, textos de agenda, cidades, WhatsApp                                                        | ✅ testes de paridade de utilitários                                   |
| Simulações de tempo (500/600/700/900 ms)                                                                         | ✅ mesmos atrasos                                                      |
| Ícones (mask-image com data URIs; "olho" da senha invisível como no legado)                                      | ✅                                                                     |
| CSS (tokens, base, Tailwind com mesmas regras)                                                                   | ✅ mesmo tema e mesmo autoprefixer; estilos computados idênticos       |
| Abrir sem servidor (`file://`)                                                                                   | ✅ `npm run build:standalone`                                          |

## Observações (comportamentos do legado replicados de propósito, sem "corrigir")

1. **Não há Firebase** — nem Auth, nem Realtime Database, nem `/usuarios/{uid}`, nem tradução de
   erros do Firebase, nem persistência em `localStorage`/`sessionStorage`. Login/cadastro/verificação
   são simulados e todo o estado volta ao seed num recarregamento. Mantido assim; a integração real
   seria uma mudança funcional. A camada `src/services/` concentra todo acesso a dados e a estrutura
   para o Supabase já está preparada, sem conexão (`docs/SUPABASE.md`).
2. **Login não valida nada**: "Entrar", "Continuar com o Google" e "Continuar com o celular" apenas
   entram no papel escolhido em "Entrar como (demonstração)".
3. **Ícone do "olho" da senha era invisível** no legado (os ícones `eye`/`eye-off` nunca foram
   incluídos). Foi corrigido a pedido depois da revalidação — ver "Mudanças de interface pedidas".
4. **Rascunhos de edição de perfil persistem**: editar o nome e tocar em "Cancelar" mantém o texto
   editado na próxima vez que a tela abre (o estado da tela é criado só uma vez).
5. **Iniciais do trabalhador não mudam** ao editar o nome.
6. **"Aprovar para a vaga" aparece mesmo para quem não se candidatou** (em `/trabalhador/:id/:vaga`);
   tocar não faz nada além de voltar para a vaga.
7. **Links "Termos de uso"/"Política de privacidade" do cadastro apontam para `#`**, o que leva de
   volta ao splash; os itens equivalentes em Configurações não fazem nada. "Reenviar o link", "Editar
   vaga" e "Falar no WhatsApp" (bico fechado) também não fazem nada.
8. **Micro-interações do re-render total**: o legado recriava todo o DOM a cada mudança de estado.
   Consequências visíveis replicadas em `src/components/LegacyRerender.tsx` (remova-o de `App.tsx`
   para o comportamento mais suave do React):
   - botões/selects/checkboxes perdem o foco após o clique (só campos de texto com id mantêm);
   - transições CSS não animam em mudanças de estado (barra de progresso, medidor de senha, switch,
     checkbox mudam instantaneamente);
   - animações de entrada de sheets/diálogos/menu reiniciam a cada interação dentro deles;
   - a rolagem interna de um sheet volta ao topo a cada toque;
   - a página não faz _scroll anchoring_: quando aparece conteúdo acima da área visível (ex.: mensagens
     de validação no "Publicar vaga"), o conteúdo visível desce em vez de o navegador compensar.

   Pelo mesmo motivo, o shell (`<main>` + navegação) é recriado a cada navegação e a barra de
   navegação a cada mudança de estado (`App.tsx`, `layouts/AppShell.tsx`). Isso importa com "reduzir
   movimento" ligado: a regra do legado `* { transition-duration: 0.01ms }` transforma qualquer mudança
   de propriedade num elemento reaproveitado numa transição de um quadro — o carrossel da vaga chegava a
   medir a largura antiga e a primeira seta não funcionava. Encontrado pela validação e corrigido.

   **Única micro-interação não replicada**: no legado, a borda azul do campo em foco re-animava de cinza
   para azul (150 ms) a cada tecla digitada, porque o campo era recriado e refocado; e um botão sob o
   ponteiro re-animava a cor de _hover_ a cada mudança de estado. Reproduzir isso exigiria tirar e
   devolver o foco do campo a cada tecla, o que pode fechar o teclado virtual no celular — no React a
   borda simplesmente permanece azul.

9. **`autofocus` só vale uma vez por página** (regra do navegador que o legado herdava): o primeiro
   campo com autofoco exibido recebe foco; os seguintes não. Emulado em `hooks/useTextField.ts`.
10. O `tailwind.css` versionado no legado tinha 9 classes que nenhum arquivo usa mais (build antigo);
    não afetam nenhum elemento.
11. O CSS usa o autoprefixer embutido no Tailwind (o mesmo do build legado) para gerar regras
    idênticas; por isso o Vite avisa que o `caniuse-lite` dele está desatualizado.

## Diferenças conhecidas

- Código dividido por tela (chunks) e servido como módulos: é preciso um servidor HTTP (`npm run
preview` ou qualquer hospedagem estática). Para abrir direto do disco, use `npm run build:standalone`.
- IDs gerados de `<label for>` sem id explícito usam `useId` do React em vez de `field-N` (invisível).
