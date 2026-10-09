# Aplicar as migrations novas no Supabase

O projeto `ppnxdajiihsjaojxokzh` já tem as três migrations de 2026-10-09 (`…_bicos_v2_schema`,
`…_bicos_v2_rules`, `…_bicos_v2_data`). As migrations abaixo são novas. O conector do Supabase usado no
desenvolvimento pede uma aprovação manual para comandos com `DROP`/`DELETE` (inclusive dentro de funções),
que não chega numa sessão automática. Por isso elas ficam prontas aqui, testadas num Postgres igual ao do
Supabase (`supabase/tests/local/setup.sh`), para aplicar de uma destas formas:

- **SQL Editor do painel**: abra cada arquivo, na ordem, cole e rode (cada um é idempotente: pode rodar de
  novo sem problema). Ou cole `APLICAR-TUDO.sql`, que junta todos numa transação só.
- **Supabase CLI**: `supabase link --project-ref ppnxdajiihsjaojxokzh` e `supabase db push`.

Depois de aplicar, rode a consulta de conferência de cada uma (no fim de cada item).

## Ordem

### 1. `20261010000100_z01_rpcs_candidatura.sql` (Z01 + Y02/Y03/Y05/Y06/Y08/Y15)

Cria as funções que faltavam (`transition_application`, `withdraw_application`, `delete_job`,
`delete_my_account`), o gatilho de limpeza de cadastro abandonado e a política de apagar foto da vaga. Já
com as correções: concluir/marcar falta só a partir do dia; "concluída" ocupa a posição; recusados
automáticos voltam quando uma posição libera; desfazer aprovação em vaga encerrada é recusado; excluir vaga
com equipe é recusado; excluir conta exige login recente e tira o nome das avaliações.

```sql
select proname from pg_proc
 where pronamespace = 'public'::regnamespace
   and proname in ('transition_application', 'withdraw_application', 'delete_job', 'delete_my_account',
                   'job_holding', 'job_reopen_auto_rejected', 'session_authenticated_at')
 order by 1;
-- 7 linhas
select tgname from pg_trigger where tgname = 'on_account_deleted_v2';  -- 1 linha
```

### 2. `20261010000200_z02_pagamentos.sql` (Z02 + Y13)

Apaga `simulate_pix_paid`, `pay_with_card` e `start_pix_payment`; cria as funções de cobrança só para
`service_role` (`begin_boost_payment`, `attach_boost_charge`, `fail_boost_payment`, `confirm_boost_payment`), a
tabela `payment_webhook_events`, os status `cancelado`/`reembolso_pendente` e o índice de um pagamento aguardando
por vaga.

```sql
select count(*) from pg_proc where pronamespace = 'public'::regnamespace
   and proname in ('simulate_pix_paid', 'pay_with_card', 'start_pix_payment');            -- 0
select has_function_privilege('authenticated', 'public.confirm_boost_payment(uuid)', 'execute'); -- false
select to_regclass('public.payment_webhook_events');                                         -- não nulo
```

### 3. `20261010000300_z07_documento_login.sql` (Z07 + Y16)

Tira `document_available` do app, cria `auth_attempts`/`rate_limit_hit`, `document_login_email`, o gatilho
`before_auth_user_created_v2` (documento conferido dentro do cadastro) e a rotina diária de limpeza.

```sql
select has_function_privilege('anon', 'public.document_available(text)', 'execute');        -- false
select tgname from pg_trigger where tgname = 'before_auth_user_created_v2';                   -- 1 linha
select jobname from cron.job where jobname = 'bicos-limpar-tentativas';                       -- 1 linha
```

Depois de aplicar, publique a Edge Function nova: `supabase functions deploy entrar-com-documento`.

### 4. `20261010000400_z08_app_antigo.sql` (Z08)

Fecha as funções e tabelas do app antigo para visitante e conta logada; cadastro não confirmado expira em
7 dias (`bicos-limpar-cadastros`).

```sql
select has_function_privilege('anon', 'public.reiniciar_cadastro_pendente_email(text)', 'execute'); -- false
select has_table_privilege('authenticated', 'public.profiles', 'update');                          -- false
select jobname from cron.job where jobname in ('limpar-cadastros-nao-confirmados', 'bicos-limpar-cadastros');
-- só bicos-limpar-cadastros
```

### 5. `20261010000500_z09_cpf_metadados.sql` (Z09)

O documento sai dos metadados do Auth no cadastro e nas contas existentes.

```sql
select count(*) from auth.users where raw_user_meta_data ? 'documento';                       -- 0
```

### 6. `20261010000600_z06_endereco.sql` (Z06)

Rua, número, complemento, CEP e o ponto exato deixam de ser legíveis por `select`; colunas `area_lat`/`area_lon`;
RPC `get_job_addresses`.

```sql
select has_column_privilege('authenticated', 'public.jobs', 'street', 'select');               -- false
select has_column_privilege('authenticated', 'public.jobs', 'area_lat', 'select');             -- true
```

### 7. `20261010000700_z12_fotos.sql` (Z12 + X09)

`app_config` com o endereço público do Storage (**no staging, troque o valor**), gatilhos que só aceitam URLs
do próprio Storage na pasta do dono, políticas do Storage sem listagem e com limites.

```sql
select value from public.app_config where key = 'storage_public_base';
-- https://ppnxdajiihsjaojxokzh.supabase.co/storage/v1/object/public/
select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects' and cmd = 'SELECT'; -- 0
```

### 8. `20261011000100_y01_y04_ciclo_vaga.sql` (Y01 + Y04)

Status `expirada`; o último dia da vaga ("a combinar" vale 30 dias depois de publicada); a vaga fecha sozinha
quando a equipe toda concluiu; a rotina diária conclui quem trabalhou (2 dias depois do último dia) e, em vaga
vencida, avisa quem esperava e expira pré-seleções não confirmadas; `update_job` reabre a vaga ao aumentar as vagas.

```sql
select 'expirada' = any(enum_range(null::public.application_status)::text[]);                 -- true
select proname from pg_proc where pronamespace = 'public'::regnamespace
   and proname in ('job_last_day', 'job_close_if_team_done') order by 1;                   -- 2 linhas
```

### 9. `20261011000200_x01_mural.sql` (X01 + Y10/Y11/L17)

Mural paginado no servidor: `feed_jobs` (cidade ou raio, ofício, quando, busca sem acento, impulsionadas e
urgentes primeiro, cursor), coluna `area_geog` com índice GiST e índices das consultas mais usadas.

```sql
select count(*) from pg_proc where proname = 'feed_jobs' and pronamespace = 'public'::regnamespace;   -- 1
select indexname from pg_indexes where tablename = 'jobs' and indexname in ('jobs_area_geog_idx', 'jobs_open_city_idx'); -- 2 linhas
```

## Testes

`supabase/tests/[a-z]*.sql` testam cada RPC como o app chama (cada teste termina em `rollback`, então pode rodar
no banco de verdade). Para rodar localmente:

```bash
./supabase/tests/local/setup.sh      # sobe o Postgres do Supabase (Docker) e aplica todas as migrations
DATABASE_URL=postgres://postgres:postgres@localhost:54322/postgres node supabase/tests/run.mjs supabase/tests/[a-z]*.sql
```

No SQL Editor: `node supabase/tests/run.mjs supabase/tests/z01_candidaturas.sql` imprime o SQL completo
(utilitários + teste) para colar; a última linha deve ser `TODOS OS TESTES PASSARAM`.
