# Relatório final — rodada 2

Branch `claude/front-novo-supabase`, pasta `web/`. Um commit por ID (ou por grupo pequeno de IDs ligados). Cada
decisão está em `DECISOES.md`; banco, funções e serviços externos em `SUPABASE.md`; ordem para aplicar no banco em
`supabase/APLICAR.md` (ou `supabase/APLICAR-TUDO.sql`).

**Legenda**: **feito** · **escondido até configurar** (pronto no código, aparece quando o serviço externo for
configurado — `services/features.ts`) · **adiado (motivo)**.

## O que falta do seu lado

1. **Aplicar as 36 migrations** (`APLICAR.md`, ou colar `APLICAR-TUDO.sql` no SQL Editor) — o conector pede uma
   aprovação manual que não chega numa sessão automática. A #31 reinstala o PostGIS: rodar num horário sem uso.
2. **Publicar as Edge Functions** novas (`SUPABASE.md` › 4).
3. **Configurar o que quiser ligar** (`SUPABASE.md` › 5): Mercado Pago, Turnstile, Twilio Verify, Google, push
   (VAPID), Brevo (SMTP), Sentry, limpeza de arquivos.
4. Painel: URL Configuration com o domínio; "Leaked password protection" (plano Pro).

## Validação

- `typecheck`, `lint`, `format:check`, **167 testes** (Vitest, serviços nos dois modos + falso Supabase), builds de
  demonstração, real e prévia — no CI a cada push, com **Lighthouse** (celular: Desempenho 96, Acessibilidade 100,
  Boas práticas 100, SEO 100) e **axe** (14 telas, 0 problemas WCAG 2.1 AA).
- **37 testes SQL** num Postgres igual ao do Supabase, aplicando as migrations uma a uma e também pelo
  `APLICAR-TUDO.sql` sobre uma cópia do esquema atual; inclui `seguranca.sql` (critério de aceite 8).
- Advisors do banco real anexados em `docs/ADVISORS.md`, com o que resolve cada aviso.

## Fase A — bloqueadores

| ID  | Situação                                                         | Onde                                                                      |
| --- | ---------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Z01 | feito                                                            | migration `z01_rpcs_candidatura`; `services/remote/applications.ts`       |
| Z02 | feito; cobrança real **escondida até configurar** (Mercado Pago) | migration `z02_pagamentos`; funções `criar-cobranca`, `webhook-pagamento` |
| Z03 | feito                                                            | `feed/feedUI.ts` (`orderJobs`), `feed_jobs`, `JobTile.tsx`                |
| Z04 | feito                                                            | `services/remote/jobs.ts` (insert/delete em `saved_jobs`)                 |
| Z05 | feito                                                            | `AccountMenuSheet.tsx`, `AppNav.tsx`, `pages/shared/Help.tsx`             |
| Z06 | feito                                                            | migration `z06_endereco` (`get_job_addresses`); `MapLinks.tsx`            |
| Z07 | feito; captcha **escondido até configurar** (Turnstile)          | migration `z07_documento_login`; função `entrar-com-documento`            |
| Z08 | feito                                                            | migration `z08_app_antigo`                                                |
| Z09 | feito                                                            | migration `z09_cpf_metadados`; `services/remote/auth.ts`                  |
| Z10 | feito                                                            | `ErrorBoundary.tsx`, `services/router.ts`                                 |
| Z11 | feito                                                            | `index.html`, `services/boot.ts`, `services/remote/session.ts`            |
| Z12 | feito                                                            | migration `z12_fotos`; `services/remote/storage.ts`, `utils/image.ts`     |

## Fase B — falhas de lógica

