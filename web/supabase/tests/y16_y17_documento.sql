-- Y16/Y17 — documento com dígito verificador; CPF de recrutador fora do campo público da empresa.
begin;

select pg_temp.ok(public.cpf_valid('529.982.247-25') and public.cpf_valid('11144477735'), 'CPF válido');
select pg_temp.ok(not public.cpf_valid('123.456.789-01') and not public.cpf_valid('111.111.111-11')
                  and not public.cpf_valid('5299822472') and not public.cpf_valid(null), 'CPF inválido');
select pg_temp.ok(public.cnpj_valid('11.222.333/0001-81') and public.cnpj_valid('18402551000147'), 'CNPJ válido');
select pg_temp.ok(not public.cnpj_valid('11.222.333/0001-80') and not public.cnpj_valid('11111111111111')
                  and not public.cnpj_valid('1122233300018'), 'CNPJ inválido');
select pg_temp.ok(pg_temp.valid_cpf('qualquer') <> pg_temp.valid_cpf('outra') and public.cpf_valid(pg_temp.valid_cpf('qualquer')),
  'o utilitário dos testes gera CPF válido');

-- Cadastro com documento inválido ou sem documento: recusado no próprio Auth.
select pg_temp.fails($$select pg_temp.new_user('60000000-0000-0000-0000-0000000000a1', 'trabalhador', 'CPF Errado', '123.456.789-01')$$, 'BC422');
select pg_temp.fails($$select pg_temp.new_user('60000000-0000-0000-0000-0000000000a2', 'trabalhador', 'Sem CPF', '')$$, 'BC422');
select pg_temp.fails($$select pg_temp.new_user('60000000-0000-0000-0000-0000000000a3', 'trabalhador', 'Com CNPJ', '11.222.333/0001-81')$$, 'BC422');
select pg_temp.fails($$select pg_temp.new_user('60000000-0000-0000-0000-0000000000a4', 'recrutador', 'CNPJ Errado', '11.222.333/0001-80')$$, 'BC422');
select pg_temp.ok(not exists (select 1 from auth.users where id::text like '60000000-0000-0000-0000-0000000000a%'), 'nenhuma conta criada');

-- Recrutador com CNPJ: o começo do CNPJ no perfil. Recrutador por conta própria (CPF): nada no perfil.
select pg_temp.new_user('60000000-0000-0000-0000-0000000000b1', 'recrutador', 'Construtora CNPJ', '11.222.333/0001-81');
select pg_temp.new_user('60000000-0000-0000-0000-0000000000b2', 'recrutador', 'Empreiteiro CPF', '529.982.247-25');
select pg_temp.ok((select cnpj from public.companies where id = '60000000-0000-0000-0000-0000000000b1') = '11.222.333/****-**',
  'CNPJ mascarado no perfil');
select pg_temp.ok((select cnpj from public.companies where id = '60000000-0000-0000-0000-0000000000b2') is null,
  'CPF de recrutador não vai para companies.cnpj');

-- Login com Google (sem lado): a conta nasce depois, sem documento por enquanto.
insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values ('60000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'google@bicos.test', now(), '{"name": "Pelo Google"}', now(), now());
select pg_temp.ok(not exists (select 1 from public.accounts where id = '60000000-0000-0000-0000-0000000000c1'),
  'conta sem lado não é criada no cadastro');

-- create_account_for direto com documento inválido também é recusado.
select pg_temp.fails($$select public.create_account_for('60000000-0000-0000-0000-0000000000c1', 'google@bicos.test',
  'trabalhador', 'Pelo Google', '123.456.789-01', '11988887777', '1.0', now())$$, 'BC422');

-- Y16: o CPF mascarado antigo sai de companies.cnpj (o update da migration).
update public.companies set cnpj = '***.982.247-**' where id = '60000000-0000-0000-0000-0000000000b2';
update public.companies set cnpj = null where cnpj like '***%';
select pg_temp.ok((select cnpj from public.companies where id = '60000000-0000-0000-0000-0000000000b2') is null,
  'limpeza do CPF mascarado');

rollback;
