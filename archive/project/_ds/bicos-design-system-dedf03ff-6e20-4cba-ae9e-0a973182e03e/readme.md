# Bicos — Design System

**Bicos** é o marketplace da **NivoTech** que conecta construtoras a pedreiros para trabalhos avulsos de diária na construção civil brasileira. Resolve duas dores ao mesmo tempo: o trabalhador que precisa de grana rápida num dia livre, e a construtora com falta de mão de obra pontual.

O sistema visual existe para uma situação muito específica: **um Android de entrada, na mão de quem está no canteiro, sob sol forte, com sinal ruim, decidindo sobre renda real.** Toda regra aqui sai disso.

## Fontes deste design system

Nenhum código, Figma, deck ou arquivo de marca foi anexado a este projeto. O sistema foi construído a partir do briefing escrito do produto (descrição da empresa, perfis de usuário, telas centrais, prioridades de acessibilidade e a cor primária `#1D4BED`, tema claro).

Consequências que o leitor precisa saber:

- **Não existe logotipo.** Nada foi desenhado nem reconstruído de memória. A marca é tipográfica ("Bicos" em Barlow) — veja o card "Assinatura (sem logo)". Se houver um logotipo oficial, envie o SVG e ele substitui a assinatura tipográfica em todos os lugares.
- **As fontes são substituições do Google Fonts** (Barlow, Plus Jakarta Sans, Space Mono), escolhidas para o papel descrito no briefing. Nenhum arquivo de fonte licenciado foi fornecido; `tokens/fonts.css` carrega do CDN. Se a marca já tem tipografia definida, envie os arquivos.
- **Os ícones são Lucide**, via CDN, também por substituição — não havia conjunto de ícones a copiar.
- Os dados nas telas (nomes, obras, valores, bairros de São Paulo) são fictícios, mas escritos no registro real do produto.

## Produtos representados

| Produto | Superfície | Onde |
| --- | --- | --- |
| App do pedreiro | App mobile em React (rumo a React Native), 360px | `ui_kits/app_pedreiro/` |
| App da construtora | Mesmo app, perfil de quem contrata | `ui_kits/app_construtora/` |

Não há site de marketing, painel desktop nem produto de documentação nas fontes fornecidas — portanto não foram inventados aqui.

## Stack de front-end

O front-end é construído em **React (JavaScript)**, já pensado para futura portabilidade para **React Native** quando o app for para as lojas (App Store/Google Play). Por isso os componentes deste design system evitam qualquer coisa que não tenha equivalente direto em React Native:

- Estilo via objetos inline / custom properties de valor (nunca CSS-in-JS de biblioteca externa, nunca seletor de CSS que dependa do DOM da web como `:hover` de cascata ou pseudo-elementos `::before`/`::after` para conteúdo visual).
- Layout com Flexbox (o modelo que o React Native também usa) em vez de CSS Grid como base estrutural dos componentes.
- Sem `<a>`, `<select>`, `<input type="...">` nativos como dependência de comportamento — eles valem para a versão web, mas cada componente documenta a intenção (link, escolha única, campo de texto) para ser reimplementado com `Pressable`/`TextInput`/etc. no RN.
- Tokens vivem em `tokens/*.css` (web) mas são a fonte de verdade de valores (cor, espaço, raio, tipografia) que devem ser espelhados num objeto JS de tema (`theme.js`) no app React Native — não em unidades ou propriedades exclusivas de CSS web (`vw`, `calc()`, `grid-template-columns`).
- Ícones via Lucide: no React Native, trocar a máscara CSS por `react-native-svg` com o mesmo nome de ícone.

Os componentes React deste repositório são a **especificação visual e de comportamento**, não a implementação final de produção — nem para web, nem para RN.

---

# CONTENT FUNDAMENTALS

**Idioma:** português do Brasil, sempre. Nunca inglês na interface — nem "job", nem "dashboard", nem "match". O vocabulário é o da obra: *bico, diária, vaga, canteiro, obra, pedreiro, servente, azulejista, armador, EPI, PIX*.

**Pessoa:** falamos com **você**, sobre o que **você** recebe e faz. O produto nunca fala de si na primeira pessoa ("nós achamos") a não ser quando assume uma ação operacional: "Enviamos um código por SMS", "Avisamos por WhatsApp". Nunca "o usuário", nunca "o sistema".

**Tom:** direto e adulto. Frase curta, verbo no começo, zero entusiasmo forçado. É dinheiro e trabalho — o texto precisa soar como um contrato honesto, não como jogo.

**Caixa:** primeira letra maiúscula, o resto minúsculo (sentence case) em títulos, botões, badges e rótulos. CAIXA ALTA apenas em overline de seção (12px, tracking 0.08em). Nunca CAIXA ALTA em botão.

