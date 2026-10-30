# D4 — Edge Functions, Auth, Storage, CSP e segurança do front (achados ordenados por severidade)

### D4-001 — Todos os limites de taxa das Edge Functions usam o primeiro IP de `x-forwarded-for`, que o cliente pode escrever

- Área: segurança
- Severidade: S1 alto
- Esforço: P
- Confiança: provável (código + a própria decisão do projeto; o teste ao vivo com cabeçalho forjado não foi feito: o staging não é acessível pela rede e uma chamada via pg_net gravaria linhas)
- Onde: `web/supabase/functions/_shared/http.ts:63-66` (`clientIp`); usado por `entrar-com-documento/index.ts:35,44`, `verificar-cadastro/index.ts:55-65`, `codigo-whatsapp/index.ts:57,64`, `entrar-com-firebase/index.ts:56`; contraste: `web/supabase/migrations/20261016000200_lanc10_link_publico.sql:55-58` e `20261021000700_u52_dias_e_local.sql:390-393`; `web/docs/DECISOES.md` L10 (linha ~1394)
- Prova: `clientIp` faz `(req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim()`. Quem fica na frente (Cloudflare) acrescenta o IP real ao FINAL de um `X-Forwarded-For` que o cliente já mandou; o primeiro item continua sendo o que o cliente escreveu. O próprio projeto sabe: no L10 a RPC `public_job_card` lê `cf-connecting-ip` primeiro e a migration comenta "cf-connecting-ip é posto pela Cloudflare … (o cliente não consegue forjar); os outros cabeçalhos só de reserva". Os logs de borda do Supabase listam `request.headers.cf_connecting_ip` e `x_real_ip` (staging, `function_edge_logs`), então o cabeçalho confiável chega à borda. No staging, `auth_attempts` guarda a chave `cadastro-ip:<ipv4>` (um IPv4 por linha), ou seja, o `x-forwarded-for` existe e é usado como chave.
- Impacto: quem quer varrer CPFs/e-mails em `verificar-cadastro` (30 por IP; captcha só após 12 por IP — X32), tentar senhas em `entrar-com-documento` (20 por IP), pedir códigos de WhatsApp em massa (`zap-ip`, 10 por hora) ou abusar do `entrar-com-firebase` (20 por IP) manda um `X-Forwarded-For` diferente a cada pedido e nunca bate no limite por IP nem vê o captcha do X32. Sobram só os limites por valor (10 por CPF/e-mail, 5 por documento, 3 por telefone), que não impedem varrer valores diferentes. Inversamente, um atacante pode gastar o limite de um IP alheio de propósito.
- Causa raiz: um helper escrito antes do L10 e nunca alinhado com a conclusão do L10; a RPC do banco usa a ordem certa, as funções não.
- Correção recomendada: em `clientIp`, ler primeiro `cf-connecting-ip`, depois `x-real-ip`, e só então o ÚLTIMO item de `x-forwarded-for` (nunca o primeiro). Teste unitário com os cabeçalhos forjados. Registrar na DECISOES.
- Critério de aceite: no staging, chamar `verificar-cadastro` 13 vezes com `X-Forwarded-For` diferente em cada chamada a partir da mesma máquina: a 13ª exige captcha e a 31ª devolve 429; as linhas de `auth_attempts` têm sempre o IP da borda.
- Dependências: nenhuma.

### D4-002 — Produção roda Edge Functions de antes do L05: captcha passa sem segredo, CORS cai para "*", 2 funções nem existem

- Área: segurança
- Severidade: S2 médio
- Esforço: P (publicar com "pode"; os segredos são ação do responsável)
- Confiança: confirmado
- Onde: produção `ppnxdajiihsjaojxokzh` (get_edge_function: `entrar-com-documento` v2, as outras 7 em v1, todas de 09–12/10); repo `web/supabase/functions/_shared/{captcha,http,monitoring}.ts`; `web/docs/SUPABASE.md:28,93`; `CLAUDE.md` §4 ("todas publicadas")
- Prova: `list_edge_functions` na produção devolve 8 funções (faltam `verificar-cadastro` e `entrar-com-firebase`; o staging tem as 10, versões 81–151). Código publicado em `_shared/captcha.ts`: `const secret = Deno.env.get('TURNSTILE_SECRET'); if (!secret) return true;` (o repo recusa: `captcha.ts:12-16`). `_shared/http.ts` publicado: `'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? '*'` (o repo exige APP_ORIGIN: `http.ts:12-20`). `enviar-push` publicado: `VAPID_SUBJECT ?? 'mailto:[e-mail pessoal da equipe]'` (e-mail pessoal vai ao serviço de push; o repo já removeu). `_shared/monitoring.ts` publicado sem o scrub de JWT/token (o do repo tem). Se `TURNSTILE_SECRET` não existir nos Secrets da produção (CLAUDE.md §4 diz "Turnstile desligado"), `entrar-com-documento` aceita login sem captcha, só com o limite 5/documento e 20/IP. Também o staging está atrás do commit auditado: `verificar-cadastro` v103 (publicada em 24/10, do `master` em 5bddd2c) não tem o captcha do X32 (`cadastro-desafio-ip` não aparece no código publicado), porque o staging é publicado a partir do `master` e X30–X32 estão só na branch de auditoria.
- Impacto: no dia em que a produção abrir ao público, o login por CPF/CNPJ não tem captcha e as funções aceitam chamada de qualquer site; o cadastro não tem a checagem de "já existe conta" nem o login do Google/celular, que o app novo espera.
- Causa raiz: publicação em produção só com "pode" e nunca feita depois da rodada L05–X32; não há checagem automática da defasagem; a doc diz "todas publicadas".
- Correção recomendada: no lançamento, na ordem: (1) segredos (`APP_ORIGIN`, `TURNSTILE_SECRET`, `FIREBASE_PROJECT_ID`…), (2) publicar as 10 funções do `master` (`supabase functions deploy`, as sem JWT com `--no-verify-jwt`), (3) conferir com `get_edge_function`. Corrigir `SUPABASE.md` §4 e `CLAUDE.md` ("todas publicadas" é falso para 2). Incluir no CI/staging um passo que compare a lista de funções do repo com a do projeto.
- Critério de aceite: `list_edge_functions` na produção lista as 10 funções com `verify_jwt` igual à tabela de `SUPABASE.md` §4; chamada sem token do captcha a `entrar-com-documento` devolve 400 `captcha`; chamada com `Origin` estranho não recebe `Access-Control-Allow-Origin` dele.
- Dependências: ação do responsável (Turnstile, Firebase, domínio final em APP_ORIGIN); "pode" para publicar.

