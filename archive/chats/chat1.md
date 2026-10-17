# Tela de perfil com banner

_Started 2026-09-07 00:56 UTC_

---

## User

<system-info comment="Only acknowledge these if relevant">
Project title is now "Projeto: NivoTech "Bicos" — telas completas do aplicativo??Use o design system j"
Current date is now September 6, 2026
</system-info>

<attached aesthetic_system_instructions>
A design system or theme is attached to this project. That attachment already answers the visual-style question: apply it. Do NOT ask the user which visual style to use — no questions about vibe, colors or palette directions (including color-swatch svg-options questions), typography, mood, or art direction, and skip the "divergent visuals" question from the question-asking tips; offer divergent visual directions only if the user themselves asks for alternatives. This rule bans asking the user to pre-pick a style in the abstract — swatches, mood words, palette pickers. It does not ban asking them to choose among candidates you have already built: putting built candidates on a file-options board for the user to pick from is encouraged. Treat the attachment as the confirmed starting point and product context — the "confirm the starting point" tip is already satisfied, so do not ask the user to confirm or re-pick it. Spend your questions on everything else you need: audience, purpose, content, structure, scope, interactions, tone of copy.
</attached aesthetic_system_instructions>

<pasted_text name="Pasted text (65 lines)">
Projeto: NivoTech "Bicos" — telas completas do aplicativo

Use o design system já criado neste projeto como base obrigatória (cores, tipografia, espaçamentos, componentes). Nenhuma tela deve introduzir cor, fonte ou espaçamento fora dos tokens definidos.

O que é o app

Marketplace mobile-first que conecta construtoras/recrutadores a trabalhadores da construção civil para trabalhos avulsos de curta duração ("bicos" — diárias, fins de semana, dias pontuais). Dois públicos, duas experiências completamente distintas dentro do mesmo app. O tom deve ser profissional e confiável: envolve renda real e contratação real, não entretenimento. Público majoritariamente em celular Android de entrada, muitas vezes em canteiro de obra, sob sol forte e com conexão instável.

Como o ecossistema funciona (fluxo central)

Ambos os tipos de usuário se cadastram e escolhem seu perfil: Candidato (trabalhador) ou Recrutador (construtora/contratante).
O Recrutador cria uma vaga de bico, preenchendo todos os dados que o Candidato precisa para decidir: tipo de serviço, local, data, horário/período, valor da diária, duração, requisitos, quem contrata.
Os Candidatos veem um mural com vagas de vários recrutadores diferentes. Vagas impulsionadas (pagas pelo recrutador, para bicos urgentes) aparecem no topo, claramente sinalizadas como destaque — sem parecer enganoso.
O Candidato analisa a vaga e se candidata.
O Recrutador recebe vários candidatos por vaga, analisa os perfis e escolhe quem faz mais sentido.
Quando o candidato avança de etapa, um botão de contato via WhatsApp é liberado para ambos os lados — só nesse momento, nunca antes.
Ambos os lados têm perfil público, analisável pelo outro lado antes de decidir.

Telas a criar

Comuns aos dois perfis:

Abertura/splash
Escolha de perfil (Candidato ou Recrutador) — decisão importante, deve ser visualmente clara e explicar a diferença
Cadastro (e-mail/senha + Google)
Verificação de e-mail (com estado de espera e reenvio)
Login
Esqueci minha senha e redefinição de senha
Notificações
Configurações, incluindo privacidade: exportar meus dados e excluir minha conta (exigência legal LGPD)

Fluxo do Candidato:

Mural de bicos (lista principal) — com vagas impulsionadas no topo, diferenciadas visualmente
Busca e filtros (tipo de serviço, região, data, faixa de valor)
Detalhe da vaga — tudo que ele precisa para decidir, com valor e data em destaque máximo
Confirmação de candidatura
Minhas candidaturas — com status claro de cada uma (enviada, em análise, selecionado, não selecionado)
Tela de "você foi selecionado" — momento de maior emoção do app, com botão de WhatsApp liberado
Meu perfil (visualização e edição): experiência, especialidades, disponibilidade, avaliações recebidas
Perfil de um recrutador (como o candidato o vê antes de se candidatar)

