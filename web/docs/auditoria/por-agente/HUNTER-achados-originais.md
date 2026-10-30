# HUNTER — Caçador de lacunas de cobertura (rodadas 1 e 2) (auditoria AUD)

Transcrito pelo consolidador a partir do relatório final do agente caçador (commit `67d9ffb`; staging só com `select` e blocos desfeitos; produção só `count(*)`). Reabriu todas as 10 Edge Functions e os 7 arquivos de `_shared/`, `services/router.ts`, `guards.ts`, `supabase.ts`, `remote/data.ts`, `remote/address.ts`, `remote/admin.ts`, `feed_jobs` (u49/lanc13/u65), o catálogo do staging (grants por coluna, políticas de escrita, CHECKs, gatilhos, funções `anon`/`authenticated`, Realtime, cron) e o CI. Contagem: S0 0, S1 0, S2 5, S3 2. Os achados do caçador **não passaram pelo cético**. Caminhos relativos a `web/`.

### HUNT-001 — Reembolso prometido não tem fila, nem estado final, nem tratamento de estorno ou chargeback (Mercado Pago)

- Área: produto
- Severidade: S2
- Esforço: M
- Confiança: confirmado
- Onde: `supabase/functions/webhook-pagamento/index.ts:43-53`; `supabase/functions/_shared/mercadopago.ts:21-22`; `supabase/migrations/20261010000200_z02_pagamentos.sql:12-16,165-176`; `src/pages/recruiter/Payments.tsx:25,89`
- Prova: o webhook só trata `approved` e `rejected`/`cancelled`. Qualquer outro status, inclusive `refunded` e `charged_back` (que o tipo `MpPayment` declara), cai em `else result = mp.status` e nada muda no banco. Staging: o enum `payment_status` é `aguardando, confirmado, recusado, expirado, cancelado, reembolso_pendente`; não existe estado "reembolsado" ou "estornado". Das 13 funções `admin_*` (lanc06), nenhuma lista nem resolve pagamento; não há fila no `/admin`. `confirm_boost_payment` devolve cedo para `reembolso_pendente`, então o pagamento nunca sai desse estado. A notificação diz "Vamos devolver o valor" e a tela diz "Reembolso em análise".
- Impacto: a empresa pagou, a vaga não pôde ser impulsionada e ninguém da equipe vê isso. Se ela contestar no cartão (chargeback) ou o Mercado Pago estornar, o impulso continua ativo e a receita do funil continua contando: problema de consumidor e de caixa.
- Causa raiz: o ciclo de vida do pagamento termina em "aprovado"; reembolso é só uma promessa em texto.
- Correção recomendada: adicionar os estados `reembolsado` e `estornado`; fazer o webhook tratar `refunded`/`charged_back` (marcar o pagamento e, no chargeback, encerrar `boost_ends_at`); criar `admin_payment_queue()` e `admin_mark_refunded(id, motivo)` no `/admin`, com `staff_log`; avisar a empresa quando o reembolso for feito.
- Critério de aceite: teste SQL que marca um pagamento `refunded` e checa que `boost_ends_at` encerra e o funil descontou; a fila lista os `reembolso_pendente`; um teste do webhook com `status=refunded` muda o estado.
- Dependências: ligar `FEATURES.payments` é ação do responsável

### HUNT-002 — O webhook de pagamento responde 200 mesmo quando aplicar o pagamento falha: o Mercado Pago não reenvia e o PIX pago vira "expirado" (aspecto novo de D4-003)