### D4-003 — Pagamento aprovado que não pode ser aplicado, ou que falha no webhook, não avisa ninguém da equipe

- Área: bug
- Severidade: S2 médio (vira S1 quando o Mercado Pago for ligado)
- Esforço: M
- Confiança: confirmado (código e catálogo)
- Onde: `web/supabase/functions/webhook-pagamento/index.ts:43-46,55-62`; RPC `confirm_boost_payment` (staging: ramo `reembolso_pendente`); `web/docs/DECISOES.md:312-314`; `web/supabase/functions/criar-cobranca/index.ts:91-99`
- Prova: no webhook, `const { error } = await admin.rpc('confirm_boost_payment', …); result = error ? \`erro:${error.message}\` : 'confirmado'` e a função responde 200 (`json({ ok: true, result })`, linha 62). O Mercado Pago só reenvia em resposta não-2xx, então o aviso de um PIX pago que falhou (banco fora do ar, vaga apagada, erro de transação) nunca é reprocessado; a linha de `payment_webhook_events`fica para sempre com`result = 'erro:…'` e a deduplicação (`23505`, linha 36) bloqueia qualquer reenvio manual. Não há `reportError`/Sentry nesse ramo. Quando a vaga já fechou, `confirm_boost_payment`grava`status = 'reembolso_pendente'`e só notifica a empresa ("Vamos devolver o valor"); nenhuma RPC`admin_*`nem tela de`/admin`lê`boost_payments` (`grep boost_payments`nas migrations não encontra o back-office), e a devolução é "pelo painel do Mercado Pago" (DECISOES:312-314), sem fila nem alerta para os sócios. Em`criar-cobranca`o resultado de`attach_boost_charge`(linha 91) e de`confirm_boost_payment`(linha 99) também é ignorado. Pagamentos`refunded`/`charged_back`caem em`result = mp.status` (linha 53): o destaque continua ligado.
- Impacto: uma empresa que pagou o PIX pode ficar sem o destaque e sem devolução, e ninguém saberá até ela reclamar; os sócios não têm lista de "devolver".
- Causa raiz: o fluxo foi desenhado para o caminho feliz; o "reembolso manual" ficou sem fila e a falha do webhook é registrada só na própria tabela.
- Correção recomendada: (1) webhook: em erro de `confirm_boost_payment` chamar `reportError` e responder 500 apagando a linha de dedupe (o MP reenvia); (2) card em `/admin` (ou alerta no Sentry/e-mail) para `boost_payments.status = 'reembolso_pendente'` e para `payment_webhook_events.result like 'erro:%'`; (3) tratar `refunded`/`charged_back` encerrando o destaque; (4) verificar o `error` de `attach_boost_charge`.
- Critério de aceite: teste da função com `confirm_boost_payment` forçado a falhar devolve 5xx e não deixa a linha de dedupe; um pagamento em `reembolso_pendente` aparece na fila da equipe e gera alerta em até 1 hora.
- Dependências: Mercado Pago ligado é "ação do responsável"; o conserto pode ir antes.

### D4-004 — A CSP não tem `media-src`: vídeo do portfólio não toca nem aparece na prévia, e nenhuma etapa do CI exercita a CSP num navegador