Fluxo do Recrutador:

Painel inicial — vagas ativas, candidatos novos aguardando análise
Criar vaga — formulário em etapas, simples de preencher no celular
Minhas vagas publicadas (ativas, encerradas)
Detalhe da vaga + lista de candidatos recebidos
Perfil de um candidato (como o recrutador o avalia antes de escolher)
Escolher candidato e fechar o bico — com botão de WhatsApp liberado após a escolha
Impulsionar vaga (destaque pago) — explicar o valor de forma honesta
Perfil da empresa (visualização e edição)
Histórico de bicos realizados

Requisitos de qualidade obrigatórios em todas as telas

Mobile-first, navegação por bottom navigation, nada que dependa de mouse ou hover
Alvos de toque de no mínimo 44px, alto contraste (uso sob luz solar direta)
Todo componente principal precisa das quatro versões: normal, carregando, erro, e vazio/sem dados
Componentes reutilizáveis e consistentes entre telas (card de vaga, badge de status, avatar, botão, input) — o mesmo card de vaga deve ser o mesmo em toda parte
Linguagem simples e direta em português do Brasil, sem jargão técnico ou de RH — o candidato pode ter baixa familiaridade digital
Hierarquia visual: nas vagas, valor da diária e data são a informação mais importante da tela
Pensado para depois ser portado para React Native: flexbox, listas, cards, ícones vetoriais, sem efeitos exclusivos de navegador

Comece pelo fluxo do Candidato (do mural até o "selecionado"), depois o fluxo do Recrutador, depois as telas comuns.
</pasted_text>

