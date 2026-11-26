-- AUD-134 — ordem de travas única: primeiro a vaga, depois a candidatura ou o pagamento. `transition_application` já
-- trava vaga → candidatura; `application_conclude` (rotina que conclui diárias) travava candidatura → vaga e
-- `confirm_boost_payment` pagamento → vaga: duas chamadas cruzadas podiam travar uma à outra (deadlock, 40P01).
-- Idempotente.

CREATE OR REPLACE FUNCTION public.application_conclude(p_app_id uuid, p_actor application_actor)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_app public.applications;
  v_job public.jobs;
  v_company text;
  v_worker text;
begin
  -- AUD-134: a vaga primeiro (mesma ordem de transition_application).
  perform 1 from public.jobs
   where id = (select a.job_id from public.applications a where a.id = p_app_id) for update;
  v_app := public.application_step(p_app_id, 'concluir', p_actor);
  select * into v_job from public.jobs where id = v_app.job_id;
  select name into v_company from public.companies where id = v_job.company_id;
  select name into v_worker from public.workers where id = v_app.worker_id;
  -- AUD-011: o bico só entra na contagem com a presença confirmada ou concluído pelo sistema (cron); a empresa
  -- sozinha, logo depois de contratar, não aumenta o número de bicos feitos.
  if v_app.presence_confirmed_at is not null or p_actor = 'sistema' then
    update public.workers set jobs_done = jobs_done + 1, novo = false where id = v_app.worker_id;
  else
    update public.workers set novo = false where id = v_app.worker_id;
  end if;
  perform public.notify(v_app.worker_id, null, 'avaliar_diaria', 'Avalie sua diária',
    v_company || ' · ' || public.job_title(v_job) || '. Conte como foi.', '/avaliar/' || v_job.id);
  perform public.notify(null, v_job.company_id, 'avaliar_trabalhador', 'Avalie o trabalhador',
    coalesce(v_worker, 'O trabalhador') || ' concluiu a diária de ' || public.job_title(v_job) || '.',
    '/avaliar-trabalhador/' || v_job.id || '/' || v_app.worker_id);
  perform public.job_close_if_team_done(v_job.id);
end;
$function$;

CREATE OR REPLACE FUNCTION public.confirm_boost_payment(p_payment_id uuid)
 RETURNS boost_payments
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_pay public.boost_payments;
  v_job public.jobs;
  v_ends timestamptz;
  v_job_id text;
begin
  -- AUD-134: a vaga primeiro, depois o pagamento (mesma ordem de begin_boost_payment).
  select p.job_id into v_job_id from public.boost_payments p where p.id = p_payment_id;
  perform 1 from public.jobs where id = v_job_id for update;
  select * into v_pay from public.boost_payments where id = p_payment_id for update;
  if not found then
    raise exception using errcode = 'BC404', message = 'Esse pagamento não existe.';
  end if;
  -- Já confirmado ou já marcado para devolver: nada a fazer. Um PIX pago depois de vencido ou de
  -- cancelado (o dinheiro entrou) é tratado como os outros: confirma se a vaga ainda puder.
  if v_pay.status in ('confirmado', 'reembolso_pendente') then return v_pay; end if;
  select * into v_job from public.jobs where id = v_pay.job_id for update;
  if v_job.id is null or not public.job_is_open(v_job) or public.job_holding(v_job.id) >= v_job.slots then
    update public.boost_payments
       set status = 'reembolso_pendente', confirmed_at = now(), updated_at = now(),
           status_detail = 'vaga_indisponivel'
     where id = p_payment_id returning * into v_pay;
    if v_job.id is not null then
      perform public.notify(null, v_job.company_id, 'impulsionamento', 'Pagamento será devolvido',
        'Recebemos o pagamento, mas ' || public.job_title(v_job) ||
        ' não está mais aberta. Vamos devolver o valor pela mesma forma de pagamento.',
        '/vaga-gerenciar/' || v_job.id);
    end if;
    return v_pay;
  end if;
  v_ends := greatest(coalesce(v_job.boost_ends_at, now()), now())
            + make_interval(hours => public.boost_plan_hours(v_pay.plan));
  update public.jobs set boost_ends_at = v_ends where id = v_job.id;
  update public.boost_payments
     set status = 'confirmado', confirmed_at = now(), boost_ends_at = v_ends, updated_at = now()
   where id = p_payment_id returning * into v_pay;
  perform public.notify(null, v_job.company_id, 'impulsionamento', 'Vaga impulsionada',
    public.job_title(v_job) || ' está no topo do mural até ' || public.short_datetime_br(v_ends) || '.',
    '/vaga-gerenciar/' || v_job.id);
  return v_pay;
end;
$function$;
