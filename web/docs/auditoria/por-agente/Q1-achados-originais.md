# Q1 — Desempenho, acessibilidade e robustez, medidos (auditoria AUD)

Transcrito pelo consolidador a partir do relatório final do agente Q1 (o agente não conseguiu gravar o arquivo; scripts `*.cjs`/`*.mjs`, `lh/*.json`, `axe-result.json`, `cold-resultado.jsonl`, `kbd-resultado.json` e prints existem em `$SCRATCH/out/Q1/` e `$SCRATCH/prints/Q1/`). Contagem: S0 0, S1 0, S2 4, S3 12, M 1. Caminhos relativos a `web/`.

### Q1-001 — O service worker baixa 0,88 MB de uma vez na primeira visita (heic2any, mapa, Firebase, tela da equipe, fontes pouco usadas)

- Área: desempenho
- Severidade: S2
- Esforço: P
- Confiança: confirmado (medido)
- Onde: `vite.config.ts:127` (`globPatterns: ['**/*.{js,css,html,woff2,svg}','icons/*.png']`, sem `globIgnores`); `:103` (`registerType:'prompt'`); `src/services/pwa.ts:11-23`; `dist-demo/sw.js`
- Prova: `sw.js` tem `precacheAndRoute` com 123 entradas, 3.097 KiB brutos. Carga a frio de `/login` (`cold.cjs`, CPU 4×): antes do `load` são 5–6 pedidos e 211 KB (brotli); aos 25 s são 121 pedidos e 878 KB. Nesses 878 KB entram `heic2any` 257 KB (só serve a quem manda foto HEIC), `MapCanvas` 44 KB, `firebaseSdk` 28 KB, a tela `Admin`, 8 fontes (122 KB, incluindo 2 do Space Mono, usadas só em códigos) e `icons/og.png` 26 KB (só robôs usam). Linha do tempo no servidor: 211 KB em 3 s, 329 KB em 10 s, 878 KB em 15 s.
- Impacto: no 3G (≈ 50 KB/s) são ~17 s de banda e quase 1 MB do pacote de dados, em segundo plano, disputando com a tela que a pessoa abriu.
- Causa raiz: o pré-cache pega todo `**/*.js`, inclusive o que só carrega sob demanda. O prefetch de todas as telas no ocioso (`App.tsx:147-148`) já foi relatado em C6-006 e soma-se a isso.
- Correção recomendada: `globIgnores` para `heic2any-*`, `MapCanvas-*`, `firebaseSdk-*`, `Admin-*`, `icons/og.png` e `space-mono-*`; `runtimeCaching` `StaleWhileRevalidate` para `/assets/*`.
- Critério de aceite: `cold.cjs` aos 25 s com ≤ 400 KB e ≤ 60 pedidos; o app continua abrindo offline depois da primeira visita.
- Dependências: C6-006

### Q1-002 — Com o relógio do celular errado, o app dobra cada consulta ou desloga a pessoa uma vez por hora

- Área: bug
- Severidade: S2
- Esforço: P
- Confiança: confirmado com o `supabase-js 2.117.2` do projeto e servidor falso; provável no app real
- Onde: `src/services/supabase.ts:44` (`autoRefreshToken:true` sem compensação); `src/services/remote/client.ts:62-72` (`/JWT expired/` leva a `onSessionEnded`); `src/services/remote/session.ts:454-467`
- Prova: `skew.mjs`, relógio adiantado, token de 1 h: +0 h → 0 renovações em 10 consultas; +2 h → 10 renovações; +24 h → 10 renovações. `skew2.mjs`, relógio atrasado, 3 h depois do login: 0 h e −1 h: `REFRESH → DATA 200`; −2,5 h e −5 h: `DATA 401 JWT expired` (`PGRST301`), sem renovar. No app, esse código chama `sessionEnded()`, que faz `signOut` e vai para `/login` com "Sua sessão terminou".
- Impacto: celular com hora errada, com hora automática desligada, bateria zerada ou chip em outro fuso. Adiantado: cada tela espera um pedido extra de renovação. Atrasado: a pessoa é deslogada depois de ~1 h de uso, em loop, sem saber a causa.
- Causa raiz: o `supabase-js` decide "venceu?" com o relógio do aparelho. O app não tenta renovar uma vez antes de encerrar a sessão.
- Correção recomendada: em `request()`, ao receber `PGRST301`/`JWT expired`, chamar `auth.refreshSession()` e repetir uma vez; só depois `onSessionEnded()`. Opcional: comparar o cabeçalho `Date` com `Date.now()` e avisar "O relógio do seu celular está errado".
- Critério de aceite: `skew2.mjs` com −5 mostra `401 → REFRESH → 200` (teste Vitest com o Supabase falso e relógio deslocado).
- Dependências: nenhuma

