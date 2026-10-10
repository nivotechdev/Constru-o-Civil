-- Z07 — CPF/CNPJ: nenhum oráculo para visitante ou conta comum; login por documento só devolve o
-- e-mail com a senha certa; limite de tentativas; o cadastro recusa documento de conta confirmada e
-- libera o de cadastro nunca confirmado.
begin;

select pg_temp.new_user('30000000-0000-0000-0000-0000000000a1', 'trabalhador', 'Dono do CPF', '52998224725');
update auth.users set encrypted_password = extensions.crypt('senha-certa-1', extensions.gen_salt('bf'))
 where id = '30000000-0000-0000-0000-0000000000a1';

-- Visitante e conta comum não consultam documento nem as funções de login.
set local role anon;
select pg_temp.fails('select public.document_available(''52998224725'')', '42501');
select pg_temp.fails('select public.document_login_email(''52998224725'', ''x'')', '42501');
select pg_temp.fails('select public.rate_limit_hit(''x'', 1, ''1 minute'')', '42501');
select pg_temp.fails('select * from public.auth_attempts', '42501');
reset role;
select pg_temp.login('30000000-0000-0000-0000-0000000000a1');
select pg_temp.fails('select public.document_available(''52998224725'')', '42501');
select pg_temp.fails('select public.document_login_email(''52998224725'', ''senha-certa-1'')', '42501');
select pg_temp.logout();

-- A Edge Function (service_role): e-mail só com a senha certa; mesma resposta (nada) nos outros casos.
set local role service_role;
select pg_temp.ok(public.document_login_email('529.982.247-25', 'senha-certa-1') = 'teste+30000000-0000-0000-0000-0000000000a1@bicos.test',
  'senha certa devolve o e-mail da conta');
select pg_temp.ok(public.document_login_email('52998224725', 'errada') is null, 'senha errada: nada');
select pg_temp.ok(public.document_login_email('11144477735', 'senha-certa-1') is null, 'documento sem conta: nada (mesma resposta)');
-- Limite: a 6ª tentativa na janela passa do limite de 5.
select pg_temp.ok(not public.rate_limit_hit('doc:teste', 5, '15 minutes'), 'tentativa 1');
select public.rate_limit_hit('doc:teste', 5, '15 minutes') from generate_series(2, 5);
select pg_temp.ok(public.rate_limit_hit('doc:teste', 5, '15 minutes'), 'tentativa 6 passa do limite');
reset role;

-- Cadastro com o documento de uma conta confirmada falha (o Auth não cria a conta).
select pg_temp.fails($$select pg_temp.new_user('30000000-0000-0000-0000-0000000000a2', 'trabalhador', 'Outra Pessoa', '529.982.247-25')$$, 'BC409');

-- Cadastro nunca confirmado com o documento: o novo cadastro libera o documento.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values ('30000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'pendente@bicos.test', '{"role":"trabalhador","nome":"Pendente","documento":"11144477735","whatsapp":"11988887777","maior_de_idade":true}', now(), now());
select pg_temp.new_user('30000000-0000-0000-0000-0000000000a4', 'trabalhador', 'Quem confirmou', '111.444.777-35');
select pg_temp.ok(not exists (select 1 from auth.users where id = '30000000-0000-0000-0000-0000000000a3'),
  'cadastro pendente com o mesmo documento é liberado');
select pg_temp.ok((select document from public.accounts where id = '30000000-0000-0000-0000-0000000000a4') = '***.444.777-**',
  'documento fica com o novo cadastro (mascarado)');

-- Y16: recrutador com CPF não tem o CPF no campo público "CNPJ" da empresa.
select pg_temp.new_user('30000000-0000-0000-0000-0000000000c1', 'recrutador', 'Recrutador PF', '39053344705');
select pg_temp.ok((select cnpj from public.companies where id = '30000000-0000-0000-0000-0000000000c1') is null,
  'CPF de recrutador não vai para companies.cnpj');

rollback;
