-- GERADO por scripts/aplicar-tudo.mjs — não edite à mão. Ordem e conferências em APLICAR.md.
-- 48 migrations (20261010000100_z01_rpcs_candidatura.sql … 20261019000100_u01_vaga_simples.sql).
-- Cole tudo no SQL Editor do Supabase e rode. Cada migration é idempotente: rodar de novo não estraga nada.

-- Parte 1: valores novos de enum (precisam estar gravados antes do resto).
begin;
alter type public.payment_status add value if not exists 'cancelado';
alter type public.payment_status add value if not exists 'reembolso_pendente';
alter type public.application_status add value if not exists 'expirada';
alter type public.notification_kind add value if not exists 'verificacao';
alter type public.notification_kind add value if not exists 'bico_novo';
alter type public.notification_kind add value if not exists 'confirmar_presenca';
alter type public.notification_kind add value if not exists 'convite';
alter type public.application_status add value if not exists 'cancelado_pela_equipe';
commit;

-- Parte 2: as migrations, numa transação só.
begin;

-- ===== 20261010000100_z01_rpcs_candidatura.sql =====
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

-- ===== 20261010000200_z02_pagamentos.sql =====
-- Z02 (+ Y13) — Impulsionar só com pagamento de verdade.
--
-- Antes: qualquer conta logada chamava simulate_pix_paid (confirmava o PIX) e pay_with_card (aprovava
-- qualquer cartão sem cobrar); o código PIX gerado no banco não era pagável. Agora:
--   * as funções de simulação deixam de existir no banco (a simulação fica só no modo de demonstração);
--   * a cobrança nasce na Edge Function `criar-cobranca`, que fala com o provedor (Mercado Pago) e
--     grava o pagamento pelas funções abaixo, como service_role;
--   * só a Edge Function `webhook-pagamento` (service_role) confirma, depois de conferir a assinatura e
--     o status do pagamento direto no provedor; a confirmação é idempotente (payment_webhook_events);
--   * Y13: um só pagamento aguardando por vaga (gerar outro cancela o anterior); o prazo soma a partir
--     de max(boost_ends_at, agora); a confirmação revalida a vaga e, se ela não puder mais ser
--     impulsionada, o pagamento fica "reembolso_pendente" (e a construtora é avisada).
-- Idempotente.

alter type public.payment_status add value if not exists 'cancelado';
alter type public.payment_status add value if not exists 'reembolso_pendente';

alter table public.boost_payments
  add column if not exists provider text,
  add column if not exists provider_payment_id text,
  add column if not exists pix_qr_base64 text,
  add column if not exists status_detail text,
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists boost_payments_provider_id_key
  on public.boost_payments (provider, provider_payment_id) where provider_payment_id is not null;
create unique index if not exists boost_payments_one_pending_per_job
  on public.boost_payments (job_id) where status = 'aguardando';
create index if not exists boost_payments_job_idx on public.boost_payments (job_id);

-- Cada aviso do provedor, uma vez só (o provedor reenvia até receber 200).
create table if not exists public.payment_webhook_events (
  id bigint generated always as identity primary key,
  provider text not null,
  event_id text not null,
  provider_payment_id text,
  received_at timestamptz not null default now(),
  result text,
  unique (provider, event_id)
);
alter table public.payment_webhook_events enable row level security;
revoke all on table public.payment_webhook_events from anon, authenticated;

-- ---------------------------------------------------------------------------------------------------
-- Fora: a simulação e o PIX de mentira
-- ---------------------------------------------------------------------------------------------------

drop function if exists public.simulate_pix_paid(uuid);
drop function if exists public.pay_with_card(text, public.boost_plan, text);
drop function if exists public.start_pix_payment(text, public.boost_plan);

-- ---------------------------------------------------------------------------------------------------
-- Planos: o "24h + aviso por WhatsApp" sai até o envio existir (Z03)
-- ---------------------------------------------------------------------------------------------------

create or replace function public.boost_plan_cents(p_plan public.boost_plan)
returns integer language sql immutable set search_path = public as $$
  select case p_plan when '24h' then 1200 when '3d' then 2800 end
$$;

create or replace function public.boost_plan_hours(p_plan public.boost_plan)
returns integer language sql immutable set search_path = public as $$
  select case p_plan when '24h' then 24 when '3d' then 72 end
$$;

-- ---------------------------------------------------------------------------------------------------
-- A Edge Function criar-cobranca: abre o pagamento (em nome da conta, conferida pelo token) e, depois
-- de falar com o provedor, grava o que ele devolveu.
-- ---------------------------------------------------------------------------------------------------

create or replace function public.begin_boost_payment(
  p_account uuid, p_job_id text, p_plan public.boost_plan, p_method public.payment_method
) returns public.boost_payments language plpgsql security definer set search_path = public as $$
declare
  v_company uuid := (select company_id from public.accounts where id = p_account);
  v_job public.jobs;
  v_pay public.boost_payments;
  v_blocker text;
begin
  if v_company is null then
    raise exception using errcode = 'BC401', message = 'Só a conta de construtora pode impulsionar.';
  end if;
  if public.boost_plan_cents(p_plan) is null then
    raise exception using errcode = 'BC422', message = 'Escolha um dos planos.';
  end if;
  select * into v_job from public.jobs where id = p_job_id for update;
  if not found then
    raise exception using errcode = 'BC404', message = 'Essa vaga não existe mais.';
  end if;
  v_blocker := case
    when v_job.company_id is distinct from v_company then 'Só a construtora da vaga pode impulsionar.'
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

create or replace function public.attach_boost_charge(
  p_payment_id uuid, p_provider_payment_id text, p_pix_code text, p_pix_qr_base64 text,
  p_expires_at timestamptz, p_card_last4 text
) returns public.boost_payments language plpgsql security definer set search_path = public as $$
declare
  v_pay public.boost_payments;
begin
  update public.boost_payments
     set provider_payment_id = p_provider_payment_id,
         pix_code = coalesce(p_pix_code, pix_code),
         pix_qr_base64 = coalesce(p_pix_qr_base64, pix_qr_base64),
         expires_at = coalesce(p_expires_at, expires_at),
         card_last4 = coalesce(p_card_last4, card_last4),
         updated_at = now()
   where id = p_payment_id
  returning * into v_pay;
  if not found then
    raise exception using errcode = 'BC404', message = 'Esse pagamento não existe.';
  end if;
  return v_pay;
end;
$$;

-- O provedor recusou, cancelou ou o PIX venceu.
create or replace function public.fail_boost_payment(
  p_payment_id uuid, p_status public.payment_status, p_detail text default null
) returns public.boost_payments language plpgsql security definer set search_path = public as $$
declare
  v_pay public.boost_payments;
begin
  select * into v_pay from public.boost_payments where id = p_payment_id for update;
  if not found then
    raise exception using errcode = 'BC404', message = 'Esse pagamento não existe.';
  end if;
  if v_pay.status <> 'aguardando' or p_status not in ('recusado', 'expirado', 'cancelado') then
    return v_pay;
  end if;
  update public.boost_payments set status = p_status, status_detail = p_detail, updated_at = now()
   where id = p_payment_id returning * into v_pay;
  return v_pay;
end;
$$;

-- Pagamento aprovado pelo provedor. Idempotente: confirmar de novo não muda nada.
create or replace function public.confirm_boost_payment(p_payment_id uuid)
returns public.boost_payments language plpgsql security definer set search_path = public as $$
declare
  v_pay public.boost_payments;
  v_job public.jobs;
  v_ends timestamptz;
begin
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
$$;

-- O app lê o pagamento (a tela do PIX atualiza sozinha). Um PIX vencido aparece como vencido.
create or replace function public.get_payment(p_payment_id uuid)
returns public.boost_payments language plpgsql security definer set search_path = public as $$
declare
  v_pay public.boost_payments;
begin
  update public.boost_payments set status = 'expirado', updated_at = now()
   where id = p_payment_id and status = 'aguardando' and expires_at <= now()
     and company_id = public.my_company_id();
  select * into v_pay from public.boost_payments
   where id = p_payment_id and company_id = public.my_company_id();
  if not found then
    raise exception using errcode = 'BC404', message = 'Esse pagamento não existe.';
  end if;
  return v_pay;
end;
$$;

-- ---------------------------------------------------------------------------------------------------
-- Quem pode chamar o quê: o app só lê o próprio pagamento; o resto é das Edge Functions.
-- ---------------------------------------------------------------------------------------------------

revoke all on function
  public.begin_boost_payment(uuid, text, public.boost_plan, public.payment_method),
  public.attach_boost_charge(uuid, text, text, text, timestamptz, text),
  public.fail_boost_payment(uuid, public.payment_status, text),
  public.confirm_boost_payment(uuid), public.get_payment(uuid),
  public.boost_plan_cents(public.boost_plan), public.boost_plan_hours(public.boost_plan)
from public, anon, authenticated;

grant execute on function
  public.begin_boost_payment(uuid, text, public.boost_plan, public.payment_method),
  public.attach_boost_charge(uuid, text, text, text, timestamptz, text),
  public.fail_boost_payment(uuid, public.payment_status, text),
  public.confirm_boost_payment(uuid)
to service_role;
grant execute on function public.get_payment(uuid) to authenticated;

-- ===== 20261010000300_z07_documento_login.sql =====
-- Z07 — Ninguém descobre quem tem conta pelo CPF/CNPJ.
--   * document_available deixa de ser chamável pelo app (visitante ou logado): era um oráculo grátis.
--   * O cadastro confere o documento dentro da própria criação da conta (gatilho do Auth). Documento de
--     conta confirmada: o cadastro falha e o app mostra uma mensagem genérica. Documento preso num
--     cadastro nunca confirmado: o cadastro antigo é liberado (o que reiniciar_cadastro_pendente_* fazia,
--     mas só dentro de um cadastro de verdade, com captcha e o limite do Auth).
--   * Entrar com CPF/CNPJ: a Edge Function confere a senha aqui (document_login_email) e só então devolve
--     o e-mail da própria conta; o navegador entra com e-mail e senha (do IP de quem está entrando).
--     Uma resposta só para "não existe" e "senha errada", e limite de tentativas por documento e por IP
--     (auth_attempts).
-- Idempotente.

