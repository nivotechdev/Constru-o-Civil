# Achados C2 — serviços (legal, monitoring, store, remote/*)

### C2-001 — A casa do trabalhador (coordenadas do endereço) vai para servidores OSRM de terceiros, e a política de privacidade não diz isso

- Área: LGPD
- Severidade: S2
- Esforço: M
- Confiança: confirmado
- Onde: web/src/services/route.ts:9-49; web/src/pages/worker/JobDetail.tsx:271-275 (`home={workerHome(db)}`); web/src/components/JobMap.tsx:44-54; web/src/services/legal.ts:119 e :147; web/public/_headers (connect-src)
- Prova: `workerHome(db)` devolve `{lat, lon}` do endereço salvo da conta (selectors.ts:33-40, precisão de rua, ~200 m). `JobMap` chama `drivingRoute(origin, job, signal)` e `route.ts:42` monta `${from.lon.toFixed(6)},${from.lat.toFixed(6)};…` e faz `fetch` em `https://router.project-osrm.org/…` e, se falhar, `https://routing.openstreetmap.de/…`. Acontece em toda tela de vaga aberta por trabalhador com endereço. A política (legal.ts:119) diz do endereço: "Fica só com você: … as empresas veem só um ponto aproximado" e a lista de operadores (legal.ts:147) cita BrasilAPI, ViaCEP, Nominatim e Photon, mas não OSRM. `grep -n -i osrm web/src/services/legal.ts` → nada.
- Impacto: toda vez que o trabalhador abre uma vaga, o ponto da casa dele e o IP vão para dois servidores públicos (um na Alemanha) que ninguém contratou nem citou na política; a promessa "fica só com você" não é verdadeira.
- Causa raiz: U54 incluiu o roteamento pelo navegador (decisão registrada em DECISOES.md:2299-2316 só avalia custo/limite, não privacidade) e o texto legal não foi atualizado.
- Correção recomendada: (a) mínimo: citar o OSRM/OpenStreetMap (coordenadas do aparelho/endereço e IP) em legal.ts §2 e §5 e ajustar a frase "Fica só com você"; (b) melhor: arredondar o ponto de origem a ~1 km antes de pedir a rota ou passar o pedido por uma Edge Function própria, sem IP do usuário; (c) futuro: provedor de mapas contratado com DPA.
- Critério de aceite: texto legal cita o serviço; teste de unidade garante que `drivingRoute` recebe a origem arredondada (ou que a chamada passa pela função); `grep osrm` em legal.ts.
- Dependências: advogado revisa o texto (ação do responsável).

### C2-002 — Vídeos do portfólio sobem sem remover metadados (GPS do aparelho) para um bucket público

- Área: LGPD
- Severidade: S2
- Esforço: M
- Confiança: provável (código provado; não testei um vídeo real com GPS)
- Onde: web/src/services/remote/storage.ts:76-86 e :91-102; web/src/pages/shared/WorkerPosts.tsx:221 (`accept="image/*,video/*"`); web/src/utils/image.ts:34-60; migration 20261010000700_z12_fotos.sql:103-104 (bucket `portfolio` aceita mp4/quicktime/webm, público)
- Prova: em `uploadMedia` o bloco de compressão roda só `if (!isVideo)`; para vídeo o `blob` original vai direto ao `xhr.send(blob)`. Celulares gravam a localização no contêiner do vídeo (iPhone: `com.apple.quicktime.location.ISO6709`; Android: átomo `©xyz`) quando a câmera tem localização ligada. A URL pública (`getPublicUrl`) é mostrada no perfil. Nas fotos o EXIF cai porque `compressImage` redesenha no canvas, mas veja C2-003.
- Impacto: um vídeo de trabalho feito em casa ou no local de um cliente pode entregar a posição exata a qualquer pessoa com o link, contra a política ("Localização do aparelho: só se você tocar em Usar minha localização").
- Causa raiz: a limpeza de metadados só existe para imagem.
- Correção recomendada: desligar vídeo no lançamento (só foto) ou remuxar/limpar no servidor (função que reescreve o mp4 sem os átomos `udta/©xyz/meta`); alternativa mínima: aviso na tela "vídeos podem levar a localização de onde foram gravados".
- Critério de aceite: subir um .mp4/.mov de teste com átomo de GPS e conferir (`exiftool`/`ffprobe`) que o arquivo publicado não tem coordenadas.
- Dependências: nenhuma.

### C2-005 — Resposta que chega depois do "Sair" cai no store da conta seguinte (selo de notificações de outra conta, consulta marcada como pronta)