- Área: bug
- Severidade: S2
- Esforço: P
- Confiança: confirmado (leitura do código)
- Onde: `supabase/functions/webhook-pagamento/index.ts:30-33,44-45,57-58`; `supabase/functions/criar-cobranca/index.ts:91-99`; cron `bicos-vencer-pix` → `expire_pix_payments()`
- Prova: o aviso é gravado em `payment_webhook_events` na linha 30. Se `confirm_boost_payment` devolve erro (deadlock, timeout; ver D2-011), o código só faz `result = 'erro:…'` (linha 45), atualiza a linha do evento e devolve `{ok:true}` com status 200. Só o `catch` (falha ao ler o Mercado Pago) apaga a linha do evento para liberar o reenvio. O Mercado Pago só reenvia quando a resposta não é 2xx. O PIX tem `expires_at = now()+30 min`; em seguida `expire_pix_payments()` marca `aguardando` como `expirado`. Não existe rotina que consulte o Mercado Pago para conferir. Em `criar-cobranca`, o retorno de `attach_boost_charge` (linha 91) e de `confirm_boost_payment` do cartão aprovado (linha 99) é ignorado.
- Impacto: uma falha passageira do banco na hora em que o dinheiro entra faz a empresa pagar, ver "PIX venceu" e não receber o impulso; ninguém é avisado.
- Causa raiz: o webhook trata erro de aplicação como sucesso e não há conciliação.
- Correção recomendada: se a RPC falhar, apagar o evento e responder 5xx, como já se faz no `catch`; checar `error` de `attach_boost_charge` e `confirm_boost_payment` em `criar-cobranca`; criar uma conciliação a cada 10 minutos (para pagamentos `aguardando` ou `expirado` com `provider_payment_id`, consultar `getPayment` e chamar `confirm_boost_payment` se `approved`); alertar no Sentry quando `result` começar com `erro:`.
- Critério de aceite: teste do webhook com RPC falhando devolve 5xx e o evento pode ser reprocessado; um PIX pago com a confirmação simulada como falha é confirmado pela conciliação em até 10 minutos.
- Dependências: D4-003 (consolidar)

### HUNT-003 — "Login CSRF": o app aceita `#access_token=…&refresh_token=…` de qualquer link e entra na conta de quem montou o link

- Área: segurança
- Severidade: S2
- Esforço: M
- Confiança: confirmado (leitura do código; o ataque não foi executado)
- Onde: `src/services/remote/session.ts:355-381` (chamada de `setSession` na linha 373); `src/services/supabase.ts:44` (`flowType: 'implicit'`, `detectSessionInUrl: false`)
- Prova: `handleAuthRedirect` lê o fragmento da URL e, se existirem `access_token` e `refresh_token`, chama `client.auth.setSession(...)`. Não há nenhuma prova de que o link foi pedido por este navegador (nonce, estado ou PKCE). O atacante cria uma conta própria, copia os dois tokens da sessão dele e envia `https://<site>/#access_token=A&refresh_token=R&type=signup` por WhatsApp. Ao abrir, a vítima passa a usar a conta do atacante sem aviso; o toast diz "E-mail confirmado. Bem-vindo à Bicos!".
- Impacto: quase todos os dados que a vítima digitar vão para a conta do atacante (endereço de casa, WhatsApp, candidaturas; selfie e documento ficam sob a conta do atacante numa pasta que a equipe vê). A vítima, um trabalhador de celular simples, não percebe que está em outra conta.
- Causa raiz: o fluxo implícito aceita tokens do fragmento sem vínculo com um pedido feito neste navegador.
- Correção recomendada: passar para `flowType: 'pkce'` e trocar o `code` do link (`exchangeCodeForSession`); ou, mais barato, guardar um marcador com validade (ex.: 1 h) em `localStorage` quando o app pede cadastro, "esqueci a senha" ou troca de e-mail, e só aceitar `setSession` do fragmento se o marcador existir; ao entrar por link, mostrar "Você entrou como <e-mail>".
- Critério de aceite: teste em que um fragmento com tokens válidos, sem marcador, é ignorado e leva a `/login`; o link legítimo de "Esqueci a senha" pedido neste aparelho continua funcionando.
- Dependências: nenhuma

### HUNT-004 — Qualquer conta logada lê todos os trabalhadores (nome, bairro, coordenada, foto, bio, experiências) com uma consulta só

