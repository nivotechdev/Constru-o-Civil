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

### 10. `20261011000300_y16_y17_documento.sql` (Y16 + Y17)

`cpf_valid`/`cnpj_valid` (dígitos verificadores); o cadastro recusa conta de trabalhador ou recrutador sem
documento válido (recrutador pode usar CPF); `create_account_for` recusa documento inválido; limpa o CPF
mascarado que tinha ido para `companies.cnpj`.

```sql
select public.cpf_valid('529.982.247-25'), public.cpf_valid('123.456.789-01');   -- true, false
select count(*) from public.companies where cnpj like '***%';                     -- 0
```

### 11. `20261011000400_y18_media_notas.sql` (Y18)

Gatilho que recalcula nota e quantidade de avaliações de trabalhadores e construtoras a partir de
`reviews` (`round(avg(value), 1)`) sempre que `submit_review` mexe na contagem; recalcula todos os perfis.

```sql
select count(*) from public.workers w
 where review_count <> (select count(*) from public.reviews r where r.worker_id = w.id and r.direction = 'para_trabalhador'); -- 0
```

### 12. `20261011000500_y24_verificacao.sql` (Y24 + L10)

Status da verificação da construtora (`pendente | verificada | reprovada`, coluna `verification_status`), com
`verified_at`; o selo (`verified`) acompanha o status; só a equipe muda, pela função
`set_company_verification(empresa, status)` (service_role), que avisa a construtora.

```sql
select count(*) from public.companies where verified <> (verification_status = 'verificada');      -- 0
-- Para verificar uma empresa (SQL Editor):
-- select public.set_company_verification('<id da empresa>', 'verificada');
```

### 13. `20261011000600_y25_whatsapp.sql` (Y25)

`whatsapp_valid` (celular com DDD, 11 números) no cadastro; `change_whatsapp` é a única forma de trocar o
número (a coluna `companies.whatsapp` deixa de ser editável direto) e zera a confirmação, salvo se o número
acabou de ser confirmado por código; `whatsapp_verifications` + `mark_whatsapp_verified` (só a Edge
Function `codigo-whatsapp`).

```sql
select public.whatsapp_valid('11988887777'), public.whatsapp_valid('1188887777');               -- true, false
select has_column_privilege('authenticated', 'public.companies', 'whatsapp', 'update');          -- false
```

### 14. `20261011000700_y28_alerta_bico.sql` (Y28)

Tabela `job_alerts` (um aviso por trabalhador: cidade ou raio, ofício opcional), RPCs `save_job_alert` /
`delete_job_alert`, e o gatilho `jobs_notify_alerts` que avisa "Bico novo perto de você" em cada vaga nova que
bate (até 5 por dia por pessoa).

```sql
select count(*) from pg_trigger where tgname = 'jobs_notify_alerts';                              -- 1
select 'bico_novo' = any(enum_range(null::public.notification_kind)::text[]);                   -- true
```

### 15. `20261012000100_l18_pagamento.sql` (L18 + P06)

Colunas `jobs.payment_method` / `payment_note` (as vagas que já existem ficam com `pix_dia`, o texto que o app
mostrava); `publish_job` e `update_job` leem os campos novos e conferem os requisitos (até 12, 60 caracteres
cada); mudar o pagamento avisa os candidatos.

```sql
select count(*) from public.jobs where payment_method is null;                                  -- 0
```

### 16. `20261012000200_l22_desfazer_recusa.sql` (L22)

Transição `desfazer_recusa` e RPC `undo_reject` (só a recusa da própria construtora nos últimos 10 minutos,
em vaga aberta).

```sql
select count(*) from pg_proc where proname = 'undo_reject';                                       -- 1
```

### 17. `20261012000300_l11_validacao_perfil.sql` (L11)

Nome de trabalhador e construtora entre 3 e 80 caracteres, até 10 especialidades (restrições `NOT VALID`: valem
para o que for gravado daqui em diante).

```sql
select conname from pg_constraint where conname in ('workers_name_length', 'companies_name_length'); -- 2 linhas
```

### 18. `20261012000400_l14_maior_idade.sql` (L14)

O cadastro com lado definido precisa trazer `maior_de_idade: true` nos metadados ("Tenho 18 anos ou mais").

```sql
select prosrc like '%maior_de_idade%' from pg_proc where proname = 'claim_document_v2';           -- true
```

### 19. `20261012000500_f12_presenca.sql` (F12)

`applications.presence_confirmed_at`, RPC `confirm_presence`, lembrete diário às 18h de Brasília
(`remind_presence`, cron `bicos-lembrar-presenca`) e gatilho que zera as confirmações quando as datas mudam.

```sql
select jobname, schedule from cron.job where jobname = 'bicos-lembrar-presenca';                -- 0 21 * * *
```

### 20. `20261012000600_f15_responsavel.sql` (F15)

`companies.contact_name` (2–60 caracteres, editável pela construtora) e `handle_new_user_v2` gravando o
`responsavel` do cadastro.

```sql
select has_column_privilege('authenticated', 'public.companies', 'contact_name', 'update');      -- true
```

### 21. `20261012000700_l10_cnpj_receita.sql` (L10)

`company_cnpj_for_check` (o CNPJ completo, só para o service_role) para a Edge Function `verificar-cnpj`
(BrasilAPI), e `publish_job` recusando construtora reprovada.

```sql
select has_function_privilege('authenticated', 'public.company_cnpj_for_check(uuid)', 'execute'); -- false
```

### 22. `20261012000800_l13_conta_google.sql` (L13)

RPC `create_my_account` para a conta nova pelo Google completar lado, nome, CPF/CNPJ, WhatsApp, 18+ e termos
(as mesmas regras do cadastro por e-mail).

```sql
select count(*) from pg_proc where proname = 'create_my_account';                                 -- 1
```

### 23. `20261012000900_f18_membros.sql` (F18)

Tabela `company_members` (construtora × pessoa × papel `dono | recrutador`), preenchida com a própria conta de
cada construtora como dona; sem tela por enquanto.

```sql
select count(*) = (select count(*) from public.accounts where company_id is not null)
  from public.company_members where role = 'dono';                                              -- true
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
