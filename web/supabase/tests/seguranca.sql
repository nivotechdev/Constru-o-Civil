-- Critério 8: nenhuma conta comum lê WhatsApp, endereço da obra, CPF/CNPJ de outra pessoa; descobre se um CPF
-- tem conta; ou muda status, nota, selo ou impulsionamento por chamada direta. Visitante não lê nada disso.
begin;
select pg_temp.new_user('7d000000-0000-0000-0000-0000000000d1', 'recrutador', 'Obra Segura', '11.222.333/0001-81');
select pg_temp.new_user('7d000000-0000-0000-0000-0000000000d2', 'trabalhador', 'Ana Segura');
select pg_temp.new_user('7d000000-0000-0000-0000-0000000000d3', 'trabalhador', 'Bia Curiosa');
create temp table t_ids (k text primary key, v text);
grant all on t_ids to authenticated, anon;
insert into t_ids values ('j', pg_temp.new_job('7d000000-0000-0000-0000-0000000000d1'));

-- Ana se candidata e é pré-selecionada (o contato abre só entre Ana e a construtora).
select pg_temp.login('7d000000-0000-0000-0000-0000000000d2');
select public.submit_application((select v from t_ids));
select pg_temp.login('7d000000-0000-0000-0000-0000000000d1');
select public.transition_application((select v from t_ids), '7d000000-0000-0000-0000-0000000000d2', 'aprovar', null);

-- Bia, conta comum de fora:
select pg_temp.login('7d000000-0000-0000-0000-0000000000d3');
select pg_temp.fails($$select whatsapp from public.workers$$, '42501');
select pg_temp.fails($$select whatsapp from public.companies$$, '42501');
select pg_temp.fails($$select hidden_reason from public.jobs$$, '42501');  -- U53: o endereço é público; a moderação não
select pg_temp.ok((select count(*) from public.get_job_addresses(array[(select v from t_ids)])) = 0, 'sem endereço exato');
select pg_temp.fails($$select * from public.get_contact((select id from public.applications limit 1))$$, 'BC404');
select pg_temp.ok((select count(*) from public.accounts where id <> auth.uid()) = 0, 'não vê conta de ninguém');
select pg_temp.ok((select count(*) from public.applications) = 0, 'não vê candidatura dos outros');
select pg_temp.fails($$select public.document_available('390.533.447-05')$$, '42501');
-- Mudar o que só as regras mudam:
select pg_temp.fails($$update public.applications set status = 'contratado'$$, '42501');
select pg_temp.fails($$update public.workers set rating = 5, review_count = 99 where id = auth.uid()$$, '42501');
select pg_temp.fails($$update public.workers set verified = true where id = auth.uid()$$, '42501');
select pg_temp.fails($$update public.companies set verified = true$$, '42501');
select pg_temp.fails($$update public.jobs set boost_ends_at = now() + interval '30 days'$$, '42501');
select pg_temp.fails($$insert into public.boost_payments (job_id, company_id, plan, method, amount_cents, status)
  values ((select v from t_ids), '7d000000-0000-0000-0000-0000000000d1', enum_first(null::public.boost_plan), 'pix', 1, 'confirmado')$$, '42501');
select pg_temp.fails($$select public.confirm_boost_payment(gen_random_uuid())$$, '42501');
select pg_temp.fails($$select public.set_company_verification('7d000000-0000-0000-0000-0000000000d1', 'verificada')$$, '42501');
select pg_temp.fails($$select public.set_identity_status(auth.uid(), 'verificado')$$, '42501');
select pg_temp.fails($$select public.transition_application((select v from t_ids), '7d000000-0000-0000-0000-0000000000d2', 'contratar', null)$$, 'BC401');

-- A construtora dona também não muda nota nem selo dela.
select pg_temp.login('7d000000-0000-0000-0000-0000000000d1');
select pg_temp.fails($$update public.companies set rating = 5 where id = auth.uid()$$, '42501');
select pg_temp.fails($$update public.companies set verified = true where id = auth.uid()$$, '42501');

-- Visitante (sem conta):
select pg_temp.logout();
set local role anon;
select pg_temp.fails($$select name from public.workers$$, '42501');
select pg_temp.fails($$select id from public.jobs$$, '42501');
select pg_temp.fails($$select public.document_available('390.533.447-05')$$, '42501');
reset role;
rollback;