- Área: LGPD
- Severidade: S2
- Esforço: M
- Confiança: confirmado
- Onde: `supabase/migrations/20261009000200_bicos_v2_rules.sql:37` (política `using (true)` em `workers`); GRANT de SELECT por coluna em `workers`; `src/services/remote/merge.ts:24` (`WORKER_COLUMNS`)
- Prova: no staging, simulei uma conta de empresa (`set local role authenticated` com `sub` de uma conta `recrutador`). Resultado: `workers visiveis=231/231 companies visiveis=34/34`. As colunas legíveis de `workers` incluem `name, city, neighborhood, lat, lon, photo_url, cover_url, bio, experiences, facts, identity_status, jobs_done, rating`. Basta `GET /rest/v1/workers?select=…` com paginação.
- Impacto: cadastrar uma "empresa" é grátis e sem prova de posse (D4-005, D2-002). Quem cadastra consegue baixar a lista inteira de trabalhadores com nome, bairro (coordenada de ≈1 km) e foto: contra minimização da LGPD, e as pessoas são vulneráveis a golpe de falso emprego.
- Causa raiz: leitura pública para quem está logado, sem vínculo entre as partes.
- Correção recomendada: trocar a política: o próprio trabalhador, e empresas só quando houver vínculo (candidatura, convite, avaliação); o perfil público passa por uma RPC `get_worker_profile(id)` que confere o vínculo e devolve só os campos necessários, sem coordenada; revisar a rota `/trabalhador/:id` e o fluxo de convidar.
- Critério de aceite: teste SQL em que uma empresa sem vínculo vê 0 trabalhadores e a empresa com candidatura vê só o candidato.
- Dependências: decisão dos sócios (perfil visível a quem está logado é uma regra de produto: "os dois lados veem o perfil do outro")

### HUNT-005 — Colunas liberadas por GRANT para escrita direta aceitam MBs e coordenada inválida em perfis (aspecto novo de D2-001 / D1-003)

- Área: banco
- Severidade: S2
- Esforço: P
- Confiança: confirmado
- Onde: `supabase/migrations/20261009000100_bicos_v2_schema.sql:286-293` (grants); ausência de CHECK ou gatilho em `workers.city`, `workers.neighborhood`, `workers.lat`, `workers.lon` e `companies.location`
- Prova: no staging, num bloco desfeito com `request.jwt.claims` de uma conta de trabalhador e uma de empresa: `update workers set city = repeat('x',2000000), neighborhood = repeat('y',500000), lat = 999, lon = -999` retornou `rows=1`, `city_len=2000000`, `lat=999`. `update companies set location = repeat('z',1500000)` retornou `rows=1`, `location_len=1500000`. Como `workers` e `companies` têm SELECT `true`, esses textos vão para qualquer pessoa que veja o perfil; `city` e `location` entram em `WORKER_COLUMNS`/`COMPANY_COLUMNS`, lidos na lista de candidatos e no mural.
- Impacto: uma conta trava ou engorda a tela de outras (lista de candidatos, mural) e pode gravar coordenada fora do Brasil (a conta que fez isso quebra a própria busca).
- Causa raiz: escrita direta por coluna sem CHECK de tamanho/intervalo.
- Correção recomendada: CHECKs `char_length(city) <= 80`, `neighborhood <= 80`, `location <= 120`, `lat between -34 and 6`, `lon between -74 and -28`; ou tirar `city`, `neighborhood`, `lat`, `lon` do GRANT UPDATE e usar só as RPCs (`set_my_address`); validar as linhas atuais antes (como no L11).
- Critério de aceite: teste SQL em que o `update` com 2 MB falha e com `lat=999` falha.
- Dependências: nenhuma (mesma família de D2-001)

### HUNT-006 — Os artefatos do E2E (relatório e rastros do Playwright) ficam em repositório público, sem retenção curta