### Q1-003 — Mural: a 1ª foto de cada cartão carrega de uma vez em 1600 px, e as duas versões (celular e computador) ficam montadas

- Área: desempenho
- Severidade: S2
- Esforço: M
- Confiança: confirmado (DOM); provável (peso em rede: a demonstração não tem fotos)
- Onde: `src/components/PhotoCarousel.tsx:209-216` (`loading={i===0?'eager':'lazy'}`, sem `width/height`/`sizes`); `src/utils/image.ts:8` (`MAX_SIDE=1600`, ~250 KB); `src/pages/worker/feed/Feed.tsx:94-95` (`<MobileFeed/>` e `<DesktopFeed/>` juntos); `src/components/JobTile.tsx:69` (`useDb()` no cartão); nenhuma URL `render/image` em `src/`
- Prova: `dom.cjs` no mural logado: 2 `.tile-grid`, 52 cartões no DOM (26 visíveis), 1.598 nós, tanto a 360 px quanto a 1280 px. Um cartão de ~165 px (330 px a 2×) recebe o arquivo de 1600 px, cerca de 23× os pixels necessários. `eager` na foto de capa de todos os cartões baixa as 30 fotos da página, inclusive as fora da tela.
- Impacto: um mural de 30 vagas com foto puxa da ordem de 7 MB antes do primeiro scroll, no 3G. A cada notificação o React reconcilia 52 cartões.
- Causa raiz: a mesma foto de 1600 px serve de capa e de detalhe, o Supabase Free não redimensiona e o CSS esconde a árvore que não vale.
- Correção recomendada: (a) `loading="lazy"` e `decoding="async"` em todas as fotos de cartão; (b) gerar no envio uma miniatura de ~480 px; (c) renderizar só o layout ativo, com `matchMedia(770px)`.
- Critério de aceite: com 30 vagas com foto, a rede do mural até o primeiro scroll é ≤ 1,5 MB, e `.tile-grid` aparece 1 vez.
- Dependências: nenhuma

### Q1-004 — `.in('…', [centenas de ids])` monta URLs de 8 a 19 KB: "Minhas vagas" de empresa movimentada pode falhar

- Área: desempenho
- Severidade: S2
- Esforço: M
- Confiança: provável (tamanho medido; o limite do gateway não foi testado)
- Onde: `src/services/remote/data.ts:74-86` (`eventsOf`), `:46-60` (`companiesById`, `workersById`, `jobsById`), `:402-408` (`putCompanyJobs`: todas as candidaturas das vagas abertas + 30 encerradas, sem limite), `:117-125`
- Prova: `urllen.mjs` monta a URL real do `supabase-js` para `application_events`: 100 candidaturas → 3,9 KB; 215 → 8,3 KB; 300 → 11,5 KB; 500 → 19,2 KB; 1000 → 38 KB. Gateways HTTP costumam limitar a linha de requisição entre 8 e 16 KB.
- Impacto: a empresa que publica todo dia chega a centenas de candidaturas e a tela "Minhas vagas" ou o histórico passam a dar erro. Hoje há 0 vagas, então ninguém vê.
- Causa raiz: leituras sem limite (`select('*').in('job_id',ids)`) alimentam consultas por lista de ids na URL. Só `loadFeed` e as listas "Carregar mais" têm página.
- Correção recomendada: dividir os ids em lotes de ≤ 50, ou trazer eventos e trabalhadores por RPC (POST); paginar `putCompanyJobs` de 30 em 30.
- Critério de aceite: com o Supabase falso, 600 candidaturas não geram URL > 4 KB.
- Dependências: nenhuma

