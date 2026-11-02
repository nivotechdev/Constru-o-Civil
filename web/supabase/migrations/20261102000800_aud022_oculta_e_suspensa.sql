-- AUD-022: vaga ocultada pela equipe e empresa suspensa ainda aprovavam, contratavam e convidavam (a conta suspensa
-- só perdia o acesso ao WhatsApp). Agora transition_application (aprovar, contratar, desfazer_aprovacao),
-- invite_worker, undo_reject e update_job recusam com BC409 quando a conta da empresa está suspensa, e as três
-- ações de aprovação também quando a vaga está oculta. Recusar, cancelar a contratação e desistir continuam
-- liberados. Idempotente.

create or replace function public.assert_company_active(p_company uuid)
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if exists (select 1 from public.accounts where company_id = p_company and suspended_at is not null) then
    raise exception using errcode = 'BC409', message = 'Sua conta está suspensa pela equipe. Fale com a gente pela Ajuda.';
  end if;
end;
$$;
revoke all on function public.assert_company_active(uuid) from public, anon, authenticated;

-- transition_application (de 20261021000500_u48_publico_geral.sql)
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
    perform public.application_conclude(v_app.id, 'construtora');

  elsif p_action = 'marcar_falta' then
    if v_app.status = 'contratado' and not public.job_started(v_job) then
      raise exception using errcode = 'BC409', message = 'Só dá para marcar falta a partir do dia do bico.';
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

-- invite_worker (de 20261013000300_f13_convite.sql)
create or replace function public.invite_worker(p_job_id text, p_worker_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_job public.jobs := public.own_job_for_update(p_job_id);
  v_company text;
  v_count integer;
begin
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
$$;

-- undo_reject (de 20261012000200_l22_desfazer_recusa.sql)
create or replace function public.undo_reject(p_job_id text, p_worker_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_job public.jobs := public.own_job_for_update(p_job_id);
  v_app public.applications;
  v_last public.application_events;
  v_company text;
  v_taken_back integer;
begin
  perform public.assert_company_active(v_job.company_id);
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

-- update_job (de 20261102000700_aud012_tetos_de_vagas.sql)
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
  perform public.assert_company_active(v_old.company_id);
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
     or v_old.end_time is distinct from j.end_time or v_old.weekdays is distinct from j.weekdays then
    v_changes := array_append(v_changes, 'data');
  end if;
  if v_old.cep is distinct from j.cep or v_old.street is distinct from j.street
     or v_old.number is distinct from j.number or v_old.city is distinct from j.city
     or v_old.uf is distinct from j.uf or v_old.place_type is distinct from j.place_type then
    v_changes := array_append(v_changes, 'endereço');
  end if;

  update public.jobs set
    oficio_id = j.oficio_id, title = j.title, pay = j.pay, cep = j.cep, street = j.street, number = j.number,
    complement = j.complement, neighborhood = j.neighborhood, city = j.city, uf = j.uf, lat = j.lat,
    lon = j.lon, date_to_arrange = j.date_to_arrange, start_date = j.start_date, end_date = j.end_date,
    start_time = j.start_time, end_time = j.end_time, diarias = j.diarias, dias = j.dias,
    photos = coalesce(j.photos, photos), slots = j.slots, description = j.description,
    requirements = j.requirements, payment_method = x.method, payment_note = x.note, weekdays = j.weekdays,
    place_type = j.place_type
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