- Área: bug
- Severidade: S2 médio
- Esforço: P
- Confiança: confirmado (reproduzido no Chromium com o cabeçalho copiado de `_headers`)
- Onde: `web/public/_headers:8` (sem `media-src`; cai em `default-src 'self'`); consumidores: `web/src/pages/shared/PostViewer.tsx:74`, `web/src/pages/shared/WorkerPosts.tsx:130,240` (`<video src=…>`), `web/src/services/remote/storage.ts:20-22,68-89` (envia mp4/mov/webm ao bucket `portfolio`, até 50 MB); `web/src/__tests__/headers.test.ts` (confere só `connect-src`, `script-src`, `img-src`, `frame-src`)
- Prova: script `$SCRATCH/o1work/d4/csp-media.mjs` (e `csp-blob.mjs`): servidor local com o `Content-Security-Policy` lido de `_headers` e uma página com `<video src="https://abcdefgh.supabase.co/storage/v1/object/public/portfolio/u/x.mp4">` e um `<video>` com `blob:` criado por `URL.createObjectURL`. Saída do Chromium: `Loading media from 'https://abcdefgh.supabase.co/storage/v1/object/public/portfolio/u/x.mp4' violates the following Content Security Policy directive: "default-src 'self'". Note that 'media-src' was not explicitly set…` e o mesmo para `blob:http://127.0.0.1:…`. O teste do repositório não pega porque nunca lista `media-src`; o E2E e o site de teste (GitHub Pages, `site.yml`) não aplicam `_headers` (só o Cloudflare Pages lê o arquivo), então a CSP nunca rodou diante de um fluxo real.
- Impacto: na produção, o trabalhador que publica um vídeo no portfólio vê a prévia em branco e, depois de publicar, o vídeo não toca para ninguém. Como a CSP também nunca foi vista funcionando com Firebase (janela do Google, reCAPTCHA do SMS), Turnstile e o cartão do Mercado Pago, outras quebras no mesmo molde são possíveis no primeiro deploy real.
- Causa raiz: a lista de diretivas foi escrita à mão a partir dos endereços que o código chama; `<video>` carrega por `media-src`, que ninguém listou; o teste só cobre quatro diretivas.
- Correção recomendada: acrescentar `media-src 'self' blob: https://*.supabase.co`; estender o teste para `media-src` (e `font-src`, `worker-src`); passar a rodar um smoke de navegador (Playwright) contra uma build servida COM os cabeçalhos de `_headers` (um servidor de 15 linhas, como o do script) e falhar se houver `Refused to …`/violação de CSP no console em login, mural, vaga, portfólio, Google e cartão.
- Critério de aceite: `csp-media.mjs` sem nenhuma linha "violates"; o smoke no CI passa sem violação nas telas listadas.
- Dependências: nenhuma.

### D4-005 — "Empresa verificada" é concedida a qualquer pessoa que digite um CNPJ ativo qualquer

- Área: segurança
- Severidade: S2 médio (sobe para S1 no lançamento público: o selo é o principal sinal de confiança para quem procura bico)
- Esforço: M
- Confiança: confirmado (código e decisão documentada; a falha está na decisão)
- Onde: `web/supabase/functions/verificar-cnpj/index.ts:42-80`; `web/docs/DECISOES.md:771-783` (L10/Y24); `web/src/pages/shared/CompanyProfileScreen.tsx:140,288`, `web/src/pages/shared/PublicJob.tsx:157`
- Prova: a função pega o CNPJ que a própria conta digitou (`company_cnpj_for_check`), consulta a BrasilAPI e, se `descricao_situacao_cadastral === 'ATIVA'`, chama `set_company_verification(user.id, 'verificada')` (linhas 75-78). Nada liga quem se cadastrou àquele CNPJ: não compara o nome digitado com `razao_social`/`nome_fantasia` (a resposta é gravada em `cnpj_check` só para a fila da equipe, linhas 54-70), não compara telefone nem e-mail da Receita com os da conta, não exige código enviado ao contato do CNPJ. O nome exibido ao trabalhador é o digitado. CNPJs de empresas conhecidas são públicos, e U10 só impede repetir um CNPJ de conta já confirmada (o dono real fica sem conseguir cadastrar o seu).
- Impacto: um golpista cria a conta "Empresa X" com o CNPJ de uma empresa de verdade, recebe na hora o selo verde "Verificada" e o aviso "Empresa verificada", e publica bicos falsos (cobrar taxa, pedir documentos). O trabalhador de celular simples confia no selo.
- Causa raiz: a "verificação" confirma que o CNPJ existe, não que a pessoa é a empresa; a decisão aceitou isso para não segurar o mural (DECISOES:781).
- Correção recomendada: (a) no mínimo, trocar o texto do selo automático para "CNPJ ativo na Receita" e reservar "Verificada" para a conferência da equipe; (b) cruzar `razao_social`/`nome_fantasia` com o nome digitado e o `ddd_telefone_1`/e-mail da Receita com o WhatsApp/e-mail da conta, e só verificar automaticamente se bater; (c) alternativa mais forte: código de confirmação enviado ao telefone/e-mail que a Receita tem para o CNPJ.
- Critério de aceite: teste da função com BrasilAPI simulada devolvendo ATIVA para um CNPJ de outro nome → status continua `pendente` e a conta entra na fila `/admin`.
- Dependências: decisão do responsável sobre o significado do selo.