- Área: bug
- Severidade: S2
- Esforço: P
- Confiança: confirmado (reproduzido com o falso Supabase do projeto)
- Onde: web/src/services/queries.ts:52-80 e :104-110; web/src/services/remote/merge.ts:42-44 (`apply`); web/src/services/store.ts:150-153 (`clearSessionData`); web/src/services/remote/session.ts:338-347 (`leaveSession`) e :309 (`runQuery('notifications', …)`); mesmo padrão em todos os `load*` de remote/data.ts e nas ações de remote/profiles.ts (`session()` capturado antes do `await`)
- Prova: teste em `$SCRATCH/out/C2/repro-respostas-tardias.test.ts` (rodar com `npx vitest run --config …/repro-vitest.config.ts` dentro de `web/`): A entra (o login dispara `loadNotifications` em segundo plano, tabela lenta 80 ms), A sai logo em seguida. Saída: `AFTER LOGOUT: session= null notifications in store= 3 unreadTotal= 3 query state= ready`. Depois B (empresa, sem avisos) entra no mesmo aparelho: `B session= u-obra bell badge for B= 3 B notices listed= 0`. Ou seja, o número "3" do sino de B vem da conta A, e como `runQuery` acha a chave 'notifications' já "ready" (< 20 s, queries.ts:57) ela nem recarrega para B.
- Prova 2 (pior caso, o próprio "Sair"): `repro-sair-durante-checagem.test.ts`. Quem volta ao app abre pela conta guardada no aparelho (`enterCachedSession`) e o servidor é conferido em segundo plano (`enterSession`, session.ts:523). Se a pessoa toca em "Sair" nesses poucos segundos, o `loadSession` em voo termina depois e faz `setSessionAccount(account.id)` (session.ts:304) e `saveCache` (:284/:302). Saída: `right after Sair: session= null cache= false` e `900 ms later: session= u-ana cache saved again= true`. A conta reaparece logada sem token do Auth, até uma requisição falhar e aparecer "Sua sessão terminou".
- Impacto: quem sai da conta com uma tela ainda carregando (comum em internet ruim) deixa dados no store; a próxima pessoa no mesmo aparelho vê contagem de avisos errada e pode ver outras fatias (vagas salvas `savedJobIds`, candidaturas) até a próxima leitura. As listas de avisos são filtradas pelo id da sessão, por isso o texto não vazou neste teste, mas o número vazou. O mesmo vale para o login que termina depois de o usuário já ter saído: `loadSession` regrava conta/perfil e o cache `bicos.conta` (session.ts:279-304) depois do `leaveSession`.
- Causa raiz: `clearQueries()`/`clearSessionData()` só zeram o estado; as requisições em voo não são canceladas nem têm "geração" para serem descartadas quando terminam. `apply()` não confere de qual sessão veio o resultado.
- Correção recomendada: um contador `sessionEpoch` incrementado em `leaveSession`/`setSessionAccount`; cada loader captura o valor antes do `await` e `apply`/`runQuery` descartam o resultado se mudou; `runQuery` guarda `inFlight` por geração e `.finally` não apaga a entrada de outra geração.
- Critério de aceite: o teste de reprodução passa a mostrar `notifications in store= 0` e `query state= loading` (ou ausente) após o logout, e `bell badge for B= 0`.
- Dependências: nenhuma.

### C2-006 — Erros inesperados do servidor viram "Não deu certo agora" sem rastro: nada é enviado ao Sentry e a causa original é jogada fora

- Área: código
- Severidade: S2
- Esforço: M
- Confiança: confirmado
- Onde: web/src/services/remote/client.ts:66-79 (`toServiceError` termina em `serviceError('falha_demo')`), :88-107 (`request`), :138-161 (`invokeFunction`); web/src/services/errors.ts:20-29 (`ServiceError` não tem `cause`); web/src/services/monitoring.ts:143-163; `grep -rn reportError web/src` → só `ErrorBoundary.tsx:57`
- Prova: um erro PostgREST/RPC fora dos mapas (ex.: `PGRST202` função inexistente depois de migration atrasada, `42703` coluna que não existe, `P0001` sem BCxxx, 500 de Edge Function) cai em `serviceError('falha_demo')`: a tela mostra a mensagem genérica, e o código/mensagem original some (o objeto não guarda `cause`). `reportError` só é chamado pelo `ErrorBoundary` (erro de renderização) e pelos ouvintes globais (`unhandledrejection`), mas as telas capturam a promessa e mostram o erro, então ela nunca vira "não tratada". Resultado: uma RPC quebrada para todos os usuários não gera nenhum evento.
- Impacto: um bug de servidor ou de versão (front novo × banco antigo, justamente o risco do histórico de migrations divergente) aparece para o usuário como "tente de novo" e a equipe só descobre por reclamação.
- Causa raiz: o contrato de erros foi desenhado para a mensagem na tela, não para diagnóstico.
- Correção recomendada: em `toServiceError`, ao cair no ramo desconhecido (e em `invokeFunction` para 5xx), chamar `reportError` com um erro novo que leve só `code`, `status` e nome da RPC/tabela (sem corpo nem dados), e guardar `cause` no `ServiceError`. Limitar por chave para não gastar as 20 vagas de `monitoring.ts:149`.
- Critério de aceite: teste com falso Supabase devolvendo `{code:'PGRST202'}` espera uma chamada de `reportError` com `rpc` e `PGRST202`, sem dado pessoal.
- Dependências: Sentry ligado (ação do responsável: `VITE_SENTRY_DSN`; hoje desligado em produção).