### Q1-005 — "Hoje", "vaga vencida" e "diária começou" usam a data do aparelho; o servidor usa Brasília

- Área: bug
- Severidade: S3
- Esforço: P
- Confiança: confirmado na demonstração com relógio emulado; provável em produção (confirma M1-H6)
- Onde: `src/utils/dates.ts:11-16` (`todayISO`); `src/utils/jobInfo.ts:231-234` (`isExpired`); `src/pages/worker/feed/Feed.tsx:68` (o mural esconde "vencidas" por conta própria); `src/services/applications.ts:186-188` (`jobStarted`); `src/pages/recruiter/CandidateActions.tsx:146`; no servidor, `supabase/migrations/20261009000200_bicos_v2_rules.sql:105` (`bicos_today()` = `America/Sao_Paulo`)
- Prova: `clock.cjs`: mesma lista de vagas (carregada às 12h de 19/10), só o relógio muda depois: certo → 26 vagas ("Hoje · 7h–17h"); +1 dia → 21; +3 dias → 19; −7 dias e 01/01/2020 → 26, mas com rótulos errados ("Seg, 19 out de 2026"). No instante 01:30 UTC (22:30 em Brasília de 19/10), `todayISO` dá `2026-10-19` com `TZ=America/Sao_Paulo` e `2026-10-20` com `TZ=UTC` ou `Asia/Tokyo`.
- Impacto: quem tem hora ou fuso errado vê vagas sumirem do mural ou com rótulo trocado. A empresa vê (ou deixa de ver) "Marcar diária como concluída" no dia errado, enquanto o servidor decide por Brasília. É o mesmo erro do O2-001, do lado do produto.
- Causa raiz: duas fontes de "hoje": o aparelho e `bicos_today()`.
- Correção recomendada: um único "hoje" no cliente = data de Brasília (`Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'})`), de preferência corrigida pelo cabeçalho `Date` do servidor.
- Critério de aceite: `TZ=UTC` e `TZ=Asia/Tokyo` às 22:30 de Brasília dão o mesmo `todayISO` que `America/Sao_Paulo`.
- Dependências: O2-001

### Q1-006 — O mural espera até 5 idas e voltas ao banco, uma depois da outra, antes de desenhar

- Área: desempenho
- Severidade: S3
- Esforço: M
- Confiança: provável (lido; latência real não medida)
- Onde: `src/services/remote/data.ts:179-232` (`loadFeed`) e `:304-330` (`loadMyApplications`)
- Prova: a ordem em `loadFeed` é: (1) `rpc feed_jobs`; (2) `companies ∥ job_stats ∥ get_job_addresses`; (3) `jobsById(stale)`, só na 1ª página; (4) de novo `jobsWithContext(fresh)`; (5) `savedIds()`, em `:230`. O `apply()` só roda no fim, em `:231`. `loadMyApplications` encadeia `conclude_my_finished_jobs → applications → events∥workers∥jobs → companies∥stats∥addresses`.
- Impacto: com 150–400 ms de latência são 0,75–2 s de espera antes do primeiro cartão, com o esqueleto na tela.
- Causa raiz: chamadas em série.
- Correção recomendada: `savedIds()` em paralelo com `feed_jobs`; aplicar a 1ª página assim que chegar, e a checagem de "stale" em segundo plano; uma RPC `feed_with_context` leva a 1 viagem.
- Critério de aceite: ≤ 2 viagens em série no teste com `fakeSupabase.ts`.
- Dependências: nenhuma

### Q1-007 — O Lighthouse do CI mede só `/`, com metas frouxas, e deixa passar telas abaixo da própria meta