### D4-006 — Login por CPF/CNPJ: a resposta demora 140 vezes mais quando o documento existe, e 5 pedidos travam o login por documento de qualquer pessoa

- Área: segurança
- Severidade: S3 baixo
- Esforço: P
- Confiança: confirmado (medido no staging; o efeito de ponta a ponta pela rede não foi medido)
- Onde: RPC `document_login_email` (staging); `web/supabase/functions/entrar-com-documento/index.ts:43-56`; `web/docs/DECISOES.md:319-340` (Z07)
- Prova: a RPC sai logo quando não acha o documento e só roda `crypt()` (bcrypt) quando acha. Medido no staging (bloco `do $$` que termina em `raise exception`, nada gravado): sem conta 0,55 ms por chamada; bcrypt de conta existente 77,84 ms por chamada. A Z07 promete "Ninguém descobre quem tem conta pelo CPF/CNPJ" com uma resposta só, mas o tempo entrega a informação (diferença de dezenas de ms é medível com poucas repetições; o limite é 20 por IP, burlável pelo D4-001). Além disso, o contador 5-por-documento (linhas 44-45) conta a tentativa de qualquer pessoa: 6 pedidos com captcha em 15 minutos deixam "muitas-tentativas" para o dono do CPF, e `rate_limit_hit` insere antes de contar, então quem continua tentando mantém o bloqueio. O dono ainda entra por e-mail. (O hash sem segredo das chaves do contador é o mesmo problema do D5-008.)
- Impacto: baixo hoje, porque U10 já responde sim/não ao mesmo dado (`verificar-cadastro`). Mas a doc afirma o contrário, e um atacante pode atrapalhar o login por documento de uma pessoa específica.
- Causa raiz: a RPC retorna cedo; o contador é por valor sem distinguir quem pede.
- Correção recomendada: na RPC, fazer um `crypt()` contra um hash fixo falso quando a conta não existe (tempo igual); contar tentativas FALHAS por documento+IP (não só por documento); atualizar a Z07 dizendo que U10 abriu essa informação de propósito.
- Critério de aceite: 50 chamadas de cada tipo medidas pela função têm medianas dentro de 10% uma da outra.
- Dependências: D4-001.

### D4-007 — Nenhuma chamada a provedor externo tem prazo máximo; o app também não corta a espera

- Área: bug
- Severidade: S3 baixo
- Esforço: P
- Confiança: confirmado
- Onde: `fetch` sem `AbortSignal` em `_shared/captcha.ts:23` (Turnstile), `_shared/mercadopago.ts:31`, `_shared/firebase.ts:40` (JWKS), `_shared/monitoring.ts:27` (Sentry, e é `await`ado antes de devolver o 500), `codigo-whatsapp/index.ts:27`, `verificar-cnpj/index.ts:48`; cliente: `web/src/services/remote/client.ts:142` (`functions.invoke` sem `timeout`)
- Prova: `grep -rn "AbortSignal\|timeout\|AbortController" web/supabase/functions` não devolve nada; no cliente, `invokeFunction` não passa prazo. Com o provedor lento (ou o Sentry fora), a função só termina no limite da plataforma e o botão fica girando — o que o CLAUDE.md §6 proíbe.
- Impacto: uma lentidão do Turnstile trava login e cadastro; do Twilio, o passo do código; do Sentry, qualquer resposta de erro.
- Causa raiz: nenhum padrão de prazo nas chamadas de saída.
- Correção recomendada: `AbortSignal.timeout(8000)` em cada `fetch` das funções (captcha e Twilio com falha fechada; BrasilAPI → `pendente`; Sentry → desiste em 2 s sem bloquear a resposta) e `timeout` no `invoke` do cliente com mensagem de "sem sinal".
- Critério de aceite: teste com provedor que não responde: a função devolve em até 10 s com o erro tratado.
- Dependências: nenhuma.

### D4-008 — Pequenas folgas na validação: assinatura do webhook com `ts` não numérico, `APP_ORIGIN` aceita `https://*.com`

- Área: código
- Severidade: S3 baixo
- Esforço: P
- Confiança: confirmado (executado em Deno 2.9.6)
- Onde: `web/supabase/functions/_shared/mercadopago.ts:76`; `web/supabase/functions/_shared/origin.ts:17-20`
- Prova: (1) `validSignature` com um cabeçalho cujo `ts` é `abc` e HMAC correto devolve `true` (`Math.abs(NaN) > 900` é falso, então a janela de 15 min é ignorada); `ts` de 1 hora atrás devolve `false`. Só quem tem o segredo consegue assinar, então não há ataque de fora; mas o teste de repetição fica sem efeito se o `ts` for sempre inválido. (2) `originsProblem(['https://*.com'])` e `['https://*.pages.dev']` devolvem `null` (aceitos) e `allowedOrigin(['https://*.com'], 'https://evil.com')` devolve `https://evil.com`: um erro de digitação no segredo `APP_ORIGIN` abre o CORS para a internet inteira em vez de recusar subir.
- Impacto: baixo; são armadilhas de configuração e de futuro.
- Causa raiz: validações por regex sem checar `Number.isFinite` nem a profundidade do curinga.
- Correção recomendada: `if (!Number.isFinite(ts)) return false;` e exigir pelo menos 3 rótulos depois de `*.` (ex.: `*.algo.pages.dev`), com teste em `edgeOrigin.test.ts`.
- Critério de aceite: os dois casos acima passam a ser recusados em teste.
- Dependências: nenhuma.

