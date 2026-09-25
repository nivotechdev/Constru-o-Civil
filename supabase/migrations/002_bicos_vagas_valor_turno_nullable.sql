-- Fase 2 do front novo (Bicos): duas colunas EXISTENTES de `vagas` deixam de
-- ser obrigatórias. Diferente da migração anterior (só colunas novas), isso
-- afeta uma coluna que o front antigo já usa — por isso fica isolado neste
-- arquivo próprio, para revisar/testar separado do resto.
--
-- Por quê:
--   - `valor` vira opcional porque o front novo tem a opção "a combinar"
--     (o trabalhador negocia direto com a construtora, sem valor fixo).
--   - `turno` vira opcional porque o front novo não pergunta mais isso — ele
--     usa só o campo livre `horario` (ex.: "7h–17h").
--
-- Nenhuma linha existente é alterada (é só o constraint "not null" que sai) —
-- o front antigo continua enviando os dois campos preenchidos, exatamente
-- como já fazia, e continua funcionando sem nenhuma mudança nele.
--
-- Como reverter: só é seguro re-adicionar "not null" depois de confirmar que
-- não existe nenhuma linha com valor/turno nulos, ex.:
--   select count(*) from public.vagas where valor is null or turno is null;

alter table public.vagas alter column valor drop not null;
alter table public.vagas alter column turno drop not null;
