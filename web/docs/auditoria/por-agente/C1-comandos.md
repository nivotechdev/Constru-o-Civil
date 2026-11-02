# C1 — comandos relevantes (sem dado pessoal nem segredo)

- `Read` por inteiro dos 28 arquivos da lista C1 (4.500 linhas) + apoio: `selectors.ts`, `remote/client.ts`, `remote/data.ts`, `mode.ts`, `mockLatency.ts`, `utils/whatsapp.ts`, `components/BusyOverlay.tsx`, trecho de `pages/recruiter/CreateJob.tsx:150-260`.
- `cat $SCRATCH/f1/knip.log | head` → exportações sem uso nos meus arquivos: `alerts.ts: ALERTS_PER_DAY, alertMatches`. `madge.log`: 24 ciclos, todos em `services/` (a maioria só de tipos: `remote/actions.ts` ↔ `account.ts`/`contacts.ts` são `import type`; ciclo de valor real: `remote/actions.ts` ↔ `reviews.ts` por `MAX_COMMENT`).
- `grep -rn "getContact|DEFAULT_CITY|loadFeed(|clearContactCache|pageshow|toggleSaved|precision|resolveAddress" web/src` → quem chama o quê (ver achados).
- `grep "function public.submit_application|publish_job|job_from_draft|begin_boost_payment" web/supabase/migrations` → `publish_job` sem trava de repetição (C1-001); `begin_boost_payment` recusa vaga já impulsionada (`boost_ends_at > now()`), logo não há cobrança dupla.
- `grep "staff_log(" migrations/*.sql` → 9 ações = os 9 rótulos de `ACTION_LABELS`.
- `grep "nivotech.dev@gmail" web` → suporte por esse e-mail é decisão documentada (DECISOES.md:316), não é achado.
- Reproduções (vitest, config própria fora do repositório): `cd web && npx vitest run --config $SCRATCH/out/C1/repro/vitest.config.ts`
  - `falha-parcial.test.ts`: `1st publish -> offline … | 2nd publish -> ok BC-2 | publish_job RPC calls = 2`; `1st approve -> offline … | server status now = pre_selecionado | retry -> conflito: Essa candidatura mudou de situação…` (C1-001).
  - `endereco.test.ts`: sem rede e sem CEP → `errors.street "Não achamos essa rua…"`; com CEP → `THROWS offline`; BrasilAPI+ViaCEP 503 → `null`/"Não achamos esse CEP"; Photon 429 depois 200 → `first [] second [] fetch calls = 1` (C1-002, C1-003).
  - `conclui-primeiro.test.ts`: `loadMyApplications -> falha_demo … | reads of applications table = 0` (C1-004).
- Nada foi alterado em `/home/user/Constru-o-Civil` (git status limpo).