| ID  | Situação                                                   | Onde                                                                          |
| --- | ---------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Y01 | feito                                                      | migration `y01_y04_ciclo_vaga`; `selectors.ts`, `JobManage.tsx`, `MyJobs.tsx` |
| Y02 | feito                                                      | `applicationMachine.ts`; migration `z01`                                      |
| Y03 | feito                                                      | `applications.ts` (`reopenAutoRejected`); migration `z01`                     |
| Y04 | feito                                                      | migration `y01_y04_ciclo_vaga` (expirar, rotina)                              |
| Y05 | feito                                                      | `applications.ts`; migration `z01`                                            |
| Y06 | feito                                                      | `worker/Selected.tsx`                                                         |
| Y07 | feito                                                      | `JobDetail.tsx`, `ConfirmApplication.tsx`, `applications.ts`                  |
| Y08 | feito                                                      | `JobManage.tsx`, `CompanyProfileScreen.tsx`; migration `z01` (`delete_job`)   |
| Y09 | feito                                                      | `recruiter/JobClosed.tsx`                                                     |
| Y10 | feito                                                      | `services/remote/data.ts` (`loadFeed`), `merge.ts`                            |
| Y11 | feito                                                      | migration `x01_mural` (`feed_jobs`); `feed/`                                  |
| Y12 | feito                                                      | `services/queries.ts`, `remote/session.ts`                                    |
| Y13 | feito                                                      | migration `z02_pagamentos` (um pagamento aguardando por vaga)                 |
| Y14 | feito                                                      | `BoostPayment.tsx` (estado local; no real, formulário do provedor)            |
| Y15 | feito                                                      | função `excluir-conta`; migration `z01` (`delete_my_account`)                 |
| Y16 | feito                                                      | migration `y16_y17_documento`                                                 |
| Y17 | feito                                                      | `utils/document.ts`; migration `y16_y17_documento`                            |
| Y18 | feito                                                      | migration `y18_media_notas`                                                   |
| Y19 | feito                                                      | `VerifyEmail.tsx`, `remote/session.ts`                                        |
| Y20 | feito                                                      | `Signup.tsx`, `services/remote/auth.ts`                                       |
| Y21 | feito                                                      | `useScreenUI` (`hooks/useStore.ts`), telas de edição                          |
| Y22 | feito                                                      | `services/store.ts` (`setSessionAccount`), senhas só em estado local          |
| Y23 | feito                                                      | `SpecialtiesField.tsx`, `utils/specialties.ts`                                |
| Y24 | feito                                                      | migration `y24_verificacao`; `CompanyProfileScreen.tsx`                       |
| Y25 | feito; código **escondido até configurar** (Twilio Verify) | migration `y25_whatsapp`; função `codigo-whatsapp`; `ChangeWhatsApp.tsx`      |
| Y26 | feito                                                      | `CompleteProfile.tsx`                                                         |
| Y27 | feito                                                      | `remote/client.ts`, `remote/session.ts` (`MissingAccountError`)               |
| Y28 | feito                                                      | migration `y28_alerta_bico`; `services/alerts.ts`                             |

## Fase C — pendências antigas

