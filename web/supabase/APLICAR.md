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

## Testes

`supabase/tests/*.sql` testam cada RPC como o app chama (cada teste termina em `rollback`, então pode rodar
no banco de verdade). Para rodar localmente:

```bash
./supabase/tests/local/setup.sh      # sobe o Postgres do Supabase (Docker) e aplica todas as migrations
DATABASE_URL=postgres://postgres:postgres@localhost:54322/postgres node supabase/tests/run.mjs supabase/tests/*.sql
```

No SQL Editor: `node supabase/tests/run.mjs supabase/tests/z01_candidaturas.sql` imprime o SQL completo
(utilitários + teste) para colar; a última linha deve ser `TODOS OS TESTES PASSARAM`.
