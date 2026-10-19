# Aplicar as migrations novas no Supabase

> **Produção (`ppnxdajiihsjaojxokzh`): tudo aplicado em 12/10/2026** — as 36 migrations abaixo, na ordem, mais
> a #37 (X22) e a #38 (X23), e a extensão `pg_net` ligada. Conferido no próprio banco: as 38 consultas de
> conferência deste arquivo dão o resultado esperado e os 38 arquivos de `supabase/tests/` passam rodando no
> banco de produção (cada um numa transação desfeita no fim — nada ficou gravado). O que segue serve para
> outro ambiente (staging, um projeto novo) ou para reaplicar.

Antes desta rodada, o projeto tinha as três migrations de 2026-10-09 (`…_bicos_v2_schema`, `…_bicos_v2_rules`,
`…_bicos_v2_data`). As migrations abaixo vieram depois, testadas num Postgres igual ao do Supabase
(`supabase/tests/local/setup.sh`). Para aplicar num ambiente que ainda não as tem, use uma destas formas:

- **SQL Editor do painel**: abra cada arquivo, na ordem, cole e rode (cada um é idempotente: pode rodar de
  novo sem problema). Ou cole `APLICAR-TUDO.sql`, que junta todos numa transação só.
- **Supabase CLI**: `supabase link --project-ref <projeto>` e `supabase db push`.

### Histórico de migrations (X16)

Em produção, as migrations entraram pelo conector do Supabase, que grava cada uma com a hora em que foi aplicada
(`20261008233626_bicos_v2_schema` … `20261012033541_habilitar_pg_net`), não com a versão do arquivo. O conteúdo é o
dos arquivos de `web/supabase/migrations` (as três primeiras foram em partes; `bicos_v2_rules_7a…7d` e
`bicos_v2_enum_values` são pedaços que o Z01 e os enums das seguintes já contêm). Para o histórico do banco ficar
igual aos arquivos antes de usar `supabase db push` em produção (uma vez, pelo CLI):

```bash
supabase migration repair --status reverted \
  20261008233626 20261009000624 20261009001304 20261009001443 20261009001730 20261009001838 20261009001917 \
  20261009001947 20261009002436 20261009002539 20261012025727 20261012025751 20261012025806 20261012030139 \
  20261012030428 20261012030535 20261012030615 20261012030647 20261012030724 20261012030906 20261012030921 \
  20261012030946 20261012031034 20261012031105 20261012031131 20261012031147 20261012031159 20261012031223 \
  20261012031241 20261012031317 20261012031333 20261012031345 20261012031350 20261012031413 20261012031419 \
  20261012031435 20261012031446 20261012031450 20261012031504 20261012031534 20261012031554 20261012031612 \
  20261012031643 20261012031654 20261012031658 20261012031738 20261012031821 20261012031841 20261012031857 \
  20261012031915 20261012031930 20261012032837 20261012032951
supabase migration repair --status applied \
  20261009000100 20261009000200 20261009000300 20261010000100 20261010000200 20261010000300 20261010000400 \
  20261010000500 20261010000600 20261010000700 20261011000100 20261011000200 20261011000300 20261011000400 \
  20261011000500 20261011000600 20261011000700 20261012000100 20261012000200 20261012000300 20261012000400 \
  20261012000500 20261012000600 20261012000700 20261012000800 20261012000900 20261013000100 20261013000200 \
  20261013000300 20261013000400 20261013000500 20261013000600 20261013000700 20261014000100 20261014000200 \
  20261014000300 20261014000400 20261014000500 20261014000600 20261014000700 20261014000800
supabase migration list   # local e remoto iguais
```

(`20261012033541_habilitar_pg_net` — só `create extension if not exists pg_net` — agora também é arquivo do repo
(L09), com a mesma versão: fica como está no histórico, sem `repair`.)

Conferência automática (L09): `DB_URL=… ./scripts/staging/conferir-migrations.sh` compara o histórico com os
arquivos e aponta o que falta e o que sobra. No CI roda contra o staging (`.github/workflows/staging.yml`).

`repair` só mexe na tabela de histórico (`supabase_migrations.schema_migrations`), nunca no esquema.
Daí em diante, toda mudança no banco entra por arquivo novo em `web/supabase/migrations` e `supabase db push`.

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

