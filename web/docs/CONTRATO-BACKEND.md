# Contrato do back-end

Este é o documento que o back-end (Supabase) segue. O front-end já funciona inteiro em modo de
demonstração: todas as telas chamam **só** as funções de `src/services/`, que hoje gravam no store em
memória (`services/store.ts`) depois de uma espera (`mockLatency`). Ligar o back-end é trocar o **corpo**
dessas funções, mantendo **assinatura, retorno e erros**. Nenhuma tela precisa mudar.

> Situação: Fase 1 (B01–B12) concluída e **implementada no Supabase** (`src/services/remote/`,
> `supabase/migrations/`, ver `docs/SUPABASE.md`). As fases 2 a 4 acrescentam funções a este documento.

## Regras gerais

- **Toda função de serviço é assíncrona** e pode falhar. Ela rejeita com `ServiceError`
  (`services/errors.ts`), que tem um `code` e uma `message` pronta em português, mostrada como está:

  | code             | quando                                                                  |
  | ---------------- | ----------------------------------------------------------------------- |
  | `offline`        | sem conexão / a requisição não chegou                                   |
  | `falha_demo`     | só no mock (interruptor de falha); no real, erro inesperado do servidor |
  | `nao_autorizado` | sem sessão, ou a conta não pode fazer isso (RLS, dono errado)           |
  | `nao_encontrado` | o registro não existe mais                                              |
  | `conflito`       | a ação não cabe no estado atual (status mudou, vaga cheia, já feito…)   |
  | `validacao`      | dado recusado (campo inválido)                                          |

  O back-end deve traduzir seus erros (rede, RLS, `check`, `unique`, exceções das RPCs) para esses
  códigos, com mensagens no mesmo tom das do mock.

- **Leituras** (`load*`) hoje só esperam e resolvem; no real, buscam as linhas e as colocam no store com
  `databaseFromRows` (`services/supabaseMappers.ts`). As telas leem o store e mostram esqueleto/erro pelo
  cache de leituras (`services/queries.ts`).
- **Mudanças que afetam mais de um registro** (status + notificações, vaga que fecha + candidaturas,
  pagar + impulsionar) são **uma transação** (RPC `security definer` ou função no banco).
- **Datas**: timestamps em ISO (UTC); datas de vaga em `YYYY-MM-DD` (dia local); horários `HH:MM`.
- **Tipos**: `src/types/models.ts` (domínio) e `src/types/supabase.ts` (linhas das tabelas, com os tipos do
  domínio nos enums e as colunas que o app pode alterar por `update`). `src/types/database.generated.ts` é
  **gerado do banco** (`npm run gen:types`, X14); o `typecheck` falha se `supabase.ts` declarar tabela,
  coluna, tipo, nulidade ou RPC diferente do SQL, e o CI falha se o arquivo gerado estiver velho. Os
  mapeadores em `supabaseMappers.ts` convertem de um para o outro e têm teste de ida e volta.
- **Dados privados**: o WhatsApp de trabalhador e construtora nunca é lido direto pelas telas; só por
  `contacts.getContact` (ver abaixo). As colunas `workers.whatsapp` e `companies.whatsapp` não devem ser
  legíveis por `select` comum (RLS / view sem a coluna).

## Tabelas

| tabela               | domínio                | observações                                                                       |
| -------------------- | ---------------------- | --------------------------------------------------------------------------------- |
| `accounts`           | `Account`              | `id` = `auth.users.id`; e-mail, documento, WhatsApp, confirmações, termos aceitos |
| `oficios`            | `Oficio`               | catálogo único (id, nome, sinônimos)                                              |
| `workers`            | `Worker`               | `oficio_id`, cidade/bairro/lat/lon, `rating`, `review_count`, `whatsapp` privado  |
| `companies`          | `Company`              | `whatsapp` privado                                                                |
| `jobs`               | `Job`                  | endereço completo + lat/lon, datas/horários reais, `boost_ends_at`, `deleted_at`  |
| `applications`       | `Application`          | status só muda pela tabela de transições; `auto_rejected`, `*_reviewed`           |
| `application_events` | `Application.events`   | histórico (status, quando, quem, motivo)                                          |
| `reviews`            | `Review`               | `application_id`, `direction`, nota, pontos (`tags`), comentário                  |
| `saved_jobs`         | `Database.savedJobIds` | por trabalhador                                                                   |
| `worker_posts`       | `WorkerPost`           | portfólio                                                                         |
| `notifications`      | `AppNotification`      | de um trabalhador **ou** de uma construtora; `target` = rota que abre             |
| `boost_payments`     | `BoostPayment`         | PIX/cartão; só `confirmado` define `jobs.boost_ends_at`                           |