- Área: desempenho
- Severidade: S3
- Esforço: P
- Confiança: confirmado
- Onde: `.github/workflows/web.yml:89-98` (uma URL); `web/scripts/lighthouse-check.mjs:7` (`TARGETS` 85/95/95, sem LCP/TBT/bytes)
- Prova: `out/Q1/lh/`, mediana de 3, celular, `devtools` como no CI e também `simulate`: `/` 96–99; `/login` 90–98 (TBT 281 ms); `/cadastro/trabalhador` 82–86 (devtools), 74–80 (simulado), LCP 3,9–4,9 s, abaixo da meta 85. Acessibilidade, boas práticas e SEO = 100 em todas as rodadas; a meta de a11y é 95, então uma regressão de 5 pontos passa. `/login` faz 104 pedidos.
- Impacto: a regressão nos caminhos de entrada (link compartilhado, cadastro) passa despercebida, e a nota 96 de `/` dá falsa segurança.
- Causa raiz: uma única URL medida e metas folgadas.
- Correção recomendada: medir `/login`, `/cadastro/trabalhador`, `/v/BC-…` e `/mural` logado; usar `--budget-path`: LCP ≤ 2,5 s, TBT ≤ 200 ms, script ≤ 250 KB brotli; a11y = 100; `<link rel=modulepreload>` para as rotas de entrada (o chunk da tela só é pedido depois de o `index` executar, 172 KB br).
- Critério de aceite: CI vermelho se o LCP do cadastro passar de 2,5 s.
- Dependências: O1-005

### Q1-008 — Favicon e ícone da tela inicial quebram em rotas com mais de um segmento (`/v/:id`, o link compartilhado)

- Área: bug
- Severidade: S3
- Esforço: P
- Confiança: confirmado
- Onde: `web/index.html:27-29` (`href="./icons/…"`)
- Prova: `icons.cjs`. Em `/mural` o ícone resolve para `/icons/favicon-32.png`. Em `/v/BC-4821` resolve para `/v/icons/favicon-32.png`, `/v/icons/icon.svg` e `/v/icons/apple-touch-icon.png`. O host devolve HTML 200 para qualquer caminho.
- Impacto: quem abre a vaga pelo WhatsApp fica sem ícone na aba. Adicionar à tela inicial dali no iPhone gera ícone genérico.
- Causa raiz: caminho relativo no `<head>`.
- Correção recomendada: `href="/icons/…"`, ou `%BASE_URL%icons/…`.
- Critério de aceite: `icons.cjs` mostra `/icons/…` em todas as rotas.
- Dependências: nenhuma

### Q1-009 — Com fonte a 200 %, a barra de baixo vira "I…", "V…", "P…" e os títulos das vagas ficam com uma palavra

- Área: acessibilidade
- Severidade: S3
- Esforço: P
- Confiança: confirmado (print)
- Onde: `src/layouts/AppNav.tsx:131` (`truncate` no rótulo das abas); `src/components/JobTile.tsx` (título `truncate`)
- Prova: `zoom.cjs` (`html{font-size:200%}`, 360×800). Não há rolagem horizontal em 12 telas × 3 modos, o que é bom. Mas `prints/Q1/zoom-texto200-_minhas_vagas.png` mostra a barra com "I…", "V…", "P…", "P…" e cartões "Limpeza …" / "Controle …".
- Impacto: baixa visão e trabalhadores mais velhos com "fonte maior" perdem o nome das abas e das vagas (WCAG 1.4.4).
- Causa raiz: `truncate` em rótulos curtos.
- Correção recomendada: rótulos em 2 linhas (`line-clamp-2`) e grade de 1 coluna quando o `font-size` do `html` > 20 px.
- Critério de aceite: o mesmo print com os rótulos legíveis.
- Dependências: C5-018

### Q1-010 — "Reduzir movimento" deixa o brilho do esqueleto piscando (animação infinita de 0,01 ms); a abertura em HTML não tem a regra

