-- U10 — e-mail, CPF/CNPJ e WhatsApp de uma conta só, conferidos no passo do cadastro (signup_taken).
begin;

select pg_temp.new_user('77000000-0000-0000-0000-0000000000a1', 'trabalhador', 'Já Tem Conta');
-- Um cadastro nunca confirmado (o e-mail não foi aberto), com outro documento e outro número.
insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values ('77000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'pendente@bicos.test', null,
        jsonb_build_object('role', 'trabalhador', 'nome', 'Nunca Confirmou', 'documento', pg_temp.valid_cpf('pendente'),
                           'whatsapp', '11955550001', 'terms_version', '1.0', 'maior_de_idade', true), now(), now());

create temp table t_v as
select (select email from public.accounts where id = '77000000-0000-0000-0000-0000000000a1') as email,
       pg_temp.valid_cpf('77000000-0000-0000-0000-0000000000a1') as cpf,
       pg_temp.phone_for('77000000-0000-0000-0000-0000000000a1') as phone;
grant all on t_v to authenticated;

-- Conta confirmada: os três estão em uso (com máscara, maiúsculas e espaços, igual).
select pg_temp.ok(public.signup_taken('email', upper((select email from t_v))), 'e-mail de conta confirmada');
select pg_temp.ok(public.signup_taken('documento', (select cpf from t_v)), 'CPF de conta confirmada');
select pg_temp.ok(public.signup_taken('whatsapp', '(' || substr((select phone from t_v), 1, 2) || ') ' || substr((select phone from t_v), 3)),
  'WhatsApp de conta confirmada');
-- Cadastro nunca confirmado e dado novo: livres.
select pg_temp.ok(not public.signup_taken('email', 'pendente@bicos.test'), 'e-mail de cadastro não confirmado fica livre');
select pg_temp.ok(not public.signup_taken('documento', pg_temp.valid_cpf('pendente')), 'documento de cadastro não confirmado fica livre');
select pg_temp.ok(not public.signup_taken('whatsapp', '11955550001'), 'número de cadastro não confirmado fica livre');
select pg_temp.ok(not public.signup_taken('email', 'ninguem@bicos.test') and not public.signup_taken('whatsapp', '11955550099'),
  'dado novo fica livre');
select pg_temp.fails($$select public.signup_taken('senha', 'x')$$, 'BC422');

-- Só a Edge Function (service_role) pergunta: o app e quem não entrou, não.
select pg_temp.login('77000000-0000-0000-0000-0000000000a1');
select pg_temp.fails($$select public.signup_taken('email', 'x@y.z')$$, '42501');
select pg_temp.logout();

-- Cadastro com o WhatsApp de uma conta confirmada: recusado.
select pg_temp.fails(format($f$insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
  values ('77000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'outro@bicos.test', null, %L, now(), now())$f$,
  jsonb_build_object('role', 'trabalhador', 'nome', 'Mesmo Número', 'documento', pg_temp.valid_cpf('mesmo-numero'),
                     'whatsapp', (select phone from t_v), 'terms_version', '1.0', 'maior_de_idade', true)), 'BC409');

-- Cadastro com o número do cadastro nunca confirmado: entra e libera o número (o cadastro velho sai).
insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values ('77000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'novo@bicos.test', null,
        jsonb_build_object('role', 'trabalhador', 'nome', 'Pega O Número', 'documento', pg_temp.valid_cpf('pega-numero'),
                           'whatsapp', '11955550001', 'terms_version', '1.0', 'maior_de_idade', true), now(), now());
select pg_temp.ok(not exists (select 1 from auth.users where id = '77000000-0000-0000-0000-0000000000b1')
                  and (select whatsapp from public.accounts where id = '77000000-0000-0000-0000-0000000000d1') = '11955550001',
  'o número de cadastro nunca confirmado é liberado');

-- O banco não aceita o mesmo número em duas contas, nem por fora das funções.
select pg_temp.fails(format('update public.accounts set whatsapp = %L where id = %L', (select phone from t_v),
  '77000000-0000-0000-0000-0000000000d1'), '23505');

-- Trocar o WhatsApp para o número de outra conta confirmada: recusado.
select pg_temp.new_user('77000000-0000-0000-0000-0000000000e1', 'recrutador', 'Outra Empresa');
select pg_temp.login('77000000-0000-0000-0000-0000000000e1');
select pg_temp.fails(format('select public.change_whatsapp(%L)', (select phone from t_v)), 'BC409');
select public.change_whatsapp('11955550077');
select pg_temp.logout();
select pg_temp.ok((select whatsapp from public.accounts where id = '77000000-0000-0000-0000-0000000000e1') = '11955550077',
  'trocar para um número livre continua funcionando');

rollback;
