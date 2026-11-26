-- AUD-038 — pagamento que o banco não consegue aplicar não pode ficar parado sem ninguém saber. De hora em hora:
--   * pagamento em `reembolso_pendente` há mais de 1 hora (o dinheiro entrou e a vaga não pôde ser impulsionada);
--   * aviso do Mercado Pago de estorno (`refunded`) ou contestação (`charged_back`) nas últimas 24 horas
-- viram alerta (cron_alerts + Sentry) pela mesma via das rotinas. Sem pagamento ligado, nada disso existe e a função não faz nada.
create or replace function public.check_payment_alerts()
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_pending integer;
  v_reversed integer;
  n integer := 0;
begin
  select count(*) into v_pending from public.boost_payments
   where status = 'reembolso_pendente' and coalesce(updated_at, confirmed_at, created_at) < now() - interval '1 hour';
  if v_pending > 0 and public.raise_cron_alert(
       'bicos-alertar-pagamentos', 'Pagamentos aguardando devolução há mais de 1 hora: ' || v_pending) then
    n := n + 1;
  end if;
  select count(*) into v_reversed from public.payment_webhook_events
   where result in ('refunded', 'charged_back') and received_at > now() - interval '24 hours';
  if v_reversed > 0 and public.raise_cron_alert(
       'bicos-alertar-pagamentos', 'Estornos ou contestações de pagamento nas últimas 24 horas: ' || v_reversed) then
    n := n + 1;
  end if;
  return n;
end;
$$;
revoke all on function public.check_payment_alerts() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'bicos-alertar-pagamentos';
    perform cron.schedule('bicos-alertar-pagamentos', '27 * * * *', 'select public.check_payment_alerts()');
  end if;
end $$;