revoke all on function public.document_available(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------
-- Limite de tentativas
-- ---------------------------------------------------------------------------------------------------

create table if not exists public.auth_attempts (
  id bigint generated always as identity primary key,
  key text not null,
  at timestamptz not null default now()
);
create index if not exists auth_attempts_key_at_idx on public.auth_attempts (key, at desc);
alter table public.auth_attempts enable row level security;
revoke all on table public.auth_attempts from anon, authenticated;

-- Registra uma tentativa e diz se passou do limite (mais de p_max na janela).
create or replace function public.rate_limit_hit(p_key text, p_max integer, p_window interval)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  n integer;
begin
  insert into public.auth_attempts (key) values (p_key);
  select count(*) into n from public.auth_attempts where key = p_key and at > now() - p_window;
  return n > p_max;
end;
$$;

-- Limpeza diária das tentativas antigas.
create or replace function public.purge_auth_attempts()
returns integer language sql security definer set search_path = public as $$
  with x as (delete from public.auth_attempts where at < now() - interval '1 day' returning 1)
  select count(*)::int from x
$$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'bicos-limpar-tentativas';
    perform cron.schedule('bicos-limpar-tentativas', '17 4 * * *', 'select public.purge_auth_attempts()');
  end if;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- Entrar com CPF/CNPJ: o e-mail da conta só sai com a senha certa
-- ---------------------------------------------------------------------------------------------------

create or replace function public.document_login_email(p_document text, p_password text)
returns text language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_hash text := public.document_hash(p_document);
  v_user auth.users;
begin
  select u.* into v_user from public.accounts a join auth.users u on u.id = a.id where a.document_hash = v_hash;
  if v_user.id is null then
    -- Conta do app antigo ainda sem conta nova (o hash do documento é o mesmo).
    select u.* into v_user from public.profiles p join auth.users u on u.id = p.id
     where p.documento_hash = v_hash
     order by u.email_confirmed_at desc nulls last limit 1;
  end if;
  if v_user.id is null or v_user.encrypted_password is null or v_user.encrypted_password = ''
     or extensions.crypt(coalesce(p_password, ''), v_user.encrypted_password) <> v_user.encrypted_password then
    return null;
  end if;
  return v_user.email;
end;
$$;

-- ---------------------------------------------------------------------------------------------------
-- O cadastro confere o documento (dentro do gatilho do Auth)
-- ---------------------------------------------------------------------------------------------------

create or replace function public.claim_document_for(p_user_id uuid, p_digits text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  v_hash text := public.document_hash(p_digits);
  r record;
begin
  -- Contas do app novo com o mesmo documento.
  for r in
    select a.id, u.email_confirmed_at from public.accounts a join auth.users u on u.id = a.id
     where a.document_hash = v_hash and a.id <> p_user_id
  loop
    if r.email_confirmed_at is not null then
      raise exception using errcode = 'BC409', message = 'Documento já cadastrado.';
    end if;
    delete from auth.users where id = r.id;  -- cadastro nunca confirmado: libera o documento
  end loop;
  -- Perfis do app antigo com o mesmo documento.
  for r in
    select p.id, u.email_confirmed_at from public.profiles p join auth.users u on u.id = p.id
     where p.documento_hash = v_hash and p.id <> p_user_id
  loop
    if r.email_confirmed_at is not null then
      raise exception using errcode = 'BC409', message = 'Documento já cadastrado.';
    end if;
    delete from auth.users where id = r.id;
  end loop;
end;
$$;

-- Antes de o Auth gravar a conta (e antes do gatilho do app antigo, que recusaria o documento repetido
-- com um erro de chave única): libera o documento de cadastro nunca confirmado ou recusa o cadastro.
create or replace function public.claim_document_v2()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_digits text := regexp_replace(coalesce(new.raw_user_meta_data->>'documento', ''), '[^0-9]', '', 'g');
begin
  if length(v_digits) > 0 then
    perform public.claim_document_for(new.id, v_digits);
  end if;
  return new;
end;
$$;

drop trigger if exists before_auth_user_created_v2 on auth.users;
create trigger before_auth_user_created_v2
  before insert on auth.users
  for each row execute function public.claim_document_v2();

create or replace function public.create_account_for(
  p_user_id uuid, p_email text, p_role public.app_role, p_name text, p_document text, p_whatsapp text,
  p_terms_version text, p_email_confirmed_at timestamptz
) returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  v_digits text := regexp_replace(coalesce(p_document, ''), '[^0-9]', '', 'g');
  v_phone text := regexp_replace(coalesce(p_whatsapp, ''), '[^0-9]', '', 'g');
  v_key text;
  v_name text := coalesce(nullif(btrim(p_name), ''), split_part(p_email, '@', 1));
begin
  if exists (select 1 from public.accounts where id = p_user_id) then return; end if;
  if length(v_digits) > 0 then
    perform public.claim_document_for(p_user_id, v_digits);
  end if;

  if p_role = 'trabalhador' then
    insert into public.workers (id, name, initials, whatsapp, city, lat, lon)
    values (p_user_id, v_name, public.initials_of(v_name), v_phone, 'São Paulo, SP', -23.5505, -46.6333)
    on conflict (id) do nothing;
  else
    -- Y16: o campo público "CNPJ" da empresa só recebe CNPJ (14 dígitos), nunca o CPF de quem recruta.
    insert into public.companies (id, name, cnpj, whatsapp, location)
    values (p_user_id, v_name, case when length(v_digits) = 14 then public.mask_document(v_digits) end,
            v_phone, 'São Paulo, SP')
    on conflict (id) do nothing;
  end if;

  if length(v_digits) > 0 then
    select decrypted_secret into v_key from vault.decrypted_secrets where name = 'nivotech_documento_key';
  end if;

  insert into public.accounts (
    id, email, role, document, document_hash, document_cipher, whatsapp, email_confirmed_at,
    terms_version, worker_id, company_id
  ) values (
    p_user_id, p_email, p_role, public.mask_document(v_digits),
    case when length(v_digits) > 0 then public.document_hash(v_digits) end,
    case when length(v_digits) > 0 and v_key is not null then extensions.pgp_sym_encrypt(v_digits, v_key) end,
    v_phone, p_email_confirmed_at, coalesce(p_terms_version, ''),
    case when p_role = 'trabalhador' then p_user_id end,
    case when p_role = 'recrutador' then p_user_id end
  );

  if nullif(p_terms_version, '') is not null and exists (select 1 from public.profiles where id = p_user_id) then
    insert into public.consentimentos (usuario_id, documento, versao)
    select p_user_id, d, p_terms_version
      from unnest(array['termos_de_uso', 'politica_privacidade']) d
     where not exists (
       select 1 from public.consentimentos c
        where c.usuario_id = p_user_id and c.documento = d and c.versao = p_terms_version
     );
  end if;
end;
$$;

revoke all on function
  public.rate_limit_hit(text, integer, interval), public.purge_auth_attempts(),
  public.document_login_email(text, text), public.claim_document_for(uuid, text), public.claim_document_v2(),
  public.create_account_for(uuid, text, public.app_role, text, text, text, text, timestamptz)
from public, anon, authenticated;
grant execute on function
  public.rate_limit_hit(text, integer, interval), public.document_login_email(text, text),
  public.document_available(text)
to service_role;

-- ===== 20261010000400_z08_app_antigo.sql =====
-- Z08 — O app antigo (pasta app/) é desligado; as funções e tabelas dele, abertas a visitantes no mesmo
-- banco, são fechadas. Os dados continuam lá (o app novo lê o que precisa por funções do próprio banco:
-- contas antigas, documento cifrado, consentimentos).
--
-- Antes: reiniciar_cadastro_pendente_email/_documento aceitavam visitante (apagavam o cadastro pendente
-- de outra pessoa e revelavam CPFs com cadastro); excluir_minha_conta apagava a conta sem anonimizar nem
-- cancelar bicos; limpar_cadastros_nao_confirmados podia ser chamada por qualquer um; a política
-- "Editar o próprio perfil" deixava gravar documento_hash/documento_cifrado/tipo.
-- Idempotente.

do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.proname in (
         'reiniciar_cadastro_pendente_email', 'reiniciar_cadastro_pendente_documento', 'excluir_minha_conta',
         'limpar_cadastros_nao_confirmados', 'salvar_documento', 'meu_documento', 'meu_tipo', 'perfil_publico',
         'email_verificado', 'exportar_meus_dados', 'buscar_construtoras', 'decidir_candidatura',
         'concluir_candidatura', 'contato_whatsapp', 'fechar_vaga', 'postar_avaliacao',
         'criar_perfil_ao_cadastrar', 'impedir_troca_de_tipo', 'travar_autor_da_vaga', 'expirar_vagas_vencidas',
         'rls_auto_enable')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;

-- As tabelas do app antigo: ninguém lê nem grava direto (perfis com e-mail e documento cifrado inclusive).
do $$
declare
  t text;
begin
  foreach t in array array['profiles', 'vagas', 'candidaturas', 'avaliacoes', 'vagas_salvas',
                           'publicacoes_trabalhador', 'consentimentos']
  loop
    if to_regclass('public.' || t) is not null then
      execute format('revoke all on table public.%I from anon, authenticated', t);
    end if;
  end loop;
end $$;

-- Cadastro nunca confirmado: o app antigo apagava depois de 2 horas (o e-mail de confirmação pode chegar
-- depois disso). Agora: 7 dias.
create or replace function public.purge_unconfirmed_signups()
returns integer language sql security definer set search_path = public as $$
  with x as (
    delete from auth.users
     where email_confirmed_at is null and created_at < now() - interval '7 days'
    returning 1
  ) select count(*)::int from x
$$;
revoke all on function public.purge_unconfirmed_signups() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job
     where jobname in ('limpar-cadastros-nao-confirmados', 'expirar-vagas-diario', 'bicos-limpar-cadastros');
    perform cron.schedule('bicos-limpar-cadastros', '23 3 * * *', 'select public.purge_unconfirmed_signups()');
  end if;
end $$;

-- ===== 20261010000500_z09_cpf_metadados.sql =====
-- Z09 — O CPF/CNPJ não fica em texto puro nos metadados do Auth (auth.users.raw_user_meta_data).
-- O cadastro manda o documento nos metadados (é o único jeito de o gatilho recebê-lo junto com a conta).
-- Agora o gatilho que roda antes de gravar a conta tira o documento dos metadados e o guarda só durante a
-- transação (configuração local); o gatilho seguinte cifra e grava em accounts. O documento nunca chega a
-- ser gravado em auth.users. As contas que já existiam têm a chave removida.
-- Idempotente.

create or replace function public.claim_document_v2()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_digits text := regexp_replace(coalesce(new.raw_user_meta_data->>'documento', ''), '[^0-9]', '', 'g');
begin
  if length(v_digits) > 0 then
    perform public.claim_document_for(new.id, v_digits);
  end if;
  -- Só nesta transação (o cadastro): handle_new_user_v2 lê e apaga.
  perform set_config('bicos.cadastro_documento', v_digits, true);
  new.raw_user_meta_data := coalesce(new.raw_user_meta_data, '{}'::jsonb) - 'documento';
  return new;
end;
$$;

create or replace function public.handle_new_user_v2()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_document text := coalesce(nullif(m->>'documento', ''), nullif(current_setting('bicos.cadastro_documento', true), ''));
  v_role public.app_role := case
    when m->>'role' in ('trabalhador', 'recrutador') then (m->>'role')::public.app_role
    when m->>'tipo' = 'pedreiro' then 'trabalhador'
    when m->>'tipo' = 'construtora' then 'recrutador'
  end;
begin
  perform set_config('bicos.cadastro_documento', '', true);
  -- Sem lado definido (ex.: login com Google): a conta nasce depois, em "Escolher perfil".
  if v_role is null then return new; end if;
  perform public.create_account_for(
    new.id, new.email, v_role, m->>'nome', v_document, m->>'whatsapp', m->>'terms_version',
    new.email_confirmed_at
  );
  return new;
end;
$$;

revoke all on function public.claim_document_v2(), public.handle_new_user_v2() from public, anon, authenticated;

-- As contas que já existem: o documento já está cifrado (accounts.document_cipher ou, nas antigas,
-- profiles.documento_cifrado). Tira a cópia em texto puro dos metadados.
update auth.users
   set raw_user_meta_data = raw_user_meta_data - 'documento'
 where raw_user_meta_data ? 'documento';

-- ===== 20261010000600_z06_endereco.sql =====
-- Z06 — O endereço da obra é só de quem está no bico.
-- Antes: rua, número, complemento, CEP e as coordenadas exatas saíam para qualquer conta logada, antes de
-- qualquer aprovação. Agora:
--   * select direto em jobs mostra bairro, cidade, UF e um ponto aproximado (area_lat/area_lon: as
--     coordenadas arredondadas em 2 casas, ~1 km) — o bastante para "X km de você" e o filtro de raio;
--   * o endereço completo e o ponto exato saem só por get_job_addresses, para a construtora dona e para o
--     trabalhador pré-selecionado ou contratado naquela vaga.
-- Idempotente.

alter table public.jobs
  add column if not exists area_lat double precision generated always as (round(lat::numeric, 2)::double precision) stored,
  add column if not exists area_lon double precision generated always as (round(lon::numeric, 2)::double precision) stored;

revoke select on public.jobs from authenticated, anon;
grant select (
  id, company_id, oficio_id, title, pay, neighborhood, city, uf, area_lat, area_lon, date_to_arrange,
  start_date, end_date, start_time, end_time, diarias, dias, urgent, boost_ends_at, photos, slots, closed,
  sem_contratacao, description, requirements, created_at, updated_at, deleted_at
) on public.jobs to authenticated;

create or replace function public.get_job_addresses(p_job_ids text[])
returns table (
  job_id text, cep text, street text, number text, complement text, neighborhood text, city text, uf text,
  lat double precision, lon double precision
) language sql stable security definer set search_path = public as $$
  select j.id, j.cep, j.street, j.number, j.complement, j.neighborhood, j.city, j.uf, j.lat, j.lon
    from public.jobs j
   where j.id = any (p_job_ids)
     and (
       j.company_id = public.my_company_id()
       or exists (
         select 1 from public.applications a
          where a.job_id = j.id and a.worker_id = public.my_worker_id()
            and a.status in ('pre_selecionado', 'contratado')
       )
     )
$$;

revoke all on function public.get_job_addresses(text[]) from public, anon, authenticated;
grant execute on function public.get_job_addresses(text[]) to authenticated;

-- ===== 20261010000700_z12_fotos.sql =====
-- Z12 (+ X09) — Fotos de perfil, capa e logo salvas no Storage, e o banco só aceita imagens do próprio
-- Storage, na pasta de quem é dono.
--   * app_config.storage_public_base: o endereço público do Storage deste projeto (troque no staging);
--   * storage_url_ok(url, bucket, dono): a URL é deste projeto, do bucket certo e da pasta do dono;
--   * gatilhos em workers (photo_url, cover_url), companies (logo_url, cover_url), worker_posts
--     (media_url) e jobs (photos) recusam qualquer outra URL;
--   * Storage: ninguém lista arquivos (os buckets são públicos para abrir uma foto pelo endereço, sem
--     política de leitura que permita listar); cada conta só envia, troca e apaga na própria pasta; fotos
--     de vaga só por conta de construtora; limites de tamanho e tipo por bucket.
-- Idempotente.

create table if not exists public.app_config (
  key text primary key,
  value text not null
);
alter table public.app_config enable row level security;
revoke all on table public.app_config from anon, authenticated;

insert into public.app_config (key, value)
values ('storage_public_base', 'https://ppnxdajiihsjaojxokzh.supabase.co/storage/v1/object/public/')
on conflict (key) do nothing;

create or replace function public.storage_url_ok(p_url text, p_bucket text, p_owner uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_url is null or p_url = '' or (
    p_owner is not null
    and starts_with(p_url, (select value from public.app_config where key = 'storage_public_base') || p_bucket || '/' || p_owner::text || '/')
    and p_url !~ '\.\.'
  )
$$;

create or replace function public.check_profile_images_v2()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'workers' then
    if (new.photo_url is distinct from old.photo_url and not public.storage_url_ok(new.photo_url, 'avatars', new.id))
       or (new.cover_url is distinct from old.cover_url and not public.storage_url_ok(new.cover_url, 'avatars', new.id)) then
      raise exception using errcode = 'BC422', message = 'Essa foto não foi enviada pelo app. Escolha de novo.';
    end if;
  elsif tg_table_name = 'companies' then
    if (new.logo_url is distinct from old.logo_url and not public.storage_url_ok(new.logo_url, 'avatars', new.id))
       or (new.cover_url is distinct from old.cover_url and not public.storage_url_ok(new.cover_url, 'avatars', new.id)) then
      raise exception using errcode = 'BC422', message = 'Essa foto não foi enviada pelo app. Escolha de novo.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists check_worker_images_v2 on public.workers;
create trigger check_worker_images_v2 before update of photo_url, cover_url on public.workers
  for each row execute function public.check_profile_images_v2();
drop trigger if exists check_company_images_v2 on public.companies;
create trigger check_company_images_v2 before update of logo_url, cover_url on public.companies
  for each row execute function public.check_profile_images_v2();

create or replace function public.check_post_media_v2()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.storage_url_ok(new.media_url, 'portfolio', new.worker_id) then
    raise exception using errcode = 'BC422', message = 'Esse arquivo não foi enviado pelo app. Escolha de novo.';
  end if;
  return new;
end;
$$;
drop trigger if exists check_post_media_v2 on public.worker_posts;
create trigger check_post_media_v2 before insert or update of media_url on public.worker_posts
  for each row execute function public.check_post_media_v2();

create or replace function public.check_job_photos_v2()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  u text;
begin
  if tg_op = 'UPDATE' and new.photos is not distinct from old.photos then return new; end if;
  foreach u in array coalesce(new.photos, '{}') loop
    if not public.storage_url_ok(u, 'vagas', new.company_id) then
      raise exception using errcode = 'BC422', message = 'Essa foto não foi enviada pelo app. Escolha de novo.';
    end if;
  end loop;
  if cardinality(coalesce(new.photos, '{}')) > 8 then
    raise exception using errcode = 'BC422', message = 'Uma vaga tem até 8 fotos.';
  end if;
  return new;
end;
$$;
drop trigger if exists check_job_photos_v2 on public.jobs;
create trigger check_job_photos_v2 before insert or update of photos on public.jobs
  for each row execute function public.check_job_photos_v2();

revoke all on function
  public.storage_url_ok(text, text, uuid), public.check_profile_images_v2(), public.check_post_media_v2(),
  public.check_job_photos_v2()
from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------------------------------

update storage.buckets set file_size_limit = 10485760,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
 where id = 'avatars';
update storage.buckets set file_size_limit = 52428800,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm']
 where id = 'portfolio';
update storage.buckets set file_size_limit = 10485760,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
 where id = 'vagas';

-- Sem listagem: abrir a foto pelo endereço público não depende de política.
drop policy if exists "Avatar publico para leitura" on storage.objects;
drop policy if exists "Portfolio publico para leitura (storage)" on storage.objects;
drop policy if exists "Fotos de vaga públicas para leitura" on storage.objects;

-- Avatares e capas: cada conta na própria pasta (só contas logadas).
drop policy if exists "Cada um envia seu proprio avatar" on storage.objects;
drop policy if exists "Cada um atualiza seu proprio avatar" on storage.objects;
drop policy if exists "Cada um remove seu proprio avatar" on storage.objects;
create policy "Cada um envia seu proprio avatar" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Cada um atualiza seu proprio avatar" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Cada um remove seu proprio avatar" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Portfólio: só trabalhador, na própria pasta.
drop policy if exists "Cada um envia seu proprio portfolio" on storage.objects;
drop policy if exists "Cada um remove seu proprio portfolio" on storage.objects;
create policy "Cada um envia seu proprio portfolio" on storage.objects for insert to authenticated
  with check (bucket_id = 'portfolio' and (storage.foldername(name))[1] = (select auth.uid())::text
              and (select public.my_worker_id()) is not null);
create policy "Cada um remove seu proprio portfolio" on storage.objects for delete to authenticated
  using (bucket_id = 'portfolio' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Fotos de vaga: só construtora, na própria pasta.
drop policy if exists "Construtora envia foto da própria vaga" on storage.objects;
create policy "Construtora envia foto da própria vaga" on storage.objects for insert to authenticated
  with check (bucket_id = 'vagas' and (storage.foldername(name))[1] = (select auth.uid())::text
              and (select public.my_company_id()) is not null);

-- ===== 20261011000100_y01_y04_ciclo_vaga.sql =====
-- Y01 + Y04 — O ciclo da vaga sem becos sem saída.
--   Y01: vaga cheia continua editável e encerrável (update_job/close_job já aceitam; o limite de pessoas
--        conta quem concluiu); quando toda a equipe conclui, a vaga encerra sozinha e vai para o histórico.
--   Y04: vaga vencida não deixa candidatura presa — quem esperava vira "não selecionado" (vaga_vencida,
--        com aviso); pré-selecionado sem contratação vira "expirada" (aviso aos dois); a diária contratada é
--        concluída sozinha 2 dias depois do fim (dá tempo de marcar falta); vaga "a combinar" vence 30 dias
--        depois de publicada; sem ninguém para trabalhar, a vaga encerra.
-- Idempotente.

alter type public.application_status add value if not exists 'expirada';

create or replace function public.application_next_status(
  p_action text, p_from public.application_status, p_actor public.application_actor
) returns public.application_status language sql immutable set search_path = public as $$
  select (case
    when p_action = 'analisar' and p_from = 'enviada' and p_actor in ('construtora', 'sistema') then 'em_analise'
    when p_action = 'aprovar' and p_from in ('enviada', 'em_analise') and p_actor = 'construtora' then 'pre_selecionado'
    when p_action = 'recusar' and p_from in ('enviada', 'em_analise') and p_actor in ('construtora', 'sistema') then 'nao_selecionado'
    when p_action = 'desfazer_aprovacao' and p_from = 'pre_selecionado' and p_actor = 'construtora' then 'em_analise'
    when p_action = 'contratar' and p_from = 'pre_selecionado' and p_actor = 'construtora' then 'contratado'
    when p_action = 'desistir' and p_from in ('pre_selecionado', 'contratado') and p_actor = 'trabalhador' then 'desistiu'
    when p_action = 'cancelar_contratacao' and p_from in ('pre_selecionado', 'contratado') and p_actor = 'construtora' then 'cancelado_pela_construtora'
    when p_action = 'concluir' and p_from = 'contratado' and p_actor in ('construtora', 'sistema') then 'concluida'
    when p_action = 'marcar_falta' and p_from = 'contratado' and p_actor = 'construtora' then 'nao_compareceu'
    when p_action = 'expirar' and p_from = 'pre_selecionado' and p_actor = 'sistema' then 'expirada'
  end)::public.application_status
$$;

-- O último dia da vaga: a data de fim, ou 30 dias depois de publicada quando a data é a combinar.
create or replace function public.job_last_day(p_job public.jobs)
returns date language sql stable set search_path = public as $$
  select case when p_job.date_to_arrange
              then ((p_job.created_at at time zone 'America/Sao_Paulo')::date + 30)
              else p_job.end_date end
$$;

create or replace function public.job_is_open(p_job public.jobs)
returns boolean language sql stable set search_path = public as $$
  select not p_job.closed and p_job.deleted_at is null and public.job_last_day(p_job) >= public.bicos_today()
$$;

-- Y01: toda a equipe concluiu (posições ocupadas e ninguém escolhido/contratado ainda para trabalhar).
create or replace function public.job_close_if_team_done(p_job_id text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_job public.jobs;
begin
  select * into v_job from public.jobs where id = p_job_id for update;
  if not found or v_job.closed or v_job.deleted_at is not null then return; end if;
  if (select count(*) from public.applications where job_id = p_job_id and status = 'concluida') < v_job.slots
     or exists (select 1 from public.applications where job_id = p_job_id and status in ('pre_selecionado', 'contratado')) then
    return;
  end if;
  update public.jobs set closed = true, sem_contratacao = false where id = p_job_id returning * into v_job;
  perform public.job_close_applications(v_job);
end;
$$;

create or replace function public.application_conclude(p_app_id uuid, p_actor public.application_actor)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_app public.applications;
  v_job public.jobs;
  v_company text;
  v_worker text;
begin
  v_app := public.application_step(p_app_id, 'concluir', p_actor);
  select * into v_job from public.jobs where id = v_app.job_id;
  select name into v_company from public.companies where id = v_job.company_id;
  select name into v_worker from public.workers where id = v_app.worker_id;
  update public.workers set jobs_done = jobs_done + 1, novo = false where id = v_app.worker_id;
  perform public.notify(v_app.worker_id, null, 'avaliar_diaria', 'Avalie sua diária',
    v_company || ' · ' || public.job_title(v_job) || '. Conte como foi.', '/avaliar/' || v_job.id);
  perform public.notify(null, v_job.company_id, 'avaliar_trabalhador', 'Avalie o trabalhador',
    coalesce(v_worker, 'O trabalhador') || ' concluiu a diária de ' || public.job_title(v_job) || '.',
    '/avaliar-trabalhador/' || v_job.id || '/' || v_app.worker_id);
  perform public.job_close_if_team_done(v_job.id);
end;
$$;

-- Y04: a rotina das vagas cujo prazo acabou (de hora em hora, e para a sessão ao abrir as candidaturas).
create or replace function public.conclude_finished_jobs(p_worker uuid default null, p_company uuid default null)
returns integer language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_job public.jobs;
  v_company text;
  v_title text;
  n integer := 0;
begin
  -- Diárias contratadas: concluídas 2 dias depois do último dia (tempo para marcar falta).
  for r in
    select a.id from public.applications a join public.jobs j on j.id = a.job_id
     where a.status = 'contratado' and public.job_last_day(j) + 2 <= public.bicos_today()
       and (p_worker is null or a.worker_id = p_worker)
       and (p_company is null or j.company_id = p_company)
     order by a.id
  loop
    perform public.application_conclude(r.id, 'sistema');
    n := n + 1;
  end loop;

  -- Vagas vencidas ainda abertas: ninguém fica esperando.
  for v_job in
    select j.* from public.jobs j
     where not j.closed and j.deleted_at is null and public.job_last_day(j) < public.bicos_today()
       and (p_company is null or j.company_id = p_company)
       and (p_worker is null or exists (select 1 from public.applications a where a.job_id = j.id and a.worker_id = p_worker))
     order by j.id
     for update
  loop
    select name into v_company from public.companies where id = v_job.company_id;
    v_title := public.job_title(v_job);
    for r in select a.id, a.worker_id, a.status from public.applications a where a.job_id = v_job.id loop
      if r.status in ('enviada', 'em_analise') then
        perform public.application_step(r.id, 'recusar', 'sistema', 'vaga_vencida');
        perform public.notify(r.worker_id, null, 'nao_selecionado', 'Vaga vencida',
          'O prazo de ' || v_title || ' na ' || v_company || ' passou sem uma decisão. Tem outros bicos no mural.', '/mural');
      elsif r.status = 'pre_selecionado' then
        perform public.application_step(r.id, 'expirar', 'sistema', 'vaga_vencida');
        perform public.notify(r.worker_id, null, 'nao_selecionado', 'A contratação não foi confirmada',
          'O prazo de ' || v_title || ' passou sem a ' || v_company || ' confirmar a contratação.', '/vaga/' || v_job.id);
        perform public.notify(null, v_job.company_id, 'bico_fechado', 'Prazo da vaga vencido',
          coalesce((select name from public.workers where id = r.worker_id), 'O trabalhador') ||
          ' não foi confirmado para ' || v_title || ' antes do prazo.', '/vaga-gerenciar/' || v_job.id);
      end if;
    end loop;
    if not exists (select 1 from public.applications where job_id = v_job.id and status in ('pre_selecionado', 'contratado')) then
      update public.jobs
         set closed = true,
             sem_contratacao = not exists (select 1 from public.applications where job_id = v_job.id and status = 'concluida')
       where id = v_job.id returning * into v_job;
      perform public.job_close_applications(v_job);
    end if;
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- Y01: editar vaga cheia; o limite de pessoas conta quem já concluiu.
create or replace function public.update_job(p_job_id text, p jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_old public.jobs := public.own_job_for_update(p_job_id);
  j public.jobs;
  v_holding integer;
  v_changes text[] := '{}';
  v_company text;
  r record;
begin
  if v_old.closed or v_old.deleted_at is not null then
    raise exception using errcode = 'BC409', message = 'Essa vaga já foi encerrada e não pode mais ser editada.';
  end if;
  j := public.job_from_draft(p, v_old.start_date);
  v_holding := public.job_holding(p_job_id);
  if j.slots < v_holding then
    raise exception using errcode = 'BC422',
      message = 'Você já aprovou ' || v_holding || ' pessoas. Não dá para pedir menos que isso.';
  end if;

  if v_old.pay is distinct from j.pay then v_changes := array_append(v_changes, 'valor'); end if;
  if v_old.date_to_arrange is distinct from j.date_to_arrange or v_old.start_date is distinct from j.start_date
     or v_old.end_date is distinct from j.end_date or v_old.start_time is distinct from j.start_time
     or v_old.end_time is distinct from j.end_time then
    v_changes := array_append(v_changes, 'data');
  end if;
  if v_old.cep is distinct from j.cep or v_old.street is distinct from j.street
     or v_old.number is distinct from j.number or v_old.city is distinct from j.city
     or v_old.uf is distinct from j.uf then
    v_changes := array_append(v_changes, 'endereço');
  end if;

  update public.jobs set
    oficio_id = j.oficio_id, title = j.title, pay = j.pay, cep = j.cep, street = j.street, number = j.number,
    complement = j.complement, neighborhood = j.neighborhood, city = j.city, uf = j.uf, lat = j.lat,
    lon = j.lon, date_to_arrange = j.date_to_arrange, start_date = j.start_date, end_date = j.end_date,
    start_time = j.start_time, end_time = j.end_time, diarias = j.diarias, dias = j.dias, urgent = j.urgent,
    photos = coalesce(j.photos, photos), slots = j.slots, description = j.description,
    requirements = j.requirements
  where id = p_job_id
  returning * into j;

  -- Mais posições numa vaga que lotou: quem foi recusado automaticamente volta para análise (Y03).
  if j.slots > v_old.slots then
    perform public.job_reopen_auto_rejected(p_job_id, 'vaga_reaberta');
  end if;

  if cardinality(v_changes) > 0 then
    select name into v_company from public.companies where id = j.company_id;
    for r in
      select worker_id from public.applications
       where job_id = p_job_id and status in ('enviada', 'em_analise', 'pre_selecionado', 'contratado')
    loop
      perform public.notify(r.worker_id, null, 'vaga_editada', 'A vaga mudou',
        v_company || ' mudou ' || array_to_string(v_changes, ', ') || ' de ' || public.job_title(j) ||
        '. Confira antes de ir.', '/vaga/' || p_job_id);
    end loop;
  end if;
end;
$$;

revoke all on function
  public.application_next_status(text, public.application_status, public.application_actor),
  public.job_last_day(public.jobs), public.job_is_open(public.jobs), public.job_close_if_team_done(text),
  public.application_conclude(uuid, public.application_actor), public.conclude_finished_jobs(uuid, uuid),
  public.update_job(text, jsonb)
from public, anon, authenticated;
grant execute on function public.update_job(text, jsonb) to authenticated;

-- ===== 20261011000200_x01_mural.sql =====
-- X01 (+ Y10/Y11/L17) — O mural vem do servidor: só vagas abertas e com lugar, da cidade escolhida ou
-- dentro do raio (PostGIS), impulsionadas primeiro, depois urgentes, depois a ordem escolhida (mais perto,
-- mais cedo, maior valor), em páginas (cursor sobre a ordem + id). A busca por texto respeita a cidade
-- (ou procura em todas, se pedido). Distâncias pelo ponto aproximado da obra (area_lat/area_lon, Z06).
-- Índices: vagas abertas por cidade e data, ponto geográfico (GiST) e as chaves estrangeiras que faltavam.
-- Idempotente. O PostGIS deste projeto está no schema public (instalado pelo app antigo).

-- Texto sem acento e em minúsculas, para a busca ("hidráulica" acha "hidraulica").
create or replace function public.fold_text(p text)
returns text language sql immutable parallel safe set search_path = public as $$
  select lower(translate(coalesce(p, ''),
    'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
    'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'))
$$;

alter table public.jobs
  add column if not exists area_geog geography(Point, 4326)
  generated always as (
    st_setsrid(st_makepoint(round(lon::numeric, 2)::double precision, round(lat::numeric, 2)::double precision), 4326)::geography
  ) stored;

create index if not exists jobs_area_geog_idx on public.jobs using gist (area_geog);
create index if not exists jobs_open_city_idx on public.jobs (uf, city, created_at desc)
  where not closed and deleted_at is null;
create index if not exists saved_jobs_job_idx on public.saved_jobs (job_id);
create index if not exists applications_holding_idx on public.applications (job_id)
  where status in ('pre_selecionado', 'contratado', 'concluida');
create index if not exists applications_job_idx on public.applications (job_id);
create index if not exists reviews_application_idx on public.reviews (application_id);

-- O trabalho tem dia em `p_day` (filtro "Hoje"/"Amanhã"), como utils/jobInfo.ts › runsOn.
create or replace function public.job_runs_on(p_job public.jobs, p_day date)
returns boolean language sql stable set search_path = public as $$
  select not p_job.date_to_arrange and p_job.start_date <= p_day and p_day <= coalesce(p_job.end_date, p_job.start_date)
     and case coalesce(p_job.dias::text, 'qualquer')
           when 'semana' then extract(isodow from p_day) between 1 and 5
           when 'fimdesemana' then extract(isodow from p_day) in (6, 7)
           else true end
$$;

/*
 * Uma página do mural. Filtros:
 *   p_city/p_uf — a cidade escolhida (sem raio);  p_lat/p_lon + p_radius_km — "Até X km" do ponto;
 *   p_oficio — id do catálogo;  p_quando — 'Hoje' | 'Amanhã' | 'Durante a semana' | 'Fim de semana';
 *   p_search — texto (título, ofício e sinônimos, construtora, bairro); p_all_cities — busca no país;
 *   p_sort — 'perto' | 'cedo' | 'valor';  p_cursor — {"r": rank, "k": chave, "id": "BC-…"} da última linha.
 * Cada linha: as colunas públicas da vaga + "_rank", "_key" e "_km" (para o cursor e a distância).
 */
create or replace function public.feed_jobs(
  p_city text, p_uf text, p_lat double precision, p_lon double precision, p_radius_km integer default null,
  p_oficio text default null, p_quando text default null, p_search text default null,
  p_all_cities boolean default false, p_sort text default 'perto', p_limit integer default 30,
  p_cursor jsonb default null
) returns setof jsonb language sql stable security definer set search_path = public as $$
  with origin as (
    select st_setsrid(st_makepoint(p_lon, p_lat), 4326)::geography as g, public.bicos_today() as today
  ),
  open_jobs as (
    select j.*, (select g from origin) as o_g, (select today from origin) as today
      from public.jobs j
     where not j.closed and j.deleted_at is null
       and public.job_is_open(j)
       and public.job_holding(j.id) < j.slots
       and (p_oficio is null or j.oficio_id = p_oficio)
       and (
         case
           when nullif(btrim(coalesce(p_search, '')), '') is not null and p_all_cities then true
           when p_radius_km is not null then st_dwithin(j.area_geog, (select g from origin), p_radius_km * 1000)
           else j.city = p_city and j.uf = p_uf
         end
       )
       and (
         p_quando is null
         or (p_quando = 'Hoje' and public.job_runs_on(j, (select today from origin)))
         or (p_quando = 'Amanhã' and public.job_runs_on(j, (select today from origin) + 1))
         or (p_quando = 'Durante a semana' and coalesce(j.dias::text, 'qualquer') in ('semana', 'qualquer'))
         or (p_quando = 'Fim de semana' and coalesce(j.dias::text, 'qualquer') in ('fimdesemana', 'qualquer'))
       )
       and (
         nullif(btrim(coalesce(p_search, '')), '') is null
         or public.fold_text(concat_ws(' ', j.title, j.neighborhood, j.city,
              (select o.nome || ' ' || array_to_string(o.sinonimos, ' ') from public.oficios o where o.id = j.oficio_id),
              (select c.name from public.companies c where c.id = j.company_id)))
            like '%' || public.fold_text(btrim(p_search)) || '%'
       )
  ),
  ranked as (
    select oj.*,
           case when oj.boost_ends_at > now() then 0 when oj.urgent then 1 else 2 end as rank,
           case p_sort
             when 'valor' then coalesce(-oj.pay::double precision, 1e12)
             when 'cedo' then coalesce(extract(epoch from oj.start_date::timestamp), 1e12)
             else st_distance(oj.area_geog, oj.o_g)
           end as sort_key,
           st_distance(oj.area_geog, oj.o_g) / 1000.0 as km
      from open_jobs oj
  )
  select jsonb_build_object(
           'id', r.id, 'company_id', r.company_id, 'oficio_id', r.oficio_id, 'title', r.title, 'pay', r.pay,
           'neighborhood', r.neighborhood, 'city', r.city, 'uf', r.uf, 'area_lat', r.area_lat, 'area_lon', r.area_lon,
           'date_to_arrange', r.date_to_arrange, 'start_date', r.start_date, 'end_date', r.end_date,
           'start_time', r.start_time, 'end_time', r.end_time, 'diarias', r.diarias, 'dias', r.dias,
           'urgent', r.urgent, 'boost_ends_at', r.boost_ends_at, 'photos', r.photos, 'slots', r.slots,
           'closed', r.closed, 'sem_contratacao', r.sem_contratacao, 'description', r.description,
           'requirements', r.requirements, 'created_at', r.created_at, 'updated_at', r.updated_at,
           'deleted_at', r.deleted_at, '_rank', r.rank, '_key', r.sort_key, '_km', round(r.km::numeric, 1))
    from ranked r
   where p_cursor is null
      or (r.rank, r.sort_key, r.id) > ((p_cursor->>'r')::int, (p_cursor->>'k')::double precision, p_cursor->>'id')
   order by r.rank, r.sort_key, r.id
   limit least(greatest(coalesce(p_limit, 30), 1), 60)
$$;

revoke all on function public.fold_text(text), public.job_runs_on(public.jobs, date) from public, anon, authenticated;
revoke all on function public.feed_jobs(text, text, double precision, double precision, integer, text, text, text, boolean, text, integer, jsonb)
  from public, anon, authenticated;
grant execute on function public.feed_jobs(text, text, double precision, double precision, integer, text, text, text, boolean, text, integer, jsonb)
  to authenticated;

-- ===== 20261011000300_y16_y17_documento.sql =====
-- Y16 + Y17: documento com dígito verificador no servidor e CPF fora do campo público da empresa.
--
-- - cpf_valid / cnpj_valid: as mesmas contas de utils/document.ts.
-- - O cadastro (gatilho BEFORE INSERT em auth.users) recusa conta com lado definido (trabalhador ou
--   recrutador) sem documento válido: trabalhador com CPF; recrutador com CNPJ ou, por conta própria, CPF.
--   Conta sem lado (login com Google) não tem documento ainda: completa em "Escolher perfil" (L13).
-- - create_account_for recusa documento inválido.
-- - Y16: companies.cnpj de quem se cadastrou com CPF (máscara '***.') volta a vazio.

create or replace function public.cpf_valid(p_document text)
returns boolean language plpgsql immutable set search_path = public as $$
declare
  d text := regexp_replace(coalesce(p_document, ''), '[^0-9]', '', 'g');
  s int;
  r int;
  n int;
begin
  if length(d) <> 11 or d ~ '^(\d)\1{10}$' then return false; end if;
  foreach n in array array[9, 10] loop
    s := 0;
    for i in 1..n loop
      s := s + substr(d, i, 1)::int * (n + 2 - i);
    end loop;
    r := (s * 10) % 11;
    if r = 10 then r := 0; end if;
    if r <> substr(d, n + 1, 1)::int then return false; end if;
  end loop;
  return true;
end;
$$;

create or replace function public.cnpj_valid(p_document text)
returns boolean language plpgsql immutable set search_path = public as $$
declare
  d text := regexp_replace(coalesce(p_document, ''), '[^0-9]', '', 'g');
  w int[] := array[6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  s int;
  r int;
  n int;
begin
  if length(d) <> 14 or d ~ '^(\d)\1{13}$' then return false; end if;
  foreach n in array array[12, 13] loop
    s := 0;
    for i in 1..n loop
      -- Pesos 5,4,3,2,9,…,2 para o 1º dígito e 6,5,4,…,2 para o 2º.
      s := s + substr(d, i, 1)::int * w[i + 13 - n];
    end loop;
    r := s % 11;
    r := case when r < 2 then 0 else 11 - r end;
    if r <> substr(d, n + 1, 1)::int then return false; end if;
  end loop;
  return true;
end;
$$;

-- O documento serve para o lado da conta?
create or replace function public.document_valid_for(p_role public.app_role, p_document text)
returns boolean language sql immutable set search_path = public as $$
  select case p_role
    when 'trabalhador' then public.cpf_valid(p_document)
    else public.cnpj_valid(p_document) or public.cpf_valid(p_document)
  end
$$;

create or replace function public.claim_document_v2()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_digits text := regexp_replace(coalesce(m->>'documento', ''), '[^0-9]', '', 'g');
  v_role public.app_role := case
    when m->>'role' in ('trabalhador', 'recrutador') then (m->>'role')::public.app_role
    when m->>'tipo' = 'pedreiro' then 'trabalhador'
    when m->>'tipo' = 'construtora' then 'recrutador'
  end;
begin
  -- Y17: cadastro com lado definido precisa de documento válido (o app confere antes; isto é a garantia).
  if v_role is not null and not public.document_valid_for(v_role, v_digits) then
    raise exception using errcode = 'BC422', message = 'Documento inválido.';
  end if;
  if length(v_digits) > 0 then
    perform public.claim_document_for(new.id, v_digits);
  end if;
  -- Só nesta transação (o cadastro): handle_new_user_v2 lê e apaga.
  perform set_config('bicos.cadastro_documento', v_digits, true);
  new.raw_user_meta_data := m - 'documento';
  return new;
end;
$$;

create or replace function public.create_account_for(
  p_user_id uuid, p_email text, p_role public.app_role, p_name text, p_document text, p_whatsapp text,
  p_terms_version text, p_email_confirmed_at timestamptz
) returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  v_digits text := regexp_replace(coalesce(p_document, ''), '[^0-9]', '', 'g');
  v_phone text := regexp_replace(coalesce(p_whatsapp, ''), '[^0-9]', '', 'g');
  v_key text;
  v_name text := coalesce(nullif(btrim(p_name), ''), split_part(p_email, '@', 1));
begin
  if exists (select 1 from public.accounts where id = p_user_id) then return; end if;
  -- Y17: documento informado tem de ser válido para o lado da conta. (Sem documento só as contas do app
  -- antigo, migradas por account_from_old_profile, que copiam o documento cifrado depois.)
  if length(v_digits) > 0 and not public.document_valid_for(p_role, v_digits) then
    raise exception using errcode = 'BC422', message = 'Documento inválido.';
  end if;
  if length(v_digits) > 0 then
    perform public.claim_document_for(p_user_id, v_digits);
  end if;

  if p_role = 'trabalhador' then
    insert into public.workers (id, name, initials, whatsapp, city, lat, lon)
    values (p_user_id, v_name, public.initials_of(v_name), v_phone, 'São Paulo, SP', -23.5505, -46.6333)
    on conflict (id) do nothing;
  else
    -- Y16: o campo público "CNPJ" da empresa só recebe CNPJ (14 dígitos), nunca o CPF de quem recruta.
    insert into public.companies (id, name, cnpj, whatsapp, location)
    values (p_user_id, v_name, case when length(v_digits) = 14 then public.mask_document(v_digits) end,
            v_phone, 'São Paulo, SP')
    on conflict (id) do nothing;
  end if;

  if length(v_digits) > 0 then
    select decrypted_secret into v_key from vault.decrypted_secrets where name = 'nivotech_documento_key';
  end if;

  insert into public.accounts (
    id, email, role, document, document_hash, document_cipher, whatsapp, email_confirmed_at,
    terms_version, worker_id, company_id
  ) values (
    p_user_id, p_email, p_role, public.mask_document(v_digits),
    case when length(v_digits) > 0 then public.document_hash(v_digits) end,
    case when length(v_digits) > 0 and v_key is not null then extensions.pgp_sym_encrypt(v_digits, v_key) end,
    v_phone, p_email_confirmed_at, coalesce(p_terms_version, ''),
    case when p_role = 'trabalhador' then p_user_id end,
    case when p_role = 'recrutador' then p_user_id end
  );

  if nullif(p_terms_version, '') is not null and exists (select 1 from public.profiles where id = p_user_id) then
    insert into public.consentimentos (usuario_id, documento, versao)
    select p_user_id, d, p_terms_version
      from unnest(array['termos_de_uso', 'politica_privacidade']) d
     where not exists (
       select 1 from public.consentimentos c
        where c.usuario_id = p_user_id and c.documento = d and c.versao = p_terms_version
     );
  end if;
end;
$$;

-- Y16: o CPF mascarado ('***.456.789-**') que foi parar no campo público da empresa.
update public.companies set cnpj = null where cnpj like '***%';

revoke all on function
  public.claim_document_v2(),
  public.create_account_for(uuid, text, public.app_role, text, text, text, text, timestamptz)
from public, anon, authenticated;
grant execute on function public.cpf_valid(text), public.cnpj_valid(text),
  public.document_valid_for(public.app_role, text) to authenticated, service_role;

-- ===== 20261011000400_y18_media_notas.sql =====
-- Y18: a média das notas é sempre round(avg(value), 1) sobre todas as avaliações do perfil.
--
-- submit_review continua somando 1 em review_count; um gatilho BEFORE UPDATE nesse campo recalcula nota e
-- quantidade a partir de public.reviews (que já tem a avaliação nova), então o arredondamento não acumula.
-- No fim, recalcula todos os perfis.

create or replace function public.recount_rating()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'workers' then
    select coalesce(round(avg(value)::numeric, 1), 0), count(*)::int into new.rating, new.review_count
      from public.reviews where worker_id = new.id and direction = 'para_trabalhador';
  else
    select coalesce(round(avg(value)::numeric, 1), 0), count(*)::int into new.rating, new.review_count
      from public.reviews where company_id = new.id and direction = 'para_construtora';
  end if;
  return new;
end;
$$;
revoke all on function public.recount_rating() from public, anon, authenticated;

drop trigger if exists workers_recount_rating on public.workers;
create trigger workers_recount_rating before update of review_count, rating on public.workers
  for each row execute function public.recount_rating();
drop trigger if exists companies_recount_rating on public.companies;
create trigger companies_recount_rating before update of review_count, rating on public.companies
  for each row execute function public.recount_rating();

-- Recalcula todos (o gatilho preenche os valores certos).
update public.workers set review_count = review_count;
update public.companies set review_count = review_count;

-- ===== 20261011000500_y24_verificacao.sql =====
-- Y24 (+ L10): verificação da construtora com status de verdade — pendente | verificada | reprovada.
--
-- Ninguém nasce "verificada": a conta entra como pendente e só a equipe da Bicos muda o status, pela
-- função set_company_verification (service_role: painel do Supabase ou uma futura área de admin). A coluna
-- `verified` (usada pelo selo) acompanha o status por gatilho; `verified_at` guarda quando.

do $$ begin
  create type public.company_verification as enum ('pendente', 'verificada', 'reprovada');
exception when duplicate_object then null;
end $$;

alter type public.notification_kind add value if not exists 'verificacao';

alter table public.companies
  add column if not exists verification_status public.company_verification not null default 'pendente',
  add column if not exists verified_at timestamptz;

create or replace function public.sync_company_verified()
returns trigger language plpgsql set search_path = public as $$
begin
  new.verified := new.verification_status = 'verificada';
  if new.verification_status = 'verificada' then
    if tg_op = 'INSERT' or old.verification_status is distinct from 'verificada' then
      new.verified_at := coalesce(new.verified_at, now());
    end if;
  else
    new.verified_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists companies_sync_verified on public.companies;
create trigger companies_sync_verified before insert or update of verification_status, verified on public.companies
  for each row execute function public.sync_company_verified();

-- As que já estavam marcadas como verificadas continuam (com a data em que entraram).
update public.companies
   set verification_status = 'verificada', verified_at = coalesce(verified_at, created_at)
 where verified and verification_status = 'pendente';
-- E nenhuma outra fica com o selo.
update public.companies set verified = false where verification_status <> 'verificada' and verified;

create or replace function public.set_company_verification(p_company uuid, p_status public.company_verification)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.companies set verification_status = p_status where id = p_company;
  if not found then
    raise exception using errcode = 'BC404', message = 'Construtora não encontrada.';
  end if;
  if p_status = 'verificada' then
    perform public.notify(null, p_company, 'verificacao', 'Empresa verificada',
      'Conferimos os dados da empresa. O selo "Verificada" já aparece no seu perfil.', '/empresa');
  elsif p_status = 'reprovada' then
    perform public.notify(null, p_company, 'verificacao', 'Não conseguimos verificar a empresa',
      'Os dados não bateram. Fale com a gente pela Ajuda para resolver.', '/ajuda');
  end if;
end;
$$;

revoke all on function public.set_company_verification(uuid, public.company_verification), public.sync_company_verified()
  from public, anon, authenticated;
grant execute on function public.set_company_verification(uuid, public.company_verification) to service_role;
grant select (verification_status, verified_at) on public.companies to authenticated;

-- ===== 20261011000600_y25_whatsapp.sql =====
-- Y25: trocar o WhatsApp (trabalhador e construtora) com validação e, quando o envio de código estiver
-- ligado, confirmação por código.
--
-- - whatsapp_valid: celular com DDD, 11 números (DDD sem zero, começa com 9).
-- - O cadastro recusa WhatsApp inválido (gatilho do Auth).
-- - change_whatsapp: a única forma de trocar o número (a coluna companies.whatsapp deixa de ser editável
--   direto). Trocar zera accounts.whatsapp_verified_at, a não ser que o número novo tenha acabado de ser
--   confirmado por código.
-- - whatsapp_verifications: números confirmados por código nos últimos 30 minutos (só a Edge Function
--   codigo-whatsapp grava, com service_role, por mark_whatsapp_verified). Serve tanto para a troca quanto
--   para o cadastro (o código é conferido antes de a conta existir).

create or replace function public.whatsapp_valid(p_phone text)
returns boolean language sql immutable set search_path = public as $$
  select regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g') ~ '^[1-9][1-9]9[0-9]{8}$'
$$;

create table if not exists public.whatsapp_verifications (
  phone text primary key,
  verified_at timestamptz not null default now()
);
alter table public.whatsapp_verifications enable row level security;
revoke all on public.whatsapp_verifications from anon, authenticated;

create or replace function public.whatsapp_recently_verified(p_phone text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.whatsapp_verifications
     where phone = regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g')
       and verified_at > now() - interval '30 minutes')
$$;

-- Chamado pela Edge Function depois que o provedor aprovou o código.
create or replace function public.mark_whatsapp_verified(p_phone text, p_user uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_phone text := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
begin
  insert into public.whatsapp_verifications (phone, verified_at) values (v_phone, now())
  on conflict (phone) do update set verified_at = now();
  if p_user is not null then
    update public.accounts set whatsapp_verified_at = now() where id = p_user and whatsapp = v_phone;
  end if;
end;
$$;

-- A conta nova já nasce com o número confirmado se o código foi conferido no cadastro.
create or replace function public.accounts_whatsapp_verified()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.whatsapp_verified_at is null and public.whatsapp_recently_verified(new.whatsapp) then
    new.whatsapp_verified_at := now();
  end if;
  return new;
end;
$$;
drop trigger if exists accounts_whatsapp_verified on public.accounts;
create trigger accounts_whatsapp_verified before insert on public.accounts
  for each row execute function public.accounts_whatsapp_verified();

create or replace function public.change_whatsapp(p_whatsapp text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_phone text := regexp_replace(coalesce(p_whatsapp, ''), '[^0-9]', '', 'g');
  v_account public.accounts;
  v_verified timestamptz;
begin
  select * into v_account from public.accounts where id = auth.uid() for update;
  if not found then
    raise exception using errcode = 'BC401', message = 'Entre na sua conta de novo para continuar.';
  end if;
  if not public.whatsapp_valid(v_phone) then
    raise exception using errcode = 'BC422', message = 'Confira o número: celular com DDD, 11 números.';
  end if;
  if v_phone = v_account.whatsapp then
    return jsonb_build_object('whatsapp', v_phone, 'verified_at', v_account.whatsapp_verified_at);
  end if;
  v_verified := case when public.whatsapp_recently_verified(v_phone) then now() end;
  if v_account.worker_id is not null then
    update public.workers set whatsapp = v_phone where id = v_account.worker_id;
  else
    update public.companies set whatsapp = v_phone where id = v_account.company_id;
  end if;
  update public.accounts set whatsapp = v_phone, whatsapp_verified_at = v_verified where id = v_account.id;
  -- O código vale uma vez.
  delete from public.whatsapp_verifications where phone = v_phone;
  return jsonb_build_object('whatsapp', v_phone, 'verified_at', v_verified);
end;
$$;

-- O cadastro: além do documento (Y17), o WhatsApp precisa ser um celular válido.
create or replace function public.claim_document_v2()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_digits text := regexp_replace(coalesce(m->>'documento', ''), '[^0-9]', '', 'g');
  v_role public.app_role := case
    when m->>'role' in ('trabalhador', 'recrutador') then (m->>'role')::public.app_role
    when m->>'tipo' = 'pedreiro' then 'trabalhador'
    when m->>'tipo' = 'construtora' then 'recrutador'
  end;
begin
  if v_role is not null and not public.document_valid_for(v_role, v_digits) then
    raise exception using errcode = 'BC422', message = 'Documento inválido.';
  end if;
  if v_role is not null and not public.whatsapp_valid(m->>'whatsapp') then
    raise exception using errcode = 'BC422', message = 'WhatsApp inválido.';
  end if;
  if length(v_digits) > 0 then
    perform public.claim_document_for(new.id, v_digits);
  end if;
  perform set_config('bicos.cadastro_documento', v_digits, true);
  new.raw_user_meta_data := m - 'documento';
  return new;
end;
$$;

-- A limpeza diária também tira as confirmações velhas.
create or replace function public.purge_auth_attempts()
returns integer language plpgsql security definer set search_path = public as $$
declare
  n integer;
begin
  with x as (delete from public.auth_attempts where at < now() - interval '1 day' returning 1)
  select count(*)::int into n from x;
  delete from public.whatsapp_verifications where verified_at < now() - interval '1 day';
  return n;
end;
$$;

revoke update (whatsapp) on public.companies from authenticated;
revoke all on function
  public.whatsapp_recently_verified(text), public.mark_whatsapp_verified(text, uuid),
  public.accounts_whatsapp_verified(), public.claim_document_v2(), public.purge_auth_attempts(),
  public.change_whatsapp(text)
from public, anon, authenticated;
grant execute on function public.change_whatsapp(text) to authenticated;
grant execute on function public.whatsapp_valid(text) to authenticated, service_role;
grant execute on function public.mark_whatsapp_verified(text, uuid) to service_role;

-- ===== 20261011000700_y28_alerta_bico.sql =====
-- Y28: "Avisar quando aparecer bico novo" de verdade — um alerta salvo no servidor por trabalhador (cidade
-- ou raio a partir de um ponto, e ofício opcional). Cada vaga nova que bate gera a notificação "Bico novo
-- perto de você" (e, quando o push existir, o push: X03). No máximo 5 avisos desses por dia por pessoa.

alter type public.notification_kind add value if not exists 'bico_novo';

create table if not exists public.job_alerts (
  worker_id uuid primary key references public.workers (id) on delete cascade,
  city text not null,
  uf text not null,
  lat double precision not null,
  lon double precision not null,
  radius_km integer check (radius_km is null or radius_km between 1 and 100),
  oficio_id text references public.oficios (id),
  notified_on date,
  notified_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.job_alerts enable row level security;
revoke all on public.job_alerts from anon, authenticated;
grant select (worker_id, city, uf, lat, lon, radius_km, oficio_id, created_at, updated_at)
  on public.job_alerts to authenticated;
drop policy if exists "Trabalhador lê o próprio alerta" on public.job_alerts;
create policy "Trabalhador lê o próprio alerta" on public.job_alerts
  for select to authenticated using (worker_id = (select public.my_worker_id()));

create or replace function public.save_job_alert(
  p_city text, p_uf text, p_lat double precision, p_lon double precision, p_radius_km integer, p_oficio text
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_worker uuid := public.my_worker_id();
begin
  if v_worker is null then
    raise exception using errcode = 'BC401', message = 'Só trabalhadores recebem aviso de bico novo.';
  end if;
  if nullif(btrim(p_city), '') is null or p_uf !~ '^[A-Z]{2}$' or p_lat not between -34 and 6 or p_lon not between -74 and -28 then
    raise exception using errcode = 'BC422', message = 'Escolha a cidade do aviso.';
  end if;
  if p_radius_km is not null and p_radius_km not between 1 and 100 then
    raise exception using errcode = 'BC422', message = 'Escolha uma distância de até 100 km.';
  end if;
  if p_oficio is not null and not exists (select 1 from public.oficios where id = p_oficio) then
    raise exception using errcode = 'BC422', message = 'Escolha o ofício na lista.';
  end if;
  insert into public.job_alerts (worker_id, city, uf, lat, lon, radius_km, oficio_id)
  values (v_worker, btrim(p_city), p_uf, p_lat, p_lon, p_radius_km, p_oficio)
  on conflict (worker_id) do update
    set city = excluded.city, uf = excluded.uf, lat = excluded.lat, lon = excluded.lon,
        radius_km = excluded.radius_km, oficio_id = excluded.oficio_id, updated_at = now();
end;
$$;

create or replace function public.delete_job_alert()
returns void language sql security definer set search_path = public as $$
  delete from public.job_alerts where worker_id = public.my_worker_id()
$$;

-- Vaga nova: avisa quem tem alerta que bate (nunca a própria construtora; conta excluída não recebe).
create or replace function public.notify_job_alerts()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_today date := public.bicos_today();
  v_text text := public.job_title(new) || ' em ' || coalesce(nullif(new.neighborhood, ''), new.city) ||
                 case when new.pay > 0 then ' · R$ ' || to_char(new.pay, 'FM999G999') || ' por diária' else '' end;
begin
  for r in
    select a.worker_id
      from public.job_alerts a
      join public.workers w on w.id = a.worker_id and w.name <> 'Conta excluída'
     where (a.oficio_id is null or a.oficio_id = new.oficio_id)
       and (a.notified_on is distinct from v_today or a.notified_count < 5)
       and case
             when a.radius_km is null then public.fold_text(a.city) = public.fold_text(new.city) and a.uf = new.uf
             else st_dwithin(new.area_geog, st_setsrid(st_makepoint(a.lon, a.lat), 4326)::geography, a.radius_km * 1000)
           end
  loop
    perform public.notify(r.worker_id, null, 'bico_novo', 'Bico novo perto de você', v_text, '/vaga/' || new.id);
    update public.job_alerts
       set notified_count = case when notified_on = v_today then notified_count + 1 else 1 end,
           notified_on = v_today
     where worker_id = r.worker_id;
  end loop;
  return null;
end;
$$;

drop trigger if exists jobs_notify_alerts on public.jobs;
create trigger jobs_notify_alerts after insert on public.jobs
  for each row execute function public.notify_job_alerts();

revoke all on function public.save_job_alert(text, text, double precision, double precision, integer, text),
  public.delete_job_alert(), public.notify_job_alerts() from public, anon, authenticated;
grant execute on function public.save_job_alert(text, text, double precision, double precision, integer, text),
  public.delete_job_alert() to authenticated;

-- ===== 20261012000100_l18_pagamento.sql =====
-- L18 (+ P06): forma e prazo de pagamento da diária como campo da vaga, e limite dos requisitos.
--
-- payment_method: 'pix_dia' (PIX no fim de cada diária), 'pix_fim' (PIX no fim do bico), 'dinheiro', 'outro'
-- (com payment_note obrigatória). Vagas antigas ficam sem (ficam com 'pix_dia', o texto fixo que o app mostrava).
-- publish_job / update_job leem os dois campos do rascunho; mudar a forma de pagamento avisa os candidatos
-- como mudar o valor. Requisitos: até 12, cada um com até 60 caracteres.

alter table public.jobs
  add column if not exists payment_method text,
  add column if not exists payment_note text;
do $$ begin
  alter table public.jobs add constraint jobs_payment_method_check
    check (payment_method is null or payment_method in ('pix_dia', 'pix_fim', 'dinheiro', 'outro'));
exception when duplicate_object then null;
end $$;
do $$ begin
  alter table public.jobs add constraint jobs_payment_note_check
    check (payment_note is null or char_length(payment_note) <= 80);
exception when duplicate_object then null;
end $$;

-- Até aqui o app mostrava "Pagamento em PIX no fim da diária" em toda vaga: é o que as vagas antigas
-- prometeram.
update public.jobs set payment_method = 'pix_dia' where payment_method is null;

grant select (payment_method, payment_note) on public.jobs to authenticated;

-- Confere os campos novos do rascunho (as mesmas regras de pages/recruiter/jobForm.ts).
create or replace function public.job_extras_from_draft(p jsonb, out method text, out note text)
language plpgsql immutable set search_path = public as $$
declare
  v_req text[] := coalesce(array(select jsonb_array_elements_text(coalesce(p->'requirements', '[]'::jsonb))), '{}');
begin
  method := coalesce(nullif(p->>'payment_method', ''), 'pix_dia');
  note := nullif(btrim(coalesce(p->>'payment_note', '')), '');
  if method not in ('pix_dia', 'pix_fim', 'dinheiro', 'outro') then
    raise exception using errcode = 'BC422', message = 'Escolha como a diária vai ser paga.';
  end if;
  if method = 'outro' and note is null then
    raise exception using errcode = 'BC422', message = 'Conte como a diária vai ser paga.';
  end if;
  if method <> 'outro' then note := null; end if;
  if char_length(coalesce(note, '')) > 80 then
    raise exception using errcode = 'BC422', message = 'Use até 80 caracteres para explicar o pagamento.';
  end if;
  if cardinality(v_req) > 12 or exists (select 1 from unnest(v_req) r where char_length(r) > 60 or btrim(r) = '') then
    raise exception using errcode = 'BC422', message = 'Até 12 itens, cada um com até 60 caracteres.';
  end if;
end;
$$;

create or replace function public.publish_job(p jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_company uuid := public.my_company_id();
  j public.jobs;
  x record;
  v_id text;
begin
  if v_company is null then
    raise exception using errcode = 'BC401', message = 'Só a conta de construtora pode publicar vagas.';
  end if;
  if not exists (select 1 from public.accounts where id = auth.uid() and profile_completed_at is not null) then
    raise exception using errcode = 'BC409', message = 'Complete o perfil da empresa antes de publicar.';
  end if;
  j := public.job_from_draft(p);
  x := public.job_extras_from_draft(p);
  insert into public.jobs (
    company_id, oficio_id, title, pay, cep, street, number, complement, neighborhood, city, uf, lat, lon,
    date_to_arrange, start_date, end_date, start_time, end_time, diarias, dias, urgent, photos, slots,
    description, requirements, payment_method, payment_note
  ) values (
    v_company, j.oficio_id, j.title, j.pay, j.cep, j.street, j.number, j.complement, j.neighborhood, j.city,
    j.uf, j.lat, j.lon, j.date_to_arrange, j.start_date, j.end_date, j.start_time, j.end_time, j.diarias,
    j.dias, j.urgent, j.photos, j.slots, j.description, j.requirements, x.method, x.note
  ) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.update_job(p_job_id text, p jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_old public.jobs := public.own_job_for_update(p_job_id);
  j public.jobs;
  x record;
  v_holding integer;
  v_changes text[] := '{}';
  v_company text;
  r record;
begin
  if v_old.closed or v_old.deleted_at is not null then
    raise exception using errcode = 'BC409', message = 'Essa vaga já foi encerrada e não pode mais ser editada.';
  end if;
  j := public.job_from_draft(p, v_old.start_date);
  x := public.job_extras_from_draft(p);
  v_holding := public.job_holding(p_job_id);
  if j.slots < v_holding then
    raise exception using errcode = 'BC422',
      message = 'Você já aprovou ' || v_holding || ' pessoas. Não dá para pedir menos que isso.';
  end if;

  if v_old.pay is distinct from j.pay then v_changes := array_append(v_changes, 'valor'); end if;
  if v_old.payment_method is distinct from x.method or v_old.payment_note is distinct from x.note then
    v_changes := array_append(v_changes, 'pagamento');
  end if;
  if v_old.date_to_arrange is distinct from j.date_to_arrange or v_old.start_date is distinct from j.start_date
     or v_old.end_date is distinct from j.end_date or v_old.start_time is distinct from j.start_time
     or v_old.end_time is distinct from j.end_time then
    v_changes := array_append(v_changes, 'data');
  end if;
  if v_old.cep is distinct from j.cep or v_old.street is distinct from j.street
     or v_old.number is distinct from j.number or v_old.city is distinct from j.city
     or v_old.uf is distinct from j.uf then
    v_changes := array_append(v_changes, 'endereço');
  end if;

  update public.jobs set
    oficio_id = j.oficio_id, title = j.title, pay = j.pay, cep = j.cep, street = j.street, number = j.number,
    complement = j.complement, neighborhood = j.neighborhood, city = j.city, uf = j.uf, lat = j.lat,
    lon = j.lon, date_to_arrange = j.date_to_arrange, start_date = j.start_date, end_date = j.end_date,
    start_time = j.start_time, end_time = j.end_time, diarias = j.diarias, dias = j.dias, urgent = j.urgent,
    photos = coalesce(j.photos, photos), slots = j.slots, description = j.description,
    requirements = j.requirements, payment_method = x.method, payment_note = x.note
  where id = p_job_id
  returning * into j;

  -- Mais posições numa vaga que lotou: quem foi recusado automaticamente volta para análise (Y03).
  if j.slots > v_old.slots then
    perform public.job_reopen_auto_rejected(p_job_id, 'vaga_reaberta');
  end if;

  if cardinality(v_changes) > 0 then
    select name into v_company from public.companies where id = j.company_id;
    for r in
      select worker_id from public.applications
       where job_id = p_job_id and status in ('enviada', 'em_analise', 'pre_selecionado', 'contratado')
    loop
      perform public.notify(r.worker_id, null, 'vaga_editada', 'A vaga mudou',
        v_company || ' mudou ' || array_to_string(v_changes, ', ') || ' de ' || public.job_title(j) ||
        '. Confira antes de ir.', '/vaga/' || p_job_id);
    end loop;
  end if;
end;
$$;

revoke all on function public.job_extras_from_draft(jsonb) from public, anon, authenticated;
revoke all on function public.publish_job(jsonb), public.update_job(text, jsonb) from public, anon;
grant execute on function public.publish_job(jsonb), public.update_job(text, jsonb) to authenticated;

-- ===== 20261012000200_l22_desfazer_recusa.sql =====
-- L22: "Recusado · Desfazer". A construtora que acabou de recusar (até 10 minutos) desfaz: o candidato volta
-- para "em análise". O aviso "Não foi dessa vez" some se ele ainda não viu; se viu, recebe a correção.
-- (L01, o "Aprovado · Desfazer", usa a transição desfazer_aprovacao que já existe.)

create or replace function public.application_next_status(
  p_action text, p_from public.application_status, p_actor public.application_actor
) returns public.application_status language sql immutable set search_path = public as $$
  select (case
    when p_action = 'analisar' and p_from = 'enviada' and p_actor in ('construtora', 'sistema') then 'em_analise'
    when p_action = 'aprovar' and p_from in ('enviada', 'em_analise') and p_actor = 'construtora' then 'pre_selecionado'
    when p_action = 'recusar' and p_from in ('enviada', 'em_analise') and p_actor in ('construtora', 'sistema') then 'nao_selecionado'
    when p_action = 'desfazer_recusa' and p_from = 'nao_selecionado' and p_actor = 'construtora' then 'em_analise'
    when p_action = 'desfazer_aprovacao' and p_from = 'pre_selecionado' and p_actor = 'construtora' then 'em_analise'
    when p_action = 'contratar' and p_from = 'pre_selecionado' and p_actor = 'construtora' then 'contratado'
    when p_action = 'desistir' and p_from in ('pre_selecionado', 'contratado') and p_actor = 'trabalhador' then 'desistiu'
    when p_action = 'cancelar_contratacao' and p_from in ('pre_selecionado', 'contratado') and p_actor = 'construtora' then 'cancelado_pela_construtora'
    when p_action = 'concluir' and p_from = 'contratado' and p_actor in ('construtora', 'sistema') then 'concluida'
    when p_action = 'marcar_falta' and p_from = 'contratado' and p_actor = 'construtora' then 'nao_compareceu'
    when p_action = 'expirar' and p_from = 'pre_selecionado' and p_actor = 'sistema' then 'expirada'
  end)::public.application_status
$$;

create or replace function public.undo_reject(p_job_id text, p_worker_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_job public.jobs := public.own_job_for_update(p_job_id);
  v_app public.applications;
  v_last public.application_events;
  v_company text;
  v_taken_back integer;
begin
  select * into v_app from public.applications where job_id = p_job_id and worker_id = p_worker_id for update;
  if not found then
    raise exception using errcode = 'BC404', message = 'Essa candidatura não existe mais.';
  end if;
  select * into v_last from public.application_events
   where application_id = v_app.id and status = 'nao_selecionado' order by at desc limit 1;
  if v_app.status <> 'nao_selecionado' or v_last."by" <> 'construtora' or v_last.at < now() - interval '10 minutes' then
    raise exception using errcode = 'BC409', message = 'Não dá mais para desfazer essa recusa.';
  end if;
  if not public.job_is_open(v_job) then
    raise exception using errcode = 'BC409', message = 'Essa vaga já foi encerrada.';
  end if;
  perform public.application_step(v_app.id, 'desfazer_recusa', 'construtora');
  delete from public.notifications
   where kind = 'nao_selecionado' and worker_id = p_worker_id and target = '/vaga/' || p_job_id and read_at is null;
  get diagnostics v_taken_back = row_count;
  if v_taken_back = 0 then
    select name into v_company from public.companies where id = v_job.company_id;
    perform public.notify(p_worker_id, null, 'candidatura_em_analise', 'Sua candidatura voltou para análise',
      v_company || ' ainda está decidindo sobre ' || public.job_title(v_job) || '.', '/vaga/' || p_job_id);
  end if;
end;
$$;

revoke all on function public.undo_reject(text, uuid) from public, anon;
grant execute on function public.undo_reject(text, uuid) to authenticated;

-- ===== 20261012000300_l11_validacao_perfil.sql =====
-- L11: o banco também confere o nome do perfil (o app confere antes, por campo). NOT VALID: vale para o que
-- for gravado daqui em diante, sem travar linhas antigas.

do $$ begin
  alter table public.workers add constraint workers_name_length
    check (char_length(btrim(name)) between 3 and 80) not valid;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter table public.companies add constraint companies_name_length
    check (char_length(btrim(name)) between 3 and 80) not valid;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter table public.workers add constraint workers_specialties_limit
    check (cardinality(specialties) <= 10) not valid;
exception when duplicate_object then null;
end $$;

-- ===== 20261012000400_l14_maior_idade.sql =====
-- L14: os termos exigem 18 anos ou mais. O cadastro com lado definido precisa trazer a confirmação
-- ("Tenho 18 anos ou mais") nos metadados; sem ela, o Auth recusa.

create or replace function public.claim_document_v2()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_digits text := regexp_replace(coalesce(m->>'documento', ''), '[^0-9]', '', 'g');
  v_role public.app_role := case
    when m->>'role' in ('trabalhador', 'recrutador') then (m->>'role')::public.app_role
    when m->>'tipo' = 'pedreiro' then 'trabalhador'
    when m->>'tipo' = 'construtora' then 'recrutador'
  end;
begin
  if v_role is not null and not public.document_valid_for(v_role, v_digits) then
    raise exception using errcode = 'BC422', message = 'Documento inválido.';
  end if;
  if v_role is not null and not public.whatsapp_valid(m->>'whatsapp') then
    raise exception using errcode = 'BC422', message = 'WhatsApp inválido.';
  end if;
  if v_role is not null and coalesce(m->>'maior_de_idade', '') <> 'true' then
    raise exception using errcode = 'BC422', message = 'A Bicos é só para maiores de 18 anos.';
  end if;
  if length(v_digits) > 0 then
    perform public.claim_document_for(new.id, v_digits);
  end if;
  perform set_config('bicos.cadastro_documento', v_digits, true);
  new.raw_user_meta_data := m - 'documento';
  return new;
end;
$$;

revoke all on function public.claim_document_v2() from public, anon, authenticated;

-- ===== 20261012000500_f12_presenca.sql =====
-- F12: confirmar presença. O contratado confirma que vai ("Confirmar que vou"); a construtora vê quem
-- confirmou. Na véspera, às 18h, quem ainda não confirmou recebe o lembrete. Mudar as datas da vaga zera as
-- confirmações. ("Não vou poder ir" continua sendo a desistência que já existe.)

alter type public.notification_kind add value if not exists 'confirmar_presenca';

alter table public.applications add column if not exists presence_confirmed_at timestamptz;

create or replace function public.confirm_presence(p_job_id text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_app public.applications;
  v_job public.jobs;
  v_worker text;
begin
  select * into v_app from public.applications
   where job_id = p_job_id and worker_id = public.my_worker_id() for update;
  if not found then
    raise exception using errcode = 'BC404', message = 'Essa candidatura não existe mais.';
  end if;
  if v_app.status <> 'contratado' then
    raise exception using errcode = 'BC409', message = 'Só quem está contratado confirma presença.';
  end if;
  select * into v_job from public.jobs where id = p_job_id;
  if public.job_last_day(v_job) < public.bicos_today() then
    raise exception using errcode = 'BC409', message = 'Esse bico já passou.';
  end if;
  if v_app.presence_confirmed_at is not null then return; end if;
  update public.applications set presence_confirmed_at = now() where id = v_app.id;
  select name into v_worker from public.workers where id = v_app.worker_id;
  perform public.notify(null, v_job.company_id, 'confirmar_presenca',
    coalesce(nullif(public.first_name(v_worker), ''), 'O trabalhador') || ' confirmou que vai',
    public.job_title(v_job) || case when v_job.start_date is not null
                                     then ' · ' || to_char(v_job.start_date, 'DD/MM') else '' end || '.',
    '/vaga-gerenciar/' || p_job_id);
end;
$$;

-- Véspera: avisa quem está contratado para amanhã e ainda não confirmou. Devolve quantos avisou.
create or replace function public.remind_presence()
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_tomorrow date := public.bicos_today() + 1;
  r record;
  n integer := 0;
begin
  for r in
    select a.worker_id, j.id as job_id, public.job_title(j) as title, c.name as company
      from public.applications a
      join public.jobs j on j.id = a.job_id
      join public.companies c on c.id = j.company_id
     where a.status = 'contratado' and a.presence_confirmed_at is null
       and not j.closed and j.deleted_at is null
       and public.job_runs_on(j, v_tomorrow)
       and not exists (
         select 1 from public.notifications nn
          where nn.worker_id = a.worker_id and nn.kind = 'confirmar_presenca'
            and nn.target = '/selecionado/' || j.id and nn.created_at > now() - interval '20 hours')
  loop
    perform public.notify(r.worker_id, null, 'confirmar_presenca', 'Amanhã tem bico',
      r.title || ' com ' || r.company || '. Confirme que você vai.', '/selecionado/' || r.job_id);
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- Datas da vaga mudaram: as confirmações antigas não valem mais.
create or replace function public.reset_presence_on_new_dates()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.start_date is distinct from old.start_date or new.end_date is distinct from old.end_date
     or new.date_to_arrange is distinct from old.date_to_arrange or new.dias is distinct from old.dias then
    update public.applications set presence_confirmed_at = null
     where job_id = new.id and presence_confirmed_at is not null;
  end if;
  return null;
end;
$$;
drop trigger if exists jobs_reset_presence on public.jobs;
create trigger jobs_reset_presence after update of start_date, end_date, date_to_arrange, dias on public.jobs
  for each row execute function public.reset_presence_on_new_dates();

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'bicos-lembrar-presenca';
    -- 21h UTC = 18h em Brasília.
    perform cron.schedule('bicos-lembrar-presenca', '0 21 * * *', 'select public.remind_presence()');
  end if;
end $$;

revoke all on function public.confirm_presence(text), public.remind_presence(), public.reset_presence_on_new_dates()
  from public, anon, authenticated;
grant execute on function public.confirm_presence(text) to authenticated;

-- ===== 20261012000600_f15_responsavel.sql =====
-- F15: o nome de quem fala com os candidatos pela construtora ("Fale com Ana"). Vem do cadastro
-- (metadado `responsavel`) e é editável no perfil da empresa.

alter table public.companies add column if not exists contact_name text;
do $$ begin
  alter table public.companies add constraint companies_contact_name_length
    check (contact_name is null or char_length(btrim(contact_name)) between 2 and 60);
exception when duplicate_object then null;
end $$;
grant select (contact_name) on public.companies to authenticated;
grant update (contact_name) on public.companies to authenticated;

create or replace function public.handle_new_user_v2()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_document text := coalesce(nullif(m->>'documento', ''), nullif(current_setting('bicos.cadastro_documento', true), ''));
  v_role public.app_role := case
    when m->>'role' in ('trabalhador', 'recrutador') then (m->>'role')::public.app_role
    when m->>'tipo' = 'pedreiro' then 'trabalhador'
    when m->>'tipo' = 'construtora' then 'recrutador'
  end;
  v_contact text := nullif(btrim(left(coalesce(m->>'responsavel', ''), 60)), '');
begin
  perform set_config('bicos.cadastro_documento', '', true);
  -- Sem lado definido (ex.: login com Google): a conta nasce depois, em "Escolher perfil".
  if v_role is null then return new; end if;
  perform public.create_account_for(
    new.id, new.email, v_role, m->>'nome', v_document, m->>'whatsapp', m->>'terms_version',
    new.email_confirmed_at
  );
  if v_role = 'recrutador' and char_length(coalesce(v_contact, '')) >= 2 then
    update public.companies set contact_name = v_contact where id = new.id;
  end if;
  return new;
end;
$$;

revoke all on function public.handle_new_user_v2() from public, anon, authenticated;

-- ===== 20261012000700_l10_cnpj_receita.sql =====
-- L10: verificação automática do CNPJ (situação "ativa" na Receita, pela BrasilAPI) e vaga recusada para
-- construtora reprovada.
--
-- - company_cnpj_for_check: o CNPJ completo da construtora (decifrado de accounts.document_cipher), só para a
--   Edge Function verificar-cnpj (service_role). CPF não volta (fica para conferência manual).
-- - publish_job: construtora "reprovada" não publica. "Pendente" publica normalmente (decisão em DECISOES.md).

create or replace function public.company_cnpj_for_check(p_company uuid)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare
  v_key text;
  v_doc text;
begin
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'nivotech_documento_key';
  if v_key is null then return null; end if;
  select extensions.pgp_sym_decrypt(a.document_cipher, v_key) into v_doc
    from public.accounts a where a.company_id = p_company and a.document_cipher is not null;
  return case when length(v_doc) = 14 then v_doc end;
end;
$$;

create or replace function public.publish_job(p jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_company uuid := public.my_company_id();
  j public.jobs;
  x record;
  v_id text;
begin
  if v_company is null then
    raise exception using errcode = 'BC401', message = 'Só a conta de construtora pode publicar vagas.';
  end if;
  if not exists (select 1 from public.accounts where id = auth.uid() and profile_completed_at is not null) then
    raise exception using errcode = 'BC409', message = 'Complete o perfil da empresa antes de publicar.';
  end if;
  if exists (select 1 from public.companies where id = v_company and verification_status = 'reprovada') then
    raise exception using errcode = 'BC409',
      message = 'Não conseguimos verificar sua empresa. Fale com a gente pela Ajuda para voltar a publicar.';
  end if;
  j := public.job_from_draft(p);
  x := public.job_extras_from_draft(p);
  insert into public.jobs (
    company_id, oficio_id, title, pay, cep, street, number, complement, neighborhood, city, uf, lat, lon,
    date_to_arrange, start_date, end_date, start_time, end_time, diarias, dias, urgent, photos, slots,
    description, requirements, payment_method, payment_note
  ) values (
    v_company, j.oficio_id, j.title, j.pay, j.cep, j.street, j.number, j.complement, j.neighborhood, j.city,
    j.uf, j.lat, j.lon, j.date_to_arrange, j.start_date, j.end_date, j.start_time, j.end_time, j.diarias,
    j.dias, j.urgent, j.photos, j.slots, j.description, j.requirements, x.method, x.note
  ) returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.company_cnpj_for_check(uuid) from public, anon, authenticated;
grant execute on function public.company_cnpj_for_check(uuid) to service_role;
revoke all on function public.publish_job(jsonb) from public, anon;
grant execute on function public.publish_job(jsonb) to authenticated;

-- ===== 20261012000800_l13_conta_google.sql =====
-- L13: conta nova pelo Google. O Auth cria o usuário sem lado (sem `role` nos metadados), então nenhuma conta
-- nasce no gatilho; a pessoa escolhe o lado e completa CPF/CNPJ, WhatsApp e o aceite em "Completar
-- cadastro", que chama create_my_account. As mesmas regras do cadastro por e-mail (Y17, Y25, L14, Z07).

create or replace function public.create_my_account(
  p_role public.app_role, p_name text, p_document text, p_whatsapp text, p_terms_version text,
  p_adult boolean, p_contact_name text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_user auth.users;
  v_digits text := regexp_replace(coalesce(p_document, ''), '[^0-9]', '', 'g');
  v_contact text := nullif(btrim(left(coalesce(p_contact_name, ''), 60)), '');
begin
  select * into v_user from auth.users where id = auth.uid();
  if not found then
    raise exception using errcode = 'BC401', message = 'Entre na sua conta de novo para continuar.';
  end if;
  if exists (select 1 from public.accounts where id = v_user.id) then return; end if;
  if coalesce(p_adult, false) is not true then
    raise exception using errcode = 'BC422', message = 'A Bicos é só para maiores de 18 anos.';
  end if;
  if nullif(btrim(coalesce(p_name, '')), '') is null or char_length(btrim(p_name)) < 3 then
    raise exception using errcode = 'BC422', message = 'Informe seu nome completo.';
  end if;
  if not public.document_valid_for(p_role, v_digits) then
    raise exception using errcode = 'BC422', message = 'Documento inválido.';
  end if;
  if not public.whatsapp_valid(p_whatsapp) then
    raise exception using errcode = 'BC422', message = 'Confira o número: celular com DDD, 11 números.';
  end if;
  if nullif(p_terms_version, '') is null then
    raise exception using errcode = 'BC422', message = 'Aceite os termos para criar a conta.';
  end if;
  -- O documento de outra conta confirmada recusa sem dizer de quem (Z07): BC409 genérico.
  begin
    perform public.create_account_for(
      v_user.id, v_user.email, p_role, btrim(p_name), v_digits, p_whatsapp, p_terms_version,
      coalesce(v_user.email_confirmed_at, now())
    );
  exception when sqlstate 'BC409' then
    raise exception using errcode = 'BC409', message = 'Não deu para criar a conta com esses dados.';
  end;
  if p_role = 'recrutador' and char_length(coalesce(v_contact, '')) >= 2 then
    update public.companies set contact_name = v_contact where id = v_user.id;
  end if;
end;
$$;

revoke all on function public.create_my_account(public.app_role, text, text, text, text, boolean, text)
  from public, anon;
grant execute on function public.create_my_account(public.app_role, text, text, text, text, boolean, text)
  to authenticated;

-- ===== 20261012000900_f18_membros.sql =====
-- F18: modelo preparado para mais de uma pessoa por construtora (sem tela agora). Hoje a conta da
-- construtora é a própria empresa (accounts.company_id = id). A tabela registra quem é membro e com que papel;
-- quando houver a tela de convidar, my_company_id() passa a ler daqui.

do $$ begin
  create type public.company_member_role as enum ('dono', 'recrutador');
exception when duplicate_object then null;
end $$;

create table if not exists public.company_members (
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.company_member_role not null default 'recrutador',
  created_at timestamptz not null default now(),
  primary key (company_id, user_id)
);
alter table public.company_members enable row level security;
revoke all on public.company_members from anon, authenticated;
grant select on public.company_members to authenticated;
drop policy if exists "Membro vê a própria construtora" on public.company_members;
create policy "Membro vê a própria construtora" on public.company_members
  for select to authenticated using (user_id = (select auth.uid()));

-- Cada construtora que já existe tem a própria conta como dona; as novas também.
insert into public.company_members (company_id, user_id, role)
select a.company_id, a.id, 'dono' from public.accounts a
 where a.company_id is not null
on conflict do nothing;

create or replace function public.company_owner_member()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.company_id is not null then
    insert into public.company_members (company_id, user_id, role) values (new.company_id, new.id, 'dono')
    on conflict do nothing;
  end if;
  return null;
end;
$$;
drop trigger if exists accounts_company_owner on public.accounts;
create trigger accounts_company_owner after insert on public.accounts
  for each row execute function public.company_owner_member();
revoke all on function public.company_owner_member() from public, anon, authenticated;

-- ===== 20261012033541_habilitar_pg_net.sql =====
-- Trazida da produção (L09): aplicada lá em 12/10 pelo conector do Supabase e nunca versionada. Mesmo comando
-- que ficou no histórico da produção; o L09 (20261016000100_lanc09_pg_net) tira a extensão do `public` depois.
create extension if not exists pg_net;

-- ===== 20261013000100_f09_vaga_publica.sql =====
-- F09: a página pública da vaga (link compartilhado), que abre sem login. Só o que o mural já mostra para
-- quem está logado: área (bairro/cidade), datas, valor, descrição, requisitos, pagamento e a construtora (nome,
-- logo, nota, selo). Nunca o endereço exato nem contato. Vaga excluída não abre.

create or replace function public.public_job_card(p_job_id text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', j.id, 'oficio_id', j.oficio_id, 'title', j.title, 'pay', j.pay,
    'neighborhood', j.neighborhood, 'city', j.city, 'uf', j.uf,
    'date_to_arrange', j.date_to_arrange, 'start_date', j.start_date, 'end_date', j.end_date,
    'start_time', j.start_time, 'end_time', j.end_time, 'diarias', j.diarias, 'dias', j.dias,
    'slots', j.slots, 'urgent', j.urgent, 'photos', j.photos, 'description', j.description,
    'requirements', j.requirements, 'payment_method', j.payment_method, 'payment_note', j.payment_note,
    'created_at', j.created_at,
    'aberta', public.job_is_open(j) and public.job_holding(j.id) < j.slots,
    'company', jsonb_build_object('name', c.name, 'logo_url', c.logo_url, 'rating', c.rating,
                                  'review_count', c.review_count, 'verified', c.verified)
  )
  from public.jobs j join public.companies c on c.id = j.company_id
  where j.id = p_job_id and j.deleted_at is null
$$;

revoke all on function public.public_job_card(text) from public;
grant execute on function public.public_job_card(text) to anon, authenticated;

-- ===== 20261013000200_f10_perfil_profissional.sql =====
-- F10: perfil profissional do trabalhador — dias disponíveis, anos de experiência, diária pretendida,
-- distância que topa ir e uma bio curta. Os "fatos" que a construtora vê vêm desses campos (os fatos antigos,
-- escritos à mão, deixam de aparecer). A construtora também vê quantas faltas e desistências a pessoa teve
-- (o diálogo de falta já promete isso).

alter table public.workers
  add column if not exists availability text,
  add column if not exists years_experience smallint,
  add column if not exists desired_pay integer,
  add column if not exists travel_km smallint,
  add column if not exists bio text;
do $$ begin
  alter table public.workers add constraint workers_professional_check check (
    (availability is null or availability in ('semana', 'fimdesemana', 'qualquer'))
    and (years_experience is null or years_experience between 0 and 60)
    and (desired_pay is null or desired_pay between 80 and 2000)
    and (travel_km is null or travel_km between 1 and 100)
    and (bio is null or char_length(bio) <= 280)
  );
exception when duplicate_object then null;
end $$;
grant select (availability, years_experience, desired_pay, travel_km, bio) on public.workers to authenticated;
grant update (availability, years_experience, desired_pay, travel_km, bio) on public.workers to authenticated;

-- Faltas e desistências de cada trabalhador (para construtoras e para a própria pessoa).
create or replace function public.worker_track_record(p_worker_ids uuid[])
returns table (worker_id uuid, faltas integer, desistencias integer)
language sql stable security definer set search_path = public as $$
  select w.id,
         (select count(*)::int from public.applications a where a.worker_id = w.id and a.status = 'nao_compareceu'),
         (select count(*)::int from public.applications a where a.worker_id = w.id and a.status = 'desistiu')
    from public.workers w
   where w.id = any (p_worker_ids)
     and (public.my_company_id() is not null or w.id = public.my_worker_id())
$$;
revoke all on function public.worker_track_record(uuid[]) from public, anon;
grant execute on function public.worker_track_record(uuid[]) to authenticated;

-- ===== 20261013000300_f13_convite.sql =====
-- F13: a construtora convida um trabalhador para uma vaga aberta (da busca ou do perfil). Ele aceita — vira
-- candidatura, com as regras de sempre (submit_application) — ou recusa. Os dois lados recebem o aviso.

alter type public.notification_kind add value if not exists 'convite';

create table if not exists public.job_invites (
  job_id text not null references public.jobs (id) on delete cascade,
  worker_id uuid not null references public.workers (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  status text not null default 'pendente' check (status in ('pendente', 'aceito', 'recusado')),
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  primary key (job_id, worker_id)
);
create index if not exists job_invites_worker_idx on public.job_invites (worker_id);
alter table public.job_invites enable row level security;
revoke all on public.job_invites from anon, authenticated;
grant select on public.job_invites to authenticated;
drop policy if exists "Convite visível aos dois lados" on public.job_invites;
create policy "Convite visível aos dois lados" on public.job_invites
  for select to authenticated
  using (worker_id = (select public.my_worker_id()) or company_id = (select public.my_company_id()));

create or replace function public.invite_worker(p_job_id text, p_worker_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_job public.jobs := public.own_job_for_update(p_job_id);
  v_company text;
  v_count integer;
begin
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
$$;

create or replace function public.answer_invite(p_job_id text, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_invite public.job_invites;
  v_worker text;
begin
  select * into v_invite from public.job_invites
   where job_id = p_job_id and worker_id = public.my_worker_id() for update;
  if not found then
    raise exception using errcode = 'BC404', message = 'Esse convite não existe mais.';
  end if;
  if v_invite.status <> 'pendente' then return; end if;
  if p_accept then
    perform public.submit_application(p_job_id);  -- mesmas regras de sempre (vaga cheia, encerrada…)
  end if;
  update public.job_invites set status = case when p_accept then 'aceito' else 'recusado' end, answered_at = now()
   where job_id = p_job_id and worker_id = v_invite.worker_id;
  select name into v_worker from public.workers where id = v_invite.worker_id;
  perform public.notify(null, v_invite.company_id, 'convite',
    coalesce(nullif(public.first_name(v_worker), ''), 'O trabalhador') ||
      case when p_accept then ' aceitou o convite' else ' recusou o convite' end,
    case when p_accept then 'A candidatura já está na lista da vaga.' else 'Convide outra pessoa ou espere candidatos.' end,
    '/vaga-gerenciar/' || p_job_id);
end;
$$;

revoke all on function public.invite_worker(text, uuid), public.answer_invite(text, boolean) from public, anon;
grant execute on function public.invite_worker(text, uuid), public.answer_invite(text, boolean) to authenticated;

-- ===== 20261013000400_f04_denuncia_bloqueio.sql =====
-- F04: denunciar (vaga, perfil, avaliação, post) e bloquear uma conta.
--
-- - reports: a denúncia, com motivo; só quem denunciou lê a própria (a equipe lê pelo painel).
-- - blocks: quem bloqueou quem. Bloquear encerra as candidaturas pendentes entre os dois e impede novas
--   candidaturas e convites (gatilhos), nos dois sentidos. O app tira os bloqueados do mural e da busca.

do $$ begin
  create type public.report_target as enum ('vaga', 'perfil', 'avaliacao', 'post');
exception when duplicate_object then null;
end $$;

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users (id) on delete cascade,
  target_type public.report_target not null,
  target_id text not null,
  reason text not null check (reason in ('golpe', 'ofensa', 'falso', 'perigoso', 'spam', 'outro')),
  details text check (details is null or char_length(details) <= 500),
  status text not null default 'aberta' check (status in ('aberta', 'analisada')),
  created_at timestamptz not null default now(),
  unique (reporter_id, target_type, target_id)
);
alter table public.reports enable row level security;
revoke all on public.reports from anon, authenticated;
grant select on public.reports to authenticated;
drop policy if exists "Quem denunciou vê a própria denúncia" on public.reports;
create policy "Quem denunciou vê a própria denúncia" on public.reports
  for select to authenticated using (reporter_id = (select auth.uid()));

create table if not exists public.blocks (
  blocker_id uuid not null references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table public.blocks enable row level security;
revoke all on public.blocks from anon, authenticated;
grant select on public.blocks to authenticated;
drop policy if exists "Quem bloqueou vê os próprios bloqueios" on public.blocks;
create policy "Quem bloqueou vê os próprios bloqueios" on public.blocks
  for select to authenticated using (blocker_id = (select auth.uid()));

-- Um bloqueio entre as duas contas, em qualquer sentido?
create or replace function public.blocked_between(p_a uuid, p_b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.blocks
                  where (blocker_id = p_a and blocked_id = p_b) or (blocker_id = p_b and blocked_id = p_a))
$$;

create or replace function public.report_content(
  p_target_type public.report_target, p_target_id text, p_reason text, p_details text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_count integer;
begin
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
$$;

create or replace function public.block_account(p_account uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then
    raise exception using errcode = 'BC401', message = 'Entre na sua conta de novo para continuar.';
  end if;
  if p_account = v_me or not exists (select 1 from public.accounts where id = p_account) then
    raise exception using errcode = 'BC404', message = 'Essa conta não existe mais.';
  end if;
  insert into public.blocks (blocker_id, blocked_id) values (v_me, p_account) on conflict do nothing;
  -- Candidaturas e convites pendentes entre os dois deixam de existir.
  delete from public.applications a using public.jobs j
   where j.id = a.job_id and a.status in ('enviada', 'em_analise')
     and ((a.worker_id = v_me and j.company_id = p_account) or (a.worker_id = p_account and j.company_id = v_me));
  delete from public.job_invites
   where status = 'pendente'
     and ((worker_id = v_me and company_id = p_account) or (worker_id = p_account and company_id = v_me));
end;
$$;

create or replace function public.unblock_account(p_account uuid)
returns void language sql security definer set search_path = public as $$
  delete from public.blocks where blocker_id = auth.uid() and blocked_id = p_account
$$;

-- Ninguém se candidata nem convida através de um bloqueio.
create or replace function public.refuse_blocked_application()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_company uuid;
begin
  select company_id into v_company from public.jobs where id = new.job_id;
  if public.blocked_between(new.worker_id, v_company) then
    raise exception using errcode = 'BC409', message = 'Não é possível se candidatar a essa vaga.';
  end if;
  return new;
end;
$$;
drop trigger if exists applications_refuse_blocked on public.applications;
create trigger applications_refuse_blocked before insert on public.applications
  for each row execute function public.refuse_blocked_application();

create or replace function public.refuse_blocked_invite()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.blocked_between(new.worker_id, new.company_id) then
    raise exception using errcode = 'BC409', message = 'Não é possível convidar essa pessoa.';
  end if;
  return new;
end;
$$;
drop trigger if exists job_invites_refuse_blocked on public.job_invites;
create trigger job_invites_refuse_blocked before insert on public.job_invites
  for each row execute function public.refuse_blocked_invite();

revoke all on function public.blocked_between(uuid, uuid), public.refuse_blocked_application(),
  public.refuse_blocked_invite() from public, anon, authenticated;
revoke all on function public.report_content(public.report_target, text, text, text), public.block_account(uuid),
  public.unblock_account(uuid) from public, anon;
grant execute on function public.report_content(public.report_target, text, text, text), public.block_account(uuid),
  public.unblock_account(uuid) to authenticated;

-- ===== 20261013000500_f06_preferencias_aviso.sql =====
-- F06: preferências de aviso por tipo e canal. Grupos: candidaturas, lembretes, bicos_novos (bico novo,
-- urgente, convite) e conta. No sino do app, só "bicos_novos" pode ser silenciado (o resto é o andamento do
-- próprio bico e sempre chega). O push escolhe os grupos (X03 lê `push_groups`). E-mail fica para depois.

create table if not exists public.notification_prefs (
  account_id uuid primary key references auth.users (id) on delete cascade,
  muted_groups text[] not null default '{}',
  push_groups text[] not null default array['candidaturas', 'lembretes', 'bicos_novos', 'conta'],
  updated_at timestamptz not null default now(),
  check (muted_groups <@ array['bicos_novos']::text[]),
  check (push_groups <@ array['candidaturas', 'lembretes', 'bicos_novos', 'conta']::text[])
);
alter table public.notification_prefs enable row level security;
revoke all on public.notification_prefs from anon, authenticated;
grant select on public.notification_prefs to authenticated;
drop policy if exists "Cada um lê as próprias preferências" on public.notification_prefs;
create policy "Cada um lê as próprias preferências" on public.notification_prefs
  for select to authenticated using (account_id = (select auth.uid()));

create or replace function public.notification_group(p_kind public.notification_kind)
returns text language sql immutable set search_path = public as $$
  select case
    when p_kind::text in ('bico_novo', 'bico_urgente', 'convite') then 'bicos_novos'
    when p_kind::text in ('confirmar_presenca', 'avaliar_diaria', 'avaliar_trabalhador') then 'lembretes'
    when p_kind::text in ('verificacao', 'impulsionamento') then 'conta'
    else 'candidaturas'
  end
$$;

create or replace function public.save_notification_prefs(p_muted text[], p_push text[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception using errcode = 'BC401', message = 'Entre na sua conta de novo para continuar.';
  end if;
  if not (coalesce(p_muted, '{}') <@ array['bicos_novos']::text[])
     or not (coalesce(p_push, '{}') <@ array['candidaturas', 'lembretes', 'bicos_novos', 'conta']::text[]) then
    raise exception using errcode = 'BC422', message = 'Preferência inválida.';
  end if;
  insert into public.notification_prefs (account_id, muted_groups, push_groups)
  values (auth.uid(), coalesce(p_muted, '{}'), coalesce(p_push, '{}'))
  on conflict (account_id) do update
    set muted_groups = excluded.muted_groups, push_groups = excluded.push_groups, updated_at = now();
end;
$$;

-- O aviso respeita o que a pessoa silenciou (a conta é o próprio id do trabalhador ou da construtora).
create or replace function public.notify(
  p_worker uuid, p_company uuid, p_kind public.notification_kind, p_title text, p_body text, p_target text
) returns void language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1 from public.notification_prefs np
     where np.account_id = coalesce(p_worker, p_company)
       and public.notification_group(p_kind) = any (np.muted_groups)
  ) then
    return;
  end if;
  insert into public.notifications (worker_id, company_id, kind, title, body, target)
  values (p_worker, p_company, p_kind, p_title, p_body, p_target);
end;
$$;

revoke all on function public.notify(uuid, uuid, public.notification_kind, text, text, text) from public, anon, authenticated;
revoke all on function public.save_notification_prefs(text[], text[]) from public, anon;
grant execute on function public.save_notification_prefs(text[], text[]) to authenticated;

-- ===== 20261013000600_f16_portfolio.sql =====
-- F16: portfólio — legenda de até 280 caracteres e editável pelo dono do post.

do $$ begin
  alter table public.worker_posts add constraint worker_posts_caption_length check (char_length(caption) <= 280) not valid;
exception when duplicate_object then null;
end $$;

grant update (caption) on public.worker_posts to authenticated;
drop policy if exists "Trabalhador edita a legenda do próprio post" on public.worker_posts;
create policy "Trabalhador edita a legenda do próprio post" on public.worker_posts
  for update to authenticated
  using (worker_id = (select public.my_worker_id()))
  with check (worker_id = (select public.my_worker_id()));

-- ===== 20261013000700_f07_identidade.sql =====
-- F07: verificação de identidade do trabalhador (selfie + foto do documento). Estados: nao_enviado,
-- em_analise, verificado, recusado (com motivo). Os arquivos ficam no bucket PRIVADO `identidade`, na pasta
-- do próprio trabalhador; só ele envia e só a equipe (service_role) lê. O selo "Verificado" (workers.verified)
-- passa a significar exatamente isso.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('identidade', 'identidade', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Trabalhador envia a própria identidade" on storage.objects;
create policy "Trabalhador envia a própria identidade" on storage.objects for insert to authenticated
  with check (bucket_id = 'identidade' and (storage.foldername(name))[1] = (select auth.uid())::text
              and public.my_worker_id() is not null);
-- Sem política de select/update/delete para authenticated: ninguém lê os arquivos pelo app.

alter type public.notification_kind add value if not exists 'verificacao';

alter table public.workers
  add column if not exists identity_status text not null default 'nao_enviado',
  add column if not exists identity_reason text,
  add column if not exists identity_submitted_at timestamptz;
do $$ begin
  alter table public.workers add constraint workers_identity_status_check
    check (identity_status in ('nao_enviado', 'em_analise', 'verificado', 'recusado'));
exception when duplicate_object then null;
end $$;

create table if not exists public.identity_submissions (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.workers (id) on delete cascade,
  selfie_path text not null,
  document_path text not null,
  created_at timestamptz not null default now()
);
alter table public.identity_submissions enable row level security;
revoke all on public.identity_submissions from anon, authenticated;

-- O selo acompanha o status (quem já era "verificado" antes desta regra continua até a equipe revisar).
create or replace function public.sync_worker_verified()
returns trigger language plpgsql set search_path = public as $$
begin
  new.verified := new.identity_status = 'verificado';
  return new;
end;
$$;
drop trigger if exists workers_sync_verified on public.workers;
create trigger workers_sync_verified before update of identity_status on public.workers
  for each row execute function public.sync_worker_verified();
update public.workers set identity_status = 'verificado' where verified and identity_status = 'nao_enviado';

create or replace function public.submit_identity(p_selfie_path text, p_document_path text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_worker uuid := public.my_worker_id();
  v_prefix text := auth.uid()::text || '/';
begin
  if v_worker is null then
    raise exception using errcode = 'BC401', message = 'Só a conta de trabalhador verifica a identidade.';
  end if;
  if left(coalesce(p_selfie_path, ''), length(v_prefix)) <> v_prefix
     or left(coalesce(p_document_path, ''), length(v_prefix)) <> v_prefix then
    raise exception using errcode = 'BC422', message = 'Envie a selfie e a foto do documento de novo.';
  end if;
  if exists (select 1 from public.workers where id = v_worker and identity_status in ('em_analise', 'verificado')) then
    raise exception using errcode = 'BC409', message = 'Sua identidade já está em análise ou verificada.';
  end if;
  insert into public.identity_submissions (worker_id, selfie_path, document_path)
  values (v_worker, p_selfie_path, p_document_path);
  update public.workers set identity_status = 'em_analise', identity_reason = null, identity_submitted_at = now()
   where id = v_worker;
end;
$$;

-- O status e o motivo do próprio trabalhador.
create or replace function public.my_identity()
returns table (status text, reason text, submitted_at timestamptz)
language sql stable security definer set search_path = public as $$
  select identity_status, identity_reason, identity_submitted_at from public.workers where id = public.my_worker_id()
$$;

-- A equipe decide (painel do Supabase, service_role).
create or replace function public.set_identity_status(p_worker uuid, p_status text, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_status not in ('verificado', 'recusado') then
    raise exception using errcode = 'BC422', message = 'Status inválido.';
  end if;
  if p_status = 'recusado' and nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception using errcode = 'BC422', message = 'Diga o motivo da recusa.';
  end if;
  update public.workers set identity_status = p_status,
         identity_reason = case when p_status = 'recusado' then btrim(p_reason) end
   where id = p_worker;
  if not found then
    raise exception using errcode = 'BC404', message = 'Trabalhador não encontrado.';
  end if;
  perform public.notify(p_worker, null, 'verificacao',
    case when p_status = 'verificado' then 'Identidade verificada' else 'Não conseguimos verificar sua identidade' end,
    case when p_status = 'verificado' then 'O selo "Verificado" já aparece no seu perfil.'
         else 'Motivo: ' || btrim(p_reason) || '. Envie as fotos de novo.' end,
    '/perfil/verificar');
end;
$$;

grant select (identity_status) on public.workers to authenticated;
revoke all on function public.sync_worker_verified(), public.submit_identity(text, text), public.my_identity(),
  public.set_identity_status(uuid, text, text) from public, anon, authenticated;
grant execute on function public.submit_identity(text, text), public.my_identity() to authenticated;
grant execute on function public.set_identity_status(uuid, text, text) to service_role;

-- ===== 20261014000100_x13_avisos_seguranca.sql =====
-- X13: zera os avisos de segurança do Supabase que se aplicam.
--
-- 1. PostGIS sai do schema `public` (aviso "extension_in_public" e o ERRO "rls_disabled_in_public" da
--    tabela `spatial_ref_sys`, que é do PostGIS e não aceita RLS de quem não é dono). O PostGIS não aceita
--    `alter extension … set schema`, então é reinstalado em `extensions` (fora da API). As colunas
--    geográficas são refeitas: `jobs.area_geog` é calculada da latitude/longitude; `vagas.localizacao`
--    (app antigo, desligado no Z08) estava vazia no banco (conferido: 0 de 3 linhas com ponto) e volta
--    vazia, com o mesmo tipo.
-- 2. `search_path` fixo nas três funções do app antigo que não tinham.
-- 3. Nenhuma função `security definer` do schema `public` fica executável por visitante (`anon`), a não
--    ser a vaga pública (F09); e as funções novas deixam de nascer abertas a visitantes.
-- 4. `buscar_perfis` (app antigo) fica fechada para todos.
--
-- O aviso "authenticated_security_definer_function_executable" lista as RPCs que o app chama logado: é o
-- desenho (regras no banco, em funções security definer com search_path fixo) e não se aplica.
-- "Leaked password protection" é uma opção do painel (Authentication › Policies) — ver SUPABASE.md.
-- Idempotente.

-- 1. PostGIS em `extensions` ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_extension e join pg_namespace n on n.oid = e.extnamespace
              where e.extname = 'postgis' and n.nspname = 'public') then
    drop extension postgis cascade;
  end if;
end $$;
create schema if not exists extensions;
create extension if not exists postgis with schema extensions;

do $$
begin
  if to_regclass('public.vagas') is not null then
    alter table public.vagas add column if not exists localizacao extensions.geography(Point, 4326);
    create index if not exists vagas_localizacao_idx on public.vagas using gist (localizacao);
  end if;
end $$;

alter table public.jobs
  add column if not exists area_geog extensions.geography(Point, 4326)
  generated always as (
    extensions.st_setsrid(
      extensions.st_makepoint(round(lon::numeric, 2)::double precision, round(lat::numeric, 2)::double precision),
      4326
    )::extensions.geography
  ) stored;
create index if not exists jobs_area_geog_idx on public.jobs using gist (area_geog);

-- As funções que medem distância passam a achar o PostGIS no novo lugar (lista fixa, como antes).
alter function public.feed_jobs(text, text, double precision, double precision, integer, text, text, text,
  boolean, text, integer, jsonb) set search_path = public, extensions;
alter function public.notify_job_alerts() set search_path = public, extensions;

-- 2. search_path fixo -----------------------------------------------------------------------------------
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.proname in ('impedir_troca_de_tipo', 'travar_autor_da_vaga', 'expirar_vagas_vencidas')
  loop
    execute format('alter function %s set search_path = public', f.sig);
  end loop;
end $$;

-- 3. Visitante só executa o que precisa ----------------------------------------------------------------
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.prosecdef
       and p.proname not in ('public_job_card')
       and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('revoke execute on function %s from public, anon', f.sig);
  end loop;
end $$;

-- Funções criadas daqui em diante não nascem executáveis por visitante: quem precisa ganha `grant` na
-- própria migration (vale para o `postgres`, que roda as migrations).
alter default privileges for role postgres in schema public revoke execute on functions from anon;
-- O EXECUTE para PUBLIC é um padrão global do Postgres (não sai por schema): as funções do `postgres`
-- passam a só valer para quem ganhar grant explícito (no public, os padrões do Supabase já dão a
-- authenticated e service_role).
alter default privileges for role postgres revoke execute on functions from public;

-- 4. App antigo -----------------------------------------------------------------------------------------
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig from pg_proc p
     where p.pronamespace = 'public'::regnamespace and p.proname = 'buscar_perfis'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;

-- ===== 20261014000200_x15_rls_desempenho.sql =====
-- X15: políticas RLS sem chamada de função por linha, índices das chaves estrangeiras e limite contra spam
-- de candidatar/retirar. Também zera os avisos de desempenho das tabelas do app antigo.
-- Idempotente.

-- 1. Candidaturas: a construtora vê as das próprias vagas por um conjunto calculado uma vez por consulta
--    (`job_id in (select my_job_ids())`), não mais `is_my_job(job_id)` linha a linha. A função é security
--    definer para não reaplicar a política de `jobs` (que olha `applications`: seria recursão).
create or replace function public.my_job_ids()
returns setof text language sql stable security definer set search_path = public as $$
  select id from public.jobs where company_id = public.my_company_id()
$$;
revoke all on function public.my_job_ids() from public, anon, authenticated;
grant execute on function public.my_job_ids() to authenticated;

drop policy if exists "Candidatura visível para o trabalhador e para a construtora da vaga" on public.applications;
create policy "Candidatura visível para o trabalhador e para a construtora da vaga" on public.applications
  for select to authenticated
  using (
    worker_id = (select public.my_worker_id())
    or job_id in (select public.my_job_ids())
  );

-- O histórico segue a candidatura pelo mesmo critério, sem reaplicar a política da candidatura por linha.
drop policy if exists "Histórico segue a candidatura" on public.application_events;
create policy "Histórico segue a candidatura" on public.application_events
  for select to authenticated
  using (
    application_id in (
      select a.id from public.applications a
       where a.worker_id = (select public.my_worker_id())
          or a.job_id in (select public.my_job_ids())
    )
  );

-- 2. Índices das chaves estrangeiras (avisos "unindexed_foreign_keys").
create index if not exists accounts_company_idx on public.accounts (company_id);
create index if not exists boost_payments_job_idx on public.boost_payments (job_id);
create index if not exists jobs_oficio_idx on public.jobs (oficio_id);
create index if not exists saved_jobs_job_idx on public.saved_jobs (job_id);
create index if not exists workers_oficio_idx on public.workers (oficio_id);
create index if not exists application_events_app_at_idx on public.application_events (application_id, at);

-- 3. App antigo (desligado no Z08; as tabelas já não têm grant para anon/authenticated, então as políticas
--    nunca rodavam): as políticas saem — sem política, a RLS recusa tudo, que é o que já valia. O app novo
--    lê o que precisa dessas tabelas por funções do próprio banco.
do $$
declare
  p record;
begin
  for p in
    select tablename, policyname from pg_policies
     where schemaname = 'public'
       and tablename in ('profiles', 'vagas', 'candidaturas', 'avaliacoes', 'vagas_salvas',
                         'publicacoes_trabalhador', 'consentimentos')
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;
do $$
begin
  if to_regclass('public.avaliacoes') is not null then
    create index if not exists avaliacoes_avaliador_idx on public.avaliacoes (avaliador_id);
  end if;
  if to_regclass('public.consentimentos') is not null then
    create index if not exists consentimentos_usuario_idx on public.consentimentos (usuario_id);
  end if;
  if to_regclass('public.vagas_salvas') is not null then
    create index if not exists vagas_salvas_vaga_idx on public.vagas_salvas (vaga_id);
  end if;
end $$;

-- 4. Limite contra spam: cada candidatura enviada fica registrada (inclusive as retiradas depois). Até 30
--    por dia por trabalhador e até 3 vezes a mesma vaga por dia (candidatar → retirar → candidatar avisa a
--    construtora a cada vez).
create table if not exists public.application_attempts (
  worker_id uuid not null references public.workers (id) on delete cascade,
  job_id text not null,
  created_at timestamptz not null default now()
);
create index if not exists application_attempts_worker_idx on public.application_attempts (worker_id, created_at);
alter table public.application_attempts enable row level security;
revoke all on public.application_attempts from anon, authenticated;

create or replace function public.limit_application_spam()
returns trigger language plpgsql security definer set search_path = public as $$
begin
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
$$;
revoke all on function public.limit_application_spam() from public, anon, authenticated;

drop trigger if exists limit_application_spam on public.applications;
create trigger limit_application_spam before insert on public.applications
  for each row execute function public.limit_application_spam();

-- Registro com mais de 2 dias não serve para nada: limpeza diária.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'bicos-limpar-tentativas';
    perform cron.schedule('bicos-limpar-tentativas', '17 4 * * *',
      $c$delete from public.application_attempts where created_at < now() - interval '2 days'$c$);
  end if;
end $$;

-- ===== 20261014000300_x03_push.sql =====
-- X03: notificações no celular (Web Push) e o sino certo em qualquer aparelho.
--
-- * `push_subscriptions`: cada aparelho que aceitou receber notificações (o endereço do navegador e as
--   chaves dele). Só a própria conta grava/apaga, por RPC; ninguém lê pela API (a Edge Function `enviar-push`
--   lê com service_role).
-- * Cada aviso novo (`notifications`) chama a Edge Function `enviar-push` pelo pg_net — só se a conta tem
--   aparelho cadastrado e se a URL e o segredo estão no Vault (`bicos_push_url`, `bicos_push_secret`; ver
--   SUPABASE.md). Sem isso, nada acontece (o aviso no sino continua). A função respeita os grupos que a
--   pessoa escolheu (`notification_prefs.push_groups`, F06).
-- * `my_unread_count()`: o número do sino vem do servidor (não só dos 100 avisos carregados).
-- Idempotente.

create table if not exists public.push_subscriptions (
  endpoint text primary key check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  account_id uuid not null references auth.users (id) on delete cascade,
  p256dh text not null check (char_length(p256dh) between 20 and 200),
  auth text not null check (char_length(auth) between 8 and 100),
  user_agent text check (char_length(user_agent) <= 300),
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index if not exists push_subscriptions_account_idx on public.push_subscriptions (account_id);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;

-- Um aparelho só recebe as notificações de quem entrou nele por último (o endereço passa para a conta atual).
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception using errcode = 'BC401', message = 'Entre na sua conta de novo para continuar.';
  end if;
  if p_endpoint !~ '^https://' or char_length(p_endpoint) > 1000
     or char_length(coalesce(p_p256dh, '')) not between 20 and 200
     or char_length(coalesce(p_auth, '')) not between 8 and 100 then
    raise exception using errcode = 'BC422', message = 'Não deu para ativar as notificações neste aparelho.';
  end if;
  if (select count(*) from public.push_subscriptions where account_id = auth.uid() and endpoint <> p_endpoint) >= 10 then
    delete from public.push_subscriptions
     where endpoint = (select endpoint from public.push_subscriptions where account_id = auth.uid()
                        order by coalesce(last_used_at, created_at) limit 1);
  end if;
  insert into public.push_subscriptions (endpoint, account_id, p256dh, auth, user_agent)
  values (p_endpoint, auth.uid(), p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update
    set account_id = excluded.account_id, p256dh = excluded.p256dh, auth = excluded.auth,
        user_agent = excluded.user_agent, created_at = now();
end;
$$;

create or replace function public.delete_push_subscription(p_endpoint text)
returns void language sql security definer set search_path = public as $$
  delete from public.push_subscriptions where endpoint = p_endpoint and account_id = auth.uid()
$$;

create or replace function public.my_unread_count()
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::int from public.notifications
   where read_at is null
     and (worker_id = public.my_worker_id() or company_id = public.my_company_id())
$$;

revoke all on function public.save_push_subscription(text, text, text, text), public.delete_push_subscription(text),
  public.my_unread_count() from public, anon, authenticated;
grant execute on function public.save_push_subscription(text, text, text, text), public.delete_push_subscription(text),
  public.my_unread_count() to authenticated;

-- Aviso novo → Edge Function enviar-push (sem esperar a resposta; falha no envio nunca impede o aviso).
create or replace function public.push_new_notification()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_url text;
  v_secret text;
begin
  if to_regnamespace('net') is null or to_regnamespace('vault') is null then
    return new;
  end if;
  if not exists (select 1 from public.push_subscriptions where account_id = coalesce(new.worker_id, new.company_id)) then
    return new;
  end if;
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1' into v_url using 'bicos_push_url';
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1' into v_secret using 'bicos_push_secret';
  if v_url is null or v_secret is null then
    return new;
  end if;
  execute 'select net.http_post(url := $1, body := $2, headers := $3)'
    using v_url,
          jsonb_build_object('record', jsonb_build_object(
            'id', new.id, 'worker_id', new.worker_id, 'company_id', new.company_id, 'kind', new.kind,
            'title', new.title, 'body', new.body, 'target', new.target)),
          jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secret);
  return new;
exception when others then
  return new;
end;
$$;
revoke all on function public.push_new_notification() from public, anon, authenticated;

drop trigger if exists push_new_notification on public.notifications;
create trigger push_new_notification after insert on public.notifications
  for each row execute function public.push_new_notification();

-- O "lida" de um aparelho chega aos outros pelo Realtime (UPDATE em notifications).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

-- ===== 20261014000400_x09_arquivos_orfaos.sql =====
-- X09: arquivos órfãos saem do Storage. Sobram arquivos quando um envio dá certo e a gravação depois não
-- (sinal caiu), quando uma vaga troca ou perde fotos, quando a vaga é excluída. E as fotos de identidade (F07)
-- não ficam guardadas além do necessário: 30 dias depois da decisão da equipe, saem.
--
-- * orphan_storage_objects(limite): o que pode ser apagado — arquivo com mais de 1 dia nos buckets avatars,
--   portfolio e vagas que nenhuma linha usa (perfil, capa, logo, post, fotos da vaga), e na `identidade`
--   o que não é de nenhum envio ou é de um envio decidido há mais de 30 dias. Só para service_role.
-- * O apagar de verdade é pela API do Storage (o arquivo e o registro): Edge Function `limpar-arquivos`,
--   chamada todo dia às 4h40 pelo pg_cron via pg_net (URL e segredo no Vault: bicos_cleanup_url,
--   bicos_cleanup_secret; sem eles, nada acontece).
-- Arquivos de antes do app novo (09/10/2026) ficam como estão (o app antigo os referenciava de outro jeito).
-- Idempotente.

alter table public.identity_submissions add column if not exists decided_at timestamptz;

-- A decisão da equipe marca o envio mais recente (para contar os 30 dias).
create or replace function public.mark_identity_decided()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.identity_status in ('verificado', 'recusado')
     and new.identity_status is distinct from old.identity_status then
    update public.identity_submissions s set decided_at = now()
     where s.worker_id = new.id and s.decided_at is null;
  end if;
  return new;
end;
$$;
revoke all on function public.mark_identity_decided() from public, anon, authenticated;
drop trigger if exists mark_identity_decided on public.workers;
create trigger mark_identity_decided after update of identity_status on public.workers
  for each row execute function public.mark_identity_decided();

create or replace function public.orphan_storage_objects(p_limit integer default 500)
returns table (bucket text, name text)
language sql stable security definer set search_path = public as $$
  with base as (
    select coalesce((select value from public.app_config where key = 'storage_public_base'), '') as url
  ),
  used as (
    select photo_url as u from public.workers where photo_url is not null
    union all select cover_url from public.workers where cover_url is not null
    union all select logo_url from public.companies where logo_url is not null
    union all select cover_url from public.companies where cover_url is not null
    union all select media_url from public.worker_posts where media_url is not null
    union all select unnest(photos) from public.jobs where photos is not null
  ),
  public_files as (
    select o.bucket_id::text as bucket, o.name::text as name
      from storage.objects o, base
     where o.bucket_id in ('avatars', 'portfolio', 'vagas')
       and o.created_at < now() - interval '1 day'
       and o.created_at >= timestamptz '2026-10-09'
       and not exists (select 1 from used where used.u = base.url || o.bucket_id || '/' || o.name)
  ),
  identity_files as (
    select o.bucket_id::text, o.name::text
      from storage.objects o
     where o.bucket_id = 'identidade'
       and o.created_at < now() - interval '1 day'
       and not exists (
         select 1 from public.identity_submissions s
          where (s.selfie_path = o.name or s.document_path = o.name)
            and (s.decided_at is null or s.decided_at > now() - interval '30 days')
       )
  )
  select * from (select * from public_files union all select * from identity_files) f
   limit greatest(1, least(coalesce(p_limit, 500), 1000))
$$;
revoke all on function public.orphan_storage_objects(integer) from public, anon, authenticated;
grant execute on function public.orphan_storage_objects(integer) to service_role;

-- Chamada diária da Edge Function (sem esperar a resposta).
create or replace function public.call_storage_cleanup()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_url text;
  v_secret text;
begin
  if to_regnamespace('net') is null or to_regnamespace('vault') is null then
    return;
  end if;
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1' into v_url using 'bicos_cleanup_url';
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1' into v_secret using 'bicos_cleanup_secret';
  if v_url is null or v_secret is null then
    return;
  end if;
  execute 'select net.http_post(url := $1, body := $2, headers := $3)'
    using v_url, '{}'::jsonb, jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secret);
end;
$$;
revoke all on function public.call_storage_cleanup() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'bicos-limpar-arquivos';
    perform cron.schedule('bicos-limpar-arquivos', '40 4 * * *', 'select public.call_storage_cleanup()');
  end if;
end $$;

-- ===== 20261014000500_x21_funil.sql =====
-- X21: o funil do produto, dia a dia, contado a partir do que o banco já guarda (sem rastrear pessoas, sem
-- ferramenta de terceiros e sem guardar nada novo sobre ninguém — por isso não depende de consentimento):
-- cadastro iniciado (conta criada no Auth), e-mail confirmado, cadastro concluído (perfil completo), vaga
-- publicada, candidatura, aprovação, contratação, diária concluída e impulsionamento pago (com o valor).
-- Só para service_role (painel / SQL Editor):  select * from public.funnel_daily('2026-10-01', '2026-10-31');
-- Idempotente.

create or replace function public.funnel_daily(p_from date, p_to date)
returns table (
  dia date,
  cadastros_iniciados integer,
  emails_confirmados integer,
  cadastros_concluidos integer,
  vagas_publicadas integer,
  candidaturas integer,
  aprovacoes integer,
  contratacoes integer,
  diarias_concluidas integer,
  impulsionamentos_pagos integer,
  receita_centavos bigint
)
language sql stable security definer set search_path = public as $$
  with days as (
    select d::date as dia from generate_series(p_from, least(p_to, p_from + 366), interval '1 day') d
  )
  select
    days.dia,
    (select count(*)::int from auth.users u where (u.created_at at time zone 'America/Sao_Paulo')::date = days.dia),
    (select count(*)::int from auth.users u where (u.email_confirmed_at at time zone 'America/Sao_Paulo')::date = days.dia),
    (select count(*)::int from public.accounts a where (a.profile_completed_at at time zone 'America/Sao_Paulo')::date = days.dia),
    (select count(*)::int from public.jobs j where (j.created_at at time zone 'America/Sao_Paulo')::date = days.dia),
    (select count(*)::int from public.application_events e where e.status = 'enviada'
        and (e.at at time zone 'America/Sao_Paulo')::date = days.dia),
    (select count(*)::int from public.application_events e where e.status = 'pre_selecionado'
        and (e.at at time zone 'America/Sao_Paulo')::date = days.dia),
    (select count(*)::int from public.application_events e where e.status = 'contratado'
        and (e.at at time zone 'America/Sao_Paulo')::date = days.dia),
    (select count(*)::int from public.application_events e where e.status = 'concluida'
        and (e.at at time zone 'America/Sao_Paulo')::date = days.dia),
    (select count(*)::int from public.boost_payments p where p.status = 'confirmado'
        and (p.confirmed_at at time zone 'America/Sao_Paulo')::date = days.dia),
    (select coalesce(sum(p.amount_cents), 0)::bigint from public.boost_payments p where p.status = 'confirmado'
        and (p.confirmed_at at time zone 'America/Sao_Paulo')::date = days.dia)
  from days
  order by days.dia
$$;
revoke all on function public.funnel_daily(date, date) from public, anon, authenticated;
grant execute on function public.funnel_daily(date, date) to service_role;

-- ===== 20261014000600_w08_limites_vaga.sql =====
-- W08: limites de publicar/editar vaga também no banco — diária até R$ 5.000, descrição de 20 a 1000 letras —
-- e turno da noite que passa da meia-noite (22h–6h) aceito (antes o fim tinha que ser depois do início no
-- mesmo dia). O resto de job_from_draft fica igual. Idempotente.

create or replace function public.job_from_draft(p jsonb, p_original_start date default null)
returns public.jobs language plpgsql stable set search_path = public as $$
declare
  j public.jobs;
  v_today date := public.bicos_today();
begin
  j.oficio_id := p->>'oficio_id';
  j.title := nullif(btrim(coalesce(p->>'title', '')), '');
  j.pay := (p->>'pay')::numeric;
  j.cep := p->>'cep';
  j.street := btrim(coalesce(p->>'street', ''));
  j.number := btrim(coalesce(p->>'number', ''));
  j.complement := nullif(btrim(coalesce(p->>'complement', '')), '');
  j.neighborhood := btrim(coalesce(p->>'neighborhood', ''));
  j.city := btrim(coalesce(p->>'city', ''));
  j.uf := upper(btrim(coalesce(p->>'uf', '')));
  j.lat := (p->>'lat')::double precision;
  j.lon := (p->>'lon')::double precision;
  j.date_to_arrange := coalesce((p->>'date_to_arrange')::boolean, false);
  j.start_date := case when j.date_to_arrange then null else (p->>'start_date')::date end;
  j.end_date := case when j.date_to_arrange then null else (p->>'end_date')::date end;
  j.start_time := nullif(p->>'start_time', '');
  j.end_time := nullif(p->>'end_time', '');
  j.diarias := coalesce((p->>'diarias')::integer, 1);
  j.dias := (p->>'dias')::public.dias_semana;
  j.urgent := coalesce((p->>'urgent')::boolean, false);
  j.photos := case when jsonb_typeof(p->'photos') = 'array'
                   then array(select jsonb_array_elements_text(p->'photos')) end;
  j.slots := coalesce((p->>'slots')::integer, 1);
  j.description := btrim(coalesce(p->>'description', ''));
  j.requirements := coalesce(array(select jsonb_array_elements_text(coalesce(p->'requirements', '[]'::jsonb))), '{}');

  if not exists (select 1 from public.oficios where id = j.oficio_id) then
    raise exception using errcode = 'BC422', message = 'Escolha o ofício que a vaga precisa.';
  end if;
  if j.cep is null or j.cep !~ '^\d{5}-\d{3}$' then
    raise exception using errcode = 'BC422', message = 'Digite o CEP da obra (8 números).';
  end if;
  -- O ponto precisa cair no Brasil (sem ele, a distância no mural sai errada).
  if j.street = '' or j.number = '' or j.neighborhood = '' or j.city = '' or j.uf !~ '^[A-Z]{2}$'
     or j.lat is null or j.lon is null or j.lat not between -34 and 6 or j.lon not between -74 and -28 then
    raise exception using errcode = 'BC422', message = 'Confira o endereço da obra.';
  end if;
  if not j.date_to_arrange then
    if j.start_date is null or j.end_date is null then
      raise exception using errcode = 'BC422', message = 'Escolha a data de início e a de fim.';
    end if;
    if j.start_date < v_today and j.start_date is distinct from p_original_start then
      raise exception using errcode = 'BC422', message = 'A data de início não pode ser no passado.';
    end if;
    if j.end_date < j.start_date then
      raise exception using errcode = 'BC422', message = 'A data de fim tem que ser igual ou depois do início.';
    end if;
    if j.end_date - j.start_date + 1 > 60 then
      raise exception using errcode = 'BC422', message = 'Uma vaga cobre até 60 dias. Para mais, publique de novo depois.';
    end if;
  end if;
  if j.diarias < 1 or j.diarias > 60 then
    raise exception using errcode = 'BC422', message = 'Informe quantas diárias (de 1 a 60).';
  end if;
  if (j.start_time is null) <> (j.end_time is null) then
    raise exception using errcode = 'BC422', message = 'Preencha o início e o fim, ou deixe os dois em branco.';
  end if;
  -- W08: um turno da noite (22h–6h) passa da meia-noite; só início igual ao fim é recusado.
  if j.start_time is not null and (j.start_time !~ '^([01]\d|2[0-3]):[0-5]\d$'
     or j.end_time !~ '^([01]\d|2[0-3]):[0-5]\d$') then
    raise exception using errcode = 'BC422', message = 'Horário inválido.';
  end if;
  if j.start_time is not null and j.start_time = j.end_time then
    raise exception using errcode = 'BC422', message = 'O início e o fim não podem ser iguais.';
  end if;
  if j.slots < 1 or j.slots > 50 then
    raise exception using errcode = 'BC422', message = 'Informe quantas pessoas a vaga precisa (de 1 a 50).';
  end if;
  if j.pay is not null and j.pay < 80 then
    raise exception using errcode = 'BC422', message = 'Informe um valor de R$ 80 ou mais.';
  end if;
  -- W08: acima disso é quase sempre erro de digitação.
  if j.pay is not null and j.pay > 5000 then
    raise exception using errcode = 'BC422', message = 'Confira o valor: a diária vai até R$ 5.000.';
  end if;
  if j.description = '' then
    raise exception using errcode = 'BC422', message = 'Descreva o serviço da vaga.';
  end if;
  if char_length(j.description) < 20 then
    raise exception using errcode = 'BC422',
      message = 'Conte um pouco mais (pelo menos 20 letras): o que vai ser feito, onde, materiais.';
  end if;
  if char_length(j.description) > 1000 then
    raise exception using errcode = 'BC422', message = 'Use até 1000 letras na descrição.';
  end if;
  return j;
end;
$$;

revoke all on function public.job_from_draft(jsonb, date) from public, anon, authenticated;

-- ===== 20261014000700_x22_limpeza_tentativas.sql =====
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

-- ===== 20261014000800_x23_indices_fk.sql =====
-- X23: índices das chaves estrangeiras que as tabelas novas (F04, F07, F13, F18, Y28) trouxeram depois da
-- X15 (aviso "unindexed_foreign_keys" do Supabase). O dos convites também serve para o limite de 20 por dia
-- por construtora (invite_worker). Idempotente.

create index if not exists blocks_blocked_idx on public.blocks (blocked_id);
create index if not exists company_members_user_idx on public.company_members (user_id);
create index if not exists identity_submissions_worker_idx on public.identity_submissions (worker_id);
create index if not exists job_alerts_oficio_idx on public.job_alerts (oficio_id);
create index if not exists job_invites_company_idx on public.job_invites (company_id, created_at);

-- ===== 20261015000100_lanc06_backoffice.sql =====
-- L06 (lançamento): back-office mínimo — a equipe modera e verifica pelo app (/admin), sem SQL Editor e sem
-- chave service_role no navegador.
--
-- - staff_members: quem é da equipe (só entra por SQL/service_role: add_staff_member). is_staff() responde
--   pela sessão; toda RPC admin_* começa por staff_guard() e recusa (BC401) quem não é da equipe.
-- - staff_actions: registro de auditoria (quem, o quê, em quem, quando, motivo). Ninguém lê direto; a equipe
--   lê por admin_actions().
-- - Conta suspensa (accounts.suspended_at): não entra (banned_until no Auth e sessões encerradas), não publica
--   vaga e não se candidata (gatilhos — valem mesmo com um token ainda válido).
-- - Vaga oculta pela equipe (jobs.hidden_at): some do mural, da busca e do link público; a dona e quem já se
--   candidatou continuam vendo (como a vaga excluída).
-- - companies.cnpj_check: o que a Receita respondeu na verificação automática (verificar-cnpj), para a fila.
-- - Fotos de identidade: a equipe lê o bucket privado `identidade` (URL assinada de 5 min gerada no app).

-- ---------------------------------------------------------------------------------------------------
-- Equipe e auditoria
-- ---------------------------------------------------------------------------------------------------

create table if not exists public.staff_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'moderador' check (role in ('admin', 'moderador')),
  created_at timestamptz not null default now()
);
alter table public.staff_members enable row level security;
revoke all on public.staff_members from anon, authenticated;

create table if not exists public.staff_actions (
  id bigint generated always as identity primary key,
  staff_id uuid references auth.users (id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text not null,
  reason text,
  created_at timestamptz not null default now()
);
alter table public.staff_actions enable row level security;
revoke all on public.staff_actions from anon, authenticated;
create index if not exists staff_actions_staff_idx on public.staff_actions (staff_id);
create index if not exists staff_actions_target_idx on public.staff_actions (target_type, target_id);
create index if not exists staff_actions_created_idx on public.staff_actions (created_at desc);

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff_members where user_id = (select auth.uid()))
$$;

-- A primeira linha de toda RPC da equipe: a conta da sessão, ou BC401.
create or replace function public.staff_guard()
returns uuid language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.is_staff() then
    raise exception using errcode = 'BC401', message = 'Área só da equipe da Bicos.';
  end if;
  return auth.uid();
end;
$$;

create or replace function public.staff_log(p_action text, p_target_type text, p_target_id text, p_reason text)
returns void language sql security definer set search_path = public as $$
  insert into public.staff_actions (staff_id, action, target_type, target_id, reason)
  values (auth.uid(), p_action, p_target_type, p_target_id, nullif(btrim(coalesce(p_reason, '')), ''))
$$;

-- Só pelo SQL Editor (service_role): põe alguém na equipe pelo e-mail da conta.
create or replace function public.add_staff_member(p_email text, p_role text default 'moderador')
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  select id into v_id from public.accounts where email = lower(btrim(p_email));
  if v_id is null then
    raise exception using errcode = 'BC404', message = 'Nenhuma conta com esse e-mail.';
  end if;
  insert into public.staff_members (user_id, role) values (v_id, p_role)
  on conflict (user_id) do update set role = excluded.role;
  return v_id;
end;
$$;

create or replace function public.remove_staff_member(p_email text)
returns void language sql security definer set search_path = public as $$
  delete from public.staff_members where user_id = (select id from public.accounts where email = lower(btrim(p_email)))
$$;

-- ---------------------------------------------------------------------------------------------------
-- Conta suspensa e vaga oculta
-- ---------------------------------------------------------------------------------------------------

alter table public.accounts
  add column if not exists suspended_at timestamptz,
  add column if not exists suspended_reason text;
-- A própria conta sabe que está suspensa (o app mostra o aviso e sai); o motivo fica só com a equipe.
grant select (suspended_at) on public.accounts to authenticated;

alter table public.jobs
  add column if not exists hidden_at timestamptz,
  add column if not exists hidden_reason text;

alter table public.companies add column if not exists cnpj_check jsonb;

-- Vaga oculta não está aberta: sai do mural (feed_jobs), das candidaturas novas e do link público.
create or replace function public.job_is_open(p_job public.jobs)
returns boolean language sql stable set search_path = public as $$
  select not p_job.closed and p_job.deleted_at is null and p_job.hidden_at is null
     and public.job_last_day(p_job) >= public.bicos_today()
$$;

do $$
declare
  p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'jobs' and policyname like 'Vagas visíveis%'
  loop
    execute format('drop policy %I on public.jobs', p.policyname);
  end loop;
end $$;
create policy "Vagas visíveis (excluídas e ocultas só para a dona e candidatos)" on public.jobs
  for select to authenticated
  using (
    (deleted_at is null and hidden_at is null)
    or company_id = (select public.my_company_id())
    or exists (
      select 1 from public.applications a
       where a.job_id = jobs.id and a.worker_id = (select public.my_worker_id())
    )
  );

create or replace function public.public_job_card(p_job_id text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', j.id, 'oficio_id', j.oficio_id, 'title', j.title, 'pay', j.pay,
    'neighborhood', j.neighborhood, 'city', j.city, 'uf', j.uf,
    'date_to_arrange', j.date_to_arrange, 'start_date', j.start_date, 'end_date', j.end_date,
    'start_time', j.start_time, 'end_time', j.end_time, 'diarias', j.diarias, 'dias', j.dias,
    'slots', j.slots, 'urgent', j.urgent, 'photos', j.photos, 'description', j.description,
    'requirements', j.requirements, 'payment_method', j.payment_method, 'payment_note', j.payment_note,
    'created_at', j.created_at,
    'aberta', public.job_is_open(j) and public.job_holding(j.id) < j.slots,
    'company', jsonb_build_object('name', c.name, 'logo_url', c.logo_url, 'rating', c.rating,
                                  'review_count', c.review_count, 'verified', c.verified)
  )
  from public.jobs j join public.companies c on c.id = j.company_id
  where j.id = p_job_id and j.deleted_at is null and j.hidden_at is null
$$;

-- Conta suspensa não publica nem se candidata — mesmo com um token emitido antes da suspensão.
create or replace function public.refuse_suspended_job()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.accounts where company_id = new.company_id and suspended_at is not null) then
    raise exception using errcode = 'BC401', message = 'Sua conta está suspensa. Fale com o suporte pela Ajuda.';
  end if;
  return new;
end;
$$;
drop trigger if exists jobs_refuse_suspended on public.jobs;
create trigger jobs_refuse_suspended before insert on public.jobs
  for each row execute function public.refuse_suspended_job();

create or replace function public.refuse_suspended_application()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.accounts where worker_id = new.worker_id and suspended_at is not null) then
    raise exception using errcode = 'BC401', message = 'Sua conta está suspensa. Fale com o suporte pela Ajuda.';
  end if;
  return new;
end;
$$;
drop trigger if exists applications_refuse_suspended on public.applications;
create trigger applications_refuse_suspended before insert on public.applications
  for each row execute function public.refuse_suspended_application();

-- ---------------------------------------------------------------------------------------------------
-- Denúncias: resolução
-- ---------------------------------------------------------------------------------------------------

alter table public.reports
  add column if not exists resolution text check (resolution is null or resolution in ('arquivar', 'ocultar_vaga', 'suspender_conta')),
  add column if not exists resolved_by uuid references auth.users (id) on delete set null,
  add column if not exists resolved_at timestamptz;
create index if not exists reports_resolved_by_idx on public.reports (resolved_by);
create index if not exists reports_open_idx on public.reports (created_at) where status = 'aberta';
create index if not exists reports_target_idx on public.reports (target_type, target_id);

-- O que foi denunciado, para a fila: título/texto, a conta responsável e se já está oculto/suspenso.
create or replace function public.report_target_info(p_type public.report_target, p_id text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v jsonb;
begin
  if p_type = 'vaga' then
    select jsonb_build_object(
      'title', coalesce(j.title, o.nome), 'text', left(j.description, 600), 'job_id', j.id,
      'hidden', j.hidden_at is not null, 'deleted', j.deleted_at is not null,
      'account_id', a.id, 'account_name', c.name)
      into v
      from public.jobs j join public.companies c on c.id = j.company_id
      join public.oficios o on o.id = j.oficio_id
      left join public.accounts a on a.company_id = j.company_id
     where j.id = p_id;
  elsif p_type = 'perfil' then
    select jsonb_build_object(
      'title', coalesce(w.name, c.name), 'text', null, 'account_id', a.id,
      'account_name', coalesce(w.name, c.name))
      into v
      from public.accounts a
      left join public.workers w on w.id = a.worker_id
      left join public.companies c on c.id = a.company_id
     where a.id::text = p_id;
  elsif p_type = 'avaliacao' then
    select jsonb_build_object(
      'title', 'Avaliação ' || r.value || '★', 'text', r.comment,
      'account_id', a.id, 'account_name', coalesce(w.name, c.name))
      into v
      from public.reviews r
      left join public.applications ap on ap.id = r.application_id
      left join public.jobs j on j.id = ap.job_id
      left join public.accounts a on a.id = (
        case when r.direction = 'para_construtora'
             then (select x.id from public.accounts x where x.worker_id = ap.worker_id)
             else (select x.id from public.accounts x where x.company_id = j.company_id) end)
      left join public.workers w on w.id = a.worker_id
      left join public.companies c on c.id = a.company_id
     where r.id::text = p_id;
  elsif p_type = 'post' then
    select jsonb_build_object(
      'title', 'Publicação no portfólio', 'text', p.caption, 'media_url', p.media_url,
      'account_id', a.id, 'account_name', w.name)
      into v
      from public.worker_posts p join public.workers w on w.id = p.worker_id
      left join public.accounts a on a.worker_id = p.worker_id
     where p.id::text = p_id;
  end if;
  return coalesce(v, jsonb_build_object('title', 'Conteúdo que não existe mais', 'text', null, 'account_id', null));
end;
$$;

-- O histórico da conta denunciada, para decidir: idade da conta, lado, denúncias, vagas, candidaturas.
create or replace function public.account_history(p_account uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'account_id', a.id, 'role', a.role, 'name', coalesce(w.name, c.name), 'created_at', a.created_at,
    'suspended_at', a.suspended_at, 'suspended_reason', a.suspended_reason,
    'rating', coalesce(w.rating, c.rating), 'review_count', coalesce(w.review_count, c.review_count),
    'verified', coalesce(w.verified, c.verified),
    'reports_against', (
      select count(*) from public.reports r
       where (r.target_type = 'perfil' and r.target_id = a.id::text)
          or (r.target_type = 'vaga' and r.target_id in (select id from public.jobs where company_id = a.company_id))
          or (r.target_type = 'post' and r.target_id in (select id::text from public.worker_posts where worker_id = a.worker_id))),
    'jobs', (select count(*) from public.jobs where company_id = a.company_id),
    'applications', (select count(*) from public.applications where worker_id = a.worker_id),
    'staff_actions', (select count(*) from public.staff_actions where target_type = 'conta' and target_id = a.id::text)
  )
  from public.accounts a
  left join public.workers w on w.id = a.worker_id
  left join public.companies c on c.id = a.company_id
  where a.id = p_account
$$;

-- ---------------------------------------------------------------------------------------------------
-- RPCs da equipe (todas começam por staff_guard)
-- ---------------------------------------------------------------------------------------------------

-- Fila de identidades: trabalhadores "em análise", o envio mais antigo primeiro.
create or replace function public.admin_identity_queue()
returns table (
  worker_id uuid, name text, oficio text, city text, photo_url text, document text, created_at timestamptz,
  submitted_at timestamptz, selfie_path text, document_path text, submissions bigint
) language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  perform public.staff_guard();
  return query
    select w.id, w.name, o.nome, w.city, w.photo_url, a.document, a.created_at, w.identity_submitted_at,
           s.selfie_path, s.document_path,
           (select count(*) from public.identity_submissions x where x.worker_id = w.id)
      from public.workers w
      join public.accounts a on a.worker_id = w.id
      left join public.oficios o on o.id = w.oficio_id
      left join lateral (
        select selfie_path, document_path from public.identity_submissions
         where identity_submissions.worker_id = w.id order by identity_submissions.created_at desc limit 1
      ) s on true
     where w.identity_status = 'em_analise'
     order by w.identity_submitted_at nulls last
     limit 200;
end;
$$;

create or replace function public.admin_decide_identity(p_worker uuid, p_status text, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.staff_guard();
  if not exists (select 1 from public.workers where id = p_worker and identity_status = 'em_analise') then
    raise exception using errcode = 'BC409', message = 'Essa identidade já foi decidida.';
  end if;
  perform public.set_identity_status(p_worker, p_status, p_reason);
  perform public.staff_log(case when p_status = 'verificado' then 'aprovar_identidade' else 'recusar_identidade' end,
                           'trabalhador', p_worker::text, p_reason);
end;
$$;

-- Fila de construtoras: "pendente" com o perfil completo. CNPJ inteiro para a equipe conferir; CPF mascarado.
create or replace function public.admin_company_queue()
returns table (
  company_id uuid, name text, location text, tipo_obra text, email text, document text, document_kind text,
  created_at timestamptz, cnpj_check jsonb
) language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  perform public.staff_guard();
  return query
    select c.id, c.name, c.location, c.tipo_obra, a.email,
           coalesce(public.company_cnpj_for_check(c.id), a.document),
           case when public.company_cnpj_for_check(c.id) is not null then 'cnpj' else 'cpf' end,
           a.created_at, c.cnpj_check
      from public.companies c
      join public.accounts a on a.company_id = c.id
     where c.verification_status = 'pendente' and a.profile_completed_at is not null and a.suspended_at is null
     order by a.created_at
     limit 200;
end;
$$;

create or replace function public.admin_decide_company(p_company uuid, p_status public.company_verification, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.staff_guard();
  if p_status not in ('verificada', 'reprovada') then
    raise exception using errcode = 'BC422', message = 'Escolha aprovar ou recusar.';
  end if;
  if p_status = 'reprovada' and nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception using errcode = 'BC422', message = 'Diga o motivo da recusa.';
  end if;
  perform public.set_company_verification(p_company, p_status);
  perform public.staff_log(case when p_status = 'verificada' then 'aprovar_construtora' else 'recusar_construtora' end,
                           'construtora', p_company::text, p_reason);
end;
$$;

-- Fila de denúncias ('aberta' por padrão; 'analisada' para o histórico).
create or replace function public.admin_report_queue(p_status text default 'aberta')
returns table (
  id uuid, target_type public.report_target, target_id text, reason text, details text, status text,
  resolution text, created_at timestamptz, resolved_at timestamptz, reports_on_target bigint, target jsonb,
  account jsonb
) language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  perform public.staff_guard();
  return query
    select r.id, r.target_type, r.target_id, r.reason, r.details, r.status, r.resolution, r.created_at,
           r.resolved_at,
           (select count(*) from public.reports x where x.target_type = r.target_type and x.target_id = r.target_id),
           t.info,
           case when t.info ->> 'account_id' is not null
                then public.account_history((t.info ->> 'account_id')::uuid) end
      from public.reports r
      cross join lateral (select public.report_target_info(r.target_type, r.target_id) as info) t
     where r.status = coalesce(p_status, 'aberta')
     order by case when r.status = 'aberta' then r.created_at end asc, r.resolved_at desc nulls last
     limit 200;
end;
$$;

create or replace function public.admin_hide_job(p_job text, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_company uuid;
begin
  perform public.staff_guard();
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception using errcode = 'BC422', message = 'Diga o motivo.';
  end if;
  update public.jobs set hidden_at = now(), hidden_reason = btrim(p_reason)
   where id = p_job and hidden_at is null returning company_id into v_company;
  if v_company is null then
    if not exists (select 1 from public.jobs where id = p_job) then
      raise exception using errcode = 'BC404', message = 'Vaga não encontrada.';
    end if;
    return; -- já estava oculta
  end if;
  perform public.notify(null, v_company, 'verificacao', 'Vaga retirada do mural',
    'A vaga ' || p_job || ' foi retirada do mural pela equipe da Bicos. Motivo: ' || btrim(p_reason)
    || '. Fale com a gente pela Ajuda se achar que foi engano.', '/minhas-vagas');
  perform public.staff_log('ocultar_vaga', 'vaga', p_job, p_reason);
end;
$$;

create or replace function public.admin_unhide_job(p_job text, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.staff_guard();
  update public.jobs set hidden_at = null, hidden_reason = null where id = p_job and hidden_at is not null;
  if not found then
    raise exception using errcode = 'BC404', message = 'Essa vaga não está oculta.';
  end if;
  perform public.staff_log('mostrar_vaga', 'vaga', p_job, p_reason);
end;
$$;

create or replace function public.admin_suspend_account(p_account uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_staff uuid := public.staff_guard();
  v_account public.accounts;
begin
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception using errcode = 'BC422', message = 'Diga o motivo da suspensão.';
  end if;
  if p_account = v_staff then
    raise exception using errcode = 'BC409', message = 'Você não pode suspender a própria conta.';
  end if;
  if exists (select 1 from public.staff_members where user_id = p_account) then
    raise exception using errcode = 'BC409', message = 'Tire a conta da equipe antes de suspender.';
  end if;
  update public.accounts set suspended_at = now(), suspended_reason = btrim(p_reason)
   where id = p_account and suspended_at is null returning * into v_account;
  if v_account.id is null then
    if not exists (select 1 from public.accounts where id = p_account) then
      raise exception using errcode = 'BC404', message = 'Conta não encontrada.';
    end if;
    return; -- já estava suspensa
  end if;
  -- Não entra mais: o Auth recusa login e renovação de sessão; as sessões abertas acabam.
  -- Data distante, não 'infinity': o Auth (GoTrue, em Go) não lê 'infinity' e o login quebraria com erro 500
  -- em vez de responder "user_banned" (achado pelo E2E, L03). É o que o painel faz ao banir.
  update auth.users set banned_until = now() + interval '100 years' where id = p_account;
  if to_regclass('auth.sessions') is not null then
    execute 'delete from auth.sessions where user_id = $1' using p_account;
  end if;
  -- Construtora: as vagas abertas saem do mural. Trabalhador: as candidaturas pendentes saem.
  update public.jobs set hidden_at = now(), hidden_reason = 'conta suspensa'
   where company_id = v_account.company_id and hidden_at is null and deleted_at is null and not closed;
  delete from public.applications
   where worker_id = v_account.worker_id and status in ('enviada', 'em_analise');
  perform public.staff_log('suspender_conta', 'conta', p_account::text, p_reason);
end;
$$;

create or replace function public.admin_unsuspend_account(p_account uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_company uuid;
begin
  perform public.staff_guard();
  update public.accounts set suspended_at = null, suspended_reason = null
   where id = p_account and suspended_at is not null returning company_id into v_company;
  if not found then
    raise exception using errcode = 'BC404', message = 'Essa conta não está suspensa.';
  end if;
  update auth.users set banned_until = null where id = p_account;
  update public.jobs set hidden_at = null, hidden_reason = null
   where company_id = v_company and hidden_reason = 'conta suspensa';
  perform public.staff_log('reativar_conta', 'conta', p_account::text, p_reason);
end;
$$;

-- Resolve uma denúncia (e as outras abertas sobre o mesmo conteúdo): arquivar, ocultar a vaga ou suspender
-- a conta responsável.
create or replace function public.admin_resolve_report(p_report uuid, p_action text, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_staff uuid := public.staff_guard();
  r public.reports;
  v_info jsonb;
begin
  select * into r from public.reports where id = p_report;
  if r.id is null then
    raise exception using errcode = 'BC404', message = 'Denúncia não encontrada.';
  end if;
  if r.status <> 'aberta' then
    raise exception using errcode = 'BC409', message = 'Essa denúncia já foi resolvida.';
  end if;
  v_info := public.report_target_info(r.target_type, r.target_id);
  if p_action = 'arquivar' then
    perform public.staff_log('arquivar_denuncia', 'denuncia', r.id::text, p_reason);
  elsif p_action = 'ocultar_vaga' then
    if r.target_type <> 'vaga' then
      raise exception using errcode = 'BC422', message = 'Só dá para ocultar quando a denúncia é de uma vaga.';
    end if;
    perform public.admin_hide_job(r.target_id, coalesce(nullif(btrim(coalesce(p_reason, '')), ''), 'denúncia de ' || r.reason));
  elsif p_action = 'suspender_conta' then
    if v_info ->> 'account_id' is null then
      raise exception using errcode = 'BC404', message = 'A conta responsável não existe mais.';
    end if;
    perform public.admin_suspend_account((v_info ->> 'account_id')::uuid,
      coalesce(nullif(btrim(coalesce(p_reason, '')), ''), 'denúncia de ' || r.reason));
  else
    raise exception using errcode = 'BC422', message = 'Ação inválida.';
  end if;
  update public.reports set status = 'analisada', resolution = p_action, resolved_by = v_staff, resolved_at = now()
   where status = 'aberta' and target_type = r.target_type and target_id = r.target_id;
end;
$$;

-- O registro de auditoria, mais recente primeiro.
create or replace function public.admin_actions(p_limit integer default 100)
returns table (id bigint, staff_email text, action text, target_type text, target_id text, reason text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  perform public.staff_guard();
  return query
    select s.id, a.email, s.action, s.target_type, s.target_id, s.reason, s.created_at
      from public.staff_actions s left join public.accounts a on a.id = s.staff_id
     order by s.created_at desc, s.id desc
     limit least(greatest(coalesce(p_limit, 100), 1), 500);
end;
$$;

-- ---------------------------------------------------------------------------------------------------
-- Fotos de identidade: a equipe lê (para gerar a URL assinada); ninguém mais.
-- ---------------------------------------------------------------------------------------------------

drop policy if exists "Equipe lê as fotos de identidade" on storage.objects;
create policy "Equipe lê as fotos de identidade" on storage.objects for select to authenticated
  using (bucket_id = 'identidade' and (select public.is_staff()));

-- ---------------------------------------------------------------------------------------------------
-- Permissões
-- ---------------------------------------------------------------------------------------------------

revoke all on function public.is_staff(), public.staff_guard(), public.staff_log(text, text, text, text),
  public.add_staff_member(text, text), public.remove_staff_member(text), public.refuse_suspended_job(),
  public.refuse_suspended_application(), public.report_target_info(public.report_target, text),
  public.account_history(uuid), public.admin_identity_queue(), public.admin_decide_identity(uuid, text, text),
  public.admin_company_queue(), public.admin_decide_company(uuid, public.company_verification, text),
  public.admin_report_queue(text), public.admin_hide_job(text, text), public.admin_unhide_job(text, text),
  public.admin_suspend_account(uuid, text), public.admin_unsuspend_account(uuid, text),
  public.admin_resolve_report(uuid, text, text), public.admin_actions(integer)
  from public, anon, authenticated;
grant execute on function public.is_staff(), public.admin_identity_queue(), public.admin_decide_identity(uuid, text, text),
  public.admin_company_queue(), public.admin_decide_company(uuid, public.company_verification, text),
  public.admin_report_queue(text), public.admin_hide_job(text, text), public.admin_unhide_job(text, text),
  public.admin_suspend_account(uuid, text), public.admin_unsuspend_account(uuid, text),
  public.admin_resolve_report(uuid, text, text), public.admin_actions(integer)
  to authenticated;
grant execute on function public.add_staff_member(text, text), public.remove_staff_member(text) to service_role;

-- ===== 20261015000200_lanc07_aceites.sql =====
-- L07 (lançamento): LGPD — aceites registrados com versão e data, novo aceite quando os termos mudam, e
-- consentimento específico e destacado para a selfie e a foto do documento (dado biométrico: art. 11).
--
-- - terms_acceptances: cada aceite (termos de uso, política de privacidade, uso de imagem na verificação) com a
--   versão e a hora. Substitui `consentimentos` (tabela do app antigo, que o cadastro novo ainda alimentava);
--   o que já estava lá é copiado para cá.
-- - accept_terms(versão): o app pede o novo aceite no próximo login quando a versão dos termos muda.
-- - submit_identity passa a exigir a versão do consentimento mostrado na tela (identity_submissions.consent_*).
-- - export_my_data devolve os aceites e as verificações de identidade (sem as fotos).

create table if not exists public.terms_acceptances (
  id bigint generated always as identity primary key,
  account_id uuid not null references public.accounts (id) on delete cascade,
  document text not null check (document in ('termos_de_uso', 'politica_privacidade', 'uso_de_imagem_identidade')),
  version text not null check (char_length(version) between 1 and 20),
  accepted_at timestamptz not null default now(),
  unique (account_id, document, version)
);
alter table public.terms_acceptances enable row level security;
revoke all on public.terms_acceptances from anon, authenticated;

-- O que o app antigo registrou (só das contas que existem no app novo).
do $$
begin
  if to_regclass('public.consentimentos') is not null then
    insert into public.terms_acceptances (account_id, document, version, accepted_at)
    select c.usuario_id, c.documento, left(c.versao, 20), c.aceito_em
      from public.consentimentos c join public.accounts a on a.id = c.usuario_id
     where c.documento in ('termos_de_uso', 'politica_privacidade')
    on conflict do nothing;
  end if;
end $$;
-- E o aceite que cada conta já tem gravado em accounts.
insert into public.terms_acceptances (account_id, document, version, accepted_at)
select a.id, d, a.terms_version, a.terms_accepted_at
  from public.accounts a cross join unnest(array['termos_de_uso', 'politica_privacidade']) d
 where nullif(a.terms_version, '') is not null
on conflict do nothing;

create or replace function public.create_account_for(
  p_user_id uuid, p_email text, p_role public.app_role, p_name text, p_document text, p_whatsapp text,
  p_terms_version text, p_email_confirmed_at timestamptz
) returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  v_digits text := regexp_replace(coalesce(p_document, ''), '[^0-9]', '', 'g');
  v_phone text := regexp_replace(coalesce(p_whatsapp, ''), '[^0-9]', '', 'g');
  v_key text;
  v_name text := coalesce(nullif(btrim(p_name), ''), split_part(p_email, '@', 1));
begin
  if exists (select 1 from public.accounts where id = p_user_id) then return; end if;
  -- Y17: documento informado tem de ser válido para o lado da conta. (Sem documento só as contas do app
  -- antigo, migradas por account_from_old_profile, que copiam o documento cifrado depois.)
  if length(v_digits) > 0 and not public.document_valid_for(p_role, v_digits) then
    raise exception using errcode = 'BC422', message = 'Documento inválido.';
  end if;
  if length(v_digits) > 0 then
    perform public.claim_document_for(p_user_id, v_digits);
  end if;

  if p_role = 'trabalhador' then
    insert into public.workers (id, name, initials, whatsapp, city, lat, lon)
    values (p_user_id, v_name, public.initials_of(v_name), v_phone, 'São Paulo, SP', -23.5505, -46.6333)
    on conflict (id) do nothing;
  else
    -- Y16: o campo público "CNPJ" da empresa só recebe CNPJ (14 dígitos), nunca o CPF de quem recruta.
    insert into public.companies (id, name, cnpj, whatsapp, location)
    values (p_user_id, v_name, case when length(v_digits) = 14 then public.mask_document(v_digits) end,
            v_phone, 'São Paulo, SP')
    on conflict (id) do nothing;
  end if;

  if length(v_digits) > 0 then
    select decrypted_secret into v_key from vault.decrypted_secrets where name = 'nivotech_documento_key';
  end if;

  insert into public.accounts (
    id, email, role, document, document_hash, document_cipher, whatsapp, email_confirmed_at,
    terms_version, worker_id, company_id
  ) values (
    p_user_id, p_email, p_role, public.mask_document(v_digits),
    case when length(v_digits) > 0 then public.document_hash(v_digits) end,
    case when length(v_digits) > 0 and v_key is not null then extensions.pgp_sym_encrypt(v_digits, v_key) end,
    v_phone, p_email_confirmed_at, coalesce(p_terms_version, ''),
    case when p_role = 'trabalhador' then p_user_id end,
    case when p_role = 'recrutador' then p_user_id end
  );

  -- L07: o aceite fica registrado (com a versão e a hora) na tabela própria, não mais na do app antigo.
  if nullif(p_terms_version, '') is not null then
    insert into public.terms_acceptances (account_id, document, version)
    select p_user_id, d, p_terms_version from unnest(array['termos_de_uso', 'politica_privacidade']) d
    on conflict do nothing;
  end if;
end;
$$;

-- Novo aceite (versão nova dos termos e da política, aceitos juntos).
create or replace function public.accept_terms(p_version text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not exists (select 1 from public.accounts where id = auth.uid()) then
    raise exception using errcode = 'BC401', message = 'Entre na sua conta de novo para continuar.';
  end if;
  if nullif(btrim(coalesce(p_version, '')), '') is null or char_length(p_version) > 20 then
    raise exception using errcode = 'BC422', message = 'Versão dos termos inválida.';
  end if;
  update public.accounts set terms_version = btrim(p_version), terms_accepted_at = now() where id = auth.uid();
  insert into public.terms_acceptances (account_id, document, version)
  select auth.uid(), d, btrim(p_version) from unnest(array['termos_de_uso', 'politica_privacidade']) d
  on conflict do nothing;
end;
$$;

-- Verificação de identidade com consentimento específico.
alter table public.identity_submissions
  add column if not exists consent_version text,
  add column if not exists consent_at timestamptz;

drop function if exists public.submit_identity(text, text);
create or replace function public.submit_identity(p_selfie_path text, p_document_path text, p_consent_version text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_worker uuid := public.my_worker_id();
  v_prefix text := auth.uid()::text || '/';
begin
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

create or replace function public.export_my_data()
returns jsonb language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_account public.accounts;
  v_key text;
  v_doc text;
begin
  select * into v_account from public.accounts where id = auth.uid();
  if not found then
    raise exception using errcode = 'BC401', message = 'Entre na sua conta de novo para continuar.';
  end if;
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'nivotech_documento_key';
  if v_key is not null and v_account.document_cipher is not null then
    v_doc := extensions.pgp_sym_decrypt(v_account.document_cipher, v_key);
  end if;
  return jsonb_build_object(
    'gerado_em', now(),
    'conta', jsonb_build_object(
      'email', v_account.email, 'lado', v_account.role, 'documento', v_doc, 'whatsapp', v_account.whatsapp,
      'email_confirmado_em', v_account.email_confirmed_at, 'perfil_completo_em', v_account.profile_completed_at,
      'termos_versao', v_account.terms_version, 'termos_aceitos_em', v_account.terms_accepted_at,
      'criada_em', v_account.created_at),
    'perfil', coalesce(
      (select to_jsonb(w) from public.workers w where w.id = v_account.worker_id),
      (select to_jsonb(c) from public.companies c where c.id = v_account.company_id)),
    'vagas', coalesce((select jsonb_agg(to_jsonb(j)) from public.jobs j where j.company_id = v_account.company_id), '[]'),
    'candidaturas', coalesce((
      select jsonb_agg(to_jsonb(a) || jsonb_build_object('historico', (
        select jsonb_agg(to_jsonb(e) order by e.at) from public.application_events e where e.application_id = a.id)))
        from public.applications a
       where a.worker_id = v_account.worker_id
          or a.job_id in (select id from public.jobs where company_id = v_account.company_id)), '[]'),
    'avaliacoes_recebidas', coalesce((
      select jsonb_agg(to_jsonb(r)) from public.reviews r
       where r.worker_id = v_account.worker_id or r.company_id = v_account.company_id), '[]'),
    'vagas_salvas', coalesce((select jsonb_agg(to_jsonb(s)) from public.saved_jobs s where s.worker_id = v_account.worker_id), '[]'),
    'portfolio', coalesce((select jsonb_agg(to_jsonb(p)) from public.worker_posts p where p.worker_id = v_account.worker_id), '[]'),
    'notificacoes', coalesce((
      select jsonb_agg(to_jsonb(n)) from public.notifications n
       where n.worker_id = v_account.worker_id or n.company_id = v_account.company_id), '[]'),
    'pagamentos', coalesce((select jsonb_agg(to_jsonb(b) - 'pix_code') from public.boost_payments b where b.company_id = v_account.company_id), '[]'),
    'aceites', coalesce((
      select jsonb_agg(jsonb_build_object('documento', t.document, 'versao', t.version, 'aceito_em', t.accepted_at)
                       order by t.accepted_at)
        from public.terms_acceptances t where t.account_id = v_account.id), '[]'),
    'verificacao_identidade', coalesce((
      select jsonb_agg(jsonb_build_object('enviada_em', s.created_at, 'consentimento_versao', s.consent_version,
                                          'consentimento_em', s.consent_at, 'decidida_em', s.decided_at)
                       order by s.created_at)
        from public.identity_submissions s where s.worker_id = v_account.worker_id), '[]')
  );
end;
$$;

revoke all on function public.create_account_for(uuid, text, public.app_role, text, text, text, text, timestamptz),
  public.accept_terms(text), public.submit_identity(text, text, text), public.export_my_data()
  from public, anon, authenticated;
grant execute on function public.accept_terms(text), public.submit_identity(text, text, text), public.export_my_data()
  to authenticated;

-- ===== 20261016000100_lanc09_pg_net.sql =====
-- L09 (lançamento): pg_net sai do schema `public` (aviso `extension_in_public` do advisor).
--
-- Na produção o pg_net foi ligado em 12/10 pelo conector (migration 20261012033541_habilitar_pg_net, que só
-- existe lá) e caiu no `public`. A extensão não é relocável (`alter extension … set schema` não funciona):
-- o caminho é apagar e criar de novo no `extensions`. As funções dela continuam em `net.*` — o schema `net`
-- é dela, não do `public` —, então push_new_notification e call_storage_cleanup (que chamam
-- `net.http_post` por `execute`, sem depender do objeto) não mudam.
--
-- O que se perde: a fila de chamadas ainda não enviadas e as respostas guardadas (net.http_request_queue e
-- net._http_response), que são passageiras. Rodar fora do horário dos crons que usam a rede (4h40, 21h).
-- Sem `cascade`: se algo novo depender do pg_net, a migration para em vez de apagar junto.
-- Banco sem pg_net instalado (testes locais): liga no `extensions`, como no staging e na produção.

do $$
declare
  v_schema text;
begin
  select n.nspname into v_schema
    from pg_extension e join pg_namespace n on n.oid = e.extnamespace
   where e.extname = 'pg_net';
  if v_schema = 'extensions' then
    return;
  end if;
  if v_schema is not null then
    execute 'drop extension pg_net';
  end if;
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    execute 'create extension pg_net with schema extensions';
  end if;
end $$;

-- ===== 20261016000200_lanc10_link_publico.sql =====
-- L10 (lançamento): o link público da vaga deixa de ser enumerável.
--
-- Antes: /v/BC-1, /v/BC-2… — os IDs são sequenciais e `public_job_card` (a única RPC para visitante) abria
-- qualquer um, então dava para baixar o mural inteiro sem conta, uma vaga atrás da outra.
-- Agora:
--   * cada vaga ganha um `public_slug` aleatório (12 caracteres de um alfabeto de 31 — sem 0/o, 1/l/i —, ~59 bits) e o link
--     compartilhado é /v/<slug>. O código BC-n continua sendo o ID e aparecendo na tela;
--   * `public_job_card(p_slug)` só abre pelo slug — um BC-n devolve nada (o app manda para o login e de lá para
--     a vaga, o que serve aos links antigos);
--   * limite por IP: 60 consultas a cada 10 minutos (BC409 depois disso). O IP vem dos cabeçalhos que a API
--     repassa e é guardado só como hash do dia, apagado no dia seguinte pela limpeza das 4h17.
-- Idempotente.

create or replace function public.new_public_slug()
returns text language sql volatile set search_path = public as $$
  -- Sem 0/o, 1/l/i: dá para ditar o link por telefone sem confusão.
  select string_agg(substr('abcdefghjkmnpqrstuvwxyz23456789', (get_byte(b, i) % 31) + 1, 1), '' order by i)
    from (select extensions.gen_random_bytes(12) as b) r, generate_series(0, 11) as i
$$;
revoke all on function public.new_public_slug() from public, anon, authenticated;

alter table public.jobs add column if not exists public_slug text;
update public.jobs set public_slug = public.new_public_slug() where public_slug is null;
alter table public.jobs alter column public_slug set default public.new_public_slug();
alter table public.jobs alter column public_slug set not null;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'jobs_public_slug_format') then
    alter table public.jobs add constraint jobs_public_slug_format check (public_slug ~ '^[a-z2-9]{10,32}$');
  end if;
end $$;
create unique index if not exists jobs_public_slug_key on public.jobs (public_slug);
-- Quem vê a vaga logado pode compartilhar o link dela.
grant select (public_slug) on public.jobs to authenticated;

-- Consultas ao link público por IP (hash do IP + dia; nada que identifique a pessoa depois de 1 dia).
create table if not exists public.public_link_hits (
  ip_hash text not null,
  at timestamptz not null default now()
);
create index if not exists public_link_hits_ip_at_idx on public.public_link_hits (ip_hash, at desc);
alter table public.public_link_hits enable row level security;
revoke all on table public.public_link_hits from anon, authenticated;

-- O parâmetro mudou de nome (p_job_id → p_slug): `create or replace` não troca nome de parâmetro.
drop function if exists public.public_job_card(text);
create function public.public_job_card(p_slug text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_headers jsonb := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb;
  v_ip text;
  v_hash text;
  v_card jsonb;
begin
  -- cf-connecting-ip é posto pela Cloudflare na frente do Supabase (o cliente não consegue forjar); os outros
  -- ficam de reserva. Sem cabeçalho (SQL Editor, cron) não há limite.
  v_ip := coalesce(nullif(v_headers ->> 'cf-connecting-ip', ''), nullif(v_headers ->> 'x-real-ip', ''),
                   nullif(trim(split_part(v_headers ->> 'x-forwarded-for', ',', 1)), ''));
  if v_ip is not null then
    v_hash := encode(extensions.digest(v_ip || '|' || current_date::text, 'sha256'), 'hex');
    if (select count(*) from public.public_link_hits
         where ip_hash = v_hash and at > now() - interval '10 minutes') >= 60 then
      raise exception using errcode = 'BC409',
        message = 'Muitas vagas abertas em pouco tempo. Espere alguns minutos e tente de novo.';
    end if;
    insert into public.public_link_hits (ip_hash) values (v_hash);
  end if;

  if p_slug is null or p_slug !~ '^[a-z2-9]{10,32}$' then
    return null;
  end if;
  select jsonb_build_object(
    'id', j.id, 'oficio_id', j.oficio_id, 'title', j.title, 'pay', j.pay,
    'neighborhood', j.neighborhood, 'city', j.city, 'uf', j.uf,
    'date_to_arrange', j.date_to_arrange, 'start_date', j.start_date, 'end_date', j.end_date,
    'start_time', j.start_time, 'end_time', j.end_time, 'diarias', j.diarias, 'dias', j.dias,
    'slots', j.slots, 'urgent', j.urgent, 'photos', j.photos, 'description', j.description,
    'requirements', j.requirements, 'payment_method', j.payment_method, 'payment_note', j.payment_note,
    'created_at', j.created_at, 'public_slug', j.public_slug,
    'aberta', public.job_is_open(j) and public.job_holding(j.id) < j.slots,
    'company', jsonb_build_object('name', c.name, 'logo_url', c.logo_url, 'rating', c.rating,
                                  'review_count', c.review_count, 'verified', c.verified)
  ) into v_card
  from public.jobs j join public.companies c on c.id = j.company_id
  where j.public_slug = p_slug and j.deleted_at is null and j.hidden_at is null;
  return v_card;
end;
$$;
revoke all on function public.public_job_card(text) from public;
grant execute on function public.public_job_card(text) to anon, authenticated;

-- A limpeza diária (X22) também apaga as consultas de ontem.
create or replace function public.purge_auth_attempts()
returns integer language plpgsql security definer set search_path = public as $$
declare
  n integer;
begin
  with x as (delete from public.auth_attempts where at < now() - interval '1 day' returning 1)
  select count(*)::int into n from x;
  delete from public.whatsapp_verifications where verified_at < now() - interval '1 day';
  delete from public.application_attempts where created_at < now() - interval '2 days';
  delete from public.public_link_hits where at < now() - interval '1 day';
  return n;
end;
$$;
revoke all on function public.purge_auth_attempts() from public, anon, authenticated;

-- ===== 20261016000300_lanc12_vigia_cron.sql =====
-- L12 (lançamento): as rotinas do pg_cron (concluir diárias, vencer PIX, lembretes, limpezas) falhavam em
-- silêncio — o erro só ficava em cron.job_run_details, que ninguém olha. Agora:
--   * cron_health(): o estado de cada rotina (última execução, resultado, falhas seguidas), para o SQL Editor;
--   * check_cron_failures(), de hora em hora (`bicos-vigiar-cron`): rotina com 2 falhas seguidas vira um alerta
--     em `cron_alerts` e um evento no Sentry (DSN no Vault: `bicos_sentry_dsn`; o Sentry manda o e-mail pela
--     regra de alerta do projeto). No máximo um alerta por rotina a cada 24 h enquanto ela continuar falhando;
--   * a mensagem de erro vai sem dado pessoal (e-mails e sequências longas de dígitos — CPF, CNPJ, telefone —
--     trocados por marcadores) e cortada em 300 caracteres;
--   * o histórico do pg_cron (cron.job_run_details) passa a guardar só 14 dias.
--   * sinal de vida: a cada execução o vigia chama a URL do Vault `bicos_heartbeat_url` (um monitor de fora, como
--     o healthchecks.io), que manda e-mail quando o sinal para — cobre o pg_cron parado e o projeto pausado
--     (plano Free), que o próprio banco não consegue avisar.
-- Idempotente.

create table if not exists public.cron_alerts (
  id bigint generated always as identity primary key,
  jobname text not null,
  runid bigint not null,
  message text not null,
  sent boolean not null default false,
  alerted_at timestamptz not null default now()
);
create index if not exists cron_alerts_job_at_idx on public.cron_alerts (jobname, alerted_at desc);
alter table public.cron_alerts enable row level security;
revoke all on table public.cron_alerts from anon, authenticated;

-- Tira dado pessoal de um texto de erro antes de ele sair do banco.
create or replace function public.scrub_error_text(p_text text)
returns text language sql immutable set search_path = public as $$
  select left(
    regexp_replace(
      regexp_replace(coalesce(p_text, ''), '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '[email]', 'g'),
      '\d[\d .()/-]{6,}\d', '[número]', 'g'),
    300)
$$;
revoke all on function public.scrub_error_text(text) from public, anon, authenticated;

-- O estado de cada rotina (só a equipe, pelo SQL Editor): select * from public.cron_health();
create or replace function public.cron_health()
returns table (jobname text, schedule text, active boolean, last_run timestamptz, last_status text,
               failures_in_a_row integer, last_error text)
language plpgsql security definer set search_path = public as $$
begin
  if to_regclass('cron.job_run_details') is null then
    return;
  end if;
  return query execute $q$
    select j.jobname::text, j.schedule::text, j.active, last.end_time, last.status::text,
           coalesce((select count(*)::int
                       from cron.job_run_details f
                      where f.jobid = j.jobid and f.status = 'failed'
                        and f.runid > coalesce((select max(s.runid) from cron.job_run_details s
                                                 where s.jobid = j.jobid and s.status = 'succeeded'), 0)), 0),
           public.scrub_error_text(case when last.status = 'failed' then last.return_message end)
      from cron.job j
      left join lateral (select d.end_time, d.status, d.return_message
                           from cron.job_run_details d
                          where d.jobid = j.jobid and d.status in ('succeeded', 'failed')
                          order by d.runid desc limit 1) last on true
     where j.jobname like 'bicos-%'
     order by j.jobname
  $q$;
end;
$$;
revoke all on function public.cron_health() from public, anon, authenticated;
grant execute on function public.cron_health() to service_role;

-- Um evento no Sentry pela API "store" (a mesma do app, sem SDK). Sem DSN no Vault ou sem pg_net: false.
create or replace function public.send_sentry_event(p_message text, p_tags jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_dsn text;
  v_parts text[];
begin
  if to_regnamespace('net') is null or to_regnamespace('vault') is null then
    return false;
  end if;
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1' into v_dsn using 'bicos_sentry_dsn';
  -- https://<chave>@<host>/<caminho/><projeto>
  v_parts := regexp_match(coalesce(v_dsn, ''), '^(https://)([^@/]+)@([^/]+)/(.*/)?([0-9]+)$');
  if v_parts is null then
    return false;
  end if;
  execute 'select net.http_post(url := $1, body := $2, headers := $3)'
    using v_parts[1] || v_parts[3] || '/' || coalesce(v_parts[4], '') || 'api/' || v_parts[5] || '/store/',
          jsonb_build_object(
            'event_id', replace(gen_random_uuid()::text, '-', ''),
            'timestamp', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
            'level', 'error', 'platform', 'other', 'logger', 'pg_cron', 'server_name', 'supabase-db',
            'message', public.scrub_error_text(p_message), 'tags', p_tags),
          jsonb_build_object('Content-Type', 'application/json',
            'X-Sentry-Auth', 'Sentry sentry_version=7, sentry_client=bicos-db/1.0, sentry_key=' || v_parts[2]);
  return true;
exception when others then
  return false;
end;
$$;
revoke all on function public.send_sentry_event(text, jsonb) from public, anon, authenticated;

-- De hora em hora: rotina com as 2 últimas execuções falhadas vira alerta (no máximo 1 a cada 24 h por rotina).
create or replace function public.check_cron_failures()
returns integer language plpgsql security definer set search_path = public as $$
declare
  r record;
  n integer := 0;
  v_message text;
begin
  if to_regclass('cron.job_run_details') is null then
    return 0;
  end if;
  for r in execute $q$
    select j.jobname::text as jobname, last2.runids[1] as runid, last2.messages[1] as message
      from cron.job j
      cross join lateral (
        select array_agg(d.runid order by d.runid desc) as runids,
               array_agg(d.status::text order by d.runid desc) as statuses,
               array_agg(d.return_message order by d.runid desc) as messages
          from (select runid, status, return_message from cron.job_run_details
                 where jobid = j.jobid and status in ('succeeded', 'failed')
                 order by runid desc limit 2) d
      ) last2
     where j.jobname like 'bicos-%' and last2.statuses = array['failed', 'failed']
  $q$ loop
    if exists (select 1 from public.cron_alerts a
                where a.jobname = r.jobname and a.alerted_at > now() - interval '24 hours') then
      continue;
    end if;
    v_message := 'Rotina ' || r.jobname || ' falhou 2 vezes seguidas: ' || public.scrub_error_text(r.message);
    insert into public.cron_alerts (jobname, runid, message, sent)
    values (r.jobname, r.runid, v_message,
            public.send_sentry_event(v_message, jsonb_build_object('job', r.jobname, 'origem', 'pg_cron')));
    n := n + 1;
  end loop;
  -- Sinal de vida para o monitor de fora (sem URL no Vault, nada).
  if to_regnamespace('net') is not null then
    begin
      execute 'select decrypted_secret from vault.decrypted_secrets where name = $1' into v_message using 'bicos_heartbeat_url';
      if v_message like 'https://%' then
        execute 'select net.http_get(url := $1)' using v_message;
      end if;
    exception when others then
      null;
    end;
  end if;
  -- Guarda 90 dias de alertas e 14 de histórico do pg_cron (que cresce sem parar: a cada 10 min só o PIX).
  delete from public.cron_alerts where alerted_at < now() - interval '90 days';
  begin
    execute $d$delete from cron.job_run_details where end_time < now() - interval '14 days'$d$;
  exception when others then
    null;
  end;
  return n;
end;
$$;
revoke all on function public.check_cron_failures() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'bicos-vigiar-cron';
    perform cron.schedule('bicos-vigiar-cron', '12 * * * *', 'select public.check_cron_failures()');
  end if;
end $$;

-- ===== 20261016000400_lanc13_mural_volume.sql =====
-- L13 (lançamento): o mural (feed_jobs) com volume — 2.000 vagas e 20.000 candidaturas (scripts/volume/).
--
-- A medição mostrou o gargalo: `job_is_open(j)` chamada para cada vaga da cidade (~50 µs por linha). Ela chama
-- `job_last_day` e `bicos_today`, e as três têm `search_path` fixo (X13) — o Postgres não "abre" função com SET
-- dentro da consulta, então são três chamadas com troca de configuração por vaga. Agora:
--   * `jobs.last_day`: o último dia da vaga, coluna calculada pelo banco com a mesma regra de `job_last_day`
--     (vaga "a combinar" vale 30 dias da publicação; as outras, até a data de fim). Índice parcial das vagas
--     abertas por cidade e último dia;
--   * feed_jobs compara `last_day` com o "hoje" calculado uma vez, em vez de `job_is_open` por linha (as duas
--     regras ficam iguais — o teste lanc13 confere vaga a vaga);
--   * o texto da busca é normalizado uma vez, não uma por vaga;
--   * cada linha do mural traz também o `public_slug` (L10), para o botão de compartilhar.
-- Idempotente.

alter table public.jobs
  add column if not exists last_day date
  generated always as (
    case when date_to_arrange then (created_at at time zone 'America/Sao_Paulo')::date + 30 else end_date end
  ) stored;

create index if not exists jobs_feed_city_idx on public.jobs (uf, city, last_day)
  where not closed and deleted_at is null and hidden_at is null;

create or replace function public.feed_jobs(
  p_city text, p_uf text, p_lat double precision, p_lon double precision, p_radius_km integer default null,
  p_oficio text default null, p_quando text default null, p_search text default null,
  p_all_cities boolean default false, p_sort text default 'perto', p_limit integer default 30,
  p_cursor jsonb default null
) returns setof jsonb language sql stable security definer set search_path = public, extensions as $$
  with origin as (
    select st_setsrid(st_makepoint(p_lon, p_lat), 4326)::geography as g, public.bicos_today() as today,
           nullif(public.fold_text(btrim(coalesce(p_search, ''))), '') as needle
  ),
  open_jobs as (
    select j.*, o.g as o_g, o.today
      from public.jobs j, origin o
     -- O mesmo que job_is_open(j), sem a chamada por linha (L13).
     where not j.closed and j.deleted_at is null and j.hidden_at is null and j.last_day >= o.today
       and public.job_holding(j.id) < j.slots
       and (p_oficio is null or j.oficio_id = p_oficio)
       and (
         case
           when o.needle is not null and p_all_cities then true
           when p_radius_km is not null then st_dwithin(j.area_geog, o.g, p_radius_km * 1000)
           else j.city = p_city and j.uf = p_uf
         end
       )
       and (
         p_quando is null
         or (p_quando = 'Hoje' and public.job_runs_on(j, o.today))
         or (p_quando = 'Amanhã' and public.job_runs_on(j, o.today + 1))
         or (p_quando = 'Durante a semana' and coalesce(j.dias::text, 'qualquer') in ('semana', 'qualquer'))
         or (p_quando = 'Fim de semana' and coalesce(j.dias::text, 'qualquer') in ('fimdesemana', 'qualquer'))
       )
       and (
         o.needle is null
         or public.fold_text(concat_ws(' ', j.title, j.neighborhood, j.city,
              (select f.nome || ' ' || array_to_string(f.sinonimos, ' ') from public.oficios f where f.id = j.oficio_id),
              (select c.name from public.companies c where c.id = j.company_id)))
            like '%' || o.needle || '%'
       )
  ),
  ranked as (
    select oj.*,
           case when oj.boost_ends_at > now() then 0 when oj.urgent then 1 else 2 end as rank,
           case p_sort
             when 'valor' then coalesce(-oj.pay::double precision, 1e12)
             when 'cedo' then coalesce(extract(epoch from oj.start_date::timestamp), 1e12)
             else st_distance(oj.area_geog, oj.o_g)
           end as sort_key,
           st_distance(oj.area_geog, oj.o_g) / 1000.0 as km
      from open_jobs oj
  )
  select jsonb_build_object(
           'id', r.id, 'company_id', r.company_id, 'oficio_id', r.oficio_id, 'title', r.title, 'pay', r.pay,
           'neighborhood', r.neighborhood, 'city', r.city, 'uf', r.uf, 'area_lat', r.area_lat, 'area_lon', r.area_lon,
           'date_to_arrange', r.date_to_arrange, 'start_date', r.start_date, 'end_date', r.end_date,
           'start_time', r.start_time, 'end_time', r.end_time, 'diarias', r.diarias, 'dias', r.dias,
           'urgent', r.urgent, 'boost_ends_at', r.boost_ends_at, 'photos', r.photos, 'slots', r.slots,
           'closed', r.closed, 'sem_contratacao', r.sem_contratacao, 'description', r.description,
           'requirements', r.requirements, 'created_at', r.created_at, 'updated_at', r.updated_at,
           'deleted_at', r.deleted_at, 'public_slug', r.public_slug,
           '_rank', r.rank, '_key', r.sort_key, '_km', round(r.km::numeric, 1))
    from ranked r
   where p_cursor is null
      or (r.rank, r.sort_key, r.id) > ((p_cursor->>'r')::int, (p_cursor->>'k')::double precision, p_cursor->>'id')
   order by r.rank, r.sort_key, r.id
   limit least(greatest(coalesce(p_limit, 30), 1), 60)
$$;

revoke all on function public.feed_jobs(text, text, double precision, double precision, integer, text, text, text, boolean, text, integer, jsonb)
  from public, anon, authenticated;
grant execute on function public.feed_jobs(text, text, double precision, double precision, integer, text, text, text, boolean, text, integer, jsonb)
  to authenticated;

-- ===== 20261017000100_r03_suspensao_completa.sql =====
-- R03: suspensão completa. Antes (L06), suspender só apagava as candidaturas pendentes e tirava as vagas do mural;
-- quem já estava aprovado ou contratado ficava num bico que não ia acontecer, com o WhatsApp do outro lado aberto.
-- Agora:
--   * status novo `cancelado_pela_equipe` e a transição do sistema `cancelar_por_suspensao` (de pré-selecionado ou
--     contratado), igual em services/applicationMachine.ts;
--   * trabalhador suspenso: cada bico aprovado/contratado é cancelado com motivo "conta suspensa", a construtora é
--     avisada e a posição libera (quem tinha sido recusado automaticamente volta para análise, como na desistência);
--   * construtora suspensa: cada trabalhador aprovado/contratado nas vagas dela é avisado de que o bico foi
--     cancelado pela equipe;
--   * get_contact não devolve o WhatsApp quando um dos lados está suspenso.
-- Reativar a conta não desfaz os cancelamentos. Idempotente.

alter type public.application_status add value if not exists 'cancelado_pela_equipe';

create or replace function public.application_next_status(
  p_action text, p_from public.application_status, p_actor public.application_actor
) returns public.application_status language sql immutable set search_path = public as $$
  select (case
    when p_action = 'analisar' and p_from = 'enviada' and p_actor in ('construtora', 'sistema') then 'em_analise'
    when p_action = 'aprovar' and p_from in ('enviada', 'em_analise') and p_actor = 'construtora' then 'pre_selecionado'
    when p_action = 'recusar' and p_from in ('enviada', 'em_analise') and p_actor in ('construtora', 'sistema') then 'nao_selecionado'
    when p_action = 'desfazer_recusa' and p_from = 'nao_selecionado' and p_actor = 'construtora' then 'em_analise'
    when p_action = 'desfazer_aprovacao' and p_from = 'pre_selecionado' and p_actor = 'construtora' then 'em_analise'
    when p_action = 'contratar' and p_from = 'pre_selecionado' and p_actor = 'construtora' then 'contratado'
    when p_action = 'desistir' and p_from in ('pre_selecionado', 'contratado') and p_actor = 'trabalhador' then 'desistiu'
    when p_action = 'cancelar_contratacao' and p_from in ('pre_selecionado', 'contratado') and p_actor = 'construtora' then 'cancelado_pela_construtora'
    when p_action = 'concluir' and p_from = 'contratado' and p_actor in ('construtora', 'sistema') then 'concluida'
    when p_action = 'marcar_falta' and p_from = 'contratado' and p_actor = 'construtora' then 'nao_compareceu'
    when p_action = 'expirar' and p_from = 'pre_selecionado' and p_actor = 'sistema' then 'expirada'
    when p_action = 'cancelar_por_suspensao' and p_from in ('pre_selecionado', 'contratado') and p_actor = 'sistema'
      then 'cancelado_pela_equipe'
  end)::public.application_status
$$;

create or replace function public.admin_suspend_account(p_account uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_staff uuid := public.staff_guard();
  v_account public.accounts;
  v_job public.jobs;
  r record;
begin
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception using errcode = 'BC422', message = 'Diga o motivo da suspensão.';
  end if;
  if p_account = v_staff then
    raise exception using errcode = 'BC409', message = 'Você não pode suspender a própria conta.';
  end if;
  if exists (select 1 from public.staff_members where user_id = p_account) then
    raise exception using errcode = 'BC409', message = 'Tire a conta da equipe antes de suspender.';
  end if;
  update public.accounts set suspended_at = now(), suspended_reason = btrim(p_reason)
   where id = p_account and suspended_at is null returning * into v_account;
  if v_account.id is null then
    if not exists (select 1 from public.accounts where id = p_account) then
      raise exception using errcode = 'BC404', message = 'Conta não encontrada.';
    end if;
    return; -- já estava suspensa
  end if;
  -- Não entra mais: o Auth recusa login e renovação de sessão; as sessões abertas acabam.
  -- Data distante, não 'infinity': o Auth (GoTrue, em Go) não lê 'infinity' e o login quebraria com erro 500
  -- em vez de responder "user_banned" (achado pelo E2E, L03). É o que o painel faz ao banir.
  update auth.users set banned_until = now() + interval '100 years' where id = p_account;
  if to_regclass('auth.sessions') is not null then
    execute 'delete from auth.sessions where user_id = $1' using p_account;
  end if;
  -- Construtora: as vagas abertas saem do mural. Trabalhador: as candidaturas pendentes saem.
  update public.jobs set hidden_at = now(), hidden_reason = 'conta suspensa'
   where company_id = v_account.company_id and hidden_at is null and deleted_at is null and not closed;
  delete from public.applications
   where worker_id = v_account.worker_id and status in ('enviada', 'em_analise');
  -- R03: o que já tinha sido aprovado ou contratado é cancelado pelo sistema ("conta suspensa"): o outro lado é
  -- avisado e a posição libera (job_holding só conta pré-selecionado, contratado e concluída).
  for r in
    select a.id, a.job_id, a.worker_id from public.applications a
     where a.worker_id = v_account.worker_id and a.status in ('pre_selecionado', 'contratado')
  loop
    perform public.application_step(r.id, 'cancelar_por_suspensao', 'sistema', 'conta suspensa');
    perform public.job_reopen_auto_rejected(r.job_id, 'vaga_reaberta');
    select * into v_job from public.jobs where id = r.job_id;
    perform public.notify(null, v_job.company_id, 'desistencia', 'Bico cancelado pela equipe',
      coalesce(nullif(public.first_name((select name from public.workers where id = r.worker_id)), ''), 'O trabalhador') ||
      ' não vai mais em ' || public.job_title(v_job) || ': a equipe da Bicos suspendeu a conta dele.' ||
      case when public.job_is_open(v_job) and public.job_holding(v_job.id) < v_job.slots
           then ' A vaga voltou para o mural.' else '' end,
      '/vaga-gerenciar/' || r.job_id);
  end loop;
  for r in
    select a.id, a.job_id, a.worker_id from public.applications a join public.jobs j on j.id = a.job_id
     where j.company_id = v_account.company_id and a.status in ('pre_selecionado', 'contratado')
  loop
    perform public.application_step(r.id, 'cancelar_por_suspensao', 'sistema', 'conta suspensa');
    select * into v_job from public.jobs where id = r.job_id;
    perform public.notify(r.worker_id, null, 'contratacao_cancelada', 'Bico cancelado pela equipe',
      public.job_title(v_job) || ' na ' || coalesce((select name from public.companies where id = v_job.company_id), 'construtora') ||
      ' foi cancelado pela equipe da Bicos. Não vá até a obra. Veja outros bicos no mural.',
      '/vaga/' || r.job_id);
  end loop;
  perform public.staff_log('suspender_conta', 'conta', p_account::text, p_reason);
end;
$$;

create or replace function public.get_contact(p_application_id uuid)
returns table (name text, phone text) language plpgsql stable security definer set search_path = public as $$
declare
  v_app public.applications;
  v_job public.jobs;
begin
  select * into v_app from public.applications where id = p_application_id;
  if found then select * into v_job from public.jobs where id = v_app.job_id; end if;
  if v_app.id is null or v_job.id is null then
    raise exception using errcode = 'BC404', message = 'Essa candidatura não existe mais.';
  end if;
  if v_app.status not in ('pre_selecionado', 'contratado') then
    raise exception using errcode = 'BC401', message = 'O contato abre quando a construtora aprova o candidato.';
  end if;
  -- R03: conta suspensa pela equipe não passa contato (nem o próprio, nem o do outro lado).
  if exists (select 1 from public.accounts
              where suspended_at is not null
                and (worker_id = v_app.worker_id or company_id = v_job.company_id)) then
    raise exception using errcode = 'BC404', message = 'Esse contato não está disponível: a conta foi suspensa pela equipe da Bicos.';
  end if;
  if v_app.worker_id = public.my_worker_id() then
    return query select c.name, c.whatsapp from public.companies c where c.id = v_job.company_id and c.whatsapp <> '';
    if not found then
      raise exception using errcode = 'BC404', message = 'A construtora ainda não cadastrou um WhatsApp.';
    end if;
  elsif v_job.company_id = public.my_company_id() then
    return query select w.name, w.whatsapp from public.workers w where w.id = v_app.worker_id and w.whatsapp <> '';
    if not found then
      raise exception using errcode = 'BC404', message = 'Esse trabalhador ainda não cadastrou um WhatsApp.';
    end if;
  else
    raise exception using errcode = 'BC401', message = 'Esse contato é só de quem está no bico de ' ||
      coalesce((select nome from public.oficios where id = v_job.oficio_id), 'obra') || '.';
  end if;
end;
$$;

-- ===== 20261017000200_r04_exclusao_pelo_painel.sql =====
-- R04: apagar a conta direto no painel (Authentication › Users › Delete) não deixa mais o perfil para trás.
-- Antes, só `accounts` saía (cascata de auth.users); `workers`/`companies` continuavam com nome, foto e nota à vista,
-- as vagas da construtora seguiam abrindo pelo link e a selfie da verificação ficava guardada.
--   * anonymize_account(conta, motivo): a limpeza que a exclusão pelo app (delete_my_account, Y15) já fazia —
--     desistir/cancelar os bicos em andamento avisando o outro lado, anonimizar perfil e avaliações, encerrar as
--     vagas — e, a partir de agora, também: vagas da construtora ocultas (fora do link público) e sem fotos, e os
--     envios de verificação de identidade apagados. Os arquivos ficam sem uso e a limpeza diária
--     (orphan_storage_objects) os apaga.
--   * delete_my_account continua igual para quem usa (login recente, confirmação dos compromissos) e chama a função.
--   * gatilho BEFORE DELETE em auth.users: qualquer outro caminho (painel, Admin API) roda a mesma limpeza antes da
--     cascata. Cadastro nunca concluído (sem e-mail confirmado e sem perfil) segue a limpeza do Z01.
-- Idempotente.

create or replace function public.anonymize_account(p_account public.accounts, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_job public.jobs;
  r record;
begin
  if p_account.role = 'trabalhador' then
    perform public.conclude_finished_jobs(p_account.worker_id, null);
    for r in
      select a.id as app_id, j.id as job_id, j.company_id, public.job_title(j) as title
        from public.applications a join public.jobs j on j.id = a.job_id
       where a.worker_id = p_account.worker_id and a.status in ('pre_selecionado', 'contratado')
    loop
      perform public.application_step(r.app_id, 'desistir', 'trabalhador', p_reason);
      perform public.job_reopen_auto_rejected(r.job_id, 'vaga_reaberta');
      perform public.notify(null, r.company_id, 'desistencia', 'Um trabalhador saiu da Bicos',
        'Ele não vai mais em ' || r.title || '. Confira a vaga.', '/vaga-gerenciar/' || r.job_id);
    end loop;
    delete from public.applications where worker_id = p_account.worker_id and status in ('enviada', 'em_analise');
    delete from public.worker_posts where worker_id = p_account.worker_id;
    delete from public.notifications where worker_id = p_account.worker_id;
    delete from public.saved_jobs where worker_id = p_account.worker_id;
    -- R04: a selfie e o documento saem junto (a limpeza diária apaga os arquivos que ficaram sem envio).
    delete from public.identity_submissions where worker_id = p_account.worker_id;
    update public.reviews set author_label = 'Conta excluída'
     where direction = 'para_construtora'
       and application_id in (select id from public.applications where worker_id = p_account.worker_id);
    update public.workers
       set name = 'Conta excluída', initials = '–', whatsapp = '', specialties = '{}', facts = '{}',
           neighborhood = null, photo_url = null, cover_url = null
     where id = p_account.worker_id;
  else
    perform public.conclude_finished_jobs(null, p_account.company_id);
    for r in
      select a.id as app_id, a.worker_id, public.job_title(j) as title
        from public.applications a join public.jobs j on j.id = a.job_id
       where j.company_id = p_account.company_id and a.status in ('pre_selecionado', 'contratado')
    loop
      perform public.application_step(r.app_id, 'cancelar_contratacao', 'construtora', p_reason);
      perform public.notify(r.worker_id, null, 'contratacao_cancelada', 'Contratação cancelada',
        'A construtora de ' || r.title || ' saiu da Bicos e o bico foi cancelado.', '/minhas-candidaturas');
    end loop;
    for v_job in
      select * from public.jobs where company_id = p_account.company_id and not closed and deleted_at is null
    loop
      update public.jobs set closed = true, sem_contratacao = true where id = v_job.id;
      perform public.job_close_applications(v_job);
    end loop;
    -- R04: as vagas da construtora que saiu não abrem mais pelo link público nem aparecem para quem não esteve
    -- nelas; as fotos ficam sem uso e a limpeza diária apaga os arquivos.
    update public.jobs set hidden_at = coalesce(hidden_at, now()), hidden_reason = coalesce(hidden_reason, 'conta excluída'),
           photos = null
     where company_id = p_account.company_id and deleted_at is null;
    delete from public.notifications where company_id = p_account.company_id;
    update public.reviews set author_label = 'Construtora (conta excluída)'
     where direction = 'para_trabalhador'
       and application_id in (
         select a.id from public.applications a join public.jobs j on j.id = a.job_id
          where j.company_id = p_account.company_id);
    update public.companies
       set name = 'Construtora (conta excluída)', whatsapp = '', cnpj = null, logo_url = null, cover_url = null
     where id = p_account.company_id;
  end if;

end;
$$;
revoke all on function public.anonymize_account(public.accounts, text) from public, anon, authenticated;

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

create or replace function public.on_auth_user_deleted()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_account public.accounts;
begin
  select * into v_account from public.accounts where id = old.id for update;
  if not found or current_setting('bicos.conta_ja_limpa', true) = old.id::text then
    return old;  -- sem perfil, ou a exclusão pelo app já limpou
  end if;
  if v_account.email_confirmed_at is null and v_account.profile_completed_at is null then
    return old;  -- cadastro abandonado: cleanup_unconfirmed_profile_v2 (Z01) apaga o perfil vazio
  end if;
  perform public.anonymize_account(v_account, 'Conta excluída');
  update public.accounts set profile_completed_at = coalesce(profile_completed_at, now()) where id = old.id;
  return old;
end;
$$;
revoke all on function public.on_auth_user_deleted() from public, anon, authenticated;

drop trigger if exists on_auth_user_deleted on auth.users;
create trigger on_auth_user_deleted before delete on auth.users
  for each row execute function public.on_auth_user_deleted();

-- ===== 20261019000100_u01_vaga_simples.sql =====
-- U01 (teste com os amigos, 19/10): cadastro de vaga mais simples.
--
-- O que a construtora deixa de preencher, e o que o banco passa a aceitar:
--   * ofício: a vaga é identificada pelo TÍTULO, agora obrigatório. `jobs.oficio_id` aceita null (vagas antigas
--     continuam com o delas); se vier, ainda tem de existir no catálogo;
--   * número e complemento do endereço: número pode vir vazio (o ponto do mapa sai do CEP);
--   * forma de pagamento: sem escolha, fica null ("Pagamento combinado direto" na tela), não mais 'pix_dia'.
-- Datas (só "a combinar"), urgente e requisitos saíram só da tela: o banco continua aceitando como antes.
-- Alerta de bico novo: sem ofício na vaga, todo alerta da região recebe (o filtro de ofício saiu do mural).
-- Idempotente.

alter table public.jobs alter column oficio_id drop not null;

create or replace function public.job_from_draft(p jsonb, p_original_start date default null)
returns public.jobs language plpgsql stable set search_path = public as $$
declare
  j public.jobs;
  v_today date := public.bicos_today();
begin
  j.oficio_id := nullif(btrim(coalesce(p->>'oficio_id', '')), '');
  j.title := nullif(btrim(coalesce(p->>'title', '')), '');
  j.pay := (p->>'pay')::numeric;
  j.cep := p->>'cep';
  j.street := btrim(coalesce(p->>'street', ''));
  j.number := btrim(coalesce(p->>'number', ''));
  j.complement := nullif(btrim(coalesce(p->>'complement', '')), '');
  j.neighborhood := btrim(coalesce(p->>'neighborhood', ''));
  j.city := btrim(coalesce(p->>'city', ''));
  j.uf := upper(btrim(coalesce(p->>'uf', '')));
  j.lat := (p->>'lat')::double precision;
  j.lon := (p->>'lon')::double precision;
  j.date_to_arrange := coalesce((p->>'date_to_arrange')::boolean, false);
  j.start_date := case when j.date_to_arrange then null else (p->>'start_date')::date end;
  j.end_date := case when j.date_to_arrange then null else (p->>'end_date')::date end;
  j.start_time := nullif(p->>'start_time', '');
  j.end_time := nullif(p->>'end_time', '');
  j.diarias := coalesce((p->>'diarias')::integer, 1);
  j.dias := (p->>'dias')::public.dias_semana;
  j.urgent := coalesce((p->>'urgent')::boolean, false);
  j.photos := case when jsonb_typeof(p->'photos') = 'array'
                   then array(select jsonb_array_elements_text(p->'photos')) end;
  j.slots := coalesce((p->>'slots')::integer, 1);
  j.description := btrim(coalesce(p->>'description', ''));
  j.requirements := coalesce(array(select jsonb_array_elements_text(coalesce(p->'requirements', '[]'::jsonb))), '{}');

  -- U01: o título é o que identifica a vaga.
  if j.title is null then
    raise exception using errcode = 'BC422', message = 'Dê um título para a vaga.';
  end if;
  if char_length(j.title) > 60 then
    raise exception using errcode = 'BC422', message = 'Use até 60 letras no título.';
  end if;
  if j.oficio_id is not null and not exists (select 1 from public.oficios where id = j.oficio_id) then
    raise exception using errcode = 'BC422', message = 'Escolha o ofício que a vaga precisa.';
  end if;
  if j.cep is null or j.cep !~ '^\d{5}-\d{3}$' then
    raise exception using errcode = 'BC422', message = 'Digite o CEP da obra (8 números).';
  end if;
  -- O ponto precisa cair no Brasil (sem ele, a distância no mural sai errada). U01: o número é opcional.
  if j.street = '' or j.neighborhood = '' or j.city = '' or j.uf !~ '^[A-Z]{2}$'
     or j.lat is null or j.lon is null or j.lat not between -34 and 6 or j.lon not between -74 and -28 then
    raise exception using errcode = 'BC422', message = 'Confira o endereço da obra.';
  end if;
  if not j.date_to_arrange then
    if j.start_date is null or j.end_date is null then
      raise exception using errcode = 'BC422', message = 'Escolha a data de início e a de fim.';
    end if;
    if j.start_date < v_today and j.start_date is distinct from p_original_start then
      raise exception using errcode = 'BC422', message = 'A data de início não pode ser no passado.';
    end if;
    if j.end_date < j.start_date then
      raise exception using errcode = 'BC422', message = 'A data de fim tem que ser igual ou depois do início.';
    end if;
    if j.end_date - j.start_date + 1 > 60 then
      raise exception using errcode = 'BC422', message = 'Uma vaga cobre até 60 dias. Para mais, publique de novo depois.';
    end if;
  end if;
  if j.diarias < 1 or j.diarias > 60 then
    raise exception using errcode = 'BC422', message = 'Informe quantas diárias (de 1 a 60).';
  end if;
  if (j.start_time is null) <> (j.end_time is null) then
    raise exception using errcode = 'BC422', message = 'Preencha o início e o fim, ou deixe os dois em branco.';
  end if;
  -- W08: um turno da noite (22h–6h) passa da meia-noite; só início igual ao fim é recusado.
  if j.start_time is not null and (j.start_time !~ '^([01]\d|2[0-3]):[0-5]\d$'
     or j.end_time !~ '^([01]\d|2[0-3]):[0-5]\d$') then
    raise exception using errcode = 'BC422', message = 'Horário inválido.';
  end if;
  if j.start_time is not null and j.start_time = j.end_time then
    raise exception using errcode = 'BC422', message = 'O início e o fim não podem ser iguais.';
  end if;
  if j.slots < 1 or j.slots > 50 then
    raise exception using errcode = 'BC422', message = 'Informe quantas pessoas a vaga precisa (de 1 a 50).';
  end if;
  if j.pay is not null and j.pay < 80 then
    raise exception using errcode = 'BC422', message = 'Informe um valor de R$ 80 ou mais.';
  end if;
  -- W08: acima disso é quase sempre erro de digitação.
  if j.pay is not null and j.pay > 5000 then
    raise exception using errcode = 'BC422', message = 'Confira o valor: a diária vai até R$ 5.000.';
  end if;
  if j.description = '' then
    raise exception using errcode = 'BC422', message = 'Descreva o serviço da vaga.';
  end if;
  if char_length(j.description) < 20 then
    raise exception using errcode = 'BC422',
      message = 'Conte um pouco mais (pelo menos 20 letras): o que vai ser feito, onde, materiais.';
  end if;
  if char_length(j.description) > 1000 then
    raise exception using errcode = 'BC422', message = 'Use até 1000 letras na descrição.';
  end if;
  return j;
end;
$$;
revoke all on function public.job_from_draft(jsonb, date) from public, anon, authenticated;

-- U01: sem forma de pagamento no rascunho, fica sem (null), em vez de prometer PIX no dia.
create or replace function public.job_extras_from_draft(p jsonb, out method text, out note text)
language plpgsql immutable set search_path = public as $$
declare
  v_req text[] := coalesce(array(select jsonb_array_elements_text(coalesce(p->'requirements', '[]'::jsonb))), '{}');
begin
  method := nullif(p->>'payment_method', '');
  note := nullif(btrim(coalesce(p->>'payment_note', '')), '');
  if method is not null and method not in ('pix_dia', 'pix_fim', 'dinheiro', 'outro') then
    raise exception using errcode = 'BC422', message = 'Escolha como a diária vai ser paga.';
  end if;
  if method = 'outro' and note is null then
    raise exception using errcode = 'BC422', message = 'Conte como a diária vai ser paga.';
  end if;
  if method is distinct from 'outro' then note := null; end if;
  if char_length(coalesce(note, '')) > 80 then
    raise exception using errcode = 'BC422', message = 'Use até 80 caracteres para explicar o pagamento.';
  end if;
  if cardinality(v_req) > 12 or exists (select 1 from unnest(v_req) r where char_length(r) > 60 or btrim(r) = '') then
    raise exception using errcode = 'BC422', message = 'Até 12 itens, cada um com até 60 caracteres.';
  end if;
end;
$$;

-- U01: vaga sem ofício avisa todo alerta da região (o alerta com ofício era do filtro que saiu do mural).
-- X13: o PostGIS mora em `extensions` (por isso o search_path com os dois).
create or replace function public.notify_job_alerts()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  r record;
  v_today date := public.bicos_today();
  v_text text := public.job_title(new) || ' em ' || coalesce(nullif(new.neighborhood, ''), new.city) ||
                 case when new.pay > 0 then ' · R$ ' || to_char(new.pay, 'FM999G999') || ' por diária' else '' end;
begin
  for r in
    select a.worker_id
      from public.job_alerts a
      join public.workers w on w.id = a.worker_id and w.name <> 'Conta excluída'
     where (a.oficio_id is null or new.oficio_id is null or a.oficio_id = new.oficio_id)
       and (a.notified_on is distinct from v_today or a.notified_count < 5)
       and case
             when a.radius_km is null then public.fold_text(a.city) = public.fold_text(new.city) and a.uf = new.uf
             else st_dwithin(new.area_geog, st_setsrid(st_makepoint(a.lon, a.lat), 4326)::geography, a.radius_km * 1000)
           end
  loop
    perform public.notify(r.worker_id, null, 'bico_novo', 'Bico novo perto de você', v_text, '/vaga/' || new.id);
    update public.job_alerts
       set notified_count = case when notified_on = v_today then notified_count + 1 else 1 end,
           notified_on = v_today
     where worker_id = r.worker_id;
  end loop;
  return null;
end;
$$;
revoke all on function public.notify_job_alerts() from public, anon, authenticated;

-- U01: a denúncia de uma vaga sem ofício também aparece na fila da equipe (o join com o catálogo era interno).
create or replace function public.report_target_info(p_type public.report_target, p_id text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v jsonb;
begin
  if p_type = 'vaga' then
    select jsonb_build_object(
      'title', public.job_title(j), 'text', left(j.description, 600), 'job_id', j.id,
      'hidden', j.hidden_at is not null, 'deleted', j.deleted_at is not null,
      'account_id', a.id, 'account_name', c.name)
      into v
      from public.jobs j join public.companies c on c.id = j.company_id
      left join public.accounts a on a.company_id = j.company_id
     where j.id = p_id;
  elsif p_type = 'perfil' then
    select jsonb_build_object(
      'title', coalesce(w.name, c.name), 'text', null, 'account_id', a.id,
      'account_name', coalesce(w.name, c.name))
      into v
      from public.accounts a
      left join public.workers w on w.id = a.worker_id
      left join public.companies c on c.id = a.company_id
     where a.id::text = p_id;
  elsif p_type = 'avaliacao' then
    select jsonb_build_object(
      'title', 'Avaliação ' || r.value || '★', 'text', r.comment,
      'account_id', a.id, 'account_name', coalesce(w.name, c.name))
      into v
      from public.reviews r
      left join public.applications ap on ap.id = r.application_id
      left join public.jobs j on j.id = ap.job_id
      left join public.accounts a on a.id = (
        case when r.direction = 'para_construtora'
             then (select x.id from public.accounts x where x.worker_id = ap.worker_id)
             else (select x.id from public.accounts x where x.company_id = j.company_id) end)
      left join public.workers w on w.id = a.worker_id
      left join public.companies c on c.id = a.company_id
     where r.id::text = p_id;
  elsif p_type = 'post' then
    select jsonb_build_object(
      'title', 'Publicação no portfólio', 'text', p.caption, 'media_url', p.media_url,
      'account_id', a.id, 'account_name', w.name)
      into v
      from public.worker_posts p join public.workers w on w.id = p.worker_id
      left join public.accounts a on a.worker_id = p.worker_id
     where p.id::text = p_id;
  end if;
  return coalesce(v, jsonb_build_object('title', 'Conteúdo que não existe mais', 'text', null, 'account_id', null));
end;
$$;

commit;
