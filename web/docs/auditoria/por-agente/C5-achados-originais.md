# C5 — Componentes de UI (web/src/components, 65 arquivos) (auditoria AUD)

Transcrito pelo consolidador a partir do relatório final do agente C5 (o agente não conseguiu gravar o arquivo; `coverage.tsv` e `comandos.txt` existem). Leu por inteiro os 65 arquivos (exceto `icons/iconData.ts`, amostrado: linhas 1-71 lidas, o resto decodificado por script: 94 ícones, todos SVG válidos). Nada reproduzido em navegador; as provas são leitura, renderização de servidor com os componentes reais (`render.tsx`) e cálculo de contraste (`contrast.py`). Contagem: S0 0, S1 0, S2 4, S3 16, M 0. Caminhos relativos a `web/src/`.

### C5-001 — A linha do candidato é uma `div` com clique, sem teclado nem papel

- Área: acessibilidade
- Severidade: S2
- Esforço: P
- Confiança: confirmado
- Onde: `components/CandidateRow.tsx:47-53`; `pages/recruiter/JobManage.tsx:306`
- Prova: é uma `div` com `onClick`, sem `tabIndex`, `role` nem tecla; em `JobManage.tsx:306` esse clique é o único caminho para o perfil do candidato.
- Impacto: quem usa teclado ou leitor de tela não consegue abrir o perfil de um candidato, que é o passo central da empresa.
- Causa raiz: elemento clicável não semântico.
- Correção recomendada: nome do trabalhador como botão, como o `JobTile` já faz (X05).
- Critério de aceite: Tab chega ao candidato e Enter abre o perfil; axe sem violação.
- Dependências: nenhuma

### C5-002 — Sem foco visível em Checkbox, Radio/RadioCard, Switch, PhotoSlot, PhotoManager e carrossel

- Área: acessibilidade
- Severidade: S2
- Esforço: P
- Confiança: confirmado
- Onde: `components/Checkbox.tsx`, `Radio.tsx`, `Switch.tsx`, `PhotoSlot.tsx`, `PhotoManager.tsx`, `PhotoCarousel.tsx:198-201`, `JobTile.tsx`, `JobMap.tsx:82`, `WhatsAppButton.tsx`
- Prova: `outline-none` com `tabindex=0` no carrossel; o foco é quase invisível no título do `JobTile`, no botão do `JobMap` e no `WhatsAppButton` (`ring-brand-100` = 1,27:1; WhatsApp = 1,21:1). Nenhum `peer-focus` existe no projeto.
- Impacto: quem navega por teclado não sabe onde está; falha WCAG 2.4.7 / 1.4.11.
- Causa raiz: controles customizados escondem o input nativo sem reproduzir o foco.
- Correção recomendada: `peer-focus-visible:outline` no desenho do controle, anel `brand-500`.
- Critério de aceite: foco visível com contraste ≥ 3:1 em todos esses controles (teste Playwright com Tab).
- Dependências: nenhuma (relacionado a C3-011)

### C5-003 — `QueryView`/`runQuery` sem prazo: pedido travado deixa o esqueleto para sempre

- Área: bug
- Severidade: S2
- Esforço: M
- Confiança: provável
- Onde: `services/queries.ts:63-79`; `components/QueryView.tsx`
- Prova: leitura do código; nenhum timeout; complementa D4-007, que só trata das Edge Functions.
- Impacto: em rede ruim, a tela fica no esqueleto sem "Tentar de novo" (o padrão B10 do CLAUDE.md proíbe isso).
- Causa raiz: sem prazo nas consultas.
- Correção recomendada: `Promise.race` de ~20 s que vira estado de erro com "Tentar de novo".
- Critério de aceite: teste com promessa que nunca resolve termina em erro.
- Dependências: D4-007

### C5-004 — Captcha sem tratar `timeout-callback`/`unsupported-callback` do Turnstile: "Entrar" gira até recarregar

