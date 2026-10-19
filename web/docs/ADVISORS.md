# Advisors do Supabase (X13)

## Esperado depois das migrations `lanc*` e `r*` (R07)

Calculado em 17/10/2026 num Postgres igual ao do Supabase com as 50 migrations (as mesmas consultas que o advisor
faz). É o que o staging (R08) e a produção (R10) devem mostrar; **qualquer coisa a mais é para investigar**.

| Tipo       | Nível | Aviso                                                | Qtde | Por que fica                                                                                                                                                                                                                         |
| ---------- | ----- | ---------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Segurança  | —     | nenhum ERROR                                         | 0    | toda tabela do `public` com RLS (o `aplicar-banco.sh` confere, R05)                                                                                                                                                                  |
| Segurança  | —     | `extension_in_public`                                | 0    | o `pg_net` sai do `public` com a `lanc09`; PostGIS já tinha saído (X13)                                                                                                                                                              |
| Segurança  | —     | `function_search_path_mutable`                       | 0    | toda função nova tem `search_path` fixo                                                                                                                                                                                              |
| Segurança  | WARN  | `authenticated_security_definer_function_executable` | 55   | as 42 RPCs de antes + 11 `admin_*` da área da equipe (L06; todas recusam com BC401 quem não está em `staff_members`) + `is_staff` (o app decide se mostra "Área da equipe") + `accept_terms` (L07)                                   |
| Segurança  | WARN  | `anon_security_definer_function_executable`          | 1    | `public_job_card`, agora pelo slug e com limite por IP (L10)                                                                                                                                                                         |
| Segurança  | WARN  | `auth_leaked_password_protection`                    | 1    | até ligar no painel (exige Pro, L08)                                                                                                                                                                                                 |
| Segurança  | INFO  | `rls_enabled_no_policy`                              | 19   | as 14 de antes + `staff_members`, `staff_actions` (L06), `terms_acceptances` (L07), `public_link_hits` (L10), `cron_alerts` (L12): uso interno, só pelas RPCs; sem política a API recusa tudo. Sai 7 quando o app antigo for apagado |
| Desempenho | INFO  | `no_primary_key`                                     | 2    | `application_attempts` (de antes) e `public_link_hits` (L10): registros só de contagem, apagados em 1–2 dias                                                                                                                         |
| Desempenho | —     | `unindexed_foreign_keys`                             | 0    | conferido                                                                                                                                                                                                                            |
| Desempenho | INFO  | `unused_index`                                       | ?    | depende do uso real; reavaliar semanas depois do lançamento                                                                                                                                                                          |

## Rodada de lançamento (L09)

O `extension_in_public` do `pg_net` (ligado em 12/10 pelo conector, caiu no `public`) sai com a
`20261016000100_lanc09_pg_net.sql`: a extensão é apagada e criada de novo no `extensions` (não é relocável).
Conferido no Postgres local com o `pg_net` no `public`, como na produção: depois da migration ele fica no
`extensions`, `net.http_post` continua no lugar e os testes do push (X03) e da limpeza (X09) passam. Na
produção, só depois de passar no staging e com aprovação (`supabase/APLICAR.md` › 41).

## Depois de aplicar tudo (12/10/2026)

Com as 38 migrations de `APLICAR.md` aplicadas em `ppnxdajiihsjaojxokzh`:

| Tipo       | Nível | Aviso                                                | Qtde | Por que fica                                                                                                                                                      |
| ---------- | ----- | ---------------------------------------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Segurança  | —     | nenhum ERROR                                         | 0    | `spatial_ref_sys` e o PostGIS saíram do `public` (X13)                                                                                                            |
| Segurança  | WARN  | `authenticated_security_definer_function_executable` | 42   | São as RPCs que o app chama logado: o desenho (regras no banco, em `security definer` com `search_path` fixo)                                                     |
| Segurança  | WARN  | `anon_security_definer_function_executable`          | 1    | `public_job_card`, a vaga pública do link compartilhado (F09), de propósito                                                                                       |
| Segurança  | WARN  | `auth_leaked_password_protection`                    | 1    | Opção do painel: Authentication › Policies › "Leaked password protection" (plano Pro)                                                                             |
| Segurança  | INFO  | `rls_enabled_no_policy`                              | 14   | Tabelas só de uso interno (tentativas, filas, app antigo, envios de identidade…): sem política, a RLS recusa tudo pela API; o app usa as RPCs e as Edge Functions |
| Desempenho | INFO  | `unused_index`                                       | 17   | Banco ainda sem uso; reavaliar depois de algumas semanas em produção                                                                                              |
| Desempenho | INFO  | `no_primary_key` (`application_attempts`)            | 1    | Registro só de contagem (limite contra spam), apagado depois de 2 dias                                                                                            |

O `unindexed_foreign_keys` que sobrou depois da X15 (5 chaves das tabelas F04, F07, F13, F18 e Y28) foi zerado pela X23.

## Antes de aplicar (10/10/2026)

Rodados no projeto `ppnxdajiihsjaojxokzh` em 10/10/2026, **antes** de aplicar as migrations de `APLICAR.md`
(o banco ainda estava nas três de 09/10). Cada aviso e o que resolve:

### Segurança

| Nível | Aviso                                                | Qtde | Resolvido por                                                                                                                                                                                          |
| ----- | ---------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ERROR | `rls_disabled_in_public` (`spatial_ref_sys`)         | 1    | #31 (X13): PostGIS vai para o schema `extensions`; a tabela sai da API                                                                                                                                 |
| WARN  | `extension_in_public` (postgis)                      | 1    | #31 (X13)                                                                                                                                                                                              |
| WARN  | `function_search_path_mutable`                       | 3    | #31 (X13): `impedir_troca_de_tipo`, `travar_autor_da_vaga`, `expirar_vagas_vencidas`                                                                                                                   |
| WARN  | `anon_security_definer_function_executable`          | 22   | #4 (Z08) fecha as do app antigo; #31 fecha o resto (fica só `public_job_card`, a vaga pública do F09, de propósito)                                                                                    |
| WARN  | `authenticated_security_definer_function_executable` | 41   | **Não se aplica**: são as RPCs que o app chama logado (regra 3: regras no banco, em security definer com `search_path` fixo). As do app antigo e as de pagamento simulado saem com #2 (Z02) e #4 (Z08) |
| WARN  | `auth_leaked_password_protection`                    | 1    | Painel: Authentication › Policies › "Leaked password protection" (plano Pro). Ver SUPABASE.md                                                                                                          |

### Desempenho

| Nível | Aviso                          | Qtde | Resolvido por                                                                                                                                                        |
| ----- | ------------------------------ | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WARN  | `auth_rls_initplan`            | 20   | Todos em tabelas do app antigo: #32 (X15) remove essas políticas (tabelas já fechadas desde o Z08)                                                                   |
| WARN  | `multiple_permissive_policies` | 5    | Idem (`candidaturas`)                                                                                                                                                |
| INFO  | `unindexed_foreign_keys`       | 8    | #8 (X01) e #32 (X15): índices em `accounts.company_id`, `boost_payments.job_id`, `jobs.oficio_id`, `saved_jobs.job_id`, `workers.oficio_id` e nas três do app antigo |
| INFO  | `unused_index`                 | 9    | Esperado num banco sem uso ainda; reavaliar depois de algumas semanas em produção                                                                                    |

As políticas do app novo já usam `(select auth.uid())` / `(select my_worker_id())`; a única com função por
linha (`is_my_job(job_id)` em `applications`) foi trocada no X15.

Para conferir depois de aplicar: painel › Database › Advisors (Security e Performance), ou pelo conector
`get_advisors`.
