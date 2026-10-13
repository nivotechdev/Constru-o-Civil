-- Z02/Y13 — não existe forma de impulsionar sem pagar: as simulações sumiram, uma conta comum não
-- chama as funções de cobrança, e a confirmação (só service_role) é idempotente e revalida a vaga.
begin;

select pg_temp.new_user('20000000-0000-0000-0000-0000000000c1', 'recrutador', 'Construtora Paga');
select pg_temp.new_user('20000000-0000-0000-0000-0000000000c2', 'recrutador', 'Outra Construtora');
create temp table t_ids (k text primary key, v text);
grant all on t_ids to authenticated, service_role;
insert into t_ids values
  ('vaga', pg_temp.new_job('20000000-0000-0000-0000-0000000000c1', 1, 2)),
  ('outra', pg_temp.new_job('20000000-0000-0000-0000-0000000000c1', 1, 2));

select pg_temp.ok(not exists (select 1 from pg_proc where proname in ('simulate_pix_paid', 'pay_with_card', 'start_pix_payment')
                               and pronamespace = 'public'::regnamespace), 'funções de simulação não existem');

-- Conta comum: não abre, não confirma, não grava cobrança.
select pg_temp.login('20000000-0000-0000-0000-0000000000c1');
select pg_temp.fails(format('select public.begin_boost_payment(%L, %L, ''24h'', ''pix'')',
  '20000000-0000-0000-0000-0000000000c1', (select v from t_ids where k = 'vaga')), '42501');
select pg_temp.fails('select public.confirm_boost_payment(gen_random_uuid())', '42501');
select pg_temp.fails('select public.fail_boost_payment(gen_random_uuid(), ''recusado'')', '42501');
select pg_temp.fails(format('update public.jobs set boost_ends_at = now() + interval ''1 day'' where id = %L',
  (select v from t_ids where k = 'vaga')), '42501');
select pg_temp.fails(format('insert into public.boost_payments (job_id, company_id, plan, method, amount_cents, status) values (%L, %L, ''24h'', ''pix'', 1, ''confirmado'')',
  (select v from t_ids where k = 'vaga'), '20000000-0000-0000-0000-0000000000c1'), '42501');
select pg_temp.logout();

-- A Edge Function (service_role) abre o pagamento em nome da conta.
set local role service_role;
select pg_temp.fails(format('select public.begin_boost_payment(%L, %L, ''24h'', ''pix'')',
  '20000000-0000-0000-0000-0000000000c2', (select v from t_ids where k = 'vaga')), 'BC409');
select pg_temp.fails(format('select public.begin_boost_payment(%L, %L, ''whats'', ''pix'')',
  '20000000-0000-0000-0000-0000000000c1', (select v from t_ids where k = 'vaga')), 'BC422');
insert into t_ids select 'p1', (public.begin_boost_payment('20000000-0000-0000-0000-0000000000c1',
  (select v from t_ids where k = 'vaga'), '24h', 'pix')).id;
-- Um segundo PIX para a mesma vaga cancela o primeiro (Y13).
insert into t_ids select 'p2', (public.begin_boost_payment('20000000-0000-0000-0000-0000000000c1',
  (select v from t_ids where k = 'vaga'), '24h', 'pix')).id;
reset role;
select pg_temp.ok((select status::text from public.boost_payments where id = (select v from t_ids where k = 'p1')::uuid) = 'cancelado',
  'gerar outro PIX cancela o anterior');
select pg_temp.ok((select count(*) from public.boost_payments
                    where job_id = (select v from t_ids where k = 'vaga') and status = 'aguardando') = 1,
  'um pagamento aguardando por vaga');

set local role service_role;
select public.attach_boost_charge((select v from t_ids where k = 'p2')::uuid, 'mp-123', '000201…', 'iVBOR…', null, null);
select public.confirm_boost_payment((select v from t_ids where k = 'p2')::uuid);
select public.confirm_boost_payment((select v from t_ids where k = 'p2')::uuid);  -- webhook repetido
reset role;
select pg_temp.ok((select status::text from public.boost_payments where id = (select v from t_ids where k = 'p2')::uuid) = 'confirmado',
  'webhook confirma');
select pg_temp.ok((select boost_ends_at between now() + interval '23 hours 59 minutes' and now() + interval '24 hours 1 minute'
                     from public.jobs where id = (select v from t_ids where k = 'vaga')),
  'impulsionada por 24h (a segunda confirmação não soma de novo)');
select pg_temp.ok((select count(*) from public.notifications where company_id = '20000000-0000-0000-0000-0000000000c1'
                    and title = 'Vaga impulsionada') = 1, 'um aviso só');

-- O PIX cancelado é pago mesmo assim: a vaga já está impulsionada? A confirmação soma a partir do fim.
set local role service_role;
select public.confirm_boost_payment((select v from t_ids where k = 'p1')::uuid);
reset role;
select pg_temp.ok((select boost_ends_at > now() + interval '47 hours' from public.jobs where id = (select v from t_ids where k = 'vaga')),
  'segundo pagamento soma a partir de max(boost_ends_at, agora)');

-- Vaga encerrada antes do PIX cair: vira "reembolso_pendente", sem impulsionar.
set local role service_role;
insert into t_ids select 'p3', (public.begin_boost_payment('20000000-0000-0000-0000-0000000000c1',
  (select v from t_ids where k = 'outra'), '3d', 'pix')).id;
reset role;
update public.jobs set closed = true where id = (select v from t_ids where k = 'outra');
set local role service_role;
select public.confirm_boost_payment((select v from t_ids where k = 'p3')::uuid);
reset role;
select pg_temp.ok((select status::text from public.boost_payments where id = (select v from t_ids where k = 'p3')::uuid) = 'reembolso_pendente',
  'vaga indisponível: pagamento marcado para devolver');
select pg_temp.ok((select boost_ends_at is null from public.jobs where id = (select v from t_ids where k = 'outra')),
  'vaga encerrada não é impulsionada');

-- A dona lê o próprio pagamento; outra construtora não.
select pg_temp.login('20000000-0000-0000-0000-0000000000c1');
select pg_temp.ok((public.get_payment((select v from t_ids where k = 'p2')::uuid)).status = 'confirmado', 'get_payment da dona');
select pg_temp.login('20000000-0000-0000-0000-0000000000c2');
select pg_temp.fails(format('select public.get_payment(%L)', (select v from t_ids where k = 'p2')), 'BC404');
select pg_temp.logout();

rollback;