### C2-003 — `compressImage` devolve o arquivo original (com EXIF/GPS) quando o reencode não fica menor ou a imagem não decodifica

- Área: LGPD
- Severidade: S3
- Esforço: P
- Confiança: provável
- Onde: web/src/utils/image.ts:40-60 (`return out.size < blob.size ? out : blob`, `catch { return blob }`, `blob.type === 'image/gif'`); web/src/services/remote/storage.ts:78-84
- Prova: linhas 41, 44-46 e 56-60 devolvem `blob` (o original) em três caminhos. A foto só perde o EXIF quando passa pelo canvas e o resultado é menor. Fotos já pequenas e bem comprimidas (≤1600 px) podem sair maiores em WebP 0,82 e voltam como o original, com GPS. O bucket `avatars/portfolio/vagas` é público.
- Impacto: em casos de borda a foto publicada leva a localização de onde foi tirada.
- Causa raiz: "devolver o original se não ficou menor" foi pensado para peso, não para privacidade.
- Correção recomendada: sempre devolver o canvas re-codificado (mesmo se maior, limite de 1,5×) ou tirar o EXIF do JPEG original por bytes.
- Critério de aceite: teste com JPEG pequeno com EXIF GPS: o blob devolvido não contém o marcador APP1/Exif.
- Dependências: nenhuma.

### C2-004 — Textos legais mudaram em 21/10 sem mudar `version` nem `updatedAt` (continuam "2.0 / 15/10/2026")

- Área: processo
- Severidade: S3
- Esforço: P
- Confiança: confirmado
- Onde: web/src/services/legal.ts:26-27, :101-102, :206; commits d065387 (U48), aa87ea2 (U51), a5c76d7 (U53)
- Prova: `git log -p -- web/src/services/legal.ts | grep -E "^[+-]\s+(version|updatedAt):"` só mostra a criação (`version: '2.0'`, `updatedAt: '2026-10-15'`); os três commits de 21/10 alteraram o corpo (dados de endereço, endereço visível a quem tem conta, "público geral") sem tocar esses campos. Além disso `TERMS_VERSION = TERMS.version` (l.206) é o único campo que dispara novo aceite; `PRIVACY.version` pode divergir sem efeito.
- Impacto: hoje sem efeito (4 contas de teste, textos ainda "rascunho"). Depois do lançamento, uma mudança de texto sem bump não pede novo aceite e a data mostrada ("atualizada em 15/10/2026") fica falsa.
- Causa raiz: a versão é manual e nada no CI liga mudança de texto a bump.
- Correção recomendada: fixar versão/data na revisão do advogado; teste que guarda um hash do corpo + versão (falha se o corpo muda e a versão não); usar `max(TERMS.version, PRIVACY.version)` ou exigir que sejam iguais.
- Critério de aceite: o teste legal falha ao editar um parágrafo sem mudar `version`.
- Dependências: ação do responsável (advogado) para o texto final.

### C2-007 — O pacote de produção leva junto os dados de demonstração e a senha de demo (e 4 "imports dinâmicos" não separam nada)

- Área: desempenho
- Severidade: S3
- Esforço: M
- Confiança: confirmado
- Onde: web/src/services/store.ts:8 (`import * as seed`), selectors.ts:3, catalog.ts:4, auth.ts:7; build real: `$SCRATCH/dist-c2` (log em out/C2/build-e2e.log)
- Prova: `vite build --mode e2e --outDir $SCRATCH/dist-c2` com `VITE_SUPABASE_URL` e `ANON_KEY` preenchidos (modo real, `IS_DEMO=false`): `grep -l bicos123 dist-c2/assets/*.js` → `index-Qs53pM_j.js` (o chunk principal, 653 KB / 202 KB gzip); o mesmo chunk contém `trabalhador@bicos.demo`, um CPF de demonstração do seed e o nome "Meridiano". `IS_DEMO` é decidido em tempo de execução (`supabaseConfig()` usa `.trim()`), então o bundler não elimina o seed (43 KB de fonte). O build também avisa 4 vezes `(!) … is dynamically imported by … but also statically imported` (remote/client.ts, remote/data.ts, remote/session.ts, services/auth.ts): os `import()` de `main.tsx`, `App.tsx`, `notifications.ts`, `safety.ts`, `theme.ts` não geram chunk separado.
- Impacto: todo celular baixa e analisa dados falsos que nunca usa; a senha de demo e contas falsas ficam visíveis a quem abre o JS. Não dá acesso a nada real, mas fere a regra do projeto de "build de produção ≠ app de mentira".
- Causa raiz: seed importado de forma estática por serviços usados nos dois modos; flag de modo não é constante de build.
- Correção recomendada: trocar `IS_DEMO` por constante de build (`import.meta.env.VITE_DEMO === 'true'` via `define`) e mover `seed` para `import()` dentro de ramos `IS_DEMO`; remover os `import()` que não separam chunk ou tornar os imports estáticos.
- Critério de aceite: `grep -l bicos123 dist/assets/*.js` vazio no build de produção; cai o tamanho do chunk principal; sem os 4 avisos no build.
- Dependências: nenhuma.

