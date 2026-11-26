-- AUD-140 — o login por documento leva o mesmo tempo quando a conta existe e quando não existe (uma conferência bcrypt
-- nos dois casos); antes a conta inexistente respondia ~140 vezes mais rápido.
begin;
select pg_temp.new_user('9a000000-0000-0000-0000-0000000000a1', 'trabalhador', 'Tempo Igual', pg_temp.valid_cpf('aud140'));
update auth.users set encrypted_password = extensions.crypt('senha-boa-123', extensions.gen_salt('bf', 10))
 where id = '9a000000-0000-0000-0000-0000000000a1';

select pg_temp.ok(public.document_login_email(pg_temp.valid_cpf('aud140'), 'senha-boa-123') is not null, 'senha certa entra');
select pg_temp.ok(public.document_login_email(pg_temp.valid_cpf('aud140'), 'errada') is null, 'senha errada não entra');
select pg_temp.ok(public.document_login_email(pg_temp.valid_cpf('ninguem-tem'), 'senha-boa-123') is null, 'documento sem conta não entra');

do $$
declare
  t0 timestamptz; with_account numeric; without_account numeric;
begin
  t0 := clock_timestamp();
  for i in 1..20 loop perform public.document_login_email(pg_temp.valid_cpf('aud140'), 'errada'); end loop;
  with_account := extract(epoch from clock_timestamp() - t0);
  t0 := clock_timestamp();
  for i in 1..20 loop perform public.document_login_email(pg_temp.valid_cpf('ninguem-tem'), 'errada'); end loop;
  without_account := extract(epoch from clock_timestamp() - t0);
  if without_account < with_account * 0.5 or without_account > with_account * 2 then
    raise exception 'FALHOU: tempos diferentes (com conta %, sem conta %)', with_account, without_account;
  end if;
end $$;
rollback;
