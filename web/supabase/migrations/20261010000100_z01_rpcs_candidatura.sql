-- Z01 — As RPCs que faltavam no banco: decisões da construtora e desistência (transition_application),
-- retirar candidatura, excluir vaga e excluir conta, mais a limpeza do perfil de cadastro abandonado.
-- Substitui supabase/APLICAR-NO-SQL-EDITOR.sql (que nunca foi aplicado), já com as correções:
--   Y02 — concluir e marcar falta só a partir do dia de início; "concluída" ocupa a posição;
--   Y03 — quando uma posição libera (desistência, cancelamento, falta, aprovação desfeita) numa vaga
--         aberta, os recusados automaticamente voltam para "em análise" e são avisados;
--   Y05 — desfazer aprovação numa vaga encerrada é recusado;
--   Y06 — o aviso de desistência diz se a vaga volta ao mural ou não;
--   Y08 — excluir vaga com gente escolhida/contratada é recusado (encerrar é o caminho); quem esperava
--         vira "não selecionado", com aviso;
--   Y15 — excluir conta exige login recente (≤ 5 min) e tira o nome das avaliações escritas.
-- Idempotente: só `create or replace`, `drop … if exists` e `grant`/`revoke`.

-- ---------------------------------------------------------------------------------------------------
-- Utilidades da vaga
-- ---------------------------------------------------------------------------------------------------

-- Posições ocupadas: escolhidos, contratados e quem já concluiu a diária (Y02).
create or replace function public.job_holding(p_job_id text)
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::int from public.applications
   where job_id = p_job_id and status in ('pre_selecionado', 'contratado', 'concluida')
$$;

-- Aberta: não encerrada, não excluída e ainda no prazo.
create or replace function public.job_is_open(p_job public.jobs)
returns boolean language sql stable set search_path = public as $$
  select not p_job.closed and p_job.deleted_at is null
     and (p_job.date_to_arrange or p_job.end_date >= public.bicos_today())
$$;

-- A diária já começou (concluir e marcar falta só a partir daí). "A combinar" não tem data: vale.
create or replace function public.job_started(p_job public.jobs)
returns boolean language sql stable set search_path = public as $$
  select p_job.date_to_arrange or p_job.start_date <= public.bicos_today()
$$;

-- Y03: uma posição liberou. Se a vaga continua aberta e com lugar, quem foi recusado automaticamente
-- ao lotar volta para "em análise" e recebe o aviso. Devolve quantos voltaram.
create or replace function public.job_reopen_auto_rejected(p_job_id text, p_reason text)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_job public.jobs;
  v_company text;
  n integer := 0;
  r record;
begin
  select * into v_job from public.jobs where id = p_job_id;
  if not found or not public.job_is_open(v_job) or public.job_holding(p_job_id) >= v_job.slots then
    return 0;
  end if;
  select name into v_company from public.companies where id = v_job.company_id;
  for r in
    update public.applications
       set status = 'em_analise', status_changed_at = now(), auto_rejected = false
     where job_id = p_job_id and auto_rejected and status = 'nao_selecionado'
    returning id, worker_id
  loop
    insert into public.application_events (application_id, status, "by", reason)
    values (r.id, 'em_analise', 'sistema', p_reason);
    perform public.notify(r.worker_id, null, 'candidatura_em_analise', 'A vaga reabriu',
      v_company || ' abriu de novo ' || public.job_title(v_job) || '. Sua candidatura voltou para análise.',
      '/vaga/' || p_job_id);
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- Os números do mural: "concluída" também ocupa posição (Y02).
create or replace function public.job_stats(p_job_ids text[])
returns table (job_id text, holding integer, pending integer, total integer)
language sql stable security definer set search_path = public as $$
  select a.job_id,
         count(*) filter (where a.status in ('pre_selecionado', 'contratado', 'concluida'))::int,
         count(*) filter (where a.status in ('enviada', 'em_analise'))::int,
         count(*)::int
    from public.applications a
   where a.job_id = any (p_job_ids)
   group by a.job_id
$$;

-- ---------------------------------------------------------------------------------------------------
-- Cadastro nunca confirmado apagado do Auth: leva junto o perfil vazio
-- ---------------------------------------------------------------------------------------------------

create or replace function public.cleanup_unconfirmed_profile_v2()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.email_confirmed_at is null and old.profile_completed_at is null then
    delete from public.workers w
     where w.id = old.worker_id and not exists (select 1 from public.applications a where a.worker_id = w.id);
    delete from public.companies c
     where c.id = old.company_id and not exists (select 1 from public.jobs j where j.company_id = c.id);
  end if;
  return old;