### 24. `20261013000100_f09_vaga_publica.sql` (F09)

RPC `public_job_card` (também para `anon`): a vaga do link compartilhado, só com a área, sem endereço exato nem
contato; excluída não abre.

```sql
select has_function_privilege('anon', 'public.public_job_card(text)', 'execute');                  -- true
```

### 25. `20261013000200_f10_perfil_profissional.sql` (F10)

Colunas do perfil profissional em `workers` (dias, anos de experiência, diária pretendida, distância, bio) e a
RPC `worker_track_record` (faltas e desistências, para construtoras e para a própria pessoa).

```sql
select has_column_privilege('authenticated', 'public.workers', 'bio', 'update');                 -- true
```

### 26. `20261013000300_f13_convite.sql` (F13)

Tabela `job_invites` (cada lado lê os seus) e RPCs `invite_worker` (vaga aberta, sem candidatura, até 20
convites por dia) e `answer_invite` (aceitar vira candidatura pelas regras de sempre).

```sql
select count(*) from pg_proc where proname in ('invite_worker', 'answer_invite');                  -- 2
```

### 27. `20261013000400_f04_denuncia_bloqueio.sql` (F04)

Tabelas `reports` e `blocks` (cada um lê os seus), RPCs `report_content`, `block_account`, `unblock_account`, e
gatilhos que recusam candidatura e convite através de um bloqueio. As denúncias ficam para a equipe ler no
painel (`select * from public.reports where status = 'aberta' order by created_at`).

```sql
select count(*) from pg_trigger where tgname in ('applications_refuse_blocked', 'job_invites_refuse_blocked'); -- 2
```

### 28. `20261013000500_f06_preferencias_aviso.sql` (F06)

`notification_prefs` (silenciar "bicos novos" no sino; grupos do push para o X03), `save_notification_prefs` e
`notify()` respeitando o que foi silenciado.

```sql
select count(*) from pg_proc where proname in ('save_notification_prefs', 'notification_group');   -- 2
```

### 29. `20261013000600_f16_portfolio.sql` (F16)

Legenda do post com até 280 caracteres e editável pelo dono (grant de `update (caption)` + política).

```sql
select has_column_privilege('authenticated', 'public.worker_posts', 'caption', 'update');          -- true
```

### 30. `20261013000700_f07_identidade.sql` (F07)

Bucket privado `identidade` (cada trabalhador só envia na própria pasta; ninguém lê pelo app),
`workers.identity_status`/`identity_reason`, `identity_submissions`, `submit_identity`, `my_identity` e
`set_identity_status` (só `service_role`, para a equipe decidir). `verified` acompanha `identity_status`.

```sql
select public from storage.buckets where id = 'identidade';                                        -- false
select count(*) from pg_proc where proname in ('submit_identity', 'my_identity', 'set_identity_status'); -- 3
select has_function_privilege('authenticated', 'public.set_identity_status(uuid, text, text)', 'execute'); -- false
```

### 31. `20261014000100_x13_avisos_seguranca.sql` (X13)

PostGIS reinstalado no schema `extensions` (sai o ERRO de `spatial_ref_sys` e o aviso de extensão no
`public`; `jobs.area_geog` é recalculada e `vagas.localizacao`, vazia, volta vazia), `search_path` fixo nas
três funções antigas, nenhuma função security definer executável por visitante além de `public_job_card`, e
funções novas não nascem abertas. **Tem `DROP EXTENSION postgis CASCADE`**: rode no SQL Editor (ou pelo CLI),
de preferência num horário sem uso.

```sql
select n.nspname from pg_extension e join pg_namespace n on n.oid = e.extnamespace where e.extname = 'postgis'; -- extensions
select to_regclass('public.spatial_ref_sys');                                                                    -- null
select array_agg(proname) from pg_proc where pronamespace = 'public'::regnamespace and prosecdef
   and has_function_privilege('anon', oid, 'execute');                                                          -- {public_job_card}
select count(*) from public.jobs where area_geog is null;                                                        -- 0
```

### 32. `20261014000200_x15_rls_desempenho.sql` (X15)

Políticas de `applications`/`application_events` sem função por linha (`my_job_ids()`), índices das chaves
estrangeiras, políticas do app antigo removidas (as tabelas já estavam fechadas desde o Z08) e limite contra
spam de candidatar/retirar (30 por dia; 3 vezes a mesma vaga por dia).