- Área: processo
- Severidade: S3
- Esforço: P
- Confiança: provável
- Onde: `.github/workflows/web.yml:198-207` (também sobe `web/e2e/resultados/artefatos`); `.github/workflows/staging.yml:193-200` (sobe `web/e2e/resultados/relatorio`); `web/e2e/playwright.config.ts` (`trace: 'retain-on-failure'`, `screenshot: 'only-on-failure'`)
- Prova: o repositório é público (`private: false`). Existem artefatos `e2e-staging` não expirados de 4–5,4 MB (dias 22 e 24/10), contra ≈1 MB nos runs verdes: indica anexos de falha. O relatório HTML do Playwright e os `trace.zip` guardam cabeçalhos `Authorization`, o corpo de `/auth/v1/token` (com `refresh_token`), e-mails das contas de teste (base `nivotech.dev+…@gmail.com`) e capturas de tela. Não foi possível baixar para confirmar o conteúdo (o download passa pelo Azure Blob, bloqueado pelo proxy).
- Impacto: qualquer pessoa logada no GitHub pode baixar tokens de contas de teste e o e-mail pessoal do sócio. As contas de teste são apagadas no teardown, o que limita o dano, mas o e-mail e os dados de tela ficam.
- Causa raiz: artefatos de teste tratados como privados num repositório público.
- Correção recomendada: `retention-days: 3`; subir só o resumo (sem `artefatos`/trace) em repositório público; `trace: 'off'` ou `'on-first-retry'` com mascaramento; usar um e-mail de projeto em `E2E_EMAIL_BASE`.
- Critério de aceite: nenhum artefato público contém `trace.zip`; `retention-days` definido nas duas ações.
- Dependências: nenhuma (relacionado a O1-014)

### HUNT-007 — O staging acumula lixo de teste e dado de gente real, sem rotina de limpeza

- Área: LGPD
- Severidade: S3
- Esforço: P
- Confiança: confirmado
- Onde: staging `setyxomsbfrkneqqfoam`; `web/e2e/limpeza.ts`; `anonymize_account` (Y15, anterior ao U24)
- Prova (contagens no staging): 223 linhas em `workers` e 30 em `companies` sem conta, todas "Conta excluída", de 19 e 20/10 (resto da anonimização anterior ao U24); 12 linhas em `profiles` legada (o gatilho copia nome e e-mail); 12 contas, 11 delas `@gmail.com`, criadas até 28/10, com 11 vagas e 3 candidaturas. Produção está limpa: 1 trabalhador e 3 empresas, 0 órfãos.
- Impacto: o CLAUDE.md proíbe dado real no staging, mas ali há e-mails reais sem prazo de apagamento; as linhas órfãs também são lidas por qualquer conta logada (HUNT-004).
- Causa raiz: sem rotina de limpeza do staging.
- Correção recomendada: `delete from workers/companies` dos órfãos "Conta excluída"; um cron (ou passo do `staging.yml`) que apague contas de teste com mais de N dias; esvaziar `profiles` legada no staging.
- Critério de aceite: `select count(*)` dos órfãos = 0 e uma rotina agendada registrada.
- Dependências: nenhuma (relacionado a D5-012, O1-002)

### HUNT-008 — O E2E nunca executa de verdade 5 das 10 Edge Functions, simula o Google com `createUser` e finge o CNPJ e o mapa; também não tem visitante nem pagamento (aspecto novo de O2-002 e O2-003)

- Área: testes | Severidade: S3 | Esforço: M | Confiança: confirmado
- Onde: `web/e2e/fluxos/08-cadastro-google.spec.ts:49-66`; `web/e2e/apoio.ts:245-269`; `web/e2e/fluxos/` (todos os specs); `web/e2e/local/servidor.mjs:11`
- Prova: `grep` pelo nome da função em `web/e2e`: `codigo-whatsapp`, `criar-cobranca`, `webhook-pagamento`, `enviar-push` e `limpar-arquivos` aparecem em 0 arquivos. `entrar-com-firebase` só aparece em comentário. O spec 08 reproduz o que a função faz com `admin.auth.admin.createUser({ app_metadata: { provider: 'google', via: 'firebase' } })`. Verificação do token, `generateLink`, X31 (`confirmProvenEmail`) e o ramo do celular nunca rodam. `apoio.ts:258-269` intercepta `verificar-cnpj` no navegador e sempre devolve `pendente/indisponivel`. O caminho "ATIVA vira verificada" não é testado; o spec 07 aprova a empresa à mão. `apoio.ts:245-253` zera ViaCEP, Nominatim, Photon e BrasilAPI CEP. A cadeia de geocodificação nunca roda. Nenhum spec abre `/v/:id` sem login (por isso C3-001 passou), impulsiona vaga, cria alerta ou convite, ou cobre `nao_compareceu` e `desistiu`. O spec 04 apaga as datas da vaga com `admin().update` e chama `conclude_finished_jobs` com service_role, então o cron real e a regra de +2 dias não são exercitados. O proxy do E2E local só serve `entrar-com-documento`, `excluir-conta` e `verificar-cnpj`.
- Impacto: as áreas com mais dinheiro e mais risco (pagamento, login pelo Google, celular, link público) não têm nenhuma prova automática. HUNT-001/002 e C3-001 ficaram sem teste porque ninguém passa por ali.
- Correção recomendada: spec de visitante em `/v/:id` e `/ajuda`; spec de impulso com um servidor falso do Mercado Pago, que assina o webhook com HMAC e confirma o `boost_ends_at`; testes de `entrar-com-firebase` chamando `verifyFirebaseToken` com `fetcher` e JWKS injetados, que a função já aceita; `verificar-cnpj` com `BRASILAPI_URL` apontando para um servidor falso (a função já lê essa variável); subir mais funções no `servidor.mjs`.
- Critério de aceite: o `web.yml` roda um spec de pagamento e outro de visitante; cada função tem ao menos uma chamada real no E2E ou um teste unitário.