### D4-009 — Notificação por push: endpoint de inscrição é qualquer `https://…` (SSRF cego) e o clique abre URL absoluta

- Área: segurança
- Severidade: S3 baixo (push está desligado no lançamento, L12)
- Esforço: P
- Confiança: provável
- Onde: RPC `save_push_subscription` (só valida `^https://` e tamanho); `web/supabase/functions/enviar-push/index.ts:84-90`; `web/public/push-sw.js:25`
- Prova: qualquer conta logada grava `https://qualquer-host/...` (inclusive hosts internos ou lentos) e `webpush.sendNotification` faz POST nele a cada aviso daquela conta (a conta provoca avisos para si, p. ex. candidatando-se); 404/410 apagam a inscrição, o que revela ao dono se o alvo respondeu assim. O `web-push` também não tem `timeout` configurado (D4-012). No service worker, `new URL(data.url.replace(/^\//,''), scope)` aceita `https://outro-site` como URL absoluta e `clients.openWindow` abre. Hoje o `url` vem de `notifications.target` gerado pelo banco, então depende de outro erro para ser explorado.
- Impacto: baixo hoje; vira um ponto de partida para varredura de rede a partir do IP do Supabase e para abrir sites de terceiros se algum `target` vier de texto de usuário.
- Causa raiz: sem lista de serviços de push conhecidos; o SW confia no campo.
- Correção recomendada: na RPC e na função, aceitar só hosts de push conhecidos (`fcm.googleapis.com`, `updates.push.services.mozilla.com`, `*.notify.windows.com`, `*.push.apple.com`, `web.push.apple.com`); no SW, recusar `url` cuja origem difira de `self.location.origin`; passar `timeout` ao `web-push`.
- Critério de aceite: `save_push_subscription('https://169.254.169.254/x',…)` falha com BC422; SW com `url:'https://evil.test'` abre `/`.
- Dependências: nenhuma.

### D4-010 — Entrar por celular (Firebase) abre a conta pelo WhatsApp digitado no cadastro, mesmo sem confirmação do número

- Área: segurança
- Severidade: S3 baixo (a tela está sem botão desde o U39; o caminho do servidor continua ativo)
- Esforço: P
- Confiança: provável
- Onde: `web/supabase/functions/entrar-com-firebase/index.ts:74-87`
- Prova: no ramo `phone`, a conta é achada por `.eq('whatsapp', phone).not('email_confirmed_at','is',null)` sem exigir `whatsapp_verified_at`; depois a função grava `whatsapp_verified_at = now()` na conta. Com o código do WhatsApp desligado (Twilio, `CLAUDE.md` §4), nenhum número de conta foi comprovado. Quem tem o telefone digitado por engano por outra pessoa, ou um número reciclado pela operadora, recebe a sessão daquela conta (nome, candidaturas, contatos liberados).
- Impacto: raro, mas é acesso a conta de terceiro por coincidência de número, e o servidor ainda aceita o caminho mesmo sem botão (basta o provedor Telefone estar ligado no Firebase e o SMS do Brasil liberado).
- Causa raiz: a prova do SMS vale no momento do login, mas o vínculo número→conta não foi provado.
- Correção recomendada: exigir `whatsapp_verified_at is not null` no ramo de celular (ou manter o ramo desligado por padrão até o código do WhatsApp ser obrigatório).
- Critério de aceite: teste com token `phone` e conta com `whatsapp_verified_at` nulo → 404 `sem-conta`.
- Dependências: ação do responsável (decidir quando ligar SMS/Twilio).

### D4-011 — E-mail "Magic link" fala em excluir a conta, mas qualquer pessoa com a chave pública pode disparar para qualquer e-mail cadastrado

- Área: UX
- Severidade: S3 baixo
- Esforço: P
- Confiança: provável (comportamento padrão do Supabase Auth; não testado ao vivo por falta de rede)
- Onde: `web/supabase/email-templates/link-de-acesso.html:36-41,95-96`; `web/scripts/configurar-auth.mjs:67-68`; `web/src/services/remote/auth.ts:162` (`signInWithOtp` no navegador)
- Prova: o template do tipo "Magic link" tem o texto fixo "Você pediu para excluir sua conta na Bicos" e assunto "Seu código de verificação da Bicos". O app usa esse e-mail só no passo de segurança da exclusão, mas o endpoint `/auth/v1/otp` é público (o app mesmo o chama do navegador com a chave anônima); sem o captcha do Auth ligado (só liga se `TURNSTILE_SECRET` for dado ao script, linhas 80-85), qualquer um pede o código para o e-mail de outra pessoa e ela recebe um aviso de exclusão que não pediu. `shouldCreateUser:false` ainda costuma devolver erro para e-mail inexistente nessa rota, o que também revela quem tem conta (hipótese a confirmar no painel).
- Impacto: pessoas assustadas com "excluir conta"; ruído para o suporte; possível enumeração de e-mails pelo Auth.
- Causa raiz: um template genérico do Auth reaproveitado para um caso específico.
- Correção recomendada: texto neutro ("Seu código de segurança da Bicos") sem citar exclusão; conferir no painel que o captcha do Auth está ligado em "Enviar OTP/magic link".
- Critério de aceite: o e-mail não menciona exclusão; chamada a `/auth/v1/otp` sem token do captcha devolve 400.
- Dependências: ação do responsável (captcha no Auth).