- Área: bug
- Severidade: S2
- Esforço: P
- Confiança: provável
- Onde: `components/Captcha.tsx:59-67,82-91`; `pages/shared/Login.tsx:183`
- Prova: `getToken()` pode nunca resolver; o botão fica girando.
- Impacto: quando o Turnstile for ligado, uma falha dele trava o login (spinner eterno).
- Causa raiz: callbacks de falha ausentes.
- Correção recomendada: tratar os dois callbacks e rejeitar `getToken()` com erro amigável e prazo.
- Critério de aceite: teste com o widget simulando timeout mostra erro e libera o botão.
- Dependências: ação do responsável (ligar Turnstile) torna o problema real

### C5-005 — `Button loading` perde o nome acessível, encolhe e fica desativado

- Área: acessibilidade
- Severidade: S3
- Esforço: P
- Confiança: confirmado (renderização)
- Onde: `components/Button.tsx`
- Prova: renderização de servidor com o componente real.
- Impacto: leitor de tela não anuncia o botão durante o carregamento; o layout pula.
- Causa raiz: o rótulo sai do DOM no estado de carregamento.
- Correção recomendada: manter o rótulo (visualmente oculto) e a largura.
- Critério de aceite: nome acessível preservado em `loading`.
- Dependências: nenhuma

### C5-006 — `PhotoSlot` com foto escolhida tem campo de arquivo sem nome; remover do `PhotoManager` tem 28 px

- Área: acessibilidade
- Severidade: S3
- Esforço: P
- Confiança: confirmado
- Onde: `components/PhotoSlot.tsx`, `PhotoManager.tsx`
- Prova: leitura e medida de classes.
- Impacto: nome ausente e alvo de toque pequeno.
- Causa raiz: falta de `aria-label` e `tap-target`.
- Correção recomendada: `aria-label` e `tap-target`.
- Critério de aceite: axe e alvo ≥ 44 px.
- Dependências: nenhuma

### C5-007 — `Rating showValue={false}` não tem texto equivalente

- Área: acessibilidade
- Severidade: S3
- Esforço: P
- Confiança: confirmado
- Onde: `components/Rating.tsx`; `pages/shared/ReviewsScreen.tsx:89`
- Prova: leitura.
- Impacto: o leitor de tela não lê a nota.
- Causa raiz: estrelas só visuais.
- Correção recomendada: `aria-label="Nota 4,5 de 5"` ou texto `sr-only`.
- Critério de aceite: a nota é anunciada.
- Dependências: nenhuma

### C5-008 — Erro não ligado ao campo em `Select`, `CodeInput` e `AboutField`; o CEP aponta para um id que some

- Área: acessibilidade
- Severidade: S3
- Esforço: P
- Confiança: confirmado
- Onde: `components/Select.tsx`, `CodeInput.tsx`, `AboutField.tsx`, `AddressFields.tsx:125,148`
- Prova: sem `aria-invalid`/`aria-describedby`; o id do erro do CEP não existe no DOM em alguns estados.
- Impacto: o leitor de tela não associa o erro ao campo.
- Causa raiz: associação não implementada.
- Correção recomendada: `aria-invalid` e `aria-describedby` com id estável.
- Critério de aceite: axe e teste de leitura da árvore de acessibilidade.
- Dependências: nenhuma

### C5-009 — Botões abaixo de 44 px sem `tap-target`

- Área: acessibilidade
- Severidade: S3
- Esforço: P
- Confiança: confirmado
- Onde: olho da senha 36 px (`components/Input.tsx`), "Colar código" 40 px (`CodeInput.tsx`), painel de notificações 32 px (`NotificationsPanel.tsx`), toast 36 px (`ToastHost.tsx`), "Trocar" 36 px, entre outros
- Prova: valores de classe.
- Impacto: erro de toque em celulares simples.
- Causa raiz: `tap-target` não aplicado (ver C3-008).
- Correção recomendada: aplicar `tap-target`.
- Critério de aceite: teste de alvo mínimo nas telas.
- Dependências: nenhuma (consolidar com C3-008)

### C5-010 — Contrastes abaixo de WCAG AA

