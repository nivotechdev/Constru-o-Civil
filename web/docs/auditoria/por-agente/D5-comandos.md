# D5 — Comandos e consultas relevantes (saída resumida; nada de dado pessoal nem segredo)

Convenções: STG = staging `setyxomsbfrkneqqfoam`; PRD = produção `ppnxdajiihsjaojxokzh` (só catálogo e `count(*)`).

## Repositório (somente leitura)

- `wc -l` dos 4 arquivos da lista: política 90, termos 68, LGPD.md 69, legal.ts 225. Leitura integral de todos.
- `grep -o "{{[A-Z_]*}}" web/src/services/legal.ts | sort -u` → 10 campos: BASE_TRANSFERENCIA_INTERNACIONAL, CIDADE_FORO, CNPJ, DPO_EMAIL (3 usos), DPO_NOME, ENDERECO, PRAZO_AUDITORIA, PRAZO_PAGAMENTOS, PRAZO_REGISTROS_ACESSO, RAZAO_SOCIAL. `LEGAL_REVIEWED = false` (legal.ts:22).
- `web/build/env.ts:101-118`: campos em branco são `escapable: false`; revisão ausente é `escapable: true` (variável `BICOS_PILOTO_SEM_REVISAO_JURIDICA=1`). `.github/workflows/web.yml:58-70` exige falha do build de produção.
- `grep -rniE "deleteUser|accounts:delete|identitytoolkit" web/supabase/functions web/src` (sem testes) → só a CSP; nenhuma exclusão no Firebase.
- `grep -rniE "firebase" web/src/services/legal.ts web/docs/LGPD.md` → nenhuma ocorrência.
- `grep -rn "osrm|routing.openstreetmap" web/src` → `services/route.ts:10-11`; chamador `components/JobMap.tsx:54`; origem `services/selectors.ts:33-40` (`addresses`, 6 casas).
- `grep -rnE "gtag|plausible|posthog|mixpanel|amplitude|hotjar|clarity|googletagmanager"` no front → sem analytics (um falso positivo em `FeedSheets.tsx`, palavra comum).
- `grep -rniE "encarregado|dpo|privacidade@" web/src --include=*.tsx` fora de `legal.ts` → nada (a única correspondência de "dpo" é "endpoint" nos tipos gerados).
- `grep -rniE "incidente|vazamento|ANPD" web/docs/*.md` fora de LGPD.md → vazio.
- `grep -rniE "\bdpa\b|cláusulas" web/docs` → LGPD.md:55 e CHECKLIST-LANCAMENTO.md:49 (assinar DPA com Supabase, Cloudflare, Twilio, Sentry, Brevo: pendente).
- `docs/SUPABASE.md:129` admite: sem `CLEANUP_SECRET` "a chamada diária é recusada (401) e nada é apagado".

## STG — catálogo e contagens

