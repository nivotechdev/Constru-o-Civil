-- AUD-010 — trocar o nome tira o selo: empresa "Verificada" volta a "pendente"; trabalhador "verificado" volta a
-- "nao_enviado". Mudar outro campo não mexe no selo.
begin;
select pg_temp.new_user('96000000-0000-0000-0000-000000000ac1', 'recrutador', 'Empresa Com Selo', '51.826.049/0001-39');
select pg_temp.new_user('96000000-0000-0000-0000-000000000aa1', 'trabalhador', 'Vera Verificada');
select public.set_company_verification('96000000-0000-0000-0000-000000000ac1', 'verificada');
select public.set_identity_status('96000000-0000-0000-0000-000000000aa1', 'verificado', null);
select pg_temp.ok((select verified from public.companies where id = '96000000-0000-0000-0000-000000000ac1')
                  and (select verified from public.workers where id = '96000000-0000-0000-0000-000000000aa1'), 'antes: os dois têm selo');

-- Outro campo: o selo fica.
select pg_temp.login('96000000-0000-0000-0000-000000000ac1');
update public.companies set about = 'Fazemos eventos' where id = '96000000-0000-0000-0000-000000000ac1';
select pg_temp.login('96000000-0000-0000-0000-000000000aa1');
update public.workers set bio = 'Faxineira' where id = '96000000-0000-0000-0000-000000000aa1';
select pg_temp.logout();
select pg_temp.ok((select verified from public.companies where id = '96000000-0000-0000-0000-000000000ac1')
                  and (select verified from public.workers where id = '96000000-0000-0000-0000-000000000aa1'), 'outro campo não tira o selo');

-- Nome: o selo sai.
select pg_temp.login('96000000-0000-0000-0000-000000000ac1');
update public.companies set name = 'Outra Empresa Qualquer' where id = '96000000-0000-0000-0000-000000000ac1';
select pg_temp.login('96000000-0000-0000-0000-000000000aa1');
update public.workers set name = 'Outra Pessoa Qualquer' where id = '96000000-0000-0000-0000-000000000aa1';
select pg_temp.logout();
select pg_temp.ok((select not verified and verification_status = 'pendente' and verified_at is null
                     from public.companies where id = '96000000-0000-0000-0000-000000000ac1'), 'empresa renomeada: sem selo, pendente');
select pg_temp.ok((select not verified and identity_status = 'nao_enviado'
                     from public.workers where id = '96000000-0000-0000-0000-000000000aa1'), 'trabalhador renomeado: sem selo');
select pg_temp.ok(exists (select 1 from public.notifications where company_id = '96000000-0000-0000-0000-000000000ac1'
                            and kind = 'verificacao'), 'a empresa é avisada');

-- Quem nunca teve selo: trocar o nome não muda o status.
select pg_temp.new_user('96000000-0000-0000-0000-000000000ac2', 'recrutador', 'Empresa Sem Selo', '45.723.174/0001-10');
update public.companies set verification_status = 'reprovada' where id = '96000000-0000-0000-0000-000000000ac2';
select pg_temp.login('96000000-0000-0000-0000-000000000ac2');
update public.companies set name = 'Empresa Renomeada Reprovada' where id = '96000000-0000-0000-0000-000000000ac2';
select pg_temp.logout();
select pg_temp.ok((select verification_status = 'reprovada' from public.companies where id = '96000000-0000-0000-0000-000000000ac2'),
                  'reprovada continua reprovada');
rollback;