- Área: acessibilidade
- Severidade: S3
- Esforço: P
- Confiança: confirmado
- Onde: `src/styles/base.css:117-123` (`animation-duration:.01ms!important` sem `animation-iteration-count:1`); `web/index.html:95-103` (`.boot-spin` sem `@media`)
- Prova: `motion.cjs` com `reducedMotion:'reduce'`: `.skeleton` fica com `animationDuration:1e-05s` e `animationIterationCount:infinite`. A posição do brilho alterna entre 2 valores em 8 quadros. C6-004 achou o ícone parado; este é outro defeito da mesma regra.
- Impacto: quem pede menos movimento vê cintilação em cada carregamento.
- Causa raiz: regra de movimento reduzido que só zera a duração.
- Correção recomendada: `animation-iteration-count:1!important; scroll-behavior:auto!important` e `.skeleton,.boot-spin{animation:none}`; replicar o `@media` no `<style>` do `index.html`.
- Critério de aceite: `motion.cjs` em `reduce` mostra `iteration 1`.
- Dependências: C6-004

### Q1-011 — Todo botão de salvar vaga se chama só "Salvar vaga" (26 iguais no mural)

- Área: acessibilidade
- Severidade: S3
- Esforço: P
- Confiança: confirmado
- Onde: `src/components/SaveFlag.tsx:5-12`; `src/components/JobTile.tsx:110`
- Prova: `kbd.cjs`, Tab no mural: `8:button "Salvar vaga"`, `9:button "Garçom para casamento…"`, `10:button "Salvar vaga"`, `11:button "Auxiliar de cozinha…"`, e assim por diante. O botão vem antes do título e sem contexto.
- Impacto: no TalkBack/VoiceOver ninguém sabe qual vaga está salvando (WCAG 2.4.6).
- Causa raiz: nome acessível genérico.
- Correção recomendada: `Salvar vaga: ${título}` e `Remover dos salvos: ${título}`.
- Critério de aceite: nomes únicos no `ariaSnapshot` do mural.
- Dependências: nenhuma

### Q1-012 — O avisador de erros usa `crypto.randomUUID()` sem proteção: em navegador antigo ele próprio dá erro e nada chega ao Sentry

- Área: bug
- Severidade: S3
- Esforço: P
- Confiança: confirmado (confirma C2-H5)
- Onde: `src/services/monitoring.ts:124` (`event_id`); chamado por `reportError` (`:143`), `window.onerror` (`:161`) e `src/components/ErrorBoundary.tsx:57`; `vite.config.ts:156` (`target:'es2020'`)
- Prova: `sentry.cjs` com o build `dist-c2` (DSN configurado). Com `crypto.randomUUID` presente: 1 pedido ao Sentry. Ausente (Safari < 15.4, WebView Chrome < 92): 0 pedidos e `TypeError: crypto.randomUUID is not a function` ×2.
- Impacto: nos aparelhos mais velhos, onde mais se esperam erros, a equipe fica cega.
- Causa raiz: `es2020` promete Chrome 80/Safari 13.1, mas a API só existe desde Chrome 92/Safari 15.4.
- Correção recomendada: `crypto.randomUUID?.() ?? <hex de getRandomValues>` e `try/catch` em `reportError`.
- Critério de aceite: o mesmo script mostra 1 pedido com `randomUUID` ausente.
- Dependências: Q1-013

### Q1-013 — Não existe alvo de navegadores: o build promete uma coisa e o código e o CSS exigem outra

- Área: docs
- Severidade: S3
- Esforço: P
- Confiança: confirmado (lido); efeito em aparelho antigo não testado
- Onde: `web/package.json` (sem `browserslist`); `vite.config.ts:156`; `CLAUDE.md` e `web/docs` não dizem quais celulares são suportados
- Prova: o CSS publicado usa `aspect-ratio` (Safari 15; os cartões usam `aspect-[20/19]`), `gap` em flex (Safari 14.1) e `:focus-visible` (Safari 15.4). O JS usa `randomUUID` (15.4) e `inert` em `BusyOverlay.tsx:22` (Safari 15.5/Chrome 102; sem suporte, o fundo continua clicável). `dist-demo/assets` publica 8 `.woff` (126 KB) que nenhum navegador compatível com `es2020` baixa.
- Impacto: ninguém sabe se iPhone com iOS 14/15 ou Android com WebView velho funciona. Vai aparecer como "o app não abre" no suporte.
- Causa raiz: alvo de navegadores nunca foi definido.
- Correção recomendada: decidir e documentar (ex.: "Chrome/WebView ≥ 100, Safari ≥ 15.4"), pôr em `browserslist` e `build.target`, e rodar o E2E em WebKit no CI.
- Critério de aceite: seção "Navegadores suportados" no README e job WebKit verde.
- Dependências: Q1-012; decisão dos sócios