As tabelas reais estão nas migrations de `web/supabase/migrations/` (as três de 2026-10-09 e as da rodada 2,
2026-10-10 a 2026-10-14); `types/database.generated.ts` é gerado delas e o `typecheck` confere `types/supabase.ts`
contra ele (X14). Tabelas da rodada 2: `application_attempts` (spam, X15), `whatsapp_verifications` (Y25),
`job_alerts` (Y28), `company_members` (F18), `job_invites` (F13), `reports` e `blocks` (F04), `notification_prefs`
(F06), `identity_submissions` (F07), `push_subscriptions` (X03), `payment_webhook_events` (Z02), `app_config` (Z12).

## Máquina de status da candidatura

Fonte única: `services/applicationMachine.ts` (`TRANSITIONS`). O banco deve aplicar a mesma tabela
(função `transition_application(app_id, action, reason)` que confere status atual e quem chama).

| ação                     | de                              | para                         | quem                 | onde                                                                                              |
| ------------------------ | ------------------------------- | ---------------------------- | -------------------- | ------------------------------------------------------------------------------------------------- |
| (criar)                  | —                               | `enviada`                    | trabalhador          | Confirmar candidatura                                                                             |
| (apagar)                 | `enviada`, `em_analise`         | — (removida)                 | trabalhador          | Detalhe da vaga › Cancelar candidatura                                                            |
| `analisar`               | `enviada`                       | `em_analise`                 | construtora, sistema | ao abrir o perfil do candidato (automático)                                                       |
| `aprovar`                | `enviada`, `em_analise`         | `pre_selecionado`            | construtora          | Gerenciar vaga / Perfil do candidato                                                              |
| `recusar`                | `enviada`, `em_analise`         | `nao_selecionado`            | construtora, sistema | Recusar; automático ao lotar a vaga ou encerrá-la                                                 |
| `desfazer_aprovacao`     | `pre_selecionado`               | `em_analise`                 | construtora          | Perfil do candidato › Desfazer aprovação                                                          |
| `contratar`              | `pre_selecionado`               | `contratado`                 | construtora          | Confirmar contratação                                                                             |
| `desistir`               | `pre_selecionado`,`contratado`  | `desistiu`                   | trabalhador          | Você avançou › Não vou poder ir (com motivo)                                                      |
| `cancelar_contratacao`   | `pre_selecionado`,`contratado`  | `cancelado_pela_construtora` | construtora          | Perfil do candidato › Cancelar (com motivo)                                                       |
| `concluir`               | `contratado`                    | `concluida`                  | construtora, sistema | Marcar diária como concluída; automático após a data                                              |
| `marcar_falta`           | `contratado`                    | `nao_compareceu`             | construtora          | Perfil do candidato › Não compareceu                                                              |
| `desfazer_recusa`        | `nao_selecionado`               | `em_analise`                 | construtora          | "Desfazer" no aviso de recusa (L22)                                                               |
| `expirar`                | `pre_selecionado`               | `expirada`                   | sistema              | a vaga venceu sem confirmar a contratação (Y04)                                                   |
| `cancelar_por_suspensao` | `pre_selecionado`, `contratado` | `cancelado_pela_equipe`      | sistema              | a equipe suspendeu o trabalhador ou a construtora (R03): o outro lado é avisado; a posição libera |

- Avaliar **não** muda o status: em `concluida`, cada lado avalia uma vez (`worker_reviewed`,
  `company_reviewed`).
- Ao `aprovar` a última vaga, as candidaturas pendentes da vaga vão para `nao_selecionado` com
  `by = sistema`, `reason = 'vaga_preenchida'` e `auto_rejected = true`. `desfazer_aprovacao` devolve essas
  para `em_analise` (se a vaga não foi encerrada). Quando a vaga fecha sozinha (equipe concluída, prazo, conta
  excluída) ou é excluída, a recusa vira definitiva (`auto_rejected = false`). U06: não existe mais encerrar à mão.