```sql
select count(*) from pg_policies where schemaname = 'public'
   and tablename in ('profiles', 'vagas', 'candidaturas', 'avaliacoes', 'vagas_salvas', 'publicacoes_trabalhador', 'consentimentos'); -- 0
select tgname from pg_trigger where tgname = 'limit_application_spam';                                           -- 1 linha
```

Depois das duas: **Advisors** (Database › Advisors) — segurança sem ERROR; os avisos que sobram estão
explicados em `docs/ADVISORS.md`.

### 33. `20261014000300_x03_push.sql` (X03)

`push_subscriptions` (aparelhos que aceitaram notificações; só por RPC), `save_push_subscription`,
`delete_push_subscription`, `my_unread_count` (o número do sino vem do servidor), o gatilho que chama a Edge
Function `enviar-push` a cada aviso novo (pelo pg_net, só com a URL e o segredo no Vault) e `notifications` na
publicação do Realtime (o "lida" chega aos outros aparelhos). Sem configurar o push, nada muda para o usuário.

```sql
select count(*) from pg_proc where proname in ('save_push_subscription', 'delete_push_subscription', 'my_unread_count'); -- 3
select tgname from pg_trigger where tgname = 'push_new_notification';                                                   -- 1 linha
select count(*) from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'notifications';         -- 1
```

### 34. `20261014000400_x09_arquivos_orfaos.sql` (X09)

`orphan_storage_objects` (arquivos sem uso há mais de 1 dia; identidade 30 dias depois da decisão; só
service_role), `identity_submissions.decided_at` e a chamada diária (4h40) da Edge Function `limpar-arquivos`
pelo pg_cron/pg_net (URL e segredo no Vault). Sem configurar, nada é apagado.

```sql
select has_function_privilege('service_role', 'public.orphan_storage_objects(integer)', 'execute');   -- true
select jobname, schedule from cron.job where jobname = 'bicos-limpar-arquivos';                        -- 40 4 * * *
```

### 35. `20261014000500_x21_funil.sql` (X21)

`funnel_daily(de, até)`: o funil por dia (cadastros iniciados, e-mails confirmados, cadastros concluídos, vagas,
candidaturas, aprovações, contratações, diárias concluídas, impulsionamentos pagos e receita), contado do que o
banco já tem. Só service_role.

```sql
select * from public.funnel_daily(current_date - 6, current_date);   -- 7 linhas
```

### 36. `20261014000600_w08_limites_vaga.sql` (W08)

`job_from_draft` com diária até R$ 5.000, descrição de 20 a 1000 letras e turno da noite (22h–6h) aceito; início
igual ao fim recusado.

```sql
select prosrc like '%5.000%' from pg_proc where proname = 'job_from_draft';   -- true
```

### 37. `20261014000700_x22_limpeza_tentativas.sql` (X22)

A #32 (X15) reaproveitou o nome do cron `bicos-limpar-tentativas` para limpar `application_attempts` e, com isso,
desagendou a limpeza da #3/#13 (tentativas de entrar com CPF/CNPJ e confirmações de WhatsApp). Agora
`purge_auth_attempts()` limpa as três tabelas e o cron chama ela.

```sql
select command from cron.job where jobname = 'bicos-limpar-tentativas';   -- select public.purge_auth_attempts()
```

### 38. `20261014000800_x23_indices_fk.sql` (X23)

Índices das chaves estrangeiras das tabelas que chegaram depois da X15 (`blocks`, `company_members`,
`identity_submissions`, `job_alerts`, `job_invites`) — zera o aviso `unindexed_foreign_keys`.

```sql
select count(*) from pg_indexes where indexname in ('blocks_blocked_idx', 'company_members_user_idx',
  'identity_submissions_worker_idx', 'job_alerts_oficio_idx', 'job_invites_company_idx');   -- 5
```

## Rodada de lançamento (L01–L14) — **ainda não aplicadas na produção**

Primeiro no staging (`.github/workflows/staging.yml` aplica e confere o histórico), depois na produção **só
com aprovação** e com backup manual antes (plano Free: sem backup diário).

### 39. `20261015000100_lanc06_backoffice.sql` (L06)