### C2-008 — Fim de sessão por outro caminho que não o botão "Sair" deixa o aparelho recebendo notificações da conta antiga

- Área: LGPD
- Severidade: S3
- Esforço: P
- Confiança: provável
- Onde: web/src/services/remote/auth.ts:107-114 (só `signOut()` chama `disablePush`); web/src/services/remote/session.ts:454-468 (`sessionEnded`), :433-438 (`dropBrokenSession`), :569-571 (evento `SIGNED_OUT`) — os três chamam `leaveSession()` sem `disablePush`; web/src/services/push.ts:84-88 e supabase/migrations/20261014000300_x03_push.sql:27-49
- Prova: `grep -rn disablePush web/src` → fora da definição (push.ts:91) e do botão de Configurações (NotificationSettings.tsx:103), só `remote/auth.ts:110`, dentro de `signOut()`. A assinatura do aparelho (`push_subscriptions.endpoint`) continua ligada à conta antiga no servidor e no navegador. Quando outra pessoa entra no mesmo aparelho, `syncPushSubscription` (chamado em `loadSession`, session.ts:307) vê `pushState()==='ligado'` e `save_push_subscription` faz `on conflict (endpoint) do update set account_id = excluded.account_id`: o aparelho passa a receber os avisos da nova conta sem ela ter ligado nada. Entre uma coisa e outra, os avisos da conta antiga continuam chegando na tela de bloqueio.
- Impacto: sessão expirada/revogada ou aba que sai em outro lugar deixa títulos de avisos ("Maria foi aprovada…") aparecendo no aparelho de quem não está mais logado. Hoje push está desligado no lançamento (L12), então o risco é futuro.
- Causa raiz: `disablePush` está só no caminho do botão.
- Correção recomendada: chamar `disablePush` (com timeout curto e sem esperar o servidor) dentro de `leaveSession`, e na entrada pedir confirmação (ou não religar) se a assinatura pertencia a outra conta.
- Critério de aceite: teste com falso Supabase: depois de `sessionEnded()` a chamada `delete_push_subscription` foi feita ou `sub.unsubscribe()` executado.
- Dependências: push ligado (ação do responsável: VAPID).

### C2-009 — Falha de rede ao chamar uma Edge Function (com o aparelho "online") não vira `offline`: a pessoa vê "Não deu certo agora"

- Área: bug
- Severidade: S3
- Esforço: P
- Confiança: confirmado (reproduzido)
- Onde: web/src/services/remote/client.ts:41-45 (`isNetworkFailure`) e :138-161 (`invokeFunction`)
- Prova: `repro-edge-function-offline.test.ts` (nesta pasta): `functions.invoke` devolve o erro que o supabase-js dá quando o `fetch` cai — `name: 'FunctionsFetchError'`, `message: 'Failed to send a request to the Edge Function'` (node_modules/@supabase/functions-js/dist/main/types.js:43). A regex `/Failed to fetch|NetworkError|Load failed|fetch failed|AuthRetryableFetchError|network/i` não casa com isso. Saída: `RESULT code= falha_demo message= Não deu certo agora. Tente de novo em instantes.` e a asserção `expected 'falha_demo' to be 'offline'` falha. Só cai em `offline` se `navigator.onLine === false`, o que não acontece com sinal fraco ("lie-fi").
- Impacto: login por CPF/CNPJ, verificação de cadastro, código de WhatsApp, cobrança e exclusão de conta mostram a mensagem genérica em vez de "Sem internet. Confira sua conexão…", e as telas que reagem a `isOfflineError` (estado "offline" com botão de tentar de novo) não aparecem.
- Causa raiz: a detecção é por texto da mensagem e não conhece os erros próprios do functions-js.
- Correção recomendada: em `invokeFunction`, tratar `result.error.name === 'FunctionsFetchError'` (e `FunctionsRelayError`) como `offline`; ou incluir `FunctionsFetchError` na regex.
- Critério de aceite: o teste de reprodução passa (`code === 'offline'`).
- Dependências: nenhuma.

### C2-010 — Aviso de sucesso "E-mail trocado. Use o novo para entrar." aparece como erro (tom vermelho)

- Área: UX
- Severidade: S3
- Esforço: P
- Confiança: provável (lógica lida; não abri o app com o link)
- Onde: web/src/services/remote/session.ts:376 e :397
- Prova: `notice = 'E-mail trocado. Use o novo para entrar.'` (l.376); `flushNotice` usa `tone: text.startsWith('E-mail confirmado') ? 'default' : 'error'` (l.397). "E-mail trocado…" não começa com "E-mail confirmado", então sai `error`.
- Impacto: quem acabou de trocar o e-mail com sucesso vê um aviso em vermelho e acha que deu errado.
- Causa raiz: o tom é deduzido do começo do texto.
- Correção recomendada: guardar `{ text, tone }` em `notice` em vez de comparar texto.
- Critério de aceite: teste de `restore()` com `#access_token=…&type=email_change` verifica `tone: 'default'`.
- Dependências: nenhuma.