- `aprovar` falha com `conflito` se a vaga já estiver cheia.
- **Rotina diária**: candidaturas `contratado` cuja vaga tem `end_date < hoje` vão para `concluida`
  (`by = sistema`) e geram os pedidos de avaliação (mock: `concludeFinishedJobs`, chamado nas leituras).
- Cada mudança gera a notificação para o outro lado, na mesma transação (ver `services/applications.ts`).

## Funções de serviço

Assinaturas exatas estão no código; abaixo, o que cada uma recebe, devolve, os erros e o que o back-end
faz. "Sessão" = conta logada (`auth.uid()`).

### `auth.ts` — contas e sessão

| função                            | recebe → devolve                                                                                              | erros                                                                  | back-end                                                                                                                                                        |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `signIn(identifier, password)`    | e-mail ou CPF/CNPJ + senha → `{ok, role}` ou `{ok:false, reason:'conta-inexistente'                           | 'senha-errada'}`                                                       | `offline`                                                                                                                                                       | resolve CPF/CNPJ → e-mail (RPC), `signInWithPassword`; lê `accounts` para o papel                                                                                 |
| `signOut()`                       | → void                                                                                                        | (nunca falha)                                                          | `auth.signOut()`; limpa o store e o cache de leituras                                                                                                           |
| `isFreeForSignUp(campo, valor)`   | `'email'                                                                                                      | 'documento'                                                            | 'whatsapp'`, valor → `boolean`                                                                                                                                  | `offline`, `conflito` (muitas tentativas)                                                                                                                         | Edge Function `verificar-cadastro` → `signup_taken` (só conta confirmada); chamada no passo do cadastro (U10) |
| `signUp(data)`                    | papel, nome, documento, e-mail, WhatsApp, senha, versão dos termos → `{ok}` ou `{ok:false, reason:'doc-taken' | 'email-taken'}`                                                        | `offline`                                                                                                                                                       | `auth.signUp` + gatilho que cria `accounts` e `workers`/`companies`; guarda `terms_version`, `terms_accepted_at`; checa documento, e-mail e WhatsApp únicos (U10) |
| `verifyEmailCode(email, código)`  | 6 números do e-mail → void (entra na conta)                                                                   | `validacao` (código errado ou vencido), `conflito` (muitas tentativas) | `auth.verifyOtp({ email, token, type: 'email' })` (U11)                                                                                                         |
| `changePendingEmail(email)`       | e-mail certo → `{ok}` ou `{ok:false, reason:'email-taken'}`                                                   | `validacao`                                                            | refaz o `auth.signUp` com os mesmos dados (guardados só na memória) e o novo e-mail; o cadastro antigo, nunca confirmado, libera documento e WhatsApp (U11)     |
| `resendConfirmationEmail()`       | → void (novo código)                                                                                          | `offline`, `conflito` (pedido há menos de 1 minuto)                    | `auth.resend({ type: 'signup' })`                                                                                                                               |
| `finishSignUp(endereço)`          | endereço achado por `resolveAddress` (U51) → void                                                             | `validacao` (endereço incompleto ou fora do Brasil)                    | RPC `finish_sign_up` com `p.address`: grava o endereço em `addresses` (só a conta lê) e a cidade no perfil (trabalhador: ponto de ~1 km); perfil completo (U12) |
| `checkPassword(password)`         | → boolean                                                                                                     | `offline`                                                              | reautentica (`signInWithPassword` no mesmo e-mail)                                                                                                              |
| `requestPasswordReset(email)`     | → void                                                                                                        | `offline`                                                              | `auth.resetPasswordForEmail`                                                                                                                                    |
| `resetPassword(newPassword)`      | → void                                                                                                        | `offline`                                                              | `auth.updateUser({ password })` na sessão do link                                                                                                               |
| `sendWhatsAppCode(phone)`         | → void                                                                                                        | `offline`                                                              | envia código de 6 dígitos (Twilio/Meta) com limite de tentativas                                                                                                |
| `verifyWhatsAppCode(phone, code)` | → boolean                                                                                                     | `offline`                                                              | confere o código; marca `whatsapp_verified_at`                                                                                                                  |

**Guardas de rota** (`services/guards.ts`, puro): sem sessão → login; e-mail não confirmado →
`/verificar-email`; perfil incompleto → `/completar-perfil/:papel`; rota do outro lado → "Essa área é da
conta de …". O back-end só precisa garantir que `accounts` reflita esses estados.