Área da equipe (`/admin`): `staff_members`, `staff_actions`, filas de identidade/construtoras/denúncias,
ocultar vaga, suspender conta. Depois de aplicar, cadastrar a equipe:
`select public.add_staff_member('<email>', 'admin');`

```sql
select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname like 'admin\_%';   -- 11
```

### 40. `20261015000200_lanc07_aceites.sql` (L07)

Aceites com versão (`terms_acceptances`, copiando `consentimentos`), `accept_terms`, consentimento da
verificação de identidade.

```sql
select count(*) from public.terms_acceptances;   -- >= linhas de consentimentos das contas do app novo
```

### 41. `20261016000100_lanc09_pg_net.sql` (L09)

Tira o `pg_net` do `public` (apaga e cria de novo no `extensions`; as funções continuam em `net.*`). Perde só a
fila de chamadas ainda não enviadas: rodar longe das 4h40 e das 21h. Some o aviso `extension_in_public`.

```sql
select n.nspname from pg_extension e join pg_namespace n on n.oid = e.extnamespace where extname = 'pg_net';  -- extensions
select to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is not null;                          -- true
select public.call_storage_cleanup();   -- sem erro (com CLEANUP_SECRET ainda vazio, a função responde 401)
```

### 42. `20261016000200_lanc10_link_publico.sql` (L10)

Link público pelo `public_slug` aleatório (o BC-n é sequencial e permitia baixar o mural inteiro sem conta);
`public_job_card(p_slug)` com limite por IP; `public_link_hits` apagada todo dia pela limpeza das 4h17. Publicar o
front novo **junto** (o antigo chama a RPC com `p_job_id` e a página da vaga pública daria erro).

```sql
select count(*) from public.jobs where public_slug is null;                                       -- 0
select pg_get_function_identity_arguments('public.public_job_card'::regproc);                     -- p_slug text
```

### 43. `20261016000300_lanc12_vigia_cron.sql` (L12)

Vigia das rotinas: `cron_health()` (estado), `check_cron_failures()` de hora em hora (`bicos-vigiar-cron`), alerta
no Sentry depois de 2 falhas seguidas (DSN no Vault: `bicos_sentry_dsn`), sinal de vida para um monitor de fora
(`bicos_heartbeat_url`) e histórico do pg_cron limitado a 14 dias. Ligar os avisos: `docs/SUPABASE.md` › 5.1.

```sql
select jobname, schedule from cron.job where jobname = 'bicos-vigiar-cron';   -- 12 * * * *
select * from public.cron_health();                                           -- 7 rotinas
```

### 44. `20261016000400_lanc13_mural_volume.sql` (L13)

Mural mais rápido com volume: coluna calculada `jobs.last_day` + índice `jobs_feed_city_idx`; `feed_jobs` sem a
chamada de `job_is_open` por vaga e com o `public_slug` em cada linha. Medição em `docs/VOLUME.md`. A coluna nova
reescreve a tabela `jobs` (rápido: a produção tem 0 vagas).

```sql
select count(*) from public.jobs where last_day is distinct from public.job_last_day(jobs);   -- 0
select indexname from pg_indexes where indexname = 'jobs_feed_city_idx';                       -- 1 linha
```

### 45. `20261017000100_r03_suspensao_completa.sql` (R03)

Status `cancelado_pela_equipe` e transição do sistema `cancelar_por_suspensao`; `admin_suspend_account` cancela os
bicos aprovados/contratados do suspenso (avisa o outro lado, libera a posição); `get_contact` não abre com conta
suspensa. O valor novo do enum vai antes, numa transação própria (APLICAR-TUDO já faz isso).

```sql
select count(*) from pg_enum where enumlabel = 'cancelado_pela_equipe';                                   -- 1
select public.application_next_status('cancelar_por_suspensao', 'contratado', 'sistema');                -- cancelado_pela_equipe
```

### 46. `20261017000200_r04_exclusao_pelo_painel.sql` (R04)

`anonymize_account` (a limpeza que `delete_my_account` fazia, mais: vagas da construtora ocultas e sem fotos, envios
de selfie apagados) e o gatilho `on_auth_user_deleted` (BEFORE DELETE em `auth.users`): apagar pelo painel ou pela
Admin API limpa igual à exclusão pelo app. Os arquivos saem na limpeza diária.

```sql
select tgname from pg_trigger where tgname = 'on_auth_user_deleted';   -- 1 linha
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
