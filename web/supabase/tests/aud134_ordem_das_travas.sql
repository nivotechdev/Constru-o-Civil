-- AUD-134 — a vaga é sempre travada primeiro (antes da candidatura e do pagamento), para duas chamadas cruzadas não
-- travarem uma à outra. Aqui só se confere a ordem nas funções; o comportamento delas segue coberto pelos testes de
-- ciclo da vaga e de pagamentos.
begin;
select pg_temp.ok(
  position('from public.jobs' in pg_get_functiondef('public.application_conclude(uuid,application_actor)'::regprocedure))
    < position('application_step' in pg_get_functiondef('public.application_conclude(uuid,application_actor)'::regprocedure)),
  'application_conclude trava a vaga antes de mexer na candidatura');
select pg_temp.ok(
  position('from public.jobs' in pg_get_functiondef('public.confirm_boost_payment(uuid)'::regprocedure))
    < position('from public.boost_payments where id = p_payment_id for update' in pg_get_functiondef('public.confirm_boost_payment(uuid)'::regprocedure)),
  'confirm_boost_payment trava a vaga antes do pagamento');
rollback;