| ID  | Situação                                                                                                                                       | Onde                                                                       |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| L01 | feito                                                                                                                                          | `recruiter/decisionToasts.ts`                                              |
| L02 | feito (com Y08)                                                                                                                                | `JobDetail.tsx`                                                            |
| L03 | feito (Y07)                                                                                                                                    | —                                                                          |
| L04 | feito (Z06)                                                                                                                                    | `MapLinks.tsx`, `Selected.tsx`                                             |
| L05 | feito                                                                                                                                          | `worker/MyApplications.tsx`                                                |
| L06 | feito (Y09)                                                                                                                                    | —                                                                          |
| L07 | feito                                                                                                                                          | `recruiter/MyJobs.tsx`, `History.tsx`                                      |
| L08 | feito (Z03)                                                                                                                                    | —                                                                          |
| L09 | feito                                                                                                                                          | `ReviewsScreen.tsx`, perfis                                                |
| L10 | feito; consulta automática **escondida até publicar** `verificar-cnpj`                                                                         | migration `l10_cnpj_receita`; função `verificar-cnpj`                      |
| L11 | feito                                                                                                                                          | migration `l11_validacao_perfil`; `services/profiles.ts`                   |
| L12 | feito                                                                                                                                          | `EditCompanyProfile.tsx`                                                   |
| L13 | Google **escondido até configurar**; login por celular **adiado** (custo de SMS e Auth por telefone; o código do WhatsApp cobre a confirmação) | migration `l13_conta_google`; `CompleteSignup.tsx`                         |
| L14 | feito (dígito, 18+); duplicidade no próprio passo **adiado** (permitiria descobrir quem tem conta — Z07)                                       | migration `l14_maior_idade`; `Signup.tsx`                                  |
| L15 | feito                                                                                                                                          | `VerifyEmail.tsx`, `ChangePassword.tsx`                                    |
| L16 | feito                                                                                                                                          | `Settings.tsx`, `services/legal.ts`                                        |
| L17 | feito                                                                                                                                          | `feed/`, `feed_jobs`                                                       |
| L18 | feito                                                                                                                                          | migration `l18_pagamento`; `utils/jobInfo.ts`                              |
| L19 | feito (Z06)                                                                                                                                    | —                                                                          |
| L21 | feito (Z12)                                                                                                                                    | —                                                                          |
| L22 | feito                                                                                                                                          | migration `l22_desfazer_recusa`                                            |
| F01 | feito (Abertas, Cheias, Encerradas); "Rascunhos" **adiado** (precisa guardar vaga incompleta no servidor; pouco uso esperado)                  | `recruiter/MyJobs.tsx`                                                     |
| F03 | feito                                                                                                                                          | `recruiter/RepublishJob.tsx`                                               |
| F04 | feito                                                                                                                                          | migration `f04_denuncia_bloqueio`; `SafetyMenu.tsx`, `BlockedAccounts.tsx` |
| F05 | feito                                                                                                                                          | `pages/shared/Help.tsx`                                                    |
| F06 | feito no app; push **escondido até configurar**; preferências por e-mail **adiado** (o app ainda não manda avisos por e-mail)                  | migration `f06_preferencias_aviso`; `NotificationSettings.tsx`             |
| F07 | feito (a equipe decide); verificação automática por provedor **adiado** (serviço pago)                                                         | migration `f07_identidade`; `VerifyIdentity.tsx`, `services/identity.ts`   |
| F08 | feito                                                                                                                                          | `ChangeEmail.tsx`, `ChangeWhatsApp.tsx`, `ChangePassword.tsx`              |
| F09 | feito; prévia do link **por vaga** **adiado** (precisa de renderização no servidor e do domínio)                                               | migration `f09_vaga_publica`; `PublicJob.tsx`, `utils/share.ts`            |
| F10 | feito                                                                                                                                          | migration `f10_perfil_profissional`; `utils/workerInfo.ts`                 |
| F11 | feito (histórico e recibo); reembolso e dados de faturamento/NF **adiado** (sem CNPJ e sem provedor ainda)                                     | `recruiter/Payments.tsx`, `services/payments.ts`                           |
| F12 | feito                                                                                                                                          | migration `f12_presenca`; `Selected.tsx`                                   |
| F13 | feito                                                                                                                                          | migration `f13_convite`; `InviteSheet.tsx`, `services/invites.ts`          |
| F14 | feito                                                                                                                                          | `ChooseProfile.tsx`                                                        |
| F15 | feito                                                                                                                                          | migration `f15_responsavel`                                                |
| F16 | feito                                                                                                                                          | migration `f16_portfolio`; `PostViewer.tsx`, `WorkerPosts.tsx`             |
| F18 | feito (só o modelo, como pedido)                                                                                                               | migration `f18_membros`                                                    |
| P01 | feito                                                                                                                                          | telas de edição de perfil                                                  |
| P04 | feito                                                                                                                                          | `ConfirmApplication.tsx`                                                   |
| P05 | feito                                                                                                                                          | `CompanyProfileScreen.tsx`                                                 |
| P06 | feito                                                                                                                                          | `recruiter/jobForm.ts` (`addRequirement`)                                  |
| P07 | feito                                                                                                                                          | `utils/whatsapp.ts`                                                        |
| P08 | feito                                                                                                                                          | `PasswordStrength.tsx`                                                     |

## Fase D — qualidade de app profissional