**Pontuação:** títulos e botões sem ponto final. Mensagens de toast e de erro com ponto final. Sem exclamação — exceto uma, quando o usuário ganha dinheiro ("Você foi contratado" continua sem exclamação; a alegria vem do fato, não da pontuação).

**Emoji: nunca.** Nenhum, em nenhuma superfície do produto. Ícone Lucide monocromático faz esse trabalho.

**Números e moeda:** padrão pt-BR. `R$ 220` (espaço depois do R$, sem centavos quando é valor redondo), `R$ 1.240`, nota `4,8` com vírgula, distância `3,2 km`, data `Seg, 8 set · 7h–17h`, horário `7h–17h` (não `07:00 - 17:00`). Valor de diária sempre em Space Mono.

**Botões: verbo + objeto, na voz de quem clica.**

| Contexto | Escreva | Não escreva |
| --- | --- | --- |
| Candidatar-se | "Quero esse bico" | "Aplicar", "Enviar candidatura" |
| Contratar | "Sim, contratar" | "Confirmar", "OK" |
| Publicar | "Publicar vaga" | "Salvar" |
| Encerrar | "Encerrar vaga" | "Excluir" |
| Recusar | "Recusar" | "Rejeitar candidato" |

**Erros dizem o que fazer, não quem errou.** "CPF inválido. Confira os 11 números." · "Informe um valor de R$ 80 ou mais." · "Não conseguimos enviar." + ação "Tentar de novo". Nunca "Erro 422", nunca "campo obrigatório não preenchido".

**Estados vazios apontam a saída.** "Nenhuma vaga de acabamento hoje — tire o filtro ou aumente a distância para ver mais bicos." Nunca "nada aqui".

**Sem sinal é uma mensagem de primeira classe**, não um erro: "Sem internet. Mostrando as vagas salvas." / "Sem internet. Vamos enviar quando o sinal voltar."

**Status é escrito do ponto de vista de quem lê.** O pedreiro vê "Você foi contratado" e "Não foi essa vez" (nunca "Rejeitado"). A construtora vê "3 aprovados", "6 candidatos".

**Confiança é dita com fato, não com adjetivo.** "RG e CPF conferidos em 12 ago", "64 diárias pagas", "resposta média 1h20", "Sem taxa para o trabalhador" — em vez de "plataforma segura e confiável".

---

# VISUAL FOUNDATIONS

## A ideia

Concreto e sinalização de obra: superfície clara e neutra, informação preta, e **um** azul forte que só aparece onde há ação. A hierarquia vem de peso e borda, não de cor decorativa. Nada de ilustração, nada de gradiente, nada de brilho — o app parece uma ferramenta, e ferramentas boas são sóbrias.

## Cor

- **Azul Nivo `#1D4BED`** (`--blue-500`) é a única cor de ação: botão primário, link, barra superior, estado selecionado, foco. 600 no hover, 700 no press, 50 como fundo de destaque, 200 como anel de foco.
- **Verde-água `#0F8F82`** (`--teal-500`) identifica o **pedreiro**: avatar de iniciais, badge "Novo na plataforma", botão `variant="accent"`. O azul identifica a **construtora**. Os dois nunca disputam a mesma tela.
- **Concreto** — 12 neutros de `#FFFFFF` a `#101418`. Página `--gray-50`, cartão branco, borda `--gray-200`, texto `--gray-900`/`700`/`500`.
- **Semânticas** — verde `#0B7A4B`, âmbar `#A55A00`, vermelho `#C02626`, cada uma com um fundo claro de par. Âmbar é a cor de "sem sinal".
- **Tema:** apenas claro. Não há tema escuro definido (leitura sob sol é o caso dominante).
- Cor nunca é o único sinal: todo estado carrega ícone + texto.
- **Contraste:** piso de 4,5:1 para qualquer texto, inclusive 12px. Texto nunca usa opacidade ou `color-mix` sobre foto; usa cor cheia sobre fundo cheio.

## Tipografia

- **Barlow** (600/700) — display: títulos, nomes de vaga, valores grandes. Grotesca industrial, levemente estreita, aguenta título longo em 360px. Tracking `-0.02em`.
- **Plus Jakarta Sans** (400–700) — interface e corpo. Altura de x generosa, dígitos distintos, boa a 14px em tela barata.
- **Space Mono** (400/700) — **só números que se conferem ou se leem em voz alta**: diária, total, código da vaga (`BC-4821`), CPF, CNPJ. Texto em mono, nunca.
- **Piso de 16px** para qualquer informação de decisão (valor, endereço, horário, condições). 14px em texto auxiliar, 12px só em meta/legal.
- Escala: 12 · 14 · 16 · 18 · 20 · 24 · 30 · 36 · 44. Entrelinha 1.1 em display, 1.45 em corpo.