### D4-012 — Variáveis do Firebase não estão documentadas nos exemplos de ambiente

- Área: docs
- Severidade: S3 baixo
- Esforço: P
- Confiança: confirmado
- Onde: `web/.env.example` (46 linhas, nenhuma `VITE_FIREBASE_*`); `web/src/env.d.ts:19-22`, `web/src/services/features.ts:15-18` (usam as 4); `web/supabase/functions/.env.staging.example` (sem `FIREBASE_PROJECT_ID`, que `entrar-com-firebase/index.ts:30,36` exige — sem ele a função responde 503 `desligado`); `web/docs/SUPABASE.md:17` ("Todas as variáveis estão explicadas em web/.env.example")
- Prova: `grep -n FIREBASE web/.env.example web/supabase/functions/.env.staging.example` não devolve nada; `VITE_FIREBASE_*` só existem em `env.d.ts`/`features.ts`.
- Impacto: quem montar o ambiente de produção seguindo os exemplos entrega o app sem Google/celular (botão escondido, função em 503) e sem saber por quê. O `.env.staging.example` das funções também traz um e-mail pessoal em `VAPID_SUBJECT=mailto:[e-mail pessoal da equipe]` (e `SUPABASE.md:163` manda usar o mesmo), que vai ao serviço de push do navegador; o código já tirou esse padrão (commit 0cd502e), a doc não.
- Causa raiz: o U28 acrescentou o Firebase sem atualizar os exemplos.
- Correção recomendada: acrescentar `VITE_FIREBASE_API_KEY/AUTH_DOMAIN/PROJECT_ID/APP_ID` ao `.env.example` e `FIREBASE_PROJECT_ID` ao `.env.staging.example`; trocar o `mailto:` por um endereço de função (ex.: `suporte@…`) na doc.
- Critério de aceite: o teste que confere `.env.example` (se existir) ou um `grep` no CI falha quando uma variável lida por `env.d.ts` não está no exemplo.
- Dependências: nenhuma.

### D4-013 — No servidor a senha só precisa de 8 caracteres de qualquer tipo; "letras e números" e a checagem de senha vazada não existem lá

- Área: segurança
- Severidade: S3 baixo
- Esforço: P (a proteção contra senha vazada é "ação do responsável": exige plano Pro)
- Confiança: provável (configuração lida no script; o painel não pôde ser lido)
- Onde: `web/scripts/configurar-auth.mjs:39` (`password_min_length: 8`, sem `password_required_characters`); `web/docs/SUPABASE.md:78-79`; `get_advisors` (WARN `auth_leaked_password_protection` na produção e no staging)
- Prova: o script de Auth só fixa o tamanho mínimo; o advisor confirma a proteção contra senha vazada desligada nos dois projetos. A regra "pelo menos 8 caracteres, com letras e números" (mensagem de `auth.ts:432`) vive no app: quem chama `/auth/v1/signup` ou `updateUser` direto com a chave pública (o app roda no navegador, logo a chave é pública) pode criar `12345678`.
- Impacto: contas com senha trivial entram na base sem passar pelo app; junto com D4-001 (limites burláveis) facilita adivinhar senha por e-mail.
- Causa raiz: regra de senha só no cliente.
- Correção recomendada: incluir `password_required_characters: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ:0123456789'` no `configurar-auth.mjs`; ligar a proteção contra vazadas quando houver plano Pro.
- Critério de aceite: `POST /auth/v1/signup` com `aaaaaaaa` devolve `weak_password`.
- Dependências: ação do responsável (plano Pro para a parte de vazadas).

### D4-014 — Folgas na CSP e nos cabeçalhos

- Área: segurança
- Severidade: M (melhoria, "agora" — barata e vale antes de ter usuários reais)
- Esforço: P
- Confiança: confirmado
- Onde: `web/public/_headers:8`
- Prova: (1) `connect-src`/`img-src` aceitam `https://*.supabase.co` e `wss://*.supabase.co`: um script injetado enviaria dados para o projeto Supabase de qualquer pessoa; o ideal é o domínio do projeto (a build já conhece `VITE_SUPABASE_URL`; o staging usa outro). (2) `style-src 'unsafe-inline'` (estilos em atributo do React/Tailwind; aceitável, mas o teste só garante script). (3) `frame-src https://*.mercadopago.com https://*.mercadolibre.com https://*.firebaseapp.com`: curingas amplos; o `authDomain` do Firebase pode ser um domínio próprio, que a CSP bloquearia (o teste fixa `bicoapp-6cc68.firebaseapp.com`). (4) sem `report-to`/`report-uri`: violações em produção ficam invisíveis. (5) `Permissions-Policy` bloqueia `payment=()`, mas a Payment Request API não é usada; ok. (6) `Strict-Transport-Security` sem `preload` (decisão válida enquanto o domínio não estiver confirmado).
- Impacto: pouco hoje; reduz o estrago de um XSS futuro e dá visibilidade.
- Causa raiz: um único arquivo estático serve staging e produção.
- Correção recomendada: gerar `_headers` na build com o host do Supabase da própria build; adicionar `report-to` para o Sentry; manter o teste que confere cada diretiva (inclui o D4-004).
- Critério de aceite: a CSP da build de produção só tem o host do projeto; uma violação deliberada aparece no Sentry.
- Dependências: D4-004.