### `jobs.ts` — vagas

| função                        | recebe → devolve    | erros                                                                       | back-end                                                                                                                                                            |
| ----------------------------- | ------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `loadFeed()`                  | → void              | `offline`                                                                   | vagas abertas (não encerradas, não excluídas, `end_date >= hoje` ou a combinar) + construtoras                                                                      |
| `loadJob(id)`                 | → void              | `offline`                                                                   | a vaga, a construtora e a candidatura da sessão                                                                                                                     |
| `loadSavedJobs()`             | → void              | `offline`                                                                   | `saved_jobs` da sessão + vagas                                                                                                                                      |
| `publishJob(draft)`           | `JobDraft` → id     | `offline`, `validacao`                                                      | insere em `jobs` com `company_id` da sessão; valida datas/horários/endereço como `jobForm.ts`; U52: `weekdays` (dias marcados; `dias` vira o resumo) e `place_type` |
| `updateJob(id, draft)`        | → void              | `nao_autorizado`, `conflito` (encerrada), `validacao` (pessoas < aprovados) | atualiza a vaga; se mudou valor, data/horário/dias ou endereço/tipo do local (`significantChanges`), notifica candidatos ativos                                     |
| `updateJobPhotos(id, photos)` | → void              | `nao_autorizado`                                                            | sobe para o Storage; atualiza `jobs.photos`                                                                                                                         |
| `deleteJob(id)`               | → void              | `nao_autorizado`                                                            | `deleted_at = now()` (L02 completa as regras)                                                                                                                       |
| `toggleSavedJob(id)`          | → `saved` (boolean) | `offline`                                                                   | insere/apaga em `saved_jobs` (a tela é otimista e desfaz se falhar)                                                                                                 |

### `applications.ts` — candidaturas

Todas aplicam a tabela de transições e notificam o outro lado na mesma transação.

| função                                | quem        | erros                                               |
| ------------------------------------- | ----------- | --------------------------------------------------- |
| `loadMyApplications()`                | trabalhador | `offline`                                           |
| `loadJobCandidates(jobId)`            | construtora | `offline`                                           |
| `loadHistory()`                       | construtora | `offline`                                           |
| `submitApplication(jobId)`            | trabalhador | `nao_encontrado` (vaga sumiu)                       |
| `withdrawApplication(jobId)`          | trabalhador | `conflito` (já decidida)                            |
| `giveUp(jobId, reason)`               | trabalhador | `conflito`                                          |
| `markInReview(jobId, workerId)`       | construtora | silencioso quando não há o que mudar                |
| `approve(jobId, workerId)`            | construtora | `nao_autorizado`, `conflito` (status ou vaga cheia) |
| `reject(jobId, workerId)`             | construtora | `nao_autorizado`, `conflito`                        |
| `undoApproval(jobId, workerId)`       | construtora | `conflito`                                          |
| `confirmHire(jobId, workerId)`        | construtora | `conflito`                                          |
| `cancelHire(jobId, workerId, reason)` | construtora | `conflito`                                          |
| `completeWorkday(jobId, workerId)`    | construtora | `conflito`                                          |
| `markNoShow(jobId, workerId)`         | construtora | `conflito`                                          |

### `contacts.ts` — WhatsApp

| função                      | recebe → devolve                           | erros                                                                                                        | back-end                                                                                                             |
| --------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `getContact(applicationId)` | → `{ name, phone, url }` do **outro** lado | `nao_autorizado` (status não é pré-selecionado/contratado, ou a sessão não é um dos lados), `nao_encontrado` | RPC `security definer` que confere tudo antes de ler a coluna privada; a URL usa as mensagens de `utils/whatsapp.ts` |

### `reviews.ts` — avaliações

| função                | recebe → devolve                                                      | erros                                                                                         | back-end                                                                                                                              |
| --------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `submitReview(input)` | `{applicationId, direction, value 1–5, tags[], comment ≤ 300}` → void | `nao_autorizado` (não é o lado certo), `conflito` (não concluída ou já avaliada), `validacao` | RPC: insere em `reviews`, recalcula `rating` (média, 1 casa) e `review_count` do avaliado, marca `worker_reviewed`/`company_reviewed` |

### `payments.ts` — impulsionar vaga