| ID  | Situação                                                                                                                        | Onde                                                                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| X01 | feito                                                                                                                           | migration `x01_mural`; `services/paging.ts`, `LoadMore.tsx`, `PhotoCarousel.tsx`                     |
| X02 | feito                                                                                                                           | `vite.config.ts` (PWA), `services/pwa.ts`, `public/icons`, `index.html`                              |
| X03 | sino e sincronia feitos; push **escondido até configurar** (VAPID)                                                              | migration `x03_push`; `services/push.ts`, `public/push-sw.js`, função `enviar-push`                  |
| X04 | feito                                                                                                                           | `Login.tsx`, `Signup.tsx`, `CompleteSignup.tsx`, `ForgotPassword.tsx`                                |
| X05 | feito                                                                                                                           | `hooks/useModal.ts`, `Modal.tsx`, `JobTile.tsx`, `styles/base.css`, `scripts/a11y-check.mjs`         |
| X06 | feito                                                                                                                           | `worker/ApplicationStatusCard.tsx`                                                                   |
| X07 | feito                                                                                                                           | `ApplicationSent.tsx`, `ConfirmApplication.tsx`                                                      |
| X08 | feito                                                                                                                           | `BoostPayment.tsx`                                                                                   |
| X09 | feito; limpeza diária **escondida até configurar** (função + Vault)                                                             | migration `x09_arquivos_orfaos`; função `limpar-arquivos`                                            |
| X10 | feito                                                                                                                           | `recruiter/jobForm.ts`, `CreateJob.tsx`                                                              |
| X11 | feito                                                                                                                           | `utils/password.ts`, `ResetPassword.tsx`, `remote/session.ts`                                        |
| X12 | feito                                                                                                                           | textos em `Signup.tsx`, `VerifyIdentity.tsx`, `BoostPayment.tsx`, `VerifyEmail.tsx`, `JobDetail.tsx` |
| X13 | feito (o aviso de RPCs para quem está logado não se aplica; senha vazada é chave do painel)                                     | migration `x13_avisos_seguranca`; `docs/ADVISORS.md`                                                 |
| X14 | feito                                                                                                                           | `scripts/gen-db-types.mjs`, `types/database.generated.ts`, `types/supabase.ts`                       |
| X15 | feito                                                                                                                           | migration `x15_rls_desempenho`                                                                       |
| X16 | feito; staging separado **adiado** (criar outro projeto entra na cobrança da organização — decisão sua)                         | `.github/workflows/web.yml`, `.env.example`, `APLICAR.md`                                            |
| X17 | feito                                                                                                                           | `services/router.ts`, `vite.config.ts`                                                               |
| X18 | feito                                                                                                                           | `utils/format.ts`, `services/auth.ts`; migration `y25_whatsapp`                                      |
| X19 | feito                                                                                                                           | `feed/feedUI.ts` (`originText`), `feed/Feed.tsx`                                                     |
| X20 | feito                                                                                                                           | `remote/session.ts` (`enterSession`)                                                                 |
| X21 | feito; Sentry **escondido até configurar**; analytics por pessoa **adiado** (exigiria consentimento; o funil agregado responde) | `_shared/monitoring.ts`, `services/monitoring.ts`; migration `x21_funil`                             |

## Fase E — polimento

| ID  | Situação | Onde                                                                                         |
| --- | -------- | -------------------------------------------------------------------------------------------- |
| W01 | feito    | `utils/format.ts`                                                                            |
| W02 | feito    | `utils/jobInfo.ts` (`dateText`)                                                              |
| W03 | feito    | `utils/jobInfo.ts` (`totalText`), `JobDetail.tsx`, `ConfirmApplication.tsx`, `JobManage.tsx` |
| W04 | feito    | `JobDetail.tsx`                                                                              |
| W05 | feito    | `JobPublished.tsx`, `CompanyProfileScreen.tsx`                                               |
| W06 | feito    | `JobManage.tsx`, `CandidateRow.tsx`                                                          |
| W07 | feito    | `WorkerProfileScreen.tsx`                                                                    |
| W08 | feito    | migration `w08_limites_vaga`; `jobForm.ts`, `utils/card.ts`                                  |
| W09 | feito    | `services/jobs.ts` (`nextJobId`), `services/contacts.ts`                                     |

## Critérios de aceite

| #   | Critério                                                      | Situação                                                                                                                        |
| --- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 1–6 | fluxos de cadastro, vaga, mural, aprovação, diária, variações | cobertos por testes de serviço (demo e falso Supabase) e testes SQL; no banco real, depois de aplicar as migrations             |
| 7   | impulsionar com provedor em sandbox                           | código pronto e testado com o falso provedor; **depende da conta Mercado Pago** (sem pagamento não há impulso — testado em SQL) |
| 8   | ninguém lê/muda o que não é seu                               | `supabase/tests/seguranca.sql` (e os testes de cada item)                                                                       |
| 9   | Configurações completas no celular                            | feito (Z05, F08, Y15, exportar dados)                                                                                           |
| 10  | sem tela branca nem botão girando para sempre                 | Z10, Z11, X02 (abre sem sinal)                                                                                                  |
| 11  | advisors sem ERROR, Lighthouse, CI verde                      | Lighthouse e CI verdes; o único ERROR do advisor sai com a migration #31                                                        |
