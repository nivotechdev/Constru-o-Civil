-- L11 — nome curto ou longo demais é recusado pelo banco também.
begin;
select pg_temp.new_user('76000000-0000-0000-0000-0000000000a1', 'trabalhador', 'Nome Certo');
select pg_temp.login('76000000-0000-0000-0000-0000000000a1');
select pg_temp.fails($$update public.workers set name = 'ab' where id = '76000000-0000-0000-0000-0000000000a1'$$, '23514');
select pg_temp.fails($$update public.workers set name = repeat('x', 81) where id = '76000000-0000-0000-0000-0000000000a1'$$, '23514');
update public.workers set name = 'Nome Novo Certo' where id = '76000000-0000-0000-0000-0000000000a1';
select pg_temp.logout();
select pg_temp.ok((select name = 'Nome Novo Certo' from public.workers where id = '76000000-0000-0000-0000-0000000000a1'), 'nome válido grava');
rollback;
