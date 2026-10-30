# M1 — Comandos e consultas relevantes (sem dado pessoal)

Staging `setyxomsbfrkneqqfoam` (somente leitura, exceto 3 blocos `DO … raise exception` que desfazem tudo; conferido depois: 0 usuários/vagas de teste).

1. `select proname … from pg_proc where pronamespace='public'` — lista completa; sem `close_job` (U06), com as legadas `decidir_candidatura`, `concluir_candidatura`, `fechar_vaga`, `contato_whatsapp` (sem EXECUTE para anon/authenticated).
2. `pg_get_functiondef` de: `transition_application`, `application_next_status`, `application_step`, `application_conclude`, `submit_application`, `withdraw_application`, `confirm_presence`, `undo_reject`, `delete_job`, `conclude_finished_jobs`, `conclude_my_finished_jobs`, `get_contact`, `job_holding`, `job_reopen_auto_rejected`, `job_close_if_team_done`, `job_close_applications`, `job_is_open`, `job_started`, `job_last_day`, `admin_suspend_account`, `anonymize_account`, `delete_my_account`, `on_auth_user_deleted`, `block_account`, `invite_worker`, `answer_invite`, `update_job`, `publish_job`, `job_from_draft`, `submit_review`, `feed_jobs`, `public_job_card`, `begin/confirm_boost_payment`, `save_job_alert`, `notify_job_alerts`, `signup_taken`, `notification_group`, `save_notification_prefs`, `remind_presence`, `reset_presence_on_new_dates`, triggers `limit_application_spam`, `refuse_*`.
3. `select jobname, schedule, command from cron.job` → `bicos-concluir-diarias` `7 * * * *` `select public.conclude_finished_jobs();` (+6 outros).
4. Triggers e constraints de `applications`, `application_events`, `jobs`, `job_invites`, `company_members`, `workers`, `companies`: `UNIQUE(job_id, worker_id)`; triggers de bloqueio/suspensão/spam em INSERT de `applications`; `recount_rating` em workers/companies.
5. `information_schema.role_*_grants` + `pg_policies`: `authenticated` só SELECT em `applications`/`application_events`/`job_invites`/`company_members`; política de `jobs` mostra vaga excluída/oculta a quem tem candidatura.
6. Enum `application_status` (11), `application_actor` (3), `notification_kind` (18).
7. Prova M1-001/M1-002 (3 contas de teste, vaga, `DO` com `raise exception` no fim):
   - `update jobs set hidden_at=now()` → empresa `transition_application(job, w2, 'aprovar')` → PERMITIDO (`pre_selecionado`).
   - `update accounts set suspended_at=now()` na empresa → `aprovar`, `contratar`, `invite_worker` → PERMITIDOS; `delete_job` com contratado → BC409.
   - bloqueio da empresa pelo trabalhador → `get_contact` continua devolvendo o telefone (H3).
   - `end_date` ontem: `desistir` (trabalhador) PERMITIDO; depois `marcar_falta` → BC409 "Essa candidatura mudou de situação…"; status final `desistiu`.
8. Build real examinado (M1-005): `VITE_*` falsos + `npx vite build --mode e2e --outDir <scratch>/dist-real-m1` → `assets/index-*.js` 653.656 bytes (202 KB gzip) contém `bicos123`, `trabalhador@bicos.demo`, "Eventos Meridiano", "Restaurante Alvorada", "Padaria Belém". Nada gravado em `web/` (git status limpo). Log: `build-real.log`.
9. Verificação final: `select count(*) from auth.users where email like 'm1+%'` → 0; vagas "Teste M1" → 0.
