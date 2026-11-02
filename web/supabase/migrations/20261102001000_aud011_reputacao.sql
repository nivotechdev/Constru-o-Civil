-- AUD-011: reputação fabricada em segundos com duas contas (a mesma pessoa contrata, conclui e avalia). Decisão 11 dos
-- sócios (02/11/2026): em vaga "a combinar" concluir e marcar falta só 24 horas depois da contratação; o bico só entra
-- em `jobs_done` com a presença confirmada ou concluído pelo sistema; a equipe consulta os pares de contas que só
-- avaliam um ao outro (reciprocal_review_pairs). Idempotente.

-- reciprocal_review_pairs: empresa e trabalhador que se avaliaram e não têm avaliação com mais ninguém (só service_role).
create or replace function public.reciprocal_review_pairs()
returns table (company_id uuid, worker_id uuid, reviews bigint)
language sql stable security definer set search_path = public as $$
  with pairs as (
    select j.company_id, a.worker_id,
           count(*) filter (where r.direction = 'para_construtora') as w2c,
           count(*) filter (where r.direction = 'para_trabalhador') as c2w
      from public.reviews r
      join public.applications a on a.id = r.application_id
      join public.jobs j on j.id = a.job_id
     group by 1, 2
  )
  select p.company_id, p.worker_id, p.w2c + p.c2w
    from pairs p
   where p.w2c > 0 and p.c2w > 0
     and not exists (select 1 from pairs q where q.company_id = p.company_id and q.worker_id <> p.worker_id and q.c2w > 0)
     and not exists (select 1 from pairs q where q.worker_id = p.worker_id and q.company_id <> p.company_id and q.w2c > 0)
$$;
revoke all on function public.reciprocal_review_pairs() from public, anon, authenticated;
grant execute on function public.reciprocal_review_pairs() to service_role;

-- transition_application (de 20261102000800_aud022_oculta_e_suspensa.sql)
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
    raise exception using errcode = 'BC401', message = 'Só a empresa da vaga pode decidir os candidatos.';
  end if;
  -- AUD-022: vaga tirada do ar pela equipe e empresa suspensa não aprovam, contratam nem desfazem aprovação.
  -- Recusar, cancelar a contratação e desistir seguem livres: sair de um compromisso é sempre permitido.
  if p_action in ('aprovar', 'contratar', 'desfazer_aprovacao') then
    perform public.assert_company_active(v_job.company_id);
    if v_job.hidden_at is not null then
      raise exception using errcode = 'BC409', message = 'Essa vaga foi tirada do ar pela equipe. Fale com a gente pela Ajuda.';
    end if;
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
    -- AUD-011: vaga "a combinar" não tem dia; 24 horas depois da contratação, para não concluir em segundos.
    if v_app.status = 'contratado' and v_job.date_to_arrange and v_app.status_changed_at > now() - interval '24 hours' then
      raise exception using errcode = 'BC409',
        message = 'Como o dia é a combinar, só dá para concluir 24 horas depois da contratação.';
    end if;
    perform public.application_conclude(v_app.id, 'construtora');

  elsif p_action = 'marcar_falta' then
    if v_app.status = 'contratado' and not public.job_started(v_job) then
      raise exception using errcode = 'BC409', message = 'Só dá para marcar falta a partir do dia do bico.';
    end if;
    if v_app.status = 'contratado' and v_job.date_to_arrange and v_app.status_changed_at > now() - interval '24 hours' then
      raise exception using errcode = 'BC409',
        message = 'Como o dia é a combinar, só dá para marcar falta 24 horas depois da contratação.';
    end if;
    perform public.application_step(v_app.id, 'marcar_falta', 'construtora');
    perform public.job_reopen_auto_rejected(p_job_id, 'vaga_reaberta');
    perform public.notify(p_worker_id, null, 'nao_compareceu', 'Falta registrada',
      v_company || ' registrou que você não foi em ' || v_title ||
      '. Fale com a empresa se foi um engano.', '/vaga/' || p_job_id);

  else
    raise exception using errcode = 'BC422', message = 'Ação desconhecida.';
  end if;
end;
$$;

-- application_conclude (de 20261011000100_y01_y04_ciclo_vaga.sql)
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
$$;
