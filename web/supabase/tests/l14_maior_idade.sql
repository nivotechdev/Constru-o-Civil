-- L14 — cadastro sem "Tenho 18 anos ou mais" é recusado.
begin;
select pg_temp.fails($$insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
  values ('77000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'menor@bicos.test', now(), '{"role": "trabalhador", "nome": "Sem Idade", "documento": "52998224725", "whatsapp": "11988887777"}', now(), now())$$, 'BC422');
select pg_temp.new_user('77000000-0000-0000-0000-0000000000a1', 'trabalhador', 'Maior De Idade');
select pg_temp.ok(exists (select 1 from public.accounts where id = '77000000-0000-0000-0000-0000000000a1'), 'com a confirmação, cria');
rollback;