### Q1-014 — PIX: um relógio de 1 s refaz a tela inteira e a consulta a cada 5 s não para com a aba escondida

- Área: desempenho
- Severidade: S3
- Esforço: P
- Confiança: confirmado (lido)
- Onde: `src/pages/recruiter/BoostPayment.tsx:49-55` (`useSecondsLeft`: `setInterval` sempre ligado, mesmo sem pagamento aguardando) e `:80-85` (`getPayment` a cada 5 s)
- Prova: o `setNow` de 1 s re-renderiza `BoostPayment`, que inclui o formulário do cartão. O polling não olha `document.hidden` nem recua (≈ 360 consultas em 30 min).
- Impacto: bateria e dados de celular simples durante a espera.
- Causa raiz: relógio e polling sem condição.
- Correção recomendada: ligar o relógio só com `status==='aguardando'`, isolar o contador num componente, pausar com `visibilitychange` e recuar (5→15→30 s).
- Critério de aceite: sem re-render do formulário a cada segundo (React Profiler) e 0 consultas com a aba escondida.
- Dependências: nenhuma

### Q1-015 — Vídeo de até 50 MB sobe sem compressão, sem prazo e sem como cancelar

- Área: desempenho
- Severidade: S3
- Esforço: M
- Confiança: provável (lido)
- Onde: `src/services/remote/storage.ts:27` (`MAX_VIDEO_BYTES=50MB`), `:44-62` (XHR sem `timeout`/`abort`; só `onerror`, em `:58`), `:76-87` (vídeo não passa por `compressImage`)
- Prova: 50 MB a 50 KB/s levam ~17 min. Se a rede cair no meio, a barra congela e o botão fica ocupado. A CSP também não tem `media-src` (D4-004).
- Impacto: publicação do portfólio presa em internet ruim.
- Causa raiz: upload sem controle de tempo e de tamanho.
- Correção recomendada: limite de 20 MB ou 30 s, `xhr.timeout=120000` com mensagem, botão Cancelar com `xhr.abort()`.
- Critério de aceite: com um XHR falso que nunca termina, a tela sai do estado ocupado em 120 s.
- Dependências: D4-004, D4-007

### Q1-016 — (melhoria agora) A prévia do link no WhatsApp é a mesma para toda vaga

- Área: produto
- Severidade: M
- Esforço: M
- Confiança: confirmado
- Onde: `web/index.html:30-46` (`og:*` fixos); sem função de borda (`web/functions` não existe)
- Prova: o app é SPA. `/v/BC-4821` sempre mostra "Bicos — bicos e diárias perto de você" e a arte azul `og.png` (1200×630, conferida, correta), nunca título, valor e bairro da vaga.
- Impacto: ganho: compartilhar vaga é o principal canal de crescimento (CLAUDE.md §1); prévia com título, valor e bairro aumenta o clique.
- Causa raiz: sem renderização por rota.
- Correção recomendada: Cloudflare Pages Function em `/v/:id` que injeta `og:*` a partir de `public_job_card` (já é pública, só bairro e cidade).
- Critério de aceite: `curl -A WhatsApp …/v/BC-1` devolve `og:title` com o título da vaga.
- Dependências: ação do responsável (publicar a função na hospedagem); mesmo item do C3-017

### Q1-017 — Sem versão mínima: o app aberto em segundo plano pode ficar semanas na versão antiga falando com RPCs novas