### HUNT-009 — `submit_identity` aceita caminhos de arquivo que não existem, sem limite de tamanho, e o trabalhador fica "em análise" sem ter mandado selfie nem documento

- Área: banco/verificação | Severidade: S3 | Esforço: P | Confiança: confirmado
- Onde: função `public.submit_identity` (`web/supabase/migrations/20261013000700_f07_identidade.sql`); tabela `identity_submissions`
- Prova: no staging, num bloco desfeito, um trabalhador com `identity_status='nao_enviado'` chamou `submit_identity('<uid>/'||repeat('x',3000000), '<uid>/'||repeat('x',3000000), 'v1')`. Resultado: `msg=sem erro status=em_analise submissoes=1 tamanho_path=3000037`. A função só confere o prefixo `<uid>/`: não confere se o objeto existe no bucket `identidade`, se selfie e documento são arquivos diferentes, nem o tamanho do texto. Depois disso `submit_identity` recusa com BC409 ("já está em análise") até a equipe decidir.
- Impacto: qualquer trabalhador entra na fila da equipe sem selfie nem documento, e a fila (`admin_identity_queue`) devolve caminhos de MBs. O status "em análise" aparece para todos (D1-008). Quem tentar de má-fé trava a própria correção até a equipe recusar. A equipe gasta tempo com imagem quebrada.
- Correção recomendada: na função, exigir `char_length(path) <= 200`, caminhos diferentes, `exists (select 1 from storage.objects where bucket_id='identidade' and name = p_selfie_path)` (o mesmo para o documento) e `owner` igual ao `auth.uid()`; limitar `identity_submissions.selfie_path` e `document_path` por CHECK.
- Critério de aceite: teste SQL em que um caminho inexistente falha com BC422 e um com 3 MB também; o envio real continua passando.

## Hipóteses não confirmadas

