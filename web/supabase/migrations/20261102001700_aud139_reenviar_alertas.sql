-- AUD-139 — um alerta de rotina que não conseguiu sair (sem a chave do Sentry no Vault, ou o envio falhou) ficava
-- como "já alertado" por 24 h e nunca mais era enviado. Agora, de hora em hora, os alertas ainda não enviados dos
-- últimos 7 dias são enviados de novo; assim que a chave existir, eles saem.
create or replace function public.resend_pending_cron_alerts()
returns integer language plpgsql security definer set search_path = public as $$
declare
  r record;
  n integer := 0;
begin
  for r in
    select id, jobname, message from public.cron_alerts
     where not sent and alerted_at > now() - interval '7 days'
     order by id
     limit 20
  loop
    if public.send_sentry_event(r.message, jsonb_build_object('job', r.jobname, 'origem', 'pg_cron', 'reenvio', 'sim')) then
      update public.cron_alerts set sent = true where id = r.id;
      n := n + 1;
    end if;
  end loop;
  return n;
end;
$$;
revoke all on function public.resend_pending_cron_alerts() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'bicos-reenviar-alertas';
    perform cron.schedule('bicos-reenviar-alertas', '42 * * * *', 'select public.resend_pending_cron_alerts()');
  end if;
end $$;
