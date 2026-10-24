-- U67 — a empresa guarda só a cidade onde está: o cadastro grava a cidade (e nenhum endereço); cidade fora do formato
-- da lista é recusada; sem cidade completa o perfil como antes; a empresa troca a cidade no Editar perfil.
begin;
select pg_temp.new_user('96700000-0000-0000-0000-0000000000c1', 'recrutador', 'Empresa Cidade', '51.826.049/0001-39');
update public.accounts set profile_completed_at = null where id = '96700000-0000-0000-0000-0000000000c1';

select pg_temp.login('96700000-0000-0000-0000-0000000000c1');
select pg_temp.fails($$select public.finish_sign_up('{"city": "Caxias do Sul"}')$$, 'BC422');
select public.finish_sign_up('{"city": "Caxias do Sul, RS"}');
select pg_temp.ok((select location = 'Caxias do Sul, RS' from public.companies where id = '96700000-0000-0000-0000-0000000000c1'),
                  'o cadastro grava a cidade da empresa');
select pg_temp.ok(not exists (select 1 from public.addresses where account_id = '96700000-0000-0000-0000-0000000000c1'),
                  'e nenhum endereço');
select pg_temp.ok((select profile_completed_at is not null from public.accounts where id = '96700000-0000-0000-0000-0000000000c1'),
                  'o perfil fica completo');
update public.companies set location = 'Farroupilha, RS' where id = '96700000-0000-0000-0000-0000000000c1';
select pg_temp.ok((select location = 'Farroupilha, RS' from public.companies where id = '96700000-0000-0000-0000-0000000000c1'),
                  'a empresa troca a cidade no Editar perfil');
select public.finish_sign_up('{}');
select pg_temp.ok((select location = 'Farroupilha, RS' from public.companies where id = '96700000-0000-0000-0000-0000000000c1'),
                  'sem cidade, nada muda');
select pg_temp.logout();
rollback;