### D4-015 — Não existe "Sair de todos os aparelhos" e a redefinição de senha só encerra a sessão deste aparelho

- Área: segurança
- Severidade: M (melhoria, "agora": uma linha de código e o público usa celular emprestado e de lan house)
- Esforço: P
- Confiança: confirmado (código); o efeito no Auth sobre outras sessões após trocar a senha não foi testado
- Onde: `web/src/services/remote/auth.ts:112` e `web/src/services/remote/session.ts:435,461,514` (todo `signOut({ scope: 'local' })`); `resetPassword` (`auth.ts:376-392`) e `changePassword` (`auth.ts:431-436`)
- Prova: `grep -rn "scope" web/src/services/remote/` só mostra `'local'`; não há `'global'` nem tela que ofereça isso.
- Impacto: quem perde o celular, entrou numa lan house ou teve a senha descoberta não tem como derrubar a sessão aberta em outro aparelho; ela dura até o refresh token ser revogado.
- Causa raiz: o encerramento foi pensado só para o aparelho atual.
- Correção recomendada: botão "Sair de todos os aparelhos" em Configurações (`signOut({ scope: 'global' })`) e chamar o mesmo ao terminar `resetPassword`; confirmar no staging se `updateUser({password})` já revoga as outras sessões.
- Critério de aceite: com duas sessões da mesma conta, "Sair de todos" faz a segunda receber 401 na próxima renovação.
- Dependências: nenhuma.

## Referências cruzadas (achados de outros agentes que cobrem pontos da minha frente)

- Excluir conta não apaga `identidade/` e a limpeza (`limpar-arquivos`) não roda: **D5-002 e D5-001**. Prova minha, a somar: `excluir-conta/index.ts:18` lista só `avatars`, `portfolio`, `vagas`; `query_logs` da produção em 24 h tem 1 chamada, `limpar-arquivos` → 401 (cron das 04:40, sem `CLEANUP_SECRET`).
- Limpeza apaga tudo se `app_config.storage_public_base` estiver errado, sem freio de proporção: **D1-006** (a RPC `orphan_storage_objects` e a função `limpar-arquivos` não têm trava; minha correção sugerida: abortar e alertar se os "órfãos" passarem de ~20% dos objetos).
- Conta suspensa ainda grava até o token vencer: **D1-005 / M1-001**. Confirmei que `admin_suspend_account` põe `banned_until` +100 anos e apaga `auth.sessions` (login e renovação recusados).
- Hash SHA-256 do documento sem segredo: **D5-008** (também vale para as chaves `doc:` de `auth_attempts`).
- Coordenadas da casa para o OSRM: **C2-001 / D5-003** (na CSP, `router.project-osrm.org` e `routing.openstreetmap.de` estão liberados em `connect-src`, coerente com o código).
- Falha de rede em Edge Function vira "Não deu certo agora": **C2-009 / C2-013** (o lado do navegador do meu D4-007).

## Hipóteses não confirmadas