### C2-011 — Posts do portfólio feitos no mesmo dia aparecem do mais antigo para o mais novo (comparador de ordenação inconsistente)

- Área: bug
- Severidade: S3
- Esforço: P
- Confiança: confirmado (reproduzido)
- Onde: web/src/services/selectors.ts:155-157 (`postsForWorker`); supabaseMappers.ts:394 (`date: row.posted_on`, só o dia)
- Prova: `node -e` com 3 posts do mesmo dia na ordem do servidor (`c,b,a`, mais novo primeiro) e `.sort((a,b)=>(a.date<b.date?1:-1))` devolve `a,b,c,old`; com 12 posts do mesmo dia (`p12…p1`) devolve `p1,p2,…,p12`. O comparador devolve `-1` também quando as datas são iguais, e o V8 inverte os empatados. O servidor já manda `order by created_at desc` (remote/data.ts:436, remote/profiles.ts:102), mas a tela reordena só por dia.
- Impacto: o trabalhador publica um post novo e ele aparece no fim do grupo de hoje, não no topo.
- Causa raiz: comparador sem o caso de igualdade e data sem hora.
- Correção recomendada: não reordenar quando o dia é igual (`a.date === b.date ? 0 : …`) ou guardar `createdAt` completo no post e ordenar por ele.
- Critério de aceite: teste com 3 posts do mesmo dia mantém a ordem de entrada.
- Dependências: nenhuma.

### C2-012 — Envio de fotos/vídeos: sem prazo nem cancelamento, e erros do bucket viram sempre "Não deu para enviar a foto agora"

- Área: UX
- Severidade: S3
- Esforço: P
- Confiança: provável
- Onde: web/src/services/remote/storage.ts:40-62 (XHR sem `timeout`/`ontimeout`/`onabort`), :54-57 (qualquer status ≠ 2xx → `falha_demo`), :88 (`EXTENSIONS[blob.type] ?? 'jpg'`); web/src/utils/image.ts:44 (GIF volta como está); migration 20261010000700_z12_fotos.sql:100-107 (buckets só aceitam jpeg/png/webp, e mp4/quicktime/webm no `portfolio`)
- Prova: o XHR nunca define `xhr.timeout`; uma conexão que trava sem cair deixa a barra parada até o navegador desistir. `xhr.onload` trata 401 (token vencido), 403, 413 e 415 como a mesma falha genérica, sem acionar o "sessão terminou". Um GIF ou um vídeo 3gp/mkv escolhido (o `accept` é `image/*,video/*`) sobe com o tipo original, o bucket recusa e a pessoa recebe "Tente de novo" para sempre. `portfolioFileProblem` (utils/media.ts) só confere tamanho/duração, não o tipo aceito pelo bucket.
- Impacto: em internet ruim o envio pode ficar girando sem saída; formatos que o bucket não aceita nunca avisam o motivo.
- Causa raiz: tratamento de erro mínimo no caminho do XHR (feito para ter barra de progresso).
- Correção recomendada: `xhr.timeout` (ex.: 60 s sem progresso) com mensagem "Conexão fraca…"; mapear 401→sessão terminou, 413→"arquivo grande", 415→"formato não aceito (use JPG/PNG)"; validar o tipo contra a lista do bucket antes de enviar.
- Critério de aceite: testes do `storage.ts` com status 401/413/415 e com `ontimeout`.
- Dependências: nenhuma.

### C2-013 — "Sem conexão com a Bicos… o app abre sozinho" é falso quando o aparelho está online e o servidor só demorou (>10 s)

- Área: UX
- Severidade: S3
- Esforço: P
- Confiança: provável
- Onde: web/src/services/remote/session.ts:528-534 (`withTimeout(enterSession(user), 10000)` → `goOffline()`) e :541-550; web/src/App.tsx:119-130 (texto "Assim que a internet voltar, o app abre sozinho.")
- Prova: o ramo de timeout cai em `goOffline()`, que só escuta o evento `online`; com `navigator.onLine === true` esse evento nunca vem. Cada `retryStart()` que falha chama `goOffline()` de novo e soma mais um ouvinte `online` (só sai quando dispara), então uma volta do sinal dispara N `restore()` em paralelo.
- Impacto: sem cache da conta no aparelho (login em outro navegador com o app já aberto, limpeza parcial de dados), 10 s de lentidão deixam a pessoa na tela "Sem conexão" até tocar em "Tentar de novo".
- Causa raiz: único gatilho de nova tentativa é o evento `online`.
- Correção recomendada: nova tentativa com espera crescente (3 s, 6 s, 12 s…) além do `online`, e `goOffline` idempotente (um único ouvinte).
- Critério de aceite: teste com `enterSession` lento (>10 s) e `navigator.onLine=true`: o app abre sozinho na segunda tentativa; só um ouvinte `online` registrado.
- Dependências: nenhuma.

