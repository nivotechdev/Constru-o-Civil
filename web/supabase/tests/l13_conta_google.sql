-- L13 — usuário do Google (sem lado) completa o cadastro com as mesmas regras.
begin;
insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
values ('7b000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'google@bicos.test', now(), '{"full_name": "Pelo Google"}', '{"provider": "google"}', now(), now());
select pg_temp.ok(not exists (select 1 from public.accounts where id = '7b000000-0000-0000-0000-0000000000a1'), 'sem conta ainda');
select pg_temp.new_user('7b000000-0000-0000-0000-0000000000a9', 'trabalhador', 'Dono Do CPF', '529.982.247-25');

select pg_temp.login('7b000000-0000-0000-0000-0000000000a1');
select pg_temp.fails($$select public.create_my_account('trabalhador', 'Pelo Google', '123.456.789-01', '11988887777', '1.0', true)$$, 'BC422');
select pg_temp.fails($$select public.create_my_account('trabalhador', 'Pelo Google', '390.533.447-05', '11988887777', '1.0', false)$$, 'BC422');
select pg_temp.fails($$select public.create_my_account('trabalhador', 'Pelo Google', '529.982.247-25', '11988887777', '1.0', true)$$, 'BC409');
select public.create_my_account('trabalhador', 'Pelo Google', '390.533.447-05', '(11) 98888-7777', '1.0', true);
select public.create_my_account('trabalhador', 'Pelo Google', '390.533.447-05', '(11) 98888-7777', '1.0', true);  -- de novo: nada
select pg_temp.logout();
select pg_temp.ok((select role = 'trabalhador' and worker_id is not null and document = '***.533.447-**'
                     from public.accounts where id = '7b000000-0000-0000-0000-0000000000a1'), 'conta criada');
rollback;
