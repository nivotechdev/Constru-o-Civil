-- U32/U33/U34 — descrição nos dois perfis, experiências do trabalhador e os campos antigos fora do banco.
begin;
select pg_temp.new_user('97000000-0000-0000-0000-0000000000a1', 'trabalhador', 'Ana Perfil');
select pg_temp.new_user('97000000-0000-0000-0000-0000000000a2', 'trabalhador', 'Bruno Perfil');
select pg_temp.new_user('97000000-0000-0000-0000-0000000000c1', 'recrutador', 'Obra Sobre', '11.222.333/0001-81');

select pg_temp.ok(not exists (
  select 1 from information_schema.columns
   where table_schema = 'public' and table_name = 'workers'
     and column_name in ('availability', 'years_experience', 'desired_pay', 'travel_km')
), 'os quatro campos antigos saíram do banco');

select pg_temp.login('97000000-0000-0000-0000-0000000000a1');
update public.workers set bio = repeat('a', 500), experiences = array['Reboco de fachada', 'Contrapiso nivelado']
 where id = '97000000-0000-0000-0000-0000000000a1';
select pg_temp.ok((select cardinality(experiences) = 2 from public.workers where id = '97000000-0000-0000-0000-0000000000a1'),
  'a pessoa grava as próprias experiências');
select pg_temp.fails($$update public.workers set bio = repeat('a', 501) where id = '97000000-0000-0000-0000-0000000000a1'$$, '23514');
select pg_temp.fails($$update public.workers set experiences = array[repeat('x', 81)] where id = '97000000-0000-0000-0000-0000000000a1'$$, '23514');
select pg_temp.fails($$update public.workers set experiences = array['a'] where id = '97000000-0000-0000-0000-0000000000a1'$$, '23514');
select pg_temp.fails($$update public.workers set experiences = array[' com espaço'] where id = '97000000-0000-0000-0000-0000000000a1'$$, '23514');
select pg_temp.fails($$update public.workers set experiences = array_fill('Pintura'::text, array[11]) where id = '97000000-0000-0000-0000-0000000000a1'$$, '23514');
update public.workers set experiences = array_fill('Pintura'::text, array[10]) where id = '97000000-0000-0000-0000-0000000000a1';

select pg_temp.login('97000000-0000-0000-0000-0000000000a2');
update public.workers set experiences = array['Invasão'] where id = '97000000-0000-0000-0000-0000000000a1';
select pg_temp.login('97000000-0000-0000-0000-0000000000a1');
select pg_temp.ok((select experiences[1] = 'Pintura' from public.workers where id = '97000000-0000-0000-0000-0000000000a1'),
  'outra conta não mexe nas experiências de ninguém');

select pg_temp.login('97000000-0000-0000-0000-0000000000c1');
update public.companies set about = 'Construtora de Caxias do Sul desde 2010.' where id = '97000000-0000-0000-0000-0000000000c1';
select pg_temp.ok((select about like 'Construtora%' from public.companies where id = '97000000-0000-0000-0000-0000000000c1'),
  'a construtora grava a sua descrição');
select pg_temp.fails($$update public.companies set about = repeat('a', 501) where id = '97000000-0000-0000-0000-0000000000c1'$$, '23514');
select pg_temp.ok((select cardinality(experiences) = 10 from public.workers where id = '97000000-0000-0000-0000-0000000000a1'),
  'a construtora lê as experiências do trabalhador');

select pg_temp.login('97000000-0000-0000-0000-0000000000a2');
select pg_temp.ok((select about is not null from public.companies where id = '97000000-0000-0000-0000-0000000000c1'),
  'o trabalhador lê a descrição da construtora');
select pg_temp.logout();
rollback;
