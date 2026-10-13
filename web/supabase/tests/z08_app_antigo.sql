-- Z08 — as funções e tabelas do app antigo não respondem a visitante nem a conta comum.
begin;

select pg_temp.new_user('40000000-0000-0000-0000-0000000000a1', 'trabalhador', 'Conta Nova', '52998224725');

set local role anon;
select pg_temp.fails('select public.reiniciar_cadastro_pendente_email(''x@y.z'')', '42501');
select pg_temp.fails('select public.reiniciar_cadastro_pendente_documento(''52998224725'')', '42501');
select pg_temp.fails('select public.excluir_minha_conta()', '42501');
select pg_temp.fails('select public.limpar_cadastros_nao_confirmados()', '42501');
select pg_temp.fails('select * from public.profiles', '42501');
reset role;

select pg_temp.login('40000000-0000-0000-0000-0000000000a1');
select pg_temp.fails('select public.excluir_minha_conta()', '42501');
select pg_temp.fails('select public.salvar_documento(''11144477735'')', '42501');
select pg_temp.fails('update public.profiles set documento_hash = ''x'', tipo = ''construtora''', '42501');
select pg_temp.fails('select email from public.profiles', '42501');
select pg_temp.fails('select public.purge_unconfirmed_signups()', '42501');
select pg_temp.logout();

-- O app novo continua funcionando com os dados antigos (por dentro do banco).
select pg_temp.ok(exists (select 1 from public.profiles where id = '40000000-0000-0000-0000-0000000000a1'),
  'o gatilho do cadastro continua gravando o perfil antigo (consentimentos)');
select pg_temp.ok(exists (select 1 from public.consentimentos where usuario_id = '40000000-0000-0000-0000-0000000000a1'),
  'aceite dos termos registrado');

rollback;
