-- U37 — login do Google que nunca terminou o cadastro some depois de 7 dias; conta criada fica.
begin;
-- Login do Google sem conta, de 8 dias atrás (abandonado) e de hoje (ainda no cadastro).
insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data, created_at, updated_at)
values
  ('98000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'abandonou@gmail.com', now() - interval '8 days', '{"provider":"email","providers":["email"],"via":"firebase"}',
   now() - interval '8 days', now()),
  ('98000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'cadastrando@gmail.com', now(), '{"provider":"google","providers":["google"]}', now(), now());
-- Conta de verdade antiga, criada pelo Google e com cadastro completo.
select pg_temp.new_user('98000000-0000-0000-0000-0000000000a3', 'trabalhador', 'Conta Completa');
update auth.users set created_at = now() - interval '30 days', raw_app_meta_data = '{"provider":"google","via":"firebase"}'
 where id = '98000000-0000-0000-0000-0000000000a3';

select pg_temp.ok(public.purge_unconfirmed_signups() >= 1, 'apaga o cadastro com Google abandonado');
select pg_temp.ok(not exists (select 1 from auth.users where id = '98000000-0000-0000-0000-0000000000a1'),
  'o login de 8 dias sem conta saiu');
select pg_temp.ok(exists (select 1 from auth.users where id = '98000000-0000-0000-0000-0000000000a2'),
  'quem está se cadastrando agora fica');
select pg_temp.ok(exists (select 1 from auth.users where id = '98000000-0000-0000-0000-0000000000a3'),
  'conta completa criada pelo Google fica');

-- A conta é criada pelo create_my_account, sem passo de e-mail (já confirmado pelo Google).
select pg_temp.login('98000000-0000-0000-0000-0000000000a2');
select public.create_my_account('trabalhador', 'Pelo Google Silva', pg_temp.valid_cpf('98a2'), pg_temp.phone_for('98a2'), '1.0', true);
select pg_temp.ok((select email_confirmed_at is not null and role = 'trabalhador' from public.accounts
                    where id = '98000000-0000-0000-0000-0000000000a2'), 'conta nasce com o e-mail confirmado');
select pg_temp.logout();
rollback;
