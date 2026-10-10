# Advisors do Supabase (X13)

Rodados no projeto `ppnxdajiihsjaojxokzh` em 10/10/2026, **antes** de aplicar as migrations de `APLICAR.md`
(o banco ainda está nas três de 09/10). Cada aviso e o que resolve:

## Segurança

| Nível | Aviso                                                | Qtde | Resolvido por                                                                                                                                                                                          |
| ----- | ---------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ERROR | `rls_disabled_in_public` (`spatial_ref_sys`)         | 1    | #31 (X13): PostGIS vai para o schema `extensions`; a tabela sai da API                                                                                                                                 |
| WARN  | `extension_in_public` (postgis)                      | 1    | #31 (X13)                                                                                                                                                                                              |
| WARN  | `function_search_path_mutable`                       | 3    | #31 (X13): `impedir_troca_de_tipo`, `travar_autor_da_vaga`, `expirar_vagas_vencidas`                                                                                                                   |
| WARN  | `anon_security_definer_function_executable`          | 22   | #4 (Z08) fecha as do app antigo; #31 fecha o resto (fica só `public_job_card`, a vaga pública do F09, de propósito)                                                                                    |
| WARN  | `authenticated_security_definer_function_executable` | 41   | **Não se aplica**: são as RPCs que o app chama logado (regra 3: regras no banco, em security definer com `search_path` fixo). As do app antigo e as de pagamento simulado saem com #2 (Z02) e #4 (Z08) |
| WARN  | `auth_leaked_password_protection`                    | 1    | Painel: Authentication › Policies › "Leaked password protection" (plano Pro). Ver SUPABASE.md                                                                                                          |

## Desempenho

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
