-- AUD-135 — os limites por dia (30 candidaturas por trabalhador, 20 convites por empresa, 20 denúncias por conta) contavam e
-- depois gravavam sem trava: 40 chamadas ao mesmo tempo passavam todas. Agora cada conta toma uma trava de transação
-- antes de contar, e as chamadas dela passam a ser uma de cada vez. Idempotente.

CREATE OR REPLACE FUNCTION public.limit_application_spam()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform pg_advisory_xact_lock(hashtextextended('cand:' || new.worker_id::text, 0));
  if (select count(*) from public.application_attempts
       where worker_id = new.worker_id and created_at > now() - interval '1 day') >= 30 then
    raise exception using errcode = 'BC409',
      message = 'Você já se candidatou a muitas vagas hoje. Tente de novo amanhã.';
  end if;
  if (select count(*) from public.application_attempts
       where worker_id = new.worker_id and job_id = new.job_id and created_at > now() - interval '1 day') >= 3 then
    raise exception using errcode = 'BC409',
      message = 'Você já se candidatou e retirou essa vaga várias vezes hoje. Tente de novo amanhã.';
  end if;
  insert into public.application_attempts (worker_id, job_id) values (new.worker_id, new.job_id);
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.invite_worker(p_job_id text, p_worker_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_job public.jobs := public.own_job_for_update(p_job_id);
  v_company text;
  v_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('conv:' || v_job.company_id::text, 0));
  perform public.assert_company_active(v_job.company_id);
  if not public.job_is_open(v_job) or public.job_holding(p_job_id) >= v_job.slots then
    raise exception using errcode = 'BC409', message = 'Essa vaga não está aberta para convites.';
  end if;
  if not exists (select 1 from public.workers where id = p_worker_id and name <> 'Conta excluída') then
    raise exception using errcode = 'BC404', message = 'Esse trabalhador não está mais na Bicos.';
  end if;
  if exists (select 1 from public.applications where job_id = p_job_id and worker_id = p_worker_id) then
    raise exception using errcode = 'BC409', message = 'Essa pessoa já se candidatou a essa vaga.';
  end if;
  if exists (select 1 from public.job_invites where job_id = p_job_id and worker_id = p_worker_id) then
    raise exception using errcode = 'BC409', message = 'Você já convidou essa pessoa para essa vaga.';
  end if;
  -- Sem spam: até 20 convites por dia por construtora.
  select count(*) into v_count from public.job_invites
   where company_id = v_job.company_id and created_at > now() - interval '1 day';
  if v_count >= 20 then
    raise exception using errcode = 'BC409', message = 'Você já mandou muitos convites hoje. Tente amanhã.';
  end if;
  insert into public.job_invites (job_id, worker_id, company_id) values (p_job_id, p_worker_id, v_job.company_id);
  select name into v_company from public.companies where id = v_job.company_id;
  perform public.notify(p_worker_id, null, 'convite', v_company || ' convidou você',
    'Para ' || public.job_title(v_job) || ' em ' || coalesce(nullif(v_job.neighborhood, ''), v_job.city) ||
    '. Veja a vaga e responda.', '/vaga/' || p_job_id);
end;
$function$;

CREATE OR REPLACE FUNCTION public.report_content(p_target_type report_target, p_target_id text, p_reason text, p_details text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('denu:' || auth.uid()::text, 0));
  if auth.uid() is null then
    raise exception using errcode = 'BC401', message = 'Entre na sua conta de novo para continuar.';
  end if;
  if p_reason not in ('golpe', 'ofensa', 'falso', 'perigoso', 'spam', 'outro') then
    raise exception using errcode = 'BC422', message = 'Escolha o motivo da denúncia.';
  end if;
  select count(*) into v_count from public.reports where reporter_id = auth.uid() and created_at > now() - interval '1 day';
  if v_count >= 20 then
    raise exception using errcode = 'BC409', message = 'Você já mandou muitas denúncias hoje. Tente amanhã.';
  end if;
  insert into public.reports (reporter_id, target_type, target_id, reason, details)
  values (auth.uid(), p_target_type, p_target_id, p_reason, nullif(btrim(left(coalesce(p_details, ''), 500)), ''))
  on conflict (reporter_id, target_type, target_id) do update
    set reason = excluded.reason, details = excluded.details, created_at = now(), status = 'aberta';
end;
$function$;

