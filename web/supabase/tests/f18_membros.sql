-- F18 — a conta nova de construtora vira dona na tabela de membros.
begin;
select pg_temp.new_user('7c000000-0000-0000-0000-0000000000c1', 'recrutador', 'Obra Membros', '11.222.333/0001-81');
select pg_temp.ok((select role = 'dono' from public.company_members where company_id = '7c000000-0000-0000-0000-0000000000c1'
                     and user_id = '7c000000-0000-0000-0000-0000000000c1'), 'dona da própria construtora');
select pg_temp.login('7c000000-0000-0000-0000-0000000000c1');
select pg_temp.ok((select count(*) from public.company_members) = 1, 'vê só a própria');
select pg_temp.fails($$insert into public.company_members (company_id, user_id) values ('7c000000-0000-0000-0000-0000000000c1', '7c000000-0000-0000-0000-0000000000c1')$$, '42501');
select pg_temp.logout();
rollback;
