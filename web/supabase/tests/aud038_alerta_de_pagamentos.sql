-- AUD-038 — pagamento aguardando devolução há mais de 1 hora, e estorno/contestação do Mercado Pago, viram alerta
-- (uma vez por dia por texto).
begin;
select pg_temp.new_user('3a000000-0000-0000-0000-0000000000c1', 'recrutador', 'Empresa Alerta');
create temp table t_ids (k text primary key, v text);
insert into t_ids values ('vaga', pg_temp.new_job('3a000000-0000-0000-0000-0000000000c1', 1, 2));
select pg_temp.ok(not has_function_privilege('authenticated', 'public.check_payment_alerts()', 'execute'), 'só a equipe chama');
delete from public.cron_alerts;

select pg_temp.ok(public.check_payment_alerts() = 0, 'sem pagamento parado: nada a avisar');

insert into public.boost_payments (job_id, company_id, plan, method, amount_cents, status, updated_at)
values ((select v from t_ids where k = 'vaga'), '3a000000-0000-0000-0000-0000000000c1', '24h', 'pix', 1000,
        'reembolso_pendente', now() - interval '2 hours');
select pg_temp.ok(public.check_payment_alerts() = 1, 'pagamento parado há 2 horas: um alerta');
select pg_temp.ok((select count(*) from public.cron_alerts where jobname = 'bicos-alertar-pagamentos'
                    and message like 'Pagamentos aguardando devolução%') = 1, 'alerta registrado');
select pg_temp.ok(public.check_payment_alerts() = 0, 'no mesmo dia não se repete');

insert into public.payment_webhook_events (provider, event_id, provider_payment_id, result)
values ('mercadopago', 'e-1', '123', 'charged_back');
select pg_temp.ok(public.check_payment_alerts() = 1, 'contestação: alerta novo');
rollback;
