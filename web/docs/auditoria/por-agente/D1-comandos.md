# D1 — comandos e consultas relevantes (saídas resumidas, sem dado pessoal nem segredo)

Projetos: staging `setyxomsbfrkneqqfoam` (S), produção `ppnxdajiihsjaojxokzh` (P, só catálogo/`count(*)`/ferramentas de inspeção).

## Migrations

- `list_migrations` S: 67 versões `20261009000100 … 20261024000100`; P: 54 linhas (`20261008233626_bicos_v2_schema … 20261012033541_habilitar_pg_net`).
- Comparação local: versões de S == `ls web/supabase/migrations` (67/67, `diff` vazio). Nomes de P × arquivos: faltam 25 (lanc06, 07, 09, 10, 12, 13; r03, r04; u01, 06, 10, 12, 24, 30, 32, 37, 48, 49, 51, 52, 53, 62, 63, 65, 67); `bicos_v2_rules` e `bicos_v2_data` entraram em pedaços (`…_rules_1_policies` … `…_7d_delete_account`, `…_data_1/2`, `…_enum_values`, `…_fix_update_job_changes`).
- `scripts/aplicar-tudo.mjs` numa cópia (`scratchpad/d1work/web`): "64 migrations", `diff -q` com `web/supabase/APLICAR-TUDO.sql` = idêntico. `git status` do repositório limpo.

## Inventário do catálogo (S)

- Tabelas `public`: 39, todas `relrowsecurity=true`, `relforcerowsecurity=false`, dono `postgres`. `anon` só tem `select` em `oficios`. 19 tabelas sem política (uso interno/legado).
- Políticas (`pg_policies`): 29 (S) / 26 (P). Nenhuma `for all`. `using (true)`: `oficios` (público), `workers`, `companies`, `reviews`, `worker_posts` (só `authenticated`). Demais por `auth.uid()`, `my_worker_id()`, `my_company_id()` ou `my_job_ids()`.
- Grants por coluna (`has_column_privilege` para `anon` e `authenticated`, por coluna): fechados para `authenticated` — `accounts.document_hash/document_cipher/suspended_reason`, `workers.whatsapp/identity_reason/identity_submitted_at`, `companies.whatsapp/cnpj_check`, `jobs.area_geog/hidden_at/hidden_reason/last_day`, `job_alerts.notified_*`. Abertos (por desenho): `jobs.cep/street/number/complement/lat/lon` (U53), `workers.identity_status`, `reports.resolved_by/resolution`. Produção: as colunas de endereço de `jobs` ainda fechadas.
- FKs (`pg_constraint`): todas as colunas de FK têm índice; cascatas: `accounts→auth.users`, `applications→jobs/workers`, `reports.reporter_id→auth.users`, `terms_acceptances→accounts`, etc.
- Gatilhos (`pg_trigger`): `check_*_v2` (fotos), `limit_application_spam`, `applications_refuse_blocked/suspended`, `jobs_refuse_suspended`, `companies_/workers_recount_rating`, `sync_*_verified`, `mark_identity_decided`, etc.; nenhum limita linhas de `worker_posts`.
- Funções `public`: todas com `search_path` fixo; `anon` executa só `public_job_card` entre as `security definer` (as demais executáveis por `public` são `cnpj_valid`, `cpf_valid`, `document_valid_for`, `notification_group`, `whatsapp_valid`: puras, sem `security definer`).
- Funções que citam `suspended_at`: `account_history`, `admin_company_queue`, `admin_suspend_account`, `admin_unsuspend_account`, `get_contact`, `refuse_suspended_application`, `refuse_suspended_job`.

## Storage (S e P iguais, exceto a política de leitura da equipe só no S)