| função                           | recebe → devolve                                                | erros                                                                       | back-end                                                                                                                              |
| -------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `startPixPayment(jobId, plan)`   | → `BoostPayment` (aguardando, `pix_code`, `expires_at` +30 min) | `conflito` (vaga encerrada/cheia/vencida/já impulsionada), `nao_autorizado` | cria a cobrança no provedor (edge function)                                                                                           |
| `getPayment(id)`                 | → `BoostPayment` atual                                          | `nao_encontrado`                                                            | lê o pagamento; PIX vencido vira `expirado`                                                                                           |
| `simulatePixPaid(id)`            | só demonstração                                                 | `conflito` (código vencido)                                                 | **não existe no real**: o webhook do provedor confirma, define `jobs.boost_ends_at` = agora + horas do plano e notifica a construtora |
| `payWithCard(jobId, plan, card)` | → `BoostPayment` confirmado                                     | `validacao` (campos), `conflito` (recusado pelo banco)                      | o cartão é tokenizado no navegador pelo provedor; a edge function cobra e confirma como o webhook                                     |

Planos (`catalog.BOOST_PLANS`): `24h` R$ 12 (24 h), `3d` R$ 28 (72 h), `whats` R$ 39 (24 h + aviso por
WhatsApp a trabalhadores do ofício por perto — o envio é do back-end).

### `profiles.ts` — perfis

| função                                               | erros                              | back-end                                                                       |
| ---------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------ |
| `loadWorkerProfile(id)` / `loadCompanyProfile(id)`   | `offline`                          | perfil + avaliações (+ posts / vagas abertas)                                  |
| `updateMyWorkerProfile(patch)`                       | `validacao` (nome, ofício, cidade) | atualiza `workers` da sessão; trocar de cidade move lat/lon para o centro dela |
| `updateMyCompanyProfile(patch)`                      | `validacao`                        | atualiza `companies` da sessão                                                 |
| `saveMyAddress(endereço)` (U51)                      | `validacao`                        | RPC `set_my_address`: troca o endereço da conta e a cidade do perfil           |
| `addPortfolioPost(post)` / `deletePortfolioPost(id)` | `nao_autorizado`, `nao_encontrado` | Storage + `worker_posts`                                                       |

### `notifications.ts`

| função                         | back-end                                                                      |
| ------------------------------ | ----------------------------------------------------------------------------- |
| `loadNotifications()`          | notificações da sessão (por `worker_id` ou `company_id`), mais novas primeiro |
| `markAllNotificationsRead()`   | `read_at = now()` nas da sessão                                               |
| `markNotificationRead(id)`     | `read_at = now()` naquela (se for da sessão)                                  |
| `withNotification(...)` (puro) | no real, as notificações nascem dentro das RPCs/gatilhos das mudanças         |

### `address.ts` — endereço