### C2-014 — Política de privacidade não descreve o login por celular via Firebase/reCAPTCHA nem o que fica guardado no aparelho

- Área: LGPD
- Severidade: S3
- Esforço: P
- Confiança: confirmado
- Onde: web/src/services/legal.ts:147 e :177; web/src/services/remote/firebase.ts:1-12 e :214-226; web/src/services/remote/session.ts:144-169; web/src/services/features.ts:28-32
- Prova: `grep -c -i firebase web/src/services/legal.ts` → 0. O login por celular (`FEATURES.phoneLogin = firebase`) envia o número ao Firebase Authentication (Google) para o SMS e carrega o reCAPTCHA invisível do Google; a política cita só "Twilio (código por WhatsApp ou SMS)" e "Google (login, se você escolher)". O §9 diz que o navegador guarda "sessão e preferências (cidade, filtros)", mas o código grava `bicos.conta` (e-mail, WhatsApp, documento mascarado, perfil) na `localStorage` (session.ts:154-157), apaga no "Sair" e não apaga se a pessoa só fecha o navegador.
- Impacto: transparência incompleta (LGPD arts. 6º VI e 9º) sobre quem recebe o celular e o que fica no aparelho.
- Causa raiz: texto escrito antes do U28/U29 (Firebase) e do Z11 (cache da conta).
- Correção recomendada: citar Firebase Authentication/reCAPTCHA (Google, EUA) no §5 e a cópia local da conta no §9.
- Critério de aceite: texto atualizado e `legal.test.ts` verde.
- Dependências: advogado (ação do responsável).

### C2-015 — Código morto e comentários trocados de lugar nos serviços (higiene)

- Área: código
- Severidade: S3
- Esforço: P
- Confiança: confirmado
- Onde: supabaseMappers.ts:66-82, 112-132, 162-213, 368-407, 427-440, 462-541 (`*ToRow`, `databaseFromRows`, `databaseToInserts`, `DatabaseRows`: `grep` fora de supabaseMappers.ts → só `jobToRow` em src; `databaseFromRows/ToInserts` só em 1 teste); supabaseMappers.ts:411 (reexport de `relativeTime` que ninguém importa daqui); payments.ts:28-30 (imports no meio do arquivo e `jobInfo` importado duas vezes), :283 (e-mail hardcoded em vez de `SUPPORT_EMAIL`, features.ts:47); notifications.ts:23-27 (comentário de `withNotification` colado em cima de `notificationGroup`); session.ts:37-38 (dois blocos `/** */` seguidos), :400-401 (comentário do Y27 sobre `isOAuthUser`) e :440-452 (comentário de `startRemoteSession` solto acima de `sessionEnded`); store.ts:1-6 ("There is no backend… a reload brings the seed back" — falso desde o modo real); knip: `RELEASE`, `notificationGroup`, `DEFAULT_PREFS`, `isLocalMedia`, `storagePath` exportados sem uso; services/remote/data.ts:43 (`me()` diz "or a sign in again error" mas não lança).
- Prova: leitura linha a linha + `grep -rlw` (saída resumida em comandos.md) + `$SCRATCH/f1/knip.log`.
- Impacto: manutenção mais difícil; o comentário do `store.ts` engana quem lê.
- Causa raiz: acúmulo de rodadas (U/X/Y) sem limpeza.
- Correção recomendada: apagar a parte "para Supabase" de supabaseMappers que ninguém usa, arrumar os comentários e usar `SUPPORT_EMAIL` no recibo.
- Critério de aceite: typecheck/lint/knip sem os itens; testes verdes.
- Dependências: nenhuma.

### C2-016 — `checkPassword`/`verifyOtp` não tratam limite de tentativas nem conta suspensa: caem em "Não deu certo agora"

- Área: UX
- Severidade: S3
- Esforço: P
- Confiança: provável
- Onde: web/src/services/remote/auth.ts:120-137 (`checkPassword`, usada por `changePassword`, `changeEmail` e pela exclusão de conta), :177-197 (`checkSecurityCode`)
- Prova: `signIn` (l.91-103) trata `over_request_rate_limit`, `user_banned`, `captcha_failed`; `checkPassword` só trata `invalid_credentials` e delega o resto a `toServiceError`, que para esses códigos devolve `falha_demo` (client.ts:78). Quem erra a senha várias vezes ao trocar a senha/e-mail ou ao excluir a conta recebe a mensagem genérica em vez de "Muitas tentativas. Espere…".
- Impacto: a pessoa repete sem saber que está bloqueada por alguns minutos.
- Causa raiz: tratamento duplicado e desigual entre as funções de re-autenticação.
- Correção recomendada: extrair `authErrorToService(error)` usado por `signIn`, `checkPassword`, `verifyEmailCode` e `checkSecurityCode`.
- Critério de aceite: teste de `checkPassword` com `over_request_rate_limit` espera `code: 'conflito'` com a mensagem de espera.
- Dependências: nenhuma.