## Espaço e layout

- Base 4px; escala 2 · 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64.
- Gutter de página **16px** no celular; 12px entre cartões de uma lista; 24px entre blocos; 32px entre seções.
- Coluna única, largura máxima 480px (`--content-max`). Nada de tabela, nem na visão da construtora.
- **Elementos fixos:** AppBar de 56px no topo; BottomNav de 64px no rodapé (3 itens no pedreiro, 4 na construtora); em telas de compromisso, uma barra de ação branca fixa no rodapé com sombra `--shadow-bar`. O conteúdo entre eles rola.
- **Alvos de toque:** 48px padrão, **44px é o piso absoluto**, 56px em ação de compromisso; 8px mínimo entre alvos. A área tocável conta, não o desenho (linha de checkbox tem 44px mesmo com caixa de 24px).
- Chips de filtro rolam na horizontal em vez de quebrar em três linhas.

## Fundos e imagens

Fundo é **cor sólida**: `--gray-50` na página, branco no cartão, azul na barra e no cabeçalho de entrada. Sem gradiente, sem padrão, sem textura, sem ilustração, sem foto de banco de imagens. Não há foto de perfil obrigatória — avatar é **iniciais** sobre `--accent-subtle` (pedreiro) ou ícone `building-2` sobre `--brand-subtle` (construtora). Se um dia entrar foto de obra, a regra é: luz natural, sem filtro, sem grão, sem tratamento quente/frio — documental.

## Cartões, bordas, sombras

- Cartão = branco + **borda 1px `--gray-200`** + raio **12px** + `--shadow-1` (`0 1px 2px rgba(16,20,24,.06)`). A borda é o que define o cartão; a sombra é quase invisível de propósito, porque sombra desaparece sob sol.
- Sombra só para o que **flutua**: `--shadow-2` cartão destacado, `--shadow-3` toast e menu, `--shadow-sheet` bottom sheet, `--shadow-bar` barra inferior.
- Cartão dentro de cartão: o de dentro perde borda e sombra e vira `tone="sunken"`.
- Raios: 4 (checkbox) · 8 (botão, campo, chip) · 12 (cartão) · 16 (sheet, modal) · pill (badge, avatar). Nem canto reto, nem arredondado brincalhão.
- Lista longa (candidatos) usa **divisória de 1px**, não espaço entre cartões — densidade importa em 360px.

## Estados de interação

- **Hover** (só desktop/painel): escurece um degrau (`--blue-500` → `--blue-600`); em botão secundário e ghost, ganha fundo `--brand-subtle`.
- **Press:** escurece dois degraus + `transform: scale(0.98)` por 80ms. Sem ripple, sem ondulação.
- **Foco:** contorno de 2px `--blue-500` com offset de 2px; em campo, anel `--focus-ring` (3px `--blue-200`) e borda azul.
- **Selecionado:** borda `--brand` + fundo `--brand-subtle` + texto `--text-brand` (chip, radio-card, item de trilho).
- **Desabilitado:** fundo `--gray-100`, texto `--gray-400`, borda `--gray-200`, cursor `not-allowed`. Não usamos opacidade global em botão desabilitado — o texto continuaria ilegível ao sol.
- **Carregando:** botão mantém o rótulo e ganha spinner; listas usam **Skeleton com a forma do conteúdo**, nunca spinner de tela cheia (em 2G, spinner parece travamento).

## Movimento

Duração 80–240ms, curva única `cubic-bezier(.2,0,.2,1)`. Press 80ms · hover/cor 120ms · sheet e toast subindo 180ms · troca de tela 240ms. Sem bounce, sem mola, sem parallax, sem animação decorativa — o aparelho é de entrada e a bateria é do usuário. `prefers-reduced-motion` desliga tudo (já tratado em `tokens/base.css`).

## Transparência e blur

Praticamente ausentes. Blur nunca (custa GPU em aparelho fraco). Transparência em exatamente dois lugares: o scrim de modal (`--scrim`, preto a 55%) e o texto secundário sobre a barra azul (branco a 85%). Nada de vidro, nada de "protection gradient" — quando um texto precisa de contraste, ele ganha uma cápsula sólida, não um gradiente.

---

# ICONOGRAPHY

