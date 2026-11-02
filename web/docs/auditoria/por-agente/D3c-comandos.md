# Comandos D3c (resumo; saídas sem dado pessoal)

- Leitura integral das 17 migrations e dos 17 testes (Read).
- `python3 work/funcdiff.py migrations/<arquivo>` para cada migration: compara cada função redefinida com a última definição anterior. U48: 13 funções, diferença só em texto (obra/construtora/EPI). Saída em `work/funcdiff-all.txt`.
- Staging `list_migrations`: 67 versões, iguais às do repositório (nomes e carimbos). Produção `list_migrations`: 54 versões, a última é `20261012033541 habilitar_pg_net`; faltam as 25 do repositório (lanc06, lanc07, lanc09, lanc10, lanc12, lanc13, r03, r04, u01…u67).
- Staging: varredura de `pg_proc.prosrc` por colunas apagadas (specialties, tipo_obra, contact_name, years_experience, desired_pay, travel_km, availability): só `perfil_publico` (legado, tabela `profiles`). Sem função quebrada.
- Staging: varredura por 'construtora|obra|EPI|pedreiro' nas funções: sobra texto visível em `admin_suspend_account` ('construtora' como valor padrão) — o resto é nome interno.
- Staging: `pg_constraint` das tabelas workers/companies/jobs/reviews/accounts/addresses; `column_privileges`; `pg_policies` de jobs/addresses/account_prefs/workers/companies.
- Staging: `reviews` por direção: para_trabalhador 25 (worker_id=25, company_id=0); para_construtora 25 (worker_id=0, company_id=25).
- Staging: mapa de chaves estrangeiras que apontam para accounts/workers/companies/jobs/applications/reviews/auth.users, com a regra de exclusão.
- Produção (somente `count(*)` e catálogo): `touch_job_v2` em `jobs` = 1; `area_lat` gerada (`attgenerated='s'`); `jobs` 0, `accounts` 4, `workers` 1, `companies` 3, `reviews` 0, `reports` 0, `job_alerts` 0; colunas que as migrations apagam: contagem de linhas preenchidas = 0; WhatsApp repetido = 0; bio > 500 = 0; `close_job` existe (1).
- Staging `execute_sql`: fidelidade das definições finais (booleans sobre `prosrc`): `finish_sign_up` (U67), `anonymize_account` (U48), `job_from_draft` (U52), `public_job_card` (U52), `create_account_for` (U10), `create_my_account` (U63), `purge_unconfirmed_signups` (U37), `set_my_address` (U62), gatilho `jobs_area_point`, `account_prefs` no Realtime, índice `accounts_whatsapp_key`, `close_job` ausente: todos conferem.
- Staging, custo da busca: `explain (analyze, timing off) select count(*) from feed_jobs('Caxias do Sul','RS',-29.17,-51.18, p_search => …)` → 1 palavra 58 ms; 1000 palavras 223 ms; 20000 palavras 3,7 s (11 vagas). `pg_roles`: `authenticated` com `statement_timeout=8s`.
- Staging, `job_from_draft('{… "lat":"abc" …}')` → `22P02`; com `"weekdays":[null]` → devolve `weekdays={NULL}` (sem erro); `ARRAY[NULL]::smallint[] <@ ARRAY[1..7]` = false (o CHECK reprova depois).
- Staging, `select direction, count(*), count(worker_id), count(company_id) from reviews group by 1` (ver D3c-001); mapa de FKs com `on delete` (reviews → applications `set null`, reviews → workers/companies `cascade`, blocks → auth.users `cascade`).
- App: `web/src/data/cidades.ts` (5.571 cidades) filtrada por lat/lon fora de `[-34,6]`/`[-74,-34]`: só Fernando de Noronha.
- Nenhum `delete`/DDL foi enviado ao staging ou à produção.