### C2-017 — Se o download do supabase-js falhar uma vez, `getSupabase()` guarda a promessa rejeitada e o app não se recupera sem recarregar

- Área: bug
- Severidade: S3
- Esforço: P
- Confiança: provável
- Onde: web/src/services/supabase.ts:30-49; web/src/main.tsx:33-38; web/src/App.tsx:122-130; web/src/components/ErrorBoundary.tsx:20-31
- Prova: `client = config ? import('@supabase/supabase-js').then(...) : …` fica em cache mesmo rejeitada; todo `db()` seguinte devolve a mesma rejeição. Em `main.tsx` a falha vira `setBootStatus('offline')`; "Tentar de novo" chama `retryStart()` → `restore()` → `await db()` → rejeita de novo, fora do `try` (session.ts:482), sem mudar estado. A única saída automática é `vite:preloadError` → `reloadOnceForNewVersion`, no máximo 1 vez por minuto (ErrorBoundary.tsx:26). O chunk (`index-DaueY-7D.js`, 224 KB) é baixado só na primeira visita; depois fica no cache do service worker.
- Impacto: na primeira visita, com sinal fraco, dois erros de download seguidos deixam a tela "Sem conexão" com um botão que nunca funciona.
- Causa raiz: promessa de inicialização preguiçosa sem limpar em caso de erro (o `firebase.ts:35-37` faz certo).
- Correção recomendada: `client = undefined` no `.catch` de `getSupabase`.
- Critério de aceite: teste: `import()` falha na 1ª chamada e funciona na 2ª; a 2ª chamada de `getSupabase()` resolve.
- Dependências: nenhuma.

### C2-018 — Se salvar o tema falhar, o aviso sempre diz "Sem internet" (mesmo quando a internet está boa)

- Área: UX
- Severidade: S3
- Esforço: P
- Confiança: provável
- Onde: web/src/services/theme.ts:97-100
- Prova: `saveMyTheme(theme).catch(() => { … showToast(serviceError('offline').message + ' O tema não foi salvo.' …) })` — o `catch` não olha o erro: sessão vencida, RPC `set_my_theme` ausente (banco atrasado) ou erro 500 também mostram "Sem internet. Confira sua conexão e tente de novo. O tema não foi salvo."
- Impacto: mensagem enganosa; a pessoa culpa a internet quando o problema é de sessão ou servidor.
- Causa raiz: `catch` sem distinguir o erro.
- Correção recomendada: usar `errorMessage(e)` (services/errors.ts:38).
- Critério de aceite: teste de `setTheme` com RPC falhando com `PGRST202` mostra a mensagem genérica, não a de offline.
- Dependências: nenhuma.

### C2-019 — Qualquer erro do Firebase com a palavra "captcha" vira "Esse jeito de entrar ainda não está ligado"; navegadores embutidos (WhatsApp/Instagram) caem em erro genérico

- Área: UX
- Severidade: S3
- Esforço: P
- Confiança: provável (lógica lida; não testei em aparelho)
- Onde: web/src/services/remote/firebase.ts:109-131 (`firebaseError`), :178-212 (`signInWithFirebaseGoogle`); `grep -rni "FBAN\|Instagram\|webview" web/src` → nenhuma detecção de navegador embutido
- Prova: `code.includes('captcha')` junto com `unauthorized-domain` e `operation-not-allowed` devolve `falha_demo` "…ainda não está ligado. Entre com e-mail e senha." — inclui `auth/captcha-check-failed` e `missing-recaptcha-token`, que são falhas reais do reCAPTCHA do aparelho (bloqueador de anúncios, rede lenta), não "recurso desligado". Erros como `auth/web-storage-unsupported` e `auth/operation-not-supported-in-this-environment` (típicos de navegador embutido) caem em `toServiceError(e)` → "Não deu certo agora".
- Impacto: o link da vaga é compartilhado por WhatsApp; quem abre dentro do WhatsApp/Instagram e toca em "Entrar com Google" vê erro sem saída clara (o Google bloqueia login em navegador embutido).
- Causa raiz: mapeamento de códigos incompleto e nenhuma orientação para "abrir no navegador".
- Correção recomendada: separar `captcha` (mensagem "Não deu para confirmar que você não é um robô, tente de novo") de `operation-not-allowed`; detectar navegador embutido e mostrar "Abra este link no Chrome/Safari para entrar com o Google".
- Critério de aceite: testes de `firebaseError` para `auth/captcha-check-failed` e `auth/web-storage-unsupported`.
- Dependências: nenhuma.

## Hipóteses não confirmadas

