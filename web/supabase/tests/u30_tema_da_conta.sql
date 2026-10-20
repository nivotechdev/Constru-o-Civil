-- U30 — o tema é da conta: gravado pela própria conta, lido só por ela, o mesmo em qualquer aparelho.
begin;
select pg_temp.new_user('96000000-0000-0000-0000-0000000000a1', 'trabalhador', 'Ana Tema');
select pg_temp.new_user('96000000-0000-0000-0000-0000000000a2', 'trabalhador', 'Bruno Tema');

select pg_temp.login('96000000-0000-0000-0000-0000000000a1');
select pg_temp.ok(not exists (select 1 from public.account_prefs), 'sem escolha, nada guardado (o app usa o claro)');
select public.set_my_theme('escuro');
select pg_temp.ok((select theme from public.account_prefs) = 'escuro', 'a conta grava o escuro');
select public.set_my_theme('claro');
select pg_temp.ok((select count(*) = 1 and bool_and(theme = 'claro') from public.account_prefs), 'troca de volta, uma linha só');
select pg_temp.fails($$select public.set_my_theme('azul')$$, 'BC422');
select public.set_my_theme('escuro');

select pg_temp.login('96000000-0000-0000-0000-0000000000a2');
select pg_temp.ok(not exists (select 1 from public.account_prefs), 'outra conta não vê o tema da Ana');
select pg_temp.fails($$insert into public.account_prefs (account_id, theme) values ('96000000-0000-0000-0000-0000000000a2', 'escuro')$$, '42501');
select pg_temp.logout();

set local role anon;
select pg_temp.fails($$select public.set_my_theme('escuro')$$, '42501');
reset role;

delete from auth.users where id = '96000000-0000-0000-0000-0000000000a1';
select pg_temp.ok(not exists (select 1 from public.account_prefs where account_id = '96000000-0000-0000-0000-0000000000a1'),
                  'a exclusão da conta leva o tema junto');
rollback;
