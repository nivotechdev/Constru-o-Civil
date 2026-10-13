-- X22: a X15 reaproveitou o nome do cron `bicos-limpar-tentativas` para limpar `application_attempts` e, com
-- isso, desagendou a limpeza da Z07/Y25 (`purge_auth_attempts`: tentativas de entrar com CPF/CNPJ e
-- confirmações de WhatsApp), que ficariam crescendo para sempre. Agora uma função só limpa as três tabelas e o
-- cron chama ela. Idempotente.

create or replace function public.purge_auth_attempts()
returns integer language plpgsql security definer set search_path = public as $$
declare
  n integer;
begin
  with x as (delete from public.auth_attempts where at < now() - interval '1 day' returning 1)
  select count(*)::int into n from x;
  delete from public.whatsapp_verifications where verified_at < now() - interval '1 day';
  delete from public.application_attempts where created_at < now() - interval '2 days';
  return n;
end;
$$;
revoke all on function public.purge_auth_attempts() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'bicos-limpar-tentativas';
    perform cron.schedule('bicos-limpar-tentativas', '17 4 * * *', 'select public.purge_auth_attempts()');
  end if;
end $$;