- H1 — `startRealtime` é chamado sem esperar (`void startRealtime(account)`, session.ts:305): dois `loadSession` seguidos (ex.: `finishSignUp` + evento `USER_UPDATED`) poderiam passar juntos por `await stopRealtime()` com `channel` nulo e deixar um canal e os ouvintes `online`/`visibilitychange` do primeiro sem remover. Não consegui provocar; o efeito seria avisos duplicados e requisições a mais.
- H2 — `handleAuthRedirect` liga `setRecovering(true)` (e grava `bicos.recuperacao`) antes de `setSession` (session.ts:371-373). Se `setSession` falhar com tokens de recuperação inválidos num aparelho que já tem uma conta logada, a flag fica e a próxima abertura desloga essa conta (caminho do X11). Não reproduzi; exige link com tokens presentes mas inválidos.
- H3 — Um `SIGNED_IN` de OUTRA conta vindo de outra aba (ex.: link de confirmação aberto no mesmo navegador) chama `enterSession` sem `leaveSession` (session.ts:573-579): ficam no store as fatias da conta anterior (a causa raiz de C2-005 também se aplica). Não reproduzi.
- H4 — Paginação por `lte` + ids vistos (`nextPage`, remote/data.ts:292-301): se mais de 30 linhas de uma mesma conta tiverem o mesmo `status_changed_at`/`created_at` (atualização em lote do cron), "Carregar mais" repetiria a mesma página. Improvável por conta; não reproduzi.
- H5 — Sentry: `monitoring.ts` usa o endpoint legado `/api/<id>/store/`, que a Sentry marca como descontinuado (pode deixar de aceitar); e `crypto.randomUUID()` (l.124) não existe em Chrome <92 mas o build é `es2020`: nesses aparelhos `reportError` lançaria dentro dos ouvintes globais. Sem aparelho para testar.
- H6 — O mural esconde empresas bloqueadas só no cliente (`notBlocked`, safety.ts:29; `feed_jobs` em u65 não menciona `blocks`): uma página de 30 vagas pode vir quase toda escondida e `hasMore` continua verdadeiro. Não medi.
- H7 — `warmUpSignIn` (firebase.ts:96-101) chama `entrar-com-firebase` com `{aquecer:true}` a cada ≥3 min por aba; se a função contar essa chamada no limite de 20/IP em 15 min (não li o código da função, fora da minha lista), IPs compartilhados de operadora poderiam bloquear logins reais.
- H8 — `signIn` com e-mail/senha de um usuário do Auth sem linha em `accounts` lança `MissingAccountError` (não é `ServiceError`) e a tela mostra o texto genérico; só no próximo recarregamento aparece "Não achamos o cadastro dessa conta" (session.ts:437). Caso raro (o gatilho cria `accounts` junto com o usuário).
- H9 — `enablePush` reaproveita `getSubscription()` existente (push.ts:63): depois de uma troca de chave VAPID a assinatura antiga continuaria sendo salva e nenhum aviso chegaria. Só importa quando houver rotação de chave.

## Bom e deve ser preservado

- `build/env.ts` + `vite.config.ts`: build de produção falha com variável faltando e com `{{…}}`/`LEGAL_REVIEWED=false` nos textos legais (só `BICOS_PILOTO_SEM_REVISAO_JURIDICA=1` libera o rascunho, nunca os campos em branco). Em `--mode e2e` só avisa (conferi: build gerado com 2 avisos).
- `leaveSession` limpa cache da conta, Realtime, store, cache de contatos, consultas, paginação e histórico; `clearSessionData` zera também o `ui` (nada digitado vaza para o próximo). Só falta a defesa contra respostas atrasadas (C2-005).
- `enterSession` com leitura única por usuário (X20) e `enterNewAccountSession` (U40); `request()` converte "permission denied sem login" em fim de sessão (R08).
- O service worker só guarda fotos públicas (`runtimeCaching` em vite.config.ts); nenhum dado de API/Auth fica no cache do navegador após trocar de conta.
- `monitoring.ts`: ordem das regras (token antes dos números), limite de 20 eventos, nomes de arquivo sem query, `extra`/`tags`/`value` todos passam por `scrubText`; sem SDK, sem breadcrumbs, sem URL completa, sem usuário.
- Upload: caminho `<uid>/<tempo>-<aleatório>.<ext>`, `x-upsert: false`, limite de tamanho no cliente e no bucket, compressão para ≤1600 px (remove EXIF no caminho normal), HEIC só sob demanda, selfie/documento em bucket privado.
- Códigos de erro `BC401/404/409/422` e `PG_CODES` traduzidos; mensagens em português simples; `invokeFunction` usa o código e a mensagem que a função mandou.
- `setTheme` desfaz a mudança local quando o servidor recusa; a flag de recuperação de senha persiste para não virar login (X11) e tem teste.
- `router.ts`: o hash com tokens é limpo antes de o roteador subir; `safeDecode` evita queda com `%` solto; `busy.ts` limita o travamento a 30 s, então o botão "voltar" nunca fica preso para sempre.