- Área: acessibilidade
- Severidade: S3
- Esforço: P
- Confiança: confirmado (cálculo em `contrast.py`)
- Onde: botão WhatsApp 4,31:1; botão accent 3,98:1; placeholder 3,11:1; borda de campo e trilho do Switch 1,67:1; linha de candidato apagada 2,54:1 (`styles/tokens.css` e componentes)
- Prova: `$SCRATCH/out/C5/comandos.txt`.
- Impacto: leitura difícil sob sol, justamente o uso do público-alvo.
- Causa raiz: tokens de cor escolhidos sem checar contraste.
- Correção recomendada: ajustar tokens para ≥ 4,5:1 (texto) e ≥ 3:1 (componentes).
- Critério de aceite: teste automatizado de contraste dos tokens.
- Dependências: nenhuma

### C5-011 — Toast some em 4 s, inclusive erro e "Desfazer", sem pausar

- Área: acessibilidade
- Severidade: S3
- Esforço: P
- Confiança: confirmado
- Onde: `services/toast.ts`; `components/ToastHost.tsx`
- Prova: leitura.
- Impacto: pessoas que leem devagar perdem a mensagem de erro.
- Causa raiz: tempo fixo.
- Correção recomendada: pausar ao toque/foco e prolongar erros.
- Critério de aceite: erro permanece até a pessoa fechar ou 10 s.
- Dependências: nenhuma

### C5-012 — `NotificationsPanel` não move nem devolve o foco; selo do sino fora do nome acessível; "Não lida" em `span` com `aria-label`

- Área: acessibilidade
- Severidade: S3
- Esforço: P
- Confiança: provável
- Onde: `components/NotificationsPanel.tsx`
- Prova: leitura.
- Impacto: navegação difícil por teclado/leitor de tela.
- Causa raiz: painel sem gestão de foco.
- Correção recomendada: mover o foco ao abrir e devolver ao fechar; incluir a contagem no nome do botão.
- Critério de aceite: teste de foco.
- Dependências: nenhuma

### C5-013 — O GPS do `CityPicker` pode trocar a cidade depois de a folha ser fechada; a lista usa `listbox`/`option` sem setas

- Área: bug
- Severidade: S3
- Esforço: P
- Confiança: provável
- Onde: `components/CityPicker.tsx`
- Prova: leitura.
- Impacto: cidade muda sozinha; teclado sem setas.
- Causa raiz: resposta atrasada aplicada depois do fechamento.
- Correção recomendada: cancelar ao fechar; implementar setas.
- Critério de aceite: teste de cancelamento.
- Dependências: nenhuma

### C5-014 — Nenhum `img` tem `onError`; o track do carrossel tem `aria-roledescription` sem `role`

- Área: bug
- Severidade: S3
- Esforço: P
- Confiança: confirmado
- Onde: `components/Avatar.tsx`, `JobCover.tsx`, `PhotoCarousel.tsx`
- Prova: leitura.
- Impacto: avatar e foto quebrados ficam vazios; atributo ARIA inválido.
- Causa raiz: sem fallback de imagem.
- Correção recomendada: `onError` com iniciais/ícone; corrigir ARIA.
- Critério de aceite: imagem quebrada mostra o fallback.
- Dependências: nenhuma

### C5-015 — O cartão Mercado Pago não tem prazo para o SDK e não manda o erro ao Sentry

- Área: bug
- Severidade: S3
- Esforço: P
- Confiança: provável
- Onde: `components/MercadoPagoCardForm.tsx`
- Prova: leitura.
- Impacto: falha do SDK sem rastro.
- Causa raiz: sem timeout nem `reportError`.
- Correção recomendada: prazo e `reportError`.
- Critério de aceite: teste simulando SDK que não carrega.
- Dependências: ação do responsável (ligar pagamentos)

### C5-016 — `alertdialog` sem `aria-describedby`; erro do `SignOutDialog` entra no lugar da descrição, sem `role="alert"`

- Área: acessibilidade
- Severidade: S3
- Esforço: P
- Confiança: confirmado
- Onde: `components/Modal.tsx`, `SignOutDialog.tsx`
- Prova: leitura.
- Impacto: a descrição do diálogo não é anunciada.
- Causa raiz: associação ausente.
- Correção recomendada: `aria-describedby` e `role="alert"` no erro.
- Critério de aceite: leitor anuncia título e descrição.
- Dependências: nenhuma