- **H1 (potencialmente S1, PIX):** `begin_boost_payment` fixa `expires_at = now() + 30 minutes` no banco, e `criar-cobranca` manda isso como `date_of_expiration` ao Mercado Pago logo depois. A documentação encontrada (API de Orders) exige no mínimo 30 minutos após a criação do pagamento; se o mesmo valer para `/v1/payments`, o PIX falharia com 400 e cairia no ramo "provedor" (502). Também não confirmou se o formato com 6 casas decimais e `+00:00` é aceito. Nunca houve teste com o Mercado Pago de verdade (pagamentos desligados). Testar no sandbox, usar 35–60 min com offset ISO e 3 casas.
- **H2:** `conclude_finished_jobs()` e `remind_presence()` rodam em uma só transação sem tratamento de exceção por linha; uma linha "venenosa" pararia todas as diárias e vagas, e o cron só avisaria (D5-001 / D3b-006).
- **H3:** o "Carregar mais" por `lte(status_changed_at, cursor)` não tem desempate por `id`; com 30 ou mais linhas no mesmo instante a próxima página repete as mesmas linhas (`remote/data.ts:289-300`). Improvável com 30 por página.
- **H4:** serviços públicos gratuitos no caminho do cadastro de endereço e do mapa (Photon, Nominatim, OSRM demo, tiles do OSM), sem contrato nem SLA; as políticas de uso restringem uso comercial em volume. Se um bloquear, vira o caso de C1-002 (localização no centro da cidade em silêncio).
- **H5:** o login por celular (SMS) usa o número como única credencial; número reciclado pela operadora ou SIM swap abre a conta antiga (aspecto de D4-010).
- **H6:** `fold_text` só troca letras acentuadas pré-compostas; texto decomposto (NFD) não casa com a busca.
- **H7:** o PostgREST corta a resposta em 1000 linhas por padrão (`max_rows`); `applications.in('job_id', ids)` para empresa com muitas vagas abertas pode vir truncado sem aviso (aspecto de Q1-004).
- **H8:** se o Turnstile cair, `captchaOk` devolve `false` e ninguém entra por CPF/CNPJ nem cria cadastro, sem plano B.
- **H9:** SPF/DKIM/DMARC de `nivotech.com.br` não verificados (sem DNS no ambiente). Se o SMTP próprio (Brevo) continuar desligado na produção, o Supabase usa o SMTP padrão, limitado e restrito a e-mails da equipe do projeto.
- **H10:** `begin_boost_payment` não confere o selo da empresa nem se a vaga está oculta pela equipe, então uma empresa reprovada paga impulso.
- **H11:** o `heic2any` embute o `libheif` (LGPL-3.0) no pacote; falta aviso de licença.
- **H12:** `confirm_boost_payment` não compara o valor pago com `amount_cents` (D2-016): um chargeback parcial ou valor diferente não seria notado.
- **H13:** `anon` e `authenticated` têm SELECT de nível de tabela em `net.http_request_queue` e `net._http_response`. Se o schema `net` aparecer em `db_schemas` da API, o enfileirado inclui o cabeçalho `x-webhook-secret` de `limpar-arquivos` e de `enviar-push`, além do texto dos avisos. Por padrão o schema não é exposto, mas não consigo ler `pgrst.db_schemas`. Confira no painel (Settings, API, Exposed schemas).
- **H14:** `rate_limit_hit` insere a tentativa mesmo quando já passou do limite e conta numa janela deslizante. Quem continua tentando mantém a chave travada indefinidamente (agrava D4-006: travar o login de outra pessoa passa a custar uma tentativa por janela).
- **H15:** `submit_identity`, `set_job_photos` e `worker_posts` só conferem prefixo, com `..` proibido em texto puro. Variações `%2e%2e` ficam fora do filtro; navegadores normalizam isso para outro diretório, mas todos os buckets envolvidos são públicos, então o dano é baixo.
- **H16:** `configurar-auth.mjs` usa `rate_limit_email_sent` padrão de 100/h, enquanto o checklist fala em ≈12/h para a Brevo grátis (300/dia). Ao bater a cota diária da Brevo, o Auth devolve falha de SMTP e não `over_email_send_rate_limit`, então o cadastro mostra "Não deu certo agora" em vez da mensagem de espera.
- **H17:** a política de Storage de `identidade` não tem DELETE para o dono (liga com D5-011); o orçamento de arquivos de teste cresce sem teto no staging. Medido: `orphan_storage_objects()` lista 279 órfãos (142 em `identidade`, 134 em `vagas`, de 19 a 28/10). É a prova numérica de D5-001 na staging.

## Bom e deve ser preservado

- O gatilho `recount_rating` existe e corrige o arredondamento incremental; `notification_group` é igual no banco e em `enviar-push`; a publicação do Realtime cobre `notifications` e `account_prefs`.
- Os acessos a `localStorage`/`sessionStorage` estão todos em `try/catch`; `fold_text` cobre todas as letras do português.
- A verificação do token do Firebase está coerente (iss, aud, exp, auth_time, provedor); `set_job_photos` é validada pelo gatilho `check_job_photos_v2` (máx. 8 fotos, URL do próprio bucket).
- As licenças de produção são permissivas (MIT, ISC, Apache-2.0, BSD-2, OFL, 0BSD); o `<script>` inline do `index.html` é removido no build (a CSP não precisa de `unsafe-inline`); `companies.cnpj` fica mascarado.
- `services/router.ts`, `guards.ts` e `supabase.ts` lidos por inteiro sem defeito.