- Área: processo
- Severidade: S3
- Esforço: M
- Confiança: provável (lido; ciclo do SW não simulado)
- Onde: `vite.config.ts:103` (`registerType:'prompt'`); `src/services/pwa.ts:14-22`; `dist-demo/sw.js` (`skipWaiting` só em `message`); a decisão de pedir confirmação é boa (`DECISOES.md:909`), falta a rede de segurança
- Prova: a atualização depende do toque em "Atualizar" (aviso de 24 h) ou de fechar todas as janelas. Não há `min_version` em `app_config` nem versão enviada ao servidor. O banco muda por migration (`feed_jobs` ganhou parâmetros em `lanc13`/`u65`).
- Impacto: depois de mudar uma RPC, parte dos usuários vê erro genérico até atualizar.
- Causa raiz: sem contrato de versão entre app e banco.
- Correção recomendada: `min_web_release` em `app_config`; se o `RELEASE` do app for menor, mostrar "Atualize para continuar" e chamar `update(true)`; no mínimo, `registration.update()` quando o app volta ao primeiro plano depois de > 24 h.
- Critério de aceite: com `min_web_release` maior, a tela de atualização aparece e um toque recarrega na versão nova.
- Dependências: nenhuma

## Hipóteses não confirmadas

1. Tela branca em navegador antigo: `ErrorBoundary.componentDidCatch` chama `reportError` sem `try/catch` (`:57`); sem `randomUUID` o erro nasce dentro do limite de erro e pode derrubar a árvore. Não reproduzido.
2. iOS ≤ 14: `aspect-ratio` pode zerar a altura da foto do cartão e `gap` em flex espreme a tela. Não há WebKit no contêiner.
3. EXIF/GPS preservado: `utils/image.ts:51-58` devolve o arquivo original quando o recodificado não fica menor (ver C2-003); a foto sobe com os metadados. Não reproduzido.
4. `CacheFirst` com `statuses:[0,200]` (`vite.config.ts:141`) guarda respostas opacas, que ocupam ~7 MB de cota cada no Chrome; pode estourar a cota com 300 fotos. Não medido.
5. Leituras sem `limit`: `loadWorkerProfile` (`data.ts:413`) e `loadCompanyProfile` buscam todas as avaliações e publicações; só pesa com centenas.
6. Contraste "incompleto" do axe em cartões do mural (52 nós): texto sobre foto ou gradiente; precisa de olho humano com fotos reais.
7. Latência real do Supabase, Realtime em aba escondida e SW em aparelho real: não medidos.

## Bom e deve ser preservado

- axe 4.10.3 com `wcag2a/2aa/21a/21aa/22aa`, incluindo `target-size`: 128 varreduras (31 telas distintas × 360 e 1280 px × claro e escuro) com 0 violações; a sanidade do script foi provada com 3 violações plantadas; Lighthouse a11y, boas práticas e SEO = 100.
- Só teclado: o modal de Filtros recebe o foco, o prende em 40 Tab, fecha com Esc e devolve o foco ao botão (360 e 1280 px).
- Texto grande: sem rolagem horizontal em 12 telas, a 320 px e com fonte 150 % e 200 %.
- Supabase falhando (pendurado, 503 ou recusando a conexão): em ≤ 12 s o app mostra "Sem conexão com a Bicos… Tentar de novo"; sem tela branca (`fail.cjs`).
- `localStorage` e `sessionStorage` bloqueados ou cheios: o app funciona; offline mostra a faixa "Sem internet…".
- Primeira pintura enxuta: `/login` a frio sai com FCP 0,6 s e `load` 2,6 s em 4G lento (211 KB brotli); no 3G (400 kbps, 400 ms) FCP 1,7 s e `load` 5,3 s; CLS 0.
- `_headers`: `/assets/*` imutável por 1 ano, `sw.js`, `push-sw.js` e `manifest` com `no-cache`. Fontes próprias, só `latin`, `font-display:swap`, 2 pré-carregadas. Ícones maskable com zona segura; `og.png` correto.
- Envio de foto: `compressImage` limita a 1600 px e WebP 0,82; `heic2any` só carrega sob demanda e fora do 1º carregamento; o servidor usa Brasília em `bicos_today()`.
