-- Y24 — verificação da construtora: pendente ao nascer; só a equipe muda; o selo acompanha.
begin;

select pg_temp.new_user('71000000-0000-0000-0000-0000000000c1', 'recrutador', 'Obra Nova', '11.222.333/0001-81');
select pg_temp.ok((select verification_status = 'pendente' and not verified and verified_at is null
                     from public.companies where id = '71000000-0000-0000-0000-0000000000c1'), 'nasce pendente, sem selo');

-- A própria construtora não muda o status nem o selo.
select pg_temp.login('71000000-0000-0000-0000-0000000000c1');
select pg_temp.fails($$update public.companies set verification_status = 'verificada' where id = '71000000-0000-0000-0000-0000000000c1'$$, '42501');
select pg_temp.fails($$update public.companies set verified = true where id = '71000000-0000-0000-0000-0000000000c1'$$, '42501');
select pg_temp.fails($$select public.set_company_verification('71000000-0000-0000-0000-0000000000c1', 'verificada')$$, '42501');
select pg_temp.ok((select verification_status = 'pendente' from public.companies where id = '71000000-0000-0000-0000-0000000000c1'),
  'a construtora lê o status');
select pg_temp.logout();

-- A equipe verifica: selo, data e aviso.
select public.set_company_verification('71000000-0000-0000-0000-0000000000c1', 'verificada');
select pg_temp.ok((select verified and verified_at is not null from public.companies where id = '71000000-0000-0000-0000-0000000000c1'),
  'verificada com selo e data');
select pg_temp.ok(exists (select 1 from public.notifications where company_id = '71000000-0000-0000-0000-0000000000c1'
                            and kind = 'verificacao' and title = 'Empresa verificada'), 'aviso de verificada');

-- Reprovada: sem selo, sem data.
select public.set_company_verification('71000000-0000-0000-0000-0000000000c1', 'reprovada');
select pg_temp.ok((select not verified and verified_at is null and verification_status = 'reprovada'
                     from public.companies where id = '71000000-0000-0000-0000-0000000000c1'), 'reprovada sem selo');
select pg_temp.fails($$select public.set_company_verification('71000000-0000-0000-0000-0000000000ff', 'verificada')$$, 'BC404');

rollback;