- H1 Webhook do Mercado Pago ponta a ponta: nunca exercitado (pagamentos desligados). Dois pontos para o teste em sandbox: (a) se o Supabase entrega o `x-request-id` do Mercado Pago sem alterar (a assinatura usa esse cabeçalho; se a borda o trocar, todo aviso legítimo daria 401); (b) se `date_of_expiration` no formato que o banco devolve (`…+00:00`, sem milissegundos) é aceito pelo Mercado Pago no PIX (`criar-cobranca/index.ts:66`).
- H2 `POST /auth/v1/otp` com `create_user:false` para e-mail inexistente costuma devolver erro (422 "Signups not allowed for otp"): isso seria um oráculo de e-mails no Auth, fora do `verificar-cadastro`. Testar no staging com a chave pública.
- H3 `verifyFirebaseToken` não busca as chaves de novo quando o `kid` do token não está no cache (`_shared/firebase.ts:82`): numa troca de chaves do Google antes do `max-age` acabar, o login receberia 401 até o cache vencer. O Google publica a chave nova antes de usar, então o risco é baixo.
- H4 CSP × fluxos de terceiros: só o app em demonstração foi carregado sob a CSP (8 rotas, sem violação). Google/Firebase (janela e reCAPTCHA do SMS), Turnstile e o formulário de cartão do Mercado Pago nunca rodaram sob `_headers`; podem faltar hosts (p. ex. `connect-src` para `*.mlstatic.com`, `frame-src` para um `authDomain` próprio). Depende do D4-004 (smoke com cabeçalhos).
- H5 O service worker guarda fotos com `statuses: [0, 200]` (respostas opacas): o Chrome conta cada resposta opaca com um enchimento grande na cota de armazenamento; com até 300 fotos, celulares com pouco espaço podem estourar a cota. Não medido.
- H6 "JWT: sim" na tabela de funções do `CLAUDE.md` não é autenticação para `entrar-com-documento`, `verificar-cadastro`, `codigo-whatsapp` e `entrar-com-firebase`: a chave anônima é um JWT válido e é pública. Não há bug (as funções têm captcha e limites próprios), mas a tabela induz a achar que há login.
- H7 Não verificável sem o painel do Auth: Site URL e Redirect URLs, captcha do Auth ligado, SMTP/Brevo, Google, tempo de vida do código (`mailer_otp_exp`), confirmação de e-mail (os dados mostram 0 usuários não confirmados que entraram, 4 na produção e 13 no staging), limites de taxa do Auth, proteção de senha vazada (advisor: desligada nos dois projetos).
- H8 Segredos das funções (`TURNSTILE_SECRET`, `APP_ORIGIN`, `FIREBASE_PROJECT_ID`, `CLEANUP_SECRET`…) não podem ser listados com as ferramentas disponíveis; a conclusão do D4-002 vale para o código publicado, não para os Secrets.

## Bom e deve ser preservado

- Segredos comparados em tempo constante (`same()` em `enviar-push` e `limpar-arquivos`) e falha fechada sem segredo: captcha sem `TURNSTILE_SECRET` recusa; webhook sem `MP_WEBHOOK_SECRET` dá 401; push sem VAPID dá 503; funções do navegador não sobem sem `APP_ORIGIN`.
- Webhook do Mercado Pago: HMAC sobre `id;request-id;ts` com janela de 15 minutos, leitura do pagamento na API do Mercado Pago (o corpo do aviso não é usado para valor nem status), deduplicação por `(provider, event_id)` com `23505`, aviso liberado se a leitura falhar, `confirm_boost_payment` com `for update` e tratamento do pagamento tardio e da vaga já fechada. Valor cobrado vem do banco, não do navegador (`criar-cobranca/index.ts:56`).
- As RPCs de uso interno (`rate_limit_hit`, `begin/confirm/fail/attach_boost_*`, `document_login_email`, `signup_taken`, `mark_whatsapp_verified`, `orphan_storage_objects`, `company_cnpj_for_check`, `set_company_verification`, `call_storage_cleanup`) só têm `execute` para `service_role` (staging, `pg_proc.proacl`: `anon` e `authenticated` = falso).
- `verifyFirebaseToken` confere `alg` fixo RS256, `kid`, assinatura, `aud`, `iss`, `exp`, `iat`, `auth_time` (≤ 10 min) e `sub`; chaves em cache pelo `max-age`; falha de rede sobe como 502 (fecha). Só aceita `google.com` com e-mail verificado ou `phone`. X31 (senha antiga trocada por uma aleatória) está certo e testado.
- Storage: políticas por pasta `<uid>/` em todos os buckets, limites de tamanho e tipos por bucket (imagens; vídeo só no portfólio), `identidade` privado e lido só por `is_staff()`, sem listagem; `orphan_storage_objects` cobre todas as colunas que guardam URL de arquivo (conferi o esquema).
- CSP de script sem `unsafe-inline`/`unsafe-eval`, `object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`; a build tem um único `<script type="module">` (nada inline); o app em demonstração carrega 8 rotas sem violação sob a CSP (`$SCRATCH/o1work/d4/csp-app.mjs`); HSTS, `nosniff`, `Referrer-Policy`, `Permissions-Policy` e COOP compatível com a janela do Google.
- Front: nenhum `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `postMessage`; todo `target="_blank"` com `rel`; `window.open` com `noopener`; links de WhatsApp montados só com dígitos; nenhum `?next=`/redirecionamento aberto; o `localStorage` guarda só a própria conta (documento mascarado) e é limpo ao sair; o service worker só guarda fotos públicas (nada de Auth, banco ou funções).
- Segredos: nenhuma chave privada, `service_role`, token `sbp_`/`APP_USR`/`sk_live`, JWT ou DSN em `src`, `public`, `scripts`, `docs`, `supabase`, no `dist-demo` nem no histórico do Git (279 commits, `git log -G`). `.env.*` fora do Git (só os `.example`).
- `deno check */index.ts` (como o CI) e `deno lint` passam, com Deno 2.9.6 (o CI usa 2.5.4).
- Templates de e-mail: HTML só com estilo em linha, sem imagem nem script externos, português claro, variáveis do Auth corretas, avisos coerentes com a configuração (código vale 1 h = `mailer_otp_exp 3600`; cadastro sem confirmação some em 7 dias = limpeza do banco).
- CORS: origem exata (ou curinga controlado), `Vary: Origin`, `Max-Age` de 2 h, preflight tratado.