| função                                      | back-end                                                                                                                                                                                                            |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lookupCep(cep)`                            | BrasilAPI (com o ponto do CEP), depois ViaCEP, direto do navegador → `{ cep, street, neighborhood, city: "Cidade, UF", point }` ou `null`                                                                           |
| `suggestStreets(cidade, texto)` (U51)       | ViaCEP (busca por endereço, dados dos Correios: cada rua com o CEP e o trecho); sem ViaCEP, as ruas do OpenStreetMap (Photon)                                                                                       |
| `suggestNeighborhoods(cidade, texto)` (U51) | Photon (OpenStreetMap) + os bairros das ruas já sugeridas                                                                                                                                                           |
| `resolveAddress(rascunho)` (U51)            | confere cidade (lista do IBGE), CEP (da cidade e da rua; em branco, achado pela rua e o bairro) e acha o ponto: Nominatim (OpenStreetMap), Photon, ponto do CEP, centro da cidade — `precision` diz até onde chegou |
| `locate(...)` (puro no mock)                | o ponto do CEP já buscado, ou o centro da cidade (o formulário da vaga até o U52)                                                                                                                                   |

### `account.ts` — privacidade (LGPD)

| função                                         | erros                                                             | back-end                                                                                                                                                                                                                                                                                                                                                |
| ---------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `exportMyData()`                               | `offline`                                                         | edge function monta o arquivo e envia por e-mail                                                                                                                                                                                                                                                                                                        |
| `loadDeletionImpact()`                         | `offline`                                                         | candidaturas/vagas em andamento da sessão                                                                                                                                                                                                                                                                                                               |
| `deleteAccount({password} \| {code}, confirm)` | `validacao` (senha ou código), `conflito` (bicos não confirmados) | reautentica (senha, ou código do e-mail — U16); RPC numa transação: avisa quem estava no bico em andamento e **apaga tudo da conta** (U24: construtora — todas as vagas, candidaturas, avaliações, impulsos; trabalhador — candidaturas, vagas salvas, publicações, alertas, avaliações; notas e bicos do outro lado refeitos); apaga o usuário do Auth |

### `legal.ts`

Texto, versão e data dos Termos e da Política (rascunho para revisão jurídica). No real, servir a versão
vigente de uma tabela; o cadastro grava a versão aceita em `accounts.terms_version`.

## Rodada 2 — funções de serviço novas

Mesma regra: cada função tem o corpo de demonstração e o real, com as mesmas assinaturas e erros.

| Serviço            | Funções novas                                                                                                                               | No banco                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `auth.ts`          | `changePassword`, `changeEmail`, `sendWhatsAppCode`/`verifyWhatsAppCode`, `signInWithGoogle`, `completeOAuthSignUp`, `abandonPasswordReset` | Auth; `create_my_account`; Edge Function `codigo-whatsapp`                        |
| `applications.ts`  | `undoReject`, `confirmPresence`, `loadMoreMyApplications`, `loadMoreHistory`; `submitApplication` diz `enviada`/`ja_enviada`                | `transition_application`, `undo_reject`, `confirm_presence`                       |
| `jobs.ts`          | `loadPublicJob` (vaga aberta sem login, pelo `public_slug` — L10; 60 consultas/10 min por IP, depois BC409), `loadMoreFeed`                 | `public_job_card`, `feed_jobs`                                                    |
| `profiles.ts`      | `changeWhatsApp`, `checkMyCompany`, `updatePostCaption`, `saveMyProfileImages`                                                              | `change_whatsapp`, Edge Function `verificar-cnpj`, grants por coluna              |
| `notifications.ts` | `loadMoreNotifications`, `myPrefs`/`loadNotificationPrefs`/`saveNotificationPrefs`; `unreadCount` usa o número do servidor                  | `my_unread_count`, `save_notification_prefs`, `notify()` respeita o silenciado    |
| `payments.ts`      | `myPayments`, `loadMyPayments`, `receiptText`                                                                                               | `boost_payments` (leitura da própria construtora)                                 |
| `alerts.ts`        | `loadMyJobAlert`, `saveJobAlert`, `deleteJobAlert`                                                                                          | `save_job_alert`, `delete_job_alert`, gatilho `notify_job_alerts` (5 por dia)     |
| `invites.ts`       | `loadInvites`, `inviteWorker`, `answerInvite`                                                                                               | `invite_worker`, `answer_invite`                                                  |
| `safety.ts`        | `reportContent`, `loadMyBlocks`, `blockAccount`, `unblockAccount`                                                                           | `report_content`, `block_account`, `unblock_account`, gatilhos de bloqueio        |
| `identity.ts`      | `loadMyIdentity`, `submitIdentity` (+ `demoApproveIdentity`, só demonstração)                                                               | bucket privado `identidade`, `submit_identity`, `my_identity`                     |
| `push.ts`          | `pushState`, `enablePush`, `disablePush`, `syncPushSubscription` (só modo real, com VAPID)                                                  | `save_push_subscription`, `delete_push_subscription`, Edge Function `enviar-push` |
| `contacts.ts`      | `getContact` guardado por candidatura e situação (W09)                                                                                      | `get_contact`                                                                     |

Só para a equipe (service_role, sem tela no app): `set_company_verification`, `set_identity_status`,
`funnel_daily`, `orphan_storage_objects`. Rotinas: ver SUPABASE.md.

## Modo de demonstração

- Contas: `trabalhador@bicos.demo` e `construtora@bicos.demo`, senha `bicos123`.
- Interruptor de falha: `?falhar=1` antes do `#`, ou Configurações › Demonstração.
- Simulações que somem no real: "Abrir meu e-mail" (confirma o e-mail), código de WhatsApp (qualquer 6
  dígitos menos 000000), "Simular pagamento confirmado" (PIX), cartão terminado em 0000 (recusa), CEPs da
  tabela de exemplo.
