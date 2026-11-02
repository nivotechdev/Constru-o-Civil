Todos os S0 e S1 resolvidos: não

# Relatório da rodada FIX (parcial: bloco 0 em andamento)

Branch `claude/correcao` (a partir de `claude/auditoria`). Nada foi aplicado na produção. O banco local de testes
(imagem `supabase/postgres:17.6.1.011`) rodou todos os testes SQL; o staging não foi alterado (o proxy do ambiente
recusa `*.supabase.co` e o conector pede confirmação humana para DDL).

**Por que "não":** o S1 AUD-007 (link público e Ajuda quebram sem login) é do bloco 1, que ainda não começou. Os
outros cinco S1 e o S0 do bloco 0 estão resolvidos no código e nos testes; as partes que dependem dos sócios estão em
`CHECKLIST-LANCAMENTO.md` (seção "Rodada FIX").

## Estado dos itens

| AUD     | Gravidade | Estado                                                                                   | Prova (antes → depois)                                                                                  |
| ------- | --------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| AUD-001 | S0        | resolvido (falta republicar a função e aplicar a migration)                              | `excluirConta.test.ts` e `aud001_*.sql` falhavam; agora passam                                          |
| AUD-006 | S1        | resolvido no código; **depende do responsável** (criar `CLEANUP_SECRET` em cada projeto) | `aud006_limpeza_vigiada.sql` falhava (função inexistente); agora passa                                  |
| AUD-002 | S1        | resolvido (decisão 1, opção C)                                                           | `aud002_endereco_residencial.sql` falhava no `select street`; agora `42501`; `remote.test.ts` reescrito |
| AUD-003 | S1        | resolvido                                                                                | `aud003_limites_de_texto.sql` falhava com rua de 121 letras; agora `BC422`                              |
| AUD-004 | S1        | resolvido (decisão 3, anonimizar)                                                        | `aud004_*.sql` e `deleteAccount.test.ts` falhavam; agora passam                                         |
| AUD-005 | S1        | resolvido (falta republicar as funções e conferir no staging)                            | `clientIp.test.ts` falhava (módulo inexistente); agora passa                                            |
| AUD-010 | S2        | resolvido                                                                                | `aud010_selo_troca_de_nome.sql` falhava; agora passa                                                    |
| AUD-012 | S2        | resolvido (decisão 11: tetos e `urgent`)                                                 | `aud012_tetos_de_vagas.sql` falhava; agora passa                                                        |
| AUD-022 | S2        | resolvido                                                                                | `aud022_oculta_e_suspensa.sql` falhava; agora passa                                                     |

Ainda **não feitos** no bloco 0: AUD-023, AUD-024 (workflows, dependem dos sócios em parte) e os S3 56 a 82 que sobraram (057, 058, 059, 060, 061, 062, 063, 064, 065, 066, 067, 068, 071, 072, 074, 075, 076, 077, 078, 079, 080, 081). Os itens jurídicos foram tratados pelo "piloto enxuto" confirmado pelos sócios em 02/11/2026 (sem advogado nem contador; impulsionar inativo).

## Verificações locais (antes de cada push)

`npm run typecheck`, `lint`, `format:check`, `npm test` (313 testes), `deno check` das 10 funções (Deno 2.5.4 instalado
no ambiente) e os 70 testes SQL no banco local: todos verdes. O CI do GitHub roda a cada push (os pushes seguidos cancelam o anterior).

## Pendências e riscos

- Staging: nenhuma das migrations `20261102*` foi aplicada lá; o critério "no staging" de AUD-001, 005 e 006 fica para
  quando o responsável der o "pode" ou aplicar pelo `scripts/staging/aplicar-banco.sh`.
- AUD-002 muda o fluxo central do app (endereço de casa só depois da aprovação) e foi autorizado pela decisão 1.
- A ordem de aplicação na produção continua sendo uma janela única (decisão 18); nada disso foi aplicado lá.

## CI

Commit `08e0bd0` (AUD-001, 002, 003, 004, 005, 006, 010, 012, 014, 020, 022): job `sql` ✔ (67 testes SQL,
`APLICAR-TUDO.sql` e tipos em dia) e job `checks` ✔ (typecheck, lint, format, 297 testes, `deno check`, builds,
Lighthouse, axe, cadastro sem rolagem). O job `e2e` segue pulado, como antes (AUD de processo no bloco 5).
Os commits seguintes (AUD-018, 008, 082) foram enviados depois; o resultado deles precisa ser conferido.