**Conjunto único: [Lucide](https://lucide.dev)** — traço de 2px, cantos arredondados, geometria sóbria. Não havia conjunto de ícones nas fontes fornecidas; **esta é uma substituição** e deve ser trocada se a NivoTech já tiver ícones próprios.

**Como é aplicado:** o componente `Icon` carrega o SVG estático do Lucide via CDN (`https://unpkg.com/lucide-static/icons/<nome>.svg`) e o usa como **máscara CSS** sobre `background-color: currentColor`. Assim o ícone herda a cor do texto (inclusive dentro de botão azul) sem nenhum SVG inline no código. Não há sprite, não há icon font, não há PNG.

```jsx
<Icon name="hard-hat" size={24} label="Pedreiro" />
<Icon name="map-pin" size={16} color="var(--text-muted)" />
```

- **Tamanhos:** 16 (meta, inline), 20 (padrão, em botão e campo), 24 (navegação e alvos de toque), 30–34 (estado vazio, avatar de empresa).
- **Cor:** sempre `currentColor`, ou um token de texto. Nunca ícone colorido, nunca ícone de duas cores.
- **Ícone sozinho nunca carrega significado:** BottomNav mostra rótulo sempre visível; `IconButton` exige `label` (vira `aria-label`).
- **Vocabulário fixo do produto:** `hammer` vagas · `hard-hat` pedreiro · `building-2` construtora · `map-pin` local · `calendar` data · `banknote` / `hand-coins` dinheiro · `users` candidatos · `file-check` candidaturas · `star` avaliação · `shield-check` verificado · `phone` / `message-circle` contato · `wifi-off` sem sinal · `search-x` nada encontrado · `circle-check` sucesso · `triangle-alert` risco · `circle-alert` erro · `sliders-horizontal` filtros · `chevron-right` navegar.
- **Emoji: nunca.** **Caracteres unicode como ícone: nunca** (exceto `·` como separador em texto de meta, e `–` em faixa de horário). **SVG desenhado à mão: nunca.**

---

# Índice

## Raiz

| Arquivo | O que é |
| --- | --- |
| `styles.css` | Ponto de entrada único do CSS — só `@import`s. É o arquivo que o consumidor linka. |
| `readme.md` | Este guia. |
| `SKILL.md` | Cabeçalho de skill para uso em Claude Code. |
| `thumbnail.html` | Tile do design system na home. |

## `tokens/`

`fonts.css` (Google Fonts) · `colors.css` (escalas + aliases semânticos) · `typography.css` (famílias, escala, estilos `--type-*`) · `spacing.css` (espaço, layout, alvos de toque) · `radius.css` · `elevation.css` · `motion.css` · `semantic.css` (status de vaga, perfis, dinheiro, skeleton) · `base.css` (reset, tipografia base, links, foco, keyframes).

## `components/`

| Grupo | Componentes |
| --- | --- |
| `core/` | `Button`, `IconButton`, `Icon`, `Badge`, `Tag`, `Card` |
| `forms/` | `Input`, `Select`, `Checkbox`, `Radio`, `Switch` |
| `feedback/` | `Dialog`, `Toast`, `Tooltip`, `EmptyState`, `Skeleton` |
| `navigation/` | `AppBar`, `BottomNav`, `Tabs` |
| `marketplace/` | `JobCard`, `CandidateRow`, `Rating` |

Cada componente tem `.jsx` (implementação), `.d.ts` (contrato de props) e `.prompt.md` (quando usar + exemplo). Cada pasta tem um card HTML com os estados principais.

### Adições intencionais

Nenhuma fonte definia inventário de componentes, então o conjunto padrão foi autorado. Estes cinco existem porque o produto não funciona sem eles:

- `Icon` — invólucro do conjunto Lucide (evita SVG inline espalhado pelo código).
- `JobCard` — a vaga é o objeto central do marketplace; aparece em quatro telas.
- `CandidateRow` — a decisão da construtora acontece nessa linha.
- `Rating` — reputação é a moeda de confiança dos dois lados.
- `EmptyState` e `Skeleton` — o briefing exige estados vazio/erro/carregando sempre visíveis.

## `ui_kits/`

- `app_pedreiro/` — entrada, escolha de perfil, mural de vagas com filtros, detalhe + candidatura, minhas candidaturas, perfil. Veja `ui_kits/app_pedreiro/README.md`.
- `app_construtora/` — painel de vagas, publicar vaga (2 passos), candidatos com aprovar/recusar, avaliar diária, minha empresa. Veja `ui_kits/app_construtora/README.md`.

## `guidelines/`

18 cards de especimen que povoam a aba Design System: cor (primária, secundária, neutros, semânticas, status da vaga, contraste), tipo (display, corpo, mono, escala), espaço (escala, aplicado, alvos de toque) e marca (assinatura, cantos, elevação, movimento, ícones).

## Pendências para a NivoTech

1. Logotipo oficial em SVG (hoje: assinatura tipográfica).
2. Arquivos de fonte licenciados, se a marca já tiver tipografia própria (hoje: Barlow / Plus Jakarta Sans / Space Mono do Google Fonts).
3. Conjunto de ícones próprio, se existir (hoje: Lucide via CDN).
4. Fotografia de obra, se o produto for usar imagem (hoje: nenhuma imagem).