### C5-017 — `h3` fixo em `EmptyState`, `ErrorState` e `ReviewUnavailable`; `JobNotFound` é tela sem saída

- Área: acessibilidade
- Severidade: S3
- Esforço: P
- Confiança: provável (a ausência de menu nessas telas não foi conferida em navegador)
- Onde: `components/EmptyState.tsx`, `ErrorState.tsx`, `NotFound.tsx`
- Prova: leitura.
- Impacto: hierarquia de títulos quebrada; tela de "não encontrado" sem caminho de volta.
- Causa raiz: nível de título fixo.
- Correção recomendada: nível configurável e botão "Voltar ao mural".
- Critério de aceite: axe sem violação de ordem de título; saída visível.
- Dependências: nenhuma

### C5-018 — Textos de 10 a 11 px em pontos importantes

- Área: UX
- Severidade: S3
- Esforço: P
- Confiança: confirmado
- Onde: situação da candidatura, selos, "Novo" (`components/Badge.tsx`, `Tag.tsx` e telas)
- Prova: classes `text-[10px]`/`text-[11px]`.
- Impacto: ilegível para quem tem vista cansada.
- Causa raiz: densidade visual priorizada.
- Correção recomendada: mínimo de 12 px, preferindo 14 px para status.
- Critério de aceite: nenhum texto de status abaixo de 12 px.
- Dependências: nenhuma

### C5-019 — Código morto e comentários desatualizados nos componentes

- Área: código
- Severidade: S3
- Esforço: P
- Confiança: confirmado
- Onde: `Rating editable`, `Input prefix`, `Card lg`, exports do knip (`AVATAR_BORDER`, `StarPicker`, `TileSkeleton`); comentários (`lg`=770 px, não 1024); hex soltos
- Prova: `$SCRATCH/f1/knip.log`.
- Impacto: manutenção.
- Causa raiz: restos de rodadas anteriores.
- Correção recomendada: remover o que não é usado e atualizar comentários.
- Critério de aceite: `knip` sem exports sem uso nos componentes.
- Dependências: nenhuma

### C5-020 — Nenhum teste de comportamento dos componentes

- Área: testes
- Severidade: S3
- Esforço: M
- Confiança: confirmado
- Onde: `web/src/__tests__/` (sem testes de componentes); `useModal` não testado; `web/scripts/a11y-check.mjs`
- Prova: o axe do CI não vê foco, nome em carregamento nem tamanho de toque.
- Impacto: regressões de acessibilidade passam no CI.
- Causa raiz: testes rodam em Node sem DOM (`vite.config.ts`).
- Correção recomendada: testes de componente com jsdom/Playwright para `Modal`, `Button`, `Checkbox`, foco e alvo de toque.
- Critério de aceite: testes cobrindo `useModal` e estados de foco.
- Dependências: nenhuma (relacionado a C3-001, O2)

## Hipóteses não confirmadas

- H1: o `onError` do Brick do Mercado Pago marca falha mesmo em erro não fatal.
- H2: regiões `aria-live` que já nascem com texto podem não ser anunciadas.
- H3: o crédito do mapa é só "© OpenStreetMap", sem link.
- H4: `scrollTo` suave ignora `prefers-reduced-motion`.
- H5: `app.inert` não existe em navegadores antigos.
- H6: o `Sheet` usa `85vh` em vez de `dvh`.

## Bom e deve ser preservado

- `useModal`: pilha de diálogos, armadilha de Tab, Esc só no topo, foco devolvido.
- `ErrorBoundary` com `key={path}` em `App.tsx:167`.
- `BusyOverlay` com trava de 30 s.
- `AutocompleteField` e `AddressFields`: abort e descarte de resposta velha.
- `Tag` (U66), `JobTile` (X05), `CodeInput`, `ThemeToggle` e `FieldError` com `role="alert"`; `tapTarget.test.ts`.