end;
$$;

drop trigger if exists on_account_deleted_v2 on public.accounts;
create trigger on_account_deleted_v2
  after delete on public.accounts
  for each row execute function public.cleanup_unconfirmed_profile_v2();

-- ---------------------------------------------------------------------------------------------------
-- Candidatura: o trabalhador se candidata (a vaga precisa estar aberta e com lugar) ou retira
-- ---------------------------------------------------------------------------------------------------

create or replace function public.submit_application(p_job_id text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_worker uuid := public.my_worker_id();
  v_job public.jobs;
  v_app_id uuid;
  v_name text;
begin
  if v_worker is null then
    raise exception using errcode = 'BC401', message = 'Só a conta de trabalhador pode se candidatar.';
  end if;
  if not exists (select 1 from public.accounts where id = auth.uid() and profile_completed_at is not null) then
    raise exception using errcode = 'BC409', message = 'Complete seu perfil antes de se candidatar.';
  end if;
  select * into v_job from public.jobs where id = p_job_id for update;
  if not found then
    raise exception using errcode = 'BC404', message = 'Essa vaga não existe mais.';
  end if;
  if v_job.deleted_at is not null then
    raise exception using errcode = 'BC409', message = 'Essa vaga foi removida pela construtora.';
  end if;
  if exists (select 1 from public.applications where job_id = p_job_id and worker_id = v_worker) then return; end if;
  if v_job.closed then
    raise exception using errcode = 'BC409', message = 'Essa vaga foi encerrada.';
  end if;
  if not public.job_is_open(v_job) then
    raise exception using errcode = 'BC409', message = 'O prazo dessa vaga já passou.';
  end if;
  if public.job_holding(p_job_id) >= v_job.slots then
    raise exception using errcode = 'BC409', message = 'Essa vaga já foi preenchida.';
  end if;

  insert into public.applications (job_id, worker_id) values (p_job_id, v_worker) returning id into v_app_id;
  insert into public.application_events (application_id, status, "by") values (v_app_id, 'enviada', 'trabalhador');
  select name into v_name from public.workers where id = v_worker;
  perform public.notify(null, v_job.company_id, 'novos_candidatos', 'Nova candidatura',
    coalesce(v_name, 'Um trabalhador') || ' se candidatou para ' || public.job_title(v_job) || '.',
    '/vaga-gerenciar/' || p_job_id);
end;
$$;

create or replace function public.withdraw_application(p_job_id text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_app public.applications;
begin
  if public.my_worker_id() is null then
    raise exception using errcode = 'BC401', message = 'Só a conta de trabalhador pode fazer isso.';
  end if;
  select * into v_app from public.applications
   where job_id = p_job_id and worker_id = public.my_worker_id() for update;
  if not found then
    raise exception using errcode = 'BC404', message = 'Essa candidatura não existe mais.';
  end if;
  if v_app.status not in ('enviada', 'em_analise') then
    raise exception using errcode = 'BC409', message = 'A construtora já decidiu sobre essa candidatura. Atualize a tela.';
  end if;
  delete from public.applications where id = v_app.id;
end;
$$;

-- ---------------------------------------------------------------------------------------------------
-- As decisões (construtora) e a desistência (trabalhador), numa RPC só
-- ---------------------------------------------------------------------------------------------------

create or replace function public.transition_application(
  p_job_id text, p_worker_id uuid, p_action text, p_reason text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_job public.jobs;
  v_app public.applications;
  v_company text;
  v_worker text;
  v_title text;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_holding integer;
  v_taken_back integer;
  r record;
begin
  if auth.uid() is null then
    raise exception using errcode = 'BC401', message = 'Entre na sua conta de novo para continuar.';
  end if;
  select * into v_job from public.jobs where id = p_job_id for update;
  if not found then
    raise exception using errcode = 'BC404', message = 'Essa vaga não existe mais.';
  end if;
  select * into v_app from public.applications where job_id = p_job_id and worker_id = p_worker_id;
  if not found then
    raise exception using errcode = 'BC404', message = 'Essa candidatura não existe mais.';
  end if;
  select name into v_company from public.companies where id = v_job.company_id;
  select name into v_worker from public.workers where id = p_worker_id;
  v_title := public.job_title(v_job);

  -- O trabalhador desiste ("Não vou poder ir"). A posição libera; se a vaga segue aberta, volta ao
  -- mural e quem foi recusado automaticamente volta para análise (Y03/Y06).
  if p_action = 'desistir' then
    if p_worker_id is distinct from public.my_worker_id() then
      raise exception using errcode = 'BC401', message = 'Essa candidatura não é sua.';
    end if;
    perform public.application_step(v_app.id, 'desistir', 'trabalhador', v_reason);
    perform public.job_reopen_auto_rejected(p_job_id, 'vaga_reaberta');
    perform public.notify(null, v_job.company_id, 'desistencia',
      coalesce(nullif(public.first_name(v_worker), ''), 'O trabalhador') || ' não vai poder ir',
      v_title || case when public.job_is_open(v_job)
                      then ': a vaga voltou a ficar aberta no mural.'
                      else ': a vaga já estava encerrada e não volta para o mural.' end ||
      ' Motivo: ' || coalesce(v_reason, 'não informado') || '.',
      '/vaga-gerenciar/' || p_job_id);
    return;
  end if;

  if v_job.company_id is distinct from public.my_company_id() then
    raise exception using errcode = 'BC401', message = 'Só a construtora da vaga pode decidir os candidatos.';
  end if;

  if p_action = 'analisar' then
    if v_app.status <> 'enviada' then return; end if;  -- nada a mudar: silencioso
    perform public.application_step(v_app.id, 'analisar', 'construtora');
    perform public.notify(p_worker_id, null, 'candidatura_em_analise', 'Candidatura em análise',
      v_company || ' está avaliando seu perfil para ' || v_title || '.', '/vaga/' || p_job_id);

  elsif p_action = 'aprovar' then
    if v_job.deleted_at is not null or v_job.closed then
      raise exception using errcode = 'BC409', message = 'Essa vaga já foi encerrada.';
    end if;
    v_holding := public.job_holding(p_job_id);
    if v_holding >= v_job.slots then
      raise exception using errcode = 'BC409', message = 'As vagas desse bico já foram preenchidas.';
    end if;
    perform public.application_step(v_app.id, 'aprovar', 'construtora');
    perform public.notify(p_worker_id, null, 'pre_selecionado', 'Você foi pré-selecionado',
      v_company || ' quer falar com você sobre ' || v_title || '. O WhatsApp está liberado.',
      '/selecionado/' || p_job_id);
    if v_holding + 1 >= v_job.slots then
      for r in
        select id, worker_id from public.applications
         where job_id = p_job_id and status in ('enviada', 'em_analise')
      loop
        perform public.application_step(r.id, 'recusar', 'sistema', 'vaga_preenchida');
        perform public.notify(r.worker_id, null, 'nao_selecionado', 'Não foi dessa vez',
          'As vagas de ' || v_title || ' na ' || v_company || ' foram preenchidas.', '/vaga/' || p_job_id);
      end loop;
    end if;

  elsif p_action = 'recusar' then
    perform public.application_step(v_app.id, 'recusar', 'construtora');
    perform public.notify(p_worker_id, null, 'nao_selecionado', 'Não foi dessa vez',
      v_company || ' escolheu outro candidato para ' || v_title || '.', '/vaga/' || p_job_id);

  elsif p_action = 'desfazer_aprovacao' then
    if v_job.closed or v_job.deleted_at is not null then
      raise exception using errcode = 'BC409',
        message = 'Essa vaga já foi encerrada. Não dá para desfazer a aprovação; cancele, se precisar.';
    end if;
    perform public.application_step(v_app.id, 'desfazer_aprovacao', 'construtora');
    perform public.job_reopen_auto_rejected(p_job_id, 'aprovacao_desfeita');
    -- O aviso de pré-seleção sai, se o trabalhador ainda não viu; se já viu, ele recebe a correção.
    delete from public.notifications
     where kind = 'pre_selecionado' and worker_id = p_worker_id
       and target = '/selecionado/' || p_job_id and read_at is null;
    get diagnostics v_taken_back = row_count;
    if v_taken_back = 0 then
      perform public.notify(p_worker_id, null, 'candidatura_em_analise', 'Sua candidatura voltou para análise',
        v_company || ' ainda está decidindo sobre ' || v_title || '. Aguarde o retorno.', '/vaga/' || p_job_id);
    end if;

  elsif p_action = 'contratar' then
    perform public.application_step(v_app.id, 'contratar', 'construtora');
    perform public.notify(p_worker_id, null, 'contratado', 'Contratação confirmada',
      v_company || ' confirmou você para ' || v_title || '.', '/selecionado/' || p_job_id);

  elsif p_action = 'cancelar_contratacao' then
    perform public.application_step(v_app.id, 'cancelar_contratacao', 'construtora', v_reason);
    perform public.job_reopen_auto_rejected(p_job_id, 'vaga_reaberta');
    perform public.notify(p_worker_id, null, 'contratacao_cancelada', 'Contratação cancelada',
      v_company || ' cancelou ' || v_title || '. Motivo: ' || coalesce(v_reason, 'não informado') || '.',
      '/vaga/' || p_job_id);

  elsif p_action = 'concluir' then
    if v_app.status = 'contratado' and not public.job_started(v_job) then
      raise exception using errcode = 'BC409', message = 'Só dá para concluir a diária a partir do dia do bico.';
    end if;
    perform public.application_conclude(v_app.id, 'construtora');

  elsif p_action = 'marcar_falta' then
    if v_app.status = 'contratado' and not public.job_started(v_job) then
      raise exception using errcode = 'BC409', message = 'Só dá para marcar falta a partir do dia do bico.';
    end if;
    perform public.application_step(v_app.id, 'marcar_falta', 'construtora');
    perform public.job_reopen_auto_rejected(p_job_id, 'vaga_reaberta');
    perform public.notify(p_worker_id, null, 'nao_compareceu', 'Falta registrada',
      v_company || ' registrou que você não foi em ' || v_title ||
      '. Fale com a construtora se foi um engano.', '/vaga/' || p_job_id);

  else
    raise exception using errcode = 'BC422', message = 'Ação desconhecida.';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------------------------------
-- Vagas: os limites usam as posições ocupadas com "concluída" (Y02)
-- ---------------------------------------------------------------------------------------------------

create or replace function public.boost_blocker(p_job public.jobs)
returns text language sql stable security definer set search_path = public as $$
  select case
    when p_job.company_id is distinct from public.my_company_id() then 'Só a construtora da vaga pode impulsionar.'
    when not public.job_is_open(p_job) or public.job_holding(p_job.id) >= p_job.slots
      then 'Só dá para impulsionar uma vaga aberta.'
    when p_job.boost_ends_at > now() then 'Essa vaga já está impulsionada.'
  end
$$;

-- Excluir o anúncio (Y08): só sem gente escolhida ou contratada. Quem esperava vira "não selecionado"
-- e é avisado; a vaga sai do mural e fica encerrada.
create or replace function public.delete_job(p_job_id text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_job public.jobs := public.own_job_for_update(p_job_id);
  v_company text;
  r record;
begin
  if v_job.deleted_at is not null then return; end if;
  if exists (select 1 from public.applications
              where job_id = p_job_id and status in ('pre_selecionado', 'contratado')) then
    raise exception using errcode = 'BC409',
      message = 'Essa vaga tem gente escolhida ou contratada. Encerre a vaga em vez de excluir.';
  end if;
  select name into v_company from public.companies where id = v_job.company_id;
  update public.applications set auto_rejected = false where job_id = p_job_id and auto_rejected;
  for r in
    select id, worker_id from public.applications
     where job_id = p_job_id and status in ('enviada', 'em_analise')
  loop
    perform public.application_step(r.id, 'recusar', 'sistema', 'vaga_removida');
    perform public.notify(r.worker_id, null, 'nao_selecionado', 'Vaga removida',
      v_company || ' removeu ' || public.job_title(v_job) || '. Tem outros bicos no mural.', '/mural');
  end loop;
  update public.jobs
     set closed = true,
         sem_contratacao = sem_contratacao or not exists (
           select 1 from public.applications where job_id = p_job_id and status = 'concluida'),
         deleted_at = now()
   where id = p_job_id;
end;
$$;

-- ---------------------------------------------------------------------------------------------------
-- Excluir a conta (LGPD). Exige login recente: o app confere a senha logo antes (entrar de novo
-- renova o horário do login no token). O resto como antes, numa transação.
-- ---------------------------------------------------------------------------------------------------

-- Quando a sessão fez login pela última vez (o `amr` do token do Supabase Auth).
create or replace function public.session_authenticated_at()
returns timestamptz language sql stable set search_path = public as $$
  select to_timestamp(max((x->>'timestamp')::bigint))
    from jsonb_array_elements(coalesce(auth.jwt()->'amr', '[]'::jsonb)) x
   where x ? 'timestamp'
$$;

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

  if v_account.role = 'trabalhador' then
    perform public.conclude_finished_jobs(v_account.worker_id, null);
    if not p_confirm_commitments and exists (
      select 1 from public.applications
       where worker_id = v_account.worker_id and status in ('pre_selecionado', 'contratado')) then
      raise exception using errcode = 'BC409', message = 'Confirme o que acontece com os bicos em andamento antes de excluir.';
    end if;
    for r in
      select a.id as app_id, j.id as job_id, j.company_id, public.job_title(j) as title
        from public.applications a join public.jobs j on j.id = a.job_id
       where a.worker_id = v_account.worker_id and a.status in ('pre_selecionado', 'contratado')
    loop
      perform public.application_step(r.app_id, 'desistir', 'trabalhador', v_reason);
      perform public.job_reopen_auto_rejected(r.job_id, 'vaga_reaberta');
      perform public.notify(null, r.company_id, 'desistencia', 'Um trabalhador saiu da Bicos',
        'Ele não vai mais em ' || r.title || '. Confira a vaga.', '/vaga-gerenciar/' || r.job_id);
    end loop;
    delete from public.applications where worker_id = v_account.worker_id and status in ('enviada', 'em_analise');
    delete from public.worker_posts where worker_id = v_account.worker_id;
    delete from public.notifications where worker_id = v_account.worker_id;
    delete from public.saved_jobs where worker_id = v_account.worker_id;
    update public.reviews set author_label = 'Conta excluída'
     where direction = 'para_construtora'
       and application_id in (select id from public.applications where worker_id = v_account.worker_id);
    update public.workers
       set name = 'Conta excluída', initials = '–', whatsapp = '', specialties = '{}', facts = '{}',
           neighborhood = null, photo_url = null, cover_url = null
     where id = v_account.worker_id;
  else
    perform public.conclude_finished_jobs(null, v_account.company_id);
    if not p_confirm_commitments and exists (
      select 1 from public.applications a join public.jobs j on j.id = a.job_id
       where j.company_id = v_account.company_id and not j.closed and j.deleted_at is null
         and a.status in ('pre_selecionado', 'contratado')) then
      raise exception using errcode = 'BC409', message = 'Confirme o que acontece com os bicos em andamento antes de excluir.';
    end if;
    for r in
      select a.id as app_id, a.worker_id, public.job_title(j) as title
        from public.applications a join public.jobs j on j.id = a.job_id
       where j.company_id = v_account.company_id and a.status in ('pre_selecionado', 'contratado')
    loop
      perform public.application_step(r.app_id, 'cancelar_contratacao', 'construtora', v_reason);
      perform public.notify(r.worker_id, null, 'contratacao_cancelada', 'Contratação cancelada',
        'A construtora de ' || r.title || ' saiu da Bicos e o bico foi cancelado.', '/minhas-candidaturas');
    end loop;
    for v_job in
      select * from public.jobs where company_id = v_account.company_id and not closed and deleted_at is null
    loop
      update public.jobs set closed = true, sem_contratacao = true where id = v_job.id;
      perform public.job_close_applications(v_job);
    end loop;
    delete from public.notifications where company_id = v_account.company_id;
    update public.reviews set author_label = 'Construtora (conta excluída)'
     where direction = 'para_trabalhador'
       and application_id in (
         select a.id from public.applications a join public.jobs j on j.id = a.job_id
          where j.company_id = v_account.company_id);
    update public.companies
       set name = 'Construtora (conta excluída)', whatsapp = '', cnpj = null, logo_url = null, cover_url = null
     where id = v_account.company_id;
  end if;

  -- A conta de acesso por último, na mesma transação: se algo acima falhar, nada fica pela metade.
  -- Marcar o perfil como completo impede o gatilho de limpeza de cadastro abandonado de apagar o perfil
  -- anonimizado, que o histórico do outro lado ainda usa.
  update public.accounts set profile_completed_at = coalesce(profile_completed_at, now()) where id = v_account.id;
  delete from auth.users where id = v_account.id;
end;
$$;

-- ---------------------------------------------------------------------------------------------------
-- Storage: a construtora apaga as fotos da própria vaga
-- ---------------------------------------------------------------------------------------------------

drop policy if exists "Construtora remove foto da própria vaga" on storage.objects;
create policy "Construtora remove foto da própria vaga"
  on storage.objects for delete to authenticated
  using (bucket_id = 'vagas' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------------------------------------------
-- Quem pode chamar o quê
-- ---------------------------------------------------------------------------------------------------

revoke all on function
  public.job_holding(text), public.job_is_open(public.jobs), public.job_started(public.jobs),
  public.job_reopen_auto_rejected(text, text), public.job_stats(text[]),
  public.cleanup_unconfirmed_profile_v2(), public.submit_application(text), public.withdraw_application(text),
  public.transition_application(text, uuid, text, text), public.boost_blocker(public.jobs),
  public.delete_job(text), public.session_authenticated_at(), public.delete_my_account(boolean)
from public, anon, authenticated;

grant execute on function
  public.job_stats(text[]), public.submit_application(text), public.withdraw_application(text),
  public.transition_application(text, uuid, text, text), public.delete_job(text),
  public.delete_my_account(boolean)
to authenticated;