- `storage.buckets`: `avatars` público 10 MB jpeg/png/webp; `identidade` privado 10 MB jpeg/png/webp; `portfolio` público 50 MB + mp4/quicktime/webm; `vagas` público 10 MB jpeg/png/webp.
- `storage.objects`: INSERT/UPDATE/DELETE por pasta `<uid>` (+ `my_worker_id()` ou `my_company_id()` não nulos); sem `select` nos buckets públicos; `identidade`: select só `is_staff()`, insert do dono trabalhador; sem UPDATE/DELETE.
- `app_config`: S tem `storage_public_base` com a URL do staging; P: `count(*) filter (where key='storage_public_base') = 1`.

## Advisors

- S segurança: INFO `rls_enabled_no_policy` 19; WARN `anon_security_definer_function_executable` 1; `authenticated_security_definer_function_executable` 56 (doc: 54); `auth_leaked_password_protection` 1; nenhum ERROR.
- S desempenho: INFO `no_primary_key` 2 (`application_attempts`, `public_link_hits`); `unused_index` 8.
- P segurança: INFO 14; WARN `extension_in_public` (`pg_net`), anon 1, authenticated 42, leaked password 1. P desempenho: `no_primary_key` 1; `unused_index` 17.

## Extensões (`list_extensions`)

- S: `plpgsql`, `supabase_vault` (vault), `pg_cron` (pg_catalog), `postgis`/`pg_net`/`pgcrypto`/`uuid-ossp`/`pg_stat_statements` (extensions). P: igual, mas `pg_net` em `public`. `pg_graphql` não instalado em nenhum.

## Tipos

- `generate_typescript_types` S (87 kB, arquivo salvo pela ferramenta) × `web/src/types/database.generated.ts`: script Python em `scratchpad/d1work/cmp_types.py` — 39 tabelas e colunas iguais; tipos iguais exceto `jobs.area_geog` e `vagas.localizacao` (`unknown` × `unknown | null`); 147 funções, nomes e argumentos iguais; 13 enums, valores iguais.

## Provas de RLS/escrita no staging (transação revertida)

Método: `do $$ … raise exception 'RESULTADOS …' $$` (o erro final desfaz tudo); contas de teste criadas dentro da transação com os helpers de `supabase/tests/_helpers.sql`; papel `authenticated` com `request.jwt.claims` e `set local role`.

- Rodada 1 (leitura): trabalhadora de fora e visitante. `workers.whatsapp`, `accounts.document_hash/cipher`, `jobs.hidden_reason`, `companies.whatsapp/cnpj_check`, `workers.identity_reason`: 42501. Todas as tabelas internas/legadas: 42501. Visitante: só `oficios` (14 linhas). `jobs.street/number/lat/lon/cep` de uma vaga: 1 linha (U53); `jobs` visíveis: 11; vaga oculta: 0; `workers` com lat/lon: 232; `reviews`: 50 (todas).
- Rodada 2 (escrita): `rating`/`verified` (42501); editar perfil de outra pessoa (0 linhas); foto externa e `javascript:` (BC422); `bio` longa (23514); `city`/`neighborhood` com 100 mil caracteres (OK); `lat=999`, `lat='NaN'` (OK); post em nome de outra pessoa (42501); post sem mídia (OK) e 200 posts num comando (OK); salvar vaga oculta (OK) e inexistente (23503); notificações: só `read_at` do dono; empresa: `whatsapp`, `cnpj`, `verified` (42501), `about` longo (23514), `location` com 100 mil caracteres (OK), logo externa (BC422); `insert/update/delete` em `jobs`, `accounts.role`, `applications`, `reviews`, `boost_payments` (42501); `get_contact` por não participante (BC401).
- Suspensão: `admin_suspend_account` por uma conta da equipe criada na transação; depois, trabalhadora suspensa: update do nome, post, salvar vaga, `block_account`, `save_job_alert` OK; empresa suspensa: update do nome e `delete_job` OK.
- Rodada 3 (apagar `app_config.storage_public_base` e chamar `orphan_storage_objects`): **não executada** — a ferramenta pediu confirmação humana para o `delete` e expirou sem resposta; nada foi gravado (o bloco terminaria em erro mesmo assim).