<!-- The user explicitly selected the following skills for this project, as attachments to their message. These are not optional context — they define how you work. Use them. -->
<attached-skill name="Design Components">
This project uses Design Components: every design is a single streaming `Name.dc.html` file. The full authoring spec is in your system prompt under "Writing code — Design Components" — follow it. Author and edit `.dc.html` content with the `dc_write`, `dc_html_str_replace`, `dc_js_str_replace`, and `dc_set_props` tools (not `write_file`; `str_replace_edit` works but won't stream); template edits stream into the live preview as you type.
</attached-skill>

<attached-skill name="Hi-fi design">
Create a high-fidelity, polished design.

Follow this general design process (use the todo list to remember):
(1) ask questions, (2) find existing UI kits and collect design context — copy ALL relevant components and read ALL relevant examples; ask the user if you can't find them, (3) start your file with assumptions + context + design reasoning (as if you are a junior designer and the user is your manager), with placeholders for the designs, and show it to the user early, (4) build out the designs and show the user again ASAP; append some next steps, (5) use your tools to check, verify and iterate on the design.

Good hi-fi designs do not start from scratch — they are rooted in existing design context. Ask the user to Import their codebase, or find a suitable UI kit / design resources, or ask for screenshots of existing UI. You MUST spend time trying to acquire design context, including components. If you cannot find them, ask the user for them. In the Import menu, they can link a local codebase, provide screenshots or Figma links; they can also link another project. Mocking a full product from scratch is a LAST RESORT and will lead to poor design. If stuck, try listing design assets and ls'ing design system files — be proactive! Some designs may need multiple design systems — get them all. Use the starter components (device frames and the like) to get high-quality scaffolding for free.

When showing multiple design options on one page, decide between (a) a single full-size responsive prototype with a tweaks panel, or (b) a vertical stack of anchored option cards. Choose based on how design-y vs prototype-y the ask is, how many options there are, and how big each is. For (b):

Present multiple design options as a vertical stack of turns — each turn of options is its own `<section>`, newest turn at the **top**, and every option gets a stable `{turn}{letter}` id (`1a`, `1b`, `2a`…) that the user references back in chat and you cross-link between turns. Always include `<meta name="design_doc_mode" content="canvas">` in `<helmet>` — the host provides pan/zoom, so the user can freely zoom out on designs wider than the viewport.

**How to write it** — put one `<style>` block in `<helmet>`, then one `<section class="dv-turn">` per turn as a **direct child of the root** (right after `</helmet>`, no wrapper). When the user asks for another round, **insert the new section ABOVE the existing ones** so the latest work sits at the top; never reorder, renumber, or delete earlier turns.

```html
<helmet data-dc-atomics><meta name="design_doc_mode" content="canvas"><style>body{margin:0;background:#f0eee9;font-family:system-ui,sans-serif}.dv-turn{padding:40px 44px 32px;border-bottom:1px solid rgba(0,0,0,.08);scroll-margin-top:16px}.dv-thd{display:flex;align-items:baseline;gap:10px;margin:0 0 20px}.dv-tid{font:600 10px ui-monospace,Menlo,monospace;padding:3px 7px;background:#1a1a1a;color:#fff;border-radius:4px;text-decoration:none}.dv-tname{font:600 13px/1.2 system-ui,sans-serif;color:#1a1a1a}.dv-opts{display:flex;flex-wrap:wrap;gap:28px;align-items:flex-start}.dv-opt{flex:none;display:flex;flex-direction:column;gap:9px;scroll-margin-top:16px}.dv-oid{font:600 10.5px ui-monospace,Menlo,monospace;padding:3px 7px;background:rgba(0,0,0,.08);color:#1a1a1a;border-radius:5px;text-decoration:none}.dv-olabel{display:flex;align-items:baseline;gap:8px;font:400 11px/1.3 system-ui,sans-serif;color:rgba(0,0,0,.55)}.dv-card{max-width:100%;background:#fff;border:1px solid rgba(0,0,0,.08);border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,.06);overflow:hidden}.dv-opt:target .dv-oid{background:#2a78d6;color:#fff}.dv-next{margin:22px 0 0;font:12px/1.5 system-ui,sans-serif;color:rgba(0,0,0,.5)}</style></helmet>
<section class="dv-turn" id="t2">
<div class="dv-thd"><a class="dv-tid" href="#t2">2</a><span class="dv-tname">Riffs on <a class="dv-oid" href="#1b">1b</a></span></div>
<div class="dv-opts">
<div class="dv-opt" id="2a"><div class="dv-olabel"><a class="dv-oid" href="#2a">2a</a>Tighter spacing</div><div class="dv-card" style="width:360px">…design…</div></div>
<div class="dv-opt" id="2b">…</div>
</div>
<p class="dv-next">Try next: "more like <a class="dv-oid" href="#2a">2a</a> but with the serif from <a class="dv-oid" href="#1c">1c</a>" · "make <a class="dv-oid" href="#2b">2b</a> full-bleed" · "new directions"</p>
</section>
<section class="dv-turn" id="t1">…turn 1, unchanged…</section>
```

**Rules:** turn section ids are `t1`, `t2`, `t3`…; option ids are `1a`, `1b`, `2a`… and go on the option's **outermost** element (`.dv-opt`), never on the badge — so `#1b` scrolls the whole option into view. Ids are stable forever, never reused or renumbered. Options within a turn sit side-by-side in a wrapping row; don't hand-roll your own pan/zoom — the host canvas provides it. **Every** option-id reference in the file — turn heading, option label, `.dv-next` line, any prose — is an `<a class="dv-oid" href="#1b">1b</a>` link, never a bare `1b`; in your chat replies, just write `1b`. End each turn with a one-line `.dv-next` of 2–3 plain-English follow-ups the user could paste into chat. Size each `.dv-card` to its content (explicit width is fine); don't use `height:100%`.

When designing, asking many good questions is ESSENTIAL.

Give options: try to give 3+ variations across several dimensions. Mix by-the-book designs that match existing patterns with new and novel interactions, including interesting layouts, metaphors, and visual styles. Have some options that use color or advanced CSS; some with iconography and some without. Start your variations basic and get more advanced and creative as you go! Try remixing the brand assets and visual DNA in interesting ways — play with scale, fills, texture, visual rhythm, layering, novel layouts, type treatments. The goal is not the perfect option; it's exploring atomic variations the user can mix and match.

CSS, HTML, JS and SVG are amazing. Users often don't know what they can do. Surprise the user.

If you do not have an icon, asset or component, draw a placeholder: in hi-fi design, a placeholder is better than a bad attempt at the real thing.
</attached-skill>

<attached-skill name="Interactive prototype">
Create a fully interactive prototype with realistic state management and transitions. Use React useState/useEffect for dynamic behavior. Include hover states, click interactions, form validation, animated transitions, and multi-step navigation flows. It should feel like a real working app, not a static mockup.
</attached-skill>

<attached-skill name="Bicos Design System (design system)">
[Design System] This project uses the **Bicos Design System** design system. This is a binding choice for visual style — every visual must follow it. Don't invent colors, type, spacing, or components not grounded here.

Scope: the design system is a visual style reference only. Its guide may describe example products, brands, or people that are unrelated to the user and unrelated to the subject of this conversation. Never treat anything in the design system as a fact about the user, their work, or the topic they asked about.

This project has the **BicosDesignSystem_dedf03** design system bound at `_ds/bicos-design-system-dedf03ff-6e20-4cba-ae9e-0a973182e03e/`. If anything under that path is missing or fails to load, the folder name may differ — `list_files` `_ds/` and use the folder whose name ends with dedf03ff-6e20-4cba-ae9e-0a973182e03e instead, including in the <link>/<script> paths below.

**Loading the bundle is how you use this design system.** Every Design Component you build must load `_ds/bicos-design-system-dedf03ff-6e20-4cba-ae9e-0a973182e03e/_ds_bundle.js` in `<helmet>` (include it in child DCs too — de-duped by URL) and compose with its components — do not recreate those components from scratch or restyle raw HTML to look like them. At the top of the template:

```html
<helmet>
  <link rel="stylesheet" href="_ds/bicos-design-system-dedf03ff-6e20-4cba-ae9e-0a973182e03e/tokens/fonts.css">
  <link rel="stylesheet" href="_ds/bicos-design-system-dedf03ff-6e20-4cba-ae9e-0a973182e03e/tokens/colors.css">
  <link rel="stylesheet" href="_ds/bicos-design-system-dedf03ff-6e20-4cba-ae9e-0a973182e03e/tokens/typography.css">
  <link rel="stylesheet" href="_ds/bicos-design-system-dedf03ff-6e20-4cba-ae9e-0a973182e03e/tokens/spacing.css">
  <link rel="stylesheet" href="_ds/bicos-design-system-dedf03ff-6e20-4cba-ae9e-0a973182e03e/tokens/radius.css">
  <link rel="stylesheet" href="_ds/bicos-design-system-dedf03ff-6e20-4cba-ae9e-0a973182e03e/tokens/elevation.css">
  <link rel="stylesheet" href="_ds/bicos-design-system-dedf03ff-6e20-4cba-ae9e-0a973182e03e/tokens/motion.css">
  <link rel="stylesheet" href="_ds/bicos-design-system-dedf03ff-6e20-4cba-ae9e-0a973182e03e/tokens/semantic.css">
  <link rel="stylesheet" href="_ds/bicos-design-system-dedf03ff-6e20-4cba-ae9e-0a973182e03e/tokens/base.css">
  <link rel="stylesheet" href="_ds/bicos-design-system-dedf03ff-6e20-4cba-ae9e-0a973182e03e/styles.css">
  <script src="_ds/bicos-design-system-dedf03ff-6e20-4cba-ae9e-0a973182e03e/_ds_bundle.js"></script>
</helmet>
```

Then mount any component directly in the template — no logic class needed:

```html
<x-import component-from-global-scope="BicosDesignSystem_dedf03.Button" hint-size="auto,40px">Label</x-import>
```

Props are template attributes (kebab → camelCase); template children pass through as `props.children`. The linked stylesheet(s) carry the design tokens (colors, type, spacing) — style against those via `var(--*)` and the design system's classes rather than guessing values.

**Start from a template if one matches.** Before building from scratch, check whether a template below matches the user's request. Read the template (list its folder, `read_file` the entry) and decide: if it's close to what's asked, `copy_files` the folder as your starting point; if you'd rather re-author in DC, `dc_write` a new page using the template as your structural reference. When this design system is bound, `copy_files` repoints the copied `ds-base.js` automatically — only edit its base line yourself if the copy result says so, or when copying from an unbound project (change `'../..'` to your `_ds/bicos-design-system-dedf03ff-6e20-4cba-ae9e-0a973182e03e` path). (Older templates have no `ds-base.js` and carry `../../…` bundle/stylesheet refs in their pages instead — repoint those by hand.)

- `Tela de app (mobile)` (`/projects/dedf03ff-6e20-4cba-ae9e-0a973182e03e/templates/tela-app/`) — Casca de tela do Bicos: barra superior azul, filtros, lista de vagas e navegação inferior de 64px.

The full design-system source tree lives at `/projects/dedf03ff-6e20-4cba-ae9e-0a973182e03e/` — use `list_files` / `read_file` from there for anything not under `_ds/` (layout varies by brand; don't assume folder names). Its guide is reproduced below so you don't need to fetch it:

<design-system-guide>
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
- Sem `&lt;a&gt;`, `&lt;select&gt;`, `&lt;input type="..."&gt;` nativos como dependência de comportamento — eles valem para a versão web, mas cada componente documenta a intenção (link, escolha única, campo de texto) para ser reimplementado com `Pressable`/`TextInput`/etc. no RN.
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

**Como é aplicado:** o componente `Icon` carrega o SVG estático do Lucide via CDN (`https://unpkg.com/lucide-static/icons/&lt;nome&gt;.svg`) e o usa como **máscara CSS** sobre `background-color: currentColor`. Assim o ícone herda a cor do texto (inclusive dentro de botão azul) sem nenhum SVG inline no código. Não há sprite, não há icon font, não há PNG.

```jsx
&lt;Icon name="hard-hat" size={24} label="Pedreiro" /&gt;
&lt;Icon name="map-pin" size={16} color="var(--text-muted)" /&gt;
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

</design-system-guide>
</attached-skill>

## Assistant



## Assistant

_[tool: list_files]_

_[tool: list_files]_

_[tool: read_file]_

_[tool: list_files]_

_[tool: list_files]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: list_files]_

_[tool: run_script]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

Design system e UI kits lidos (componentes, tokens, kits pedreiro/construtora). Antes de construir, 10 perguntas — todas mudam o que eu entrego.

_[tool: ask_user]_

Formulário no ar — aguardando suas respostas (formato de entrega, escopo, vocabulário, login, estados, e os fatos do impulsionamento) para começar pelo fluxo do candidato.

## User

Answered — Asked for follow-up questions; formato: Protótipo navegável — um app tocável, telas ligadas por navegação real; escopo: Só o fluxo do candidato (mural → detalhe → candidatura → selecionado → perfil); vocabulario: Trabalhador e Construtora; cadastro: E-mail/senha + Google + celular como alternativa; estados: Uma seção separada só de estados, telas principais em estado normal; impulsionar: seria parecido com o patrocinio do google nos sites, quem mais paga mais terá prioridade de aparecer no topo e a vaga terá algo sinalizando de que ela é uma vaga emergente para os trabalhadores; ve…

## Assistant



## Assistant

_[tool: ask_user]_

Segunda rodada no ar — aguardando as três decisões (sinal da vaga impulsionada, etapas do status, e se o mural abre antes do login).

## User

Answered — sinal_vaga: Selo "Urgente" + linha discreta "Vaga em destaque" (transparência total); etapas_status: Enviada → Em análise → Pré-selecionado (WhatsApp) → Contratado → Diária concluída → Avaliação; mural_primeiro: Login antes de tudo

## Assistant

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

Contexto coletado. Construindo o protótipo do fluxo do trabalhador.

_[tool: update_todos]_

_[tool: dc_write]_

_[tool: show_html]_

_[tool: ready_for_verification]_

Fluxo do trabalhador no ar: login → mural (com as impulsionadas marcadas "Urgente" + "Vaga em destaque") → detalhe → confirmar → enviada → minhas candidaturas → pré-selecionado com WhatsApp liberado, mais perfil do trabalhador, perfil da construtora e avaliação. Tudo tocável; ao lado do telefone fica o quadro de estados (carregando, vazio, erro, sem sinal, botão, campo, badges de etapa).

Três controles de tweak: tela inicial, quantidade de vagas impulsionadas e exibir/ocultar o quadro de estados.

Próximo passo, se aprovar: fluxo da construtora (painel, criar vaga em etapas, candidatos, escolher e fechar o bico, impulsionar) e depois as telas comuns.

## User

Found issues — fixing…

## Assistant

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: ready_for_verification]_

Corrigido: ícone do Google trocado por um válido (não aparece mais o quadrado preto), badge "Pré-selecionado" agora é cápsula clara sobre o azul, bicos encerrados passaram a ter datas passadas próprias (a tela de avaliação bate com o card que a abre), o título duplicado da tela de envio saiu, e os chips do filtro agora selecionam de verdade — o mural reflete o que foi escolhido.

## User

Found issues — fixing…

## Assistant

_[tool: str_replace_edit]_

_[tool: ready_for_verification]_

O painel de filtros agora só fecha ao tocar fora dele ou nos botões — dá para escolher tipo, distância, período e faixa de valor numa visita só.

## User

na tela de perfil faça ela ficar assim com a opção do usuário colocar a foto de perfil e um banner com exatamente a mesma contrução e formato como no print faça isso e coloque uma imagem de exemplo diferente da do print

## Assistant

_[tool: copy_starter_component]_

_[tool: str_replace_edit]_

_[tool: tool_search_tool_bm25]_

_[tool: show_html]_

_[tool: multi_screenshot]_

_[tool: ready_for_verification]_

A tela de perfil agora tem a mesma construção do print: capa no topo, foto redonda sobrepondo a capa pela esquerda com anel branco, selo azul de verificado no canto da foto, nome e cargo abaixo. Um botão de câmera no canto da capa sinaliza a troca.

Dois pontos:

Não consigo gerar imagens, então deixei os dois espaços (capa e foto) como campos que você preenche — arraste um arquivo para dentro deles, ou clique para escolher; a imagem fica salva e aparece nas próximas aberturas. Se você me mandar as fotos, eu já coloco.

O selo de verificado veio do print, mas você me disse que esta versão não terá verificação de documento. Se preferir, troco por um selo com fato ("64 diárias pagas") ou removo.

## User

Found issues — fixing…

## Assistant

_[tool: grep]_

_[tool: read_file]_

_[tool: grep]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: ready_for_verification]_

Textos dos campos de imagem agora em português ("ou escolher do celular"), e o círculo da foto de perfil mostra só a legenda — sem texto batendo no selo azul.

## User

remova esse header azul de todas as telas, e na tela de perfil adicione da melhor forma possível um botão de editar o perfil onde o usuário consiguira editar todo o perfil e adicionar e trocar as fotos

## Assistant

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: str_replace_edit]_

## User

pegue como exemplo esse menu de navegação mobile e faça ele da melhor forma possível nesse projeto, ajuste o botão de editar o perfil na seção do perfil ajuste e coloque no canto direito do lado do nome do user

## Assistant

_[tool: view_image]_

_[tool: read_file]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: ready_for_verification]_

Navegação inferior agora é um dock flutuante com ícones em círculo (o do item ativo preenchido em azul), rótulo sempre visível abaixo — inspirado no menu que você mandou, mas sóbrio, sem blur nem transparência, seguindo o design system. Botão "Editar" movido para o canto direito, ao lado do nome.

## User

ajuste da melhor forma possível a barra de navegação você deve ser o melhor ux design e deve deixa ela mais bonita e proporcional, pois ela ficou muito gorda e ta quase vazando os itens, se baseie na nova do instagram a barra de navegação ilha flutuante, tire esse background branco feio deixe somente a da ilha flutuante

## Assistant

_[tool: grep]_

_[tool: read_file]_

_[tool: read_file]_

Now applying the redesign — icon-only floating island, dark solid capsule, absolutely positioned so it stops fighting the layout for height.

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: grep]_

_[tool: str_replace_edit]_

Also need the phone screen root to be `position:relative` so the floating pill anchors correctly (it already is).

_[tool: ready_for_verification]_

Nav agora é uma ilha flutuante compacta: cápsula sólida escura, só ícones (sem faixa branca por trás), item ativo com círculo azul preenchido. Ajustei o espaço no fim das listas para o conteúdo não ficar escondido atrás da ilha.

## User

deixe a ilha flutuante ma larga horizontalmente, deixe ela no tema claro e deixe o background dela meio transparente fosca como a do instagram

## Assistant

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: ready_for_verification]_

Ilha agora mais larga, clara e fosca (fundo branco translúcido com blur), item ativo em círculo azul.

## User

ajuste o header da tela inicial, adicione um sino de notificação no topo a direita e você deve ser o melhor ux design do mundo e com base nisso você deve fazer essas alterações da melhor forma possível: 

a esquerda adicione um botão com a localização atual do usuário onde se ele clicar no botão ele consegue alterar a localização para encontar os bicos e reformule a seção dos filtros para não haver mais rolagem horizontal e adicione algo ha mais em que possa ajudar e facilitar a vida do usuário em algo no app,
e nos cards de bico ajuste a meneira que o valor do bico aparecerá destacando e ficando mais bonito e atraente da melhor forma possível, e ajuste os cards deixando-os mais bonitos e atraentes e bem trabalhados de forma simples, bonito, minimalista e atraente faça essas alterações da melhor forma possível.

## Assistant

_[tool: read_file]_

_[tool: read_file]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

Now the location sheet and the logic behind the header, sort and filter chips.

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: show_html]_

_[tool: multi_screenshot]_

_[tool: str_replace_edit]_

_[tool: ready_for_verification]_

Header do mural refeito:

Esquerda: botão de localização ("Bicos perto de / Tatuapé, SP") que abre uma folha com bairros, contagem de bicos em cada um e "Usar minha localização agora". Direita: sino com contador de notificações.

Filtros sem rolagem horizontal: um botão "Filtros · 3" mais os filtros ativos como chips removíveis (com "x"), que quebram em linha em vez de rolar.

Dois acréscimos que ajudam de verdade: ordenação em três abas — Mais perto / Maior valor / Mais cedo (funciona de verdade) — e, dentro dos filtros, um aviso opcional "Avisar quando aparecer bico urgente" com esses mesmos filtros.

Cards refeitos: valor da diária em bloco azul destacado no canto direito (Space Mono, 22px, com "por diária" abaixo), data em cápsula sólida em negrito, local e distância em linha discreta, e a faixa "Urgente / Vaga em destaque" agora é uma tarja dentro do próprio card — sem card dentro de card. O mesmo card aparece em Minhas candidaturas (os encerrados com o valor em cinza).

## User

você deve ser o melhor ux design do mundo com mais de 40 anos de experiencia e com base nisso você deve fazer essas alterações da melhor forma possível: 

deixe centralizada o container onde fica o valor do bico na vertical nos cards no inicio,
e Na seção dos bicos em que se cadastrou "enviado" de uma leve reformulada da melhor forma possível nos cards deixe eles mais bonitos, atraentes, minimalista e bem contruidos de forma estratégica

## Assistant

_[tool: str_replace_edit]_

_[tool: run_script]_

_[tool: multi_screenshot]_

_[tool: show_html]_

_[tool: multi_screenshot]_

_[tool: ready_for_verification]_

No mural, o bloco do valor agora fica centralizado verticalmente em relação ao título e à empresa.

Em "Minhas candidaturas", os cards foram refeitos com outra estratégia: o status saiu de cima do card e virou uma faixa de rodapé dentro dele — badge do status à esquerda, próxima ação à direita ("Falar no WhatsApp", "Avaliar a obra", "Ver a vaga") com seta. O valor perdeu o bloco azul (ali o dinheiro é informação secundária, o status é o que importa) e ficou em mono discreto à direita; data e local em uma linha só. Nos encerrados, valor e ação em cinza para o card não competir com os ativos.

## User

Found issues — fixing…

## Assistant

_[tool: str_replace_edit]_

_[tool: ready_for_verification]_

Beco sem saída corrigido: as telas de compromisso (detalhe da vaga, confirmar, construtora, avaliar, selecionado) voltaram a ter uma barra branca de topo com seta de voltar e o título — na linguagem clara nova, sem azul. Mural, candidaturas e perfil seguem sem barra, com seus próprios cabeçalhos.

## User

Check didn’t complete

## Assistant

## User

continue o que você estava fazendo da melhor forma possível e conclua

## Assistant

_[tool: show_html]_

_[tool: get_webview_logs]_

Página carrega sem erros no console.

_[tool: ready_for_verification]_

Concluído — a correção da barra de voltar nas telas de compromisso está no ar e carregando sem erros.

## User

Found issues — fixing…

## Assistant

_[tool: str_replace_edit]_

_[tool: ready_for_verification]_

Corrigido — a barra de status voltou ao fundo neutro em todas as telas.

## User

da mesma forma que você fez no perfil faça nos cards das vagas faça com que tenha a logo da marca redondo no meio da seção entre as informações uma imagem onde o recrutador irá colocar para mostrar a imagem do local da obra não copie exatamente como a imagem faça da sua versão melhorada mais bonita simples clean e sofisticada dessa versão faça isso da melhor forma possível e deve aparecer a logo do negocio entre a imagem e o fundo branco exatamente como você fez no perfil.

## Assistant

_[tool: read_file]_

_[tool: grep]_

_[tool: grep]_

Good, image-slot is already loaded. Building the new job-card structure now (photo + overlapping round company logo, matching the profile treatment).

_[tool: run_script]_

_[tool: grep]_

Right, the earlier "Found issues" edit for vertical-centering reverted my run_script attempt (it never actually applied since the anchor threw before saving—no changes were made). Let me read exact current lines and redo precisely.

_[tool: read_file]_

_[tool: read_file]_

_[tool: run_script]_

_[tool: show_html]_

_[tool: ready_for_verification]_

Cards de vaga no mural agora têm foto do canteiro no topo (arrastável/preenchível pelo recrutador) com o logo da construtora em círculo sobrepondo a borda entre a foto e o conteúdo branco — mesmo tratamento do perfil, versão própria: cápsula do valor, data e local abaixo. Nos destacados, o selo "Urgente" e "Vaga em destaque" viraram tarjas sólidas sobre a própria foto.