- `information_schema.columns` de `public`: 42 tabelas. Acima do mapa `LGPD.md`: `public_link_hits(ip_hash, at)`, `cron_alerts`, `account_prefs`, `addresses`, `staff_actions`, `staff_members`.
- Contagens (count): accounts 11, workers 230, companies 34, addresses 3, identity_submissions 0, whatsapp_verifications 0, reviews 50, reports 0, blocks 0, notifications 18, push_subscriptions 0, auth_attempts 3, application_attempts 0, terms_acceptances 22, staff_actions 265, boost_payments 0, profiles 12, vagas/candidaturas/avaliacoes/consentimentos 0, auth.users 12. `storage.objects`: avatars 10, **identidade 142**, portfolio 2, vagas 172. `auth.audit_log_entries` 0; `auth.sessions` 11; `auth.refresh_tokens` 22.
- `pg_constraint` (FKs que apontam para contas/perfis): todas `ON DELETE CASCADE` exceto `accounts_*_fkey` (NO ACTION, tratado pelo `anonymize_account`), `reviews.application_id` e `staff_actions.staff_id` e `reports.resolved_by` (SET NULL). `staff_actions` não tem FK para o alvo (texto).
- `pg_get_functiondef` lidas: `export_my_data`, `delete_my_account`, `anonymize_account`, `on_auth_user_deleted`, `purge_auth_attempts`, `purge_unconfirmed_signups`, `rate_limit_hit`, `orphan_storage_objects`, `call_storage_cleanup`, `criar_perfil_ao_cadastrar`, `submit_identity`, `mark_identity_decided`, `staff_log`, `document_hash`, `mask_document`, `create_my_account`, `create_account_for`, `finish_sign_up`, `accept_terms`, `save_address`, `set_my_address`, `public_job_card`, `push_new_notification`, `save_push_subscription`, `signup_taken`, `document_login_email`, `get_contact`, `is_staff`, `admin_identity_queue`.
- Gatilhos em `auth.users`: `before_auth_user_created_v2`, **`on_auth_user_created → criar_perfil_ao_cadastrar()`** (ativo), `on_auth_user_created_v2`, `on_auth_user_deleted` (BEFORE DELETE), `on_auth_user_updated_v2`.
- `profiles`: por tipo `construtora` 1, `pedreiro` 7, nulo 5; `documento_cifrado` nulo em todas (os cadastros novos não mandam documento nos metadados).
- `has_function_privilege('authenticated', …)` para `perfil_publico`, `buscar_perfis`, `exportar_meus_dados`, `excluir_minha_conta`, `meu_documento`, `salvar_documento`, `contato_whatsapp`, `postar_avaliacao`, `account_from_old_profile` → todas `false`, `anon` também `false`.
- `information_schema.column_privileges` para `authenticated`: `accounts` sem `document_hash`, `document_cipher`, `suspended_reason`; `workers`/`companies` sem `whatsapp`; `addresses` com todas as colunas (RLS `addresses_own`: só o dono).
- `pg_policies`: Storage `identidade` → INSERT só do dono (pasta `<uid>/`), SELECT `is_staff()`. `staff_members.role in ('admin','moderador')`.
- `storage.buckets`: `identidade` privado, 10 MB, jpeg/png/webp; avatars/portfolio/vagas públicos.
- `cron.job`: 7 jobs ativos (concluir-diarias, vencer-pix, limpar-cadastros, lembrar-presenca, limpar-arquivos, limpar-tentativas, vigiar-cron).
- `vault.secrets` (nomes): só `nivotech_documento_key` → faltam `bicos_cleanup_url` e `bicos_cleanup_secret`.
- `cron.job_run_details` do job de limpeza de arquivos: 11 `succeeded`, última 29/10 04:40 UTC. `net._http_response`: 5×200, 1×429, 2×nulo, a mais recente em 21/10.
- `select count(*) from orphan_storage_objects(1000)` → 279 no total, **142 do bucket `identidade`**; `storage.objects` de `identidade` criados de 19/10 a 24/10.
- `select … from pg_proc where prosrc ~ 'first_name\(' and prosrc ~ 'notify\('` → `admin_suspend_account`, `answer_invite`, `confirm_presence`, `transition_application`.
- `auth` (colunas): `sessions.ip`, `sessions.user_agent`, `refresh_tokens`…, `audit_log_entries.ip_address`.

## PRD — só catálogo e contagem

- Tabelas: `accounts` sem `suspended_*`; sem `terms_acceptances`, `addresses`, `account_prefs`, `staff_*`, `public_link_hits`, `cron_alerts`; `identity_submissions` sem `consent_version`/`consent_at`.
- Contagens: accounts 4 (1 com `terms_version`, 0 com WhatsApp verificado), workers 1, companies 3, profiles 4 (3 com documento cifrado, 1 com WhatsApp, 1 com foto), vagas 3, consentimentos 2, identity_submissions 0, reviews 0, jobs 0, auth.users 4, storage.objects 2 (avatars).
- Funções: existem `export_my_data`, `delete_my_account` (versão antiga: usa `author_label`, não apaga avaliações), `purge_auth_attempts`, `orphan_storage_objects` (já cita `identidade`), `submit_identity`, `criar_perfil_ao_cadastrar`; **não existem** `anonymize_account`, `on_auth_user_deleted`, `accept_terms`, `save_address`.
- Cron: 6 jobs (sem `bicos-vigiar-cron`). Vault: 2 segredos `bicos_cleanup_*`. `net._http_response`: 1 resposta 401. `bicos-limpar-arquivos`: 18 `succeeded`.
- Edge Functions: 8 publicadas (`entrar-com-documento` v2, `excluir-conta`, `verificar-cnpj`, `limpar-arquivos`, `enviar-push`, `codigo-whatsapp`, `criar-cobranca`, `webhook-pagamento`); **não publicadas**: `verificar-cadastro`, `entrar-com-firebase`.
