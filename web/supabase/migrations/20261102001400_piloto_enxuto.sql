-- Piloto enxuto (02/11/2026): para lançar sem advogado nem contador o app coleta e guarda o mínimo.
--   * impulsionar vaga (pagamento) fica INATIVO: begin_boost_payment recusa (BC409) até app_config.payments_enabled = 'sim';
--   * selfie e documento ficam DESLIGADOS: submit_identity recusa (BC409) até app_config.identity_enabled = 'sim';
--   * conta suspensa ou com denúncia em aberto não se exclui sozinha (fala com a equipe) — assim não é preciso guardar
--     lista de banidos nem inventar prazo (AUD-163);
--   * as decisões da equipe (staff_actions) saem depois de 1 ano (cron diário), prazo que a Política passa a citar
--     (AUD-070).
-- Idempotente.

create or replace function public.feature_on(p_key text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select lower(value) in ('sim', '1', 'true') from public.app_config where key = p_key), false)
$$;
revoke all on function public.feature_on(text) from public, anon, authenticated;

-- Conta suspensa, ou com denúncia em aberto contra ela (perfil, vagas ou publicações).
create or replace function public.account_has_open_case(p_account public.accounts)
returns boolean language sql stable security definer set search_path = public as $$
  select p_account.suspended_at is not null
      or exists (
        select 1 from public.reports r
         where r.status = 'aberta'
           and (
             (r.target_type = 'perfil' and r.target_id in (p_account.id::text, coalesce(p_account.worker_id::text, ''),
                                                           coalesce(p_account.company_id::text, '')))
             or (r.target_type = 'vaga' and r.target_id in (select id from public.jobs where company_id = p_account.company_id))
             or (r.target_type = 'post' and r.target_id in (select id::text from public.worker_posts where worker_id = p_account.worker_id))
           )
      )
$$;
revoke all on function public.account_has_open_case(public.accounts) from public, anon, authenticated;

create or replace function public.purge_staff_actions()
returns integer language sql security definer set search_path = public as $$
  with x as (delete from public.staff_actions where created_at < now() - interval '1 year' returning 1)
  select count(*)::int from x
$$;
revoke all on function public.purge_staff_actions() from public, anon, authenticated;
grant execute on function public.purge_staff_actions() to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'bicos-limpar-auditoria';
    perform cron.schedule('bicos-limpar-auditoria', '51 4 * * *', 'select public.purge_staff_actions()');
  end if;
end $$;

-- begin_boost_payment (de 20261021000500_u48_publico_geral.sql)
create or replace function public.begin_boost_payment(
  p_account uuid, p_job_id text, p_plan public.boost_plan, p_method public.payment_method
) returns public.boost_payments language plpgsql security definer set search_path = public as $$
declare
  v_company uuid := (select company_id from public.accounts where id = p_account);
  v_job public.jobs;
  v_pay public.boost_payments;
  v_blocker text;
begin
  -- Piloto enxuto (02/11/2026): impulsionar fica inativo até os sócios ligarem (app_config.payments_enabled = 'sim').
  if not public.feature_on('payments_enabled') then
    raise exception using errcode = 'BC409', message = 'O impulsionamento ainda não está disponível.';
  end if;
  if v_company is null then
    raise exception using errcode = 'BC401', message = 'Só a conta de empresa pode impulsionar.';
  end if;
  if public.boost_plan_cents(p_plan) is null then
    raise exception using errcode = 'BC422', message = 'Escolha um dos planos.';
  end if;
  select * into v_job from public.jobs where id = p_job_id for update;
  if not found then
    raise exception using errcode = 'BC404', message = 'Essa vaga não existe mais.';
  end if;
  v_blocker := case
    when v_job.company_id is distinct from v_company then 'Só a empresa da vaga pode impulsionar.'
    when not public.job_is_open(v_job) or public.job_holding(v_job.id) >= v_job.slots
      then 'Só dá para impulsionar uma vaga aberta.'
    when v_job.boost_ends_at > now() then 'Essa vaga já está impulsionada.'
  end;
  if v_blocker is not null then
    raise exception using errcode = 'BC409', message = v_blocker;
  end if;
  -- Um pagamento aguardando por vaga: o anterior (código PIX que ficou para trás) é cancelado.
  update public.boost_payments set status = 'cancelado', updated_at = now()
   where job_id = p_job_id and status = 'aguardando';
  insert into public.boost_payments (job_id, company_id, plan, method, amount_cents, provider, expires_at)
  values (p_job_id, v_company, p_plan, p_method, public.boost_plan_cents(p_plan), 'mercadopago',
          case when p_method = 'pix' then now() + interval '30 minutes' end)
  returning * into v_pay;
  return v_pay;
end;
$$;

-- submit_identity (de 20261015000200_lanc07_aceites.sql)
create or replace function public.submit_identity(p_selfie_path text, p_document_path text, p_consent_version text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_worker uuid := public.my_worker_id();
  v_prefix text := auth.uid()::text || '/';
begin
  -- Piloto enxuto (02/11/2026): selfie e documento ficam desligados até os sócios ligarem (app_config.identity_enabled = 'sim').
  if not public.feature_on('identity_enabled') then
    raise exception using errcode = 'BC409', message = 'A verificação de identidade ainda não está disponível.';
  end if;
  if v_worker is null then
    raise exception using errcode = 'BC401', message = 'Só a conta de trabalhador verifica a identidade.';
  end if;
  if nullif(btrim(coalesce(p_consent_version, '')), '') is null or char_length(p_consent_version) > 20 then
    raise exception using errcode = 'BC422', message = 'Marque que você concorda com o uso das fotos para a verificação.';
  end if;
  if left(coalesce(p_selfie_path, ''), length(v_prefix)) <> v_prefix
     or left(coalesce(p_document_path, ''), length(v_prefix)) <> v_prefix then
    raise exception using errcode = 'BC422', message = 'Envie a selfie e a foto do documento de novo.';
  end if;
  if exists (select 1 from public.workers where id = v_worker and identity_status in ('em_analise', 'verificado')) then
    raise exception using errcode = 'BC409', message = 'Sua identidade já está em análise ou verificada.';
  end if;
  insert into public.identity_submissions (worker_id, selfie_path, document_path, consent_version, consent_at)
  values (v_worker, p_selfie_path, p_document_path, btrim(p_consent_version), now());
  insert into public.terms_acceptances (account_id, document, version)
  values (auth.uid(), 'uso_de_imagem_identidade', btrim(p_consent_version))
  on conflict do nothing;
  update public.workers set identity_status = 'em_analise', identity_reason = null, identity_submitted_at = now()
   where id = v_worker;
end;
$$;

-- delete_my_account (de 20261017000200_r04_exclusao_pelo_painel.sql)
create or replace function public.delete_my_account(p_confirm_commitments boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_account public.accounts;
  v_reason text := 'Conta excluída';
  v_job public.jobs;
  v_auth_at timestamptz := public.session_authenticated_at();
  r record;
begin
  select * into v_account from public.accounts where id = auth.uid() for update;
  if not found then
    raise exception using errcode = 'BC401', message = 'Entre na sua conta de novo para continuar.';
  end if;
  if v_auth_at is null or v_auth_at < now() - interval '5 minutes' then
    raise exception using errcode = 'BC401', message = 'Por segurança, confirme sua senha de novo para excluir a conta.';
  end if;
  -- Piloto enxuto: sem lista de banidos nem prazo de guarda, a exclusão espera a equipe quando a conta está suspensa
  -- ou tem denúncia em aberto (AUD-163): sair não apaga a denúncia nem faz o banido voltar limpo.
  if public.account_has_open_case(v_account) then
    raise exception using errcode = 'BC409',
      message = 'Sua conta tem uma situação em análise pela equipe. Fale com a gente pela Ajuda para excluir.';
  end if;

  if v_account.role = 'trabalhador' then
    perform public.conclude_finished_jobs(v_account.worker_id, null);
    if not p_confirm_commitments and exists (
      select 1 from public.applications
       where worker_id = v_account.worker_id and status in ('pre_selecionado', 'contratado')) then
      raise exception using errcode = 'BC409', message = 'Confirme o que acontece com os bicos em andamento antes de excluir.';
    end if;
  else
    perform public.conclude_finished_jobs(null, v_account.company_id);
    if not p_confirm_commitments and exists (
      select 1 from public.applications a join public.jobs j on j.id = a.job_id
       where j.company_id = v_account.company_id and not j.closed and j.deleted_at is null
         and a.status in ('pre_selecionado', 'contratado')) then
      raise exception using errcode = 'BC409', message = 'Confirme o que acontece com os bicos em andamento antes de excluir.';
    end if;
  end if;
  perform public.anonymize_account(v_account, v_reason);

  -- A conta de acesso por último, na mesma transação: se algo acima falhar, nada fica pela metade.
  -- Marcar o perfil como completo impede o gatilho de limpeza de cadastro abandonado de apagar o perfil
  -- anonimizado, que o histórico do outro lado ainda usa. O gatilho do R04 em auth.users não repete a limpeza.
  update public.accounts set profile_completed_at = coalesce(profile_completed_at, now()) where id = v_account.id;
  perform set_config('bicos.conta_ja_limpa', v_account.id::text, true);
  delete from auth.users where id = v_account.id;
end;
$$;
