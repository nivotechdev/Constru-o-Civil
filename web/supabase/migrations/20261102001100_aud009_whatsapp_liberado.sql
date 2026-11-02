-- AUD-009: empresa sem verificação aprovava todos e recebia o WhatsApp deles (coleta para o golpe do falso emprego).
-- Decisão 2 dos sócios (opções B + C), para empresa SEM selo (a verificada segue como antes):
--   * só aprova com a conta de pelo menos 3 dias (approve_min_account_days_unverified) e até 5 aprovações por dia
--     (approvals_per_day_unverified); se `approve_requires_whatsapp` = 'sim', também com o WhatsApp da empresa
--     confirmado (desligado de propósito enquanto o código por WhatsApp não existe em produção);
--   * o WhatsApp do trabalhador só chega à empresa depois de "Compartilhar meu WhatsApp" (share_my_whatsapp); o do
--     trabalhador para a empresa não muda. Idempotente.

alter table public.applications add column if not exists worker_shared_whatsapp_at timestamptz;

create or replace function public.share_my_whatsapp(p_job_id text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_app public.applications;
  v_job public.jobs;
  v_worker text;
begin
  select * into v_app from public.applications
   where job_id = p_job_id and worker_id = public.my_worker_id() for update;
  if not found then
    raise exception using errcode = 'BC409', message = 'Essa candidatura não está aprovada.';
  end if;
  if v_app.status not in ('pre_selecionado', 'contratado') then
    raise exception using errcode = 'BC409', message = 'Só dá para compartilhar o WhatsApp depois que a empresa aprovar.';
  end if;
  if v_app.worker_shared_whatsapp_at is not null then return; end if;
  update public.applications set worker_shared_whatsapp_at = now() where id = v_app.id;
  select * into v_job from public.jobs where id = p_job_id;
  select name into v_worker from public.workers where id = v_app.worker_id;
  perform public.notify(null, v_job.company_id, 'confirmar_presenca',
    coalesce(nullif(public.first_name(v_worker), ''), 'O trabalhador') || ' compartilhou o WhatsApp',
    'Agora você pode chamar para combinar ' || public.job_title(v_job) || '.', '/vaga-gerenciar/' || p_job_id);
end;
$$;
revoke all on function public.share_my_whatsapp(text) from public, anon;
grant execute on function public.share_my_whatsapp(text) to authenticated;

-- transition_application (de 20261102001000_aud011_reputacao.sql)
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
  v_unverified boolean;
  v_cap integer;
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
    -- AUD-009: empresa sem selo só aprova com a conta antiga (3 dias) e com um teto por dia; o WhatsApp do
    -- trabalhador só chega a ela depois que ele toca em "Compartilhar meu WhatsApp". Números em app_config.
    v_unverified := not coalesce((select verification_status = 'verificada' from public.companies
                                   where id = v_job.company_id), false);
    if v_unverified then
      if not exists (
        select 1 from public.accounts a
         where a.company_id = v_job.company_id
           and a.created_at <= now() - make_interval(days => coalesce(nullif((select value from public.app_config
                 where key = 'approve_min_account_days_unverified'), '')::integer, 3))
           and (a.whatsapp_verified_at is not null
                or coalesce((select value from public.app_config where key = 'approve_requires_whatsapp'), 'nao') <> 'sim')
      ) then
        raise exception using errcode = 'BC409',
          message = 'Sua empresa ainda não pode aprovar: a conta precisa ter alguns dias de uso. Se for urgente, fale com a gente pela Ajuda.';
      end if;
      v_cap := coalesce(nullif((select value from public.app_config where key = 'approvals_per_day_unverified'), '')::integer, 5);
      if (select count(*) from public.application_events e
            join public.applications ap on ap.id = e.application_id
            join public.jobs jb on jb.id = ap.job_id
           where jb.company_id = v_job.company_id and e.status = 'pre_selecionado'
             and (e.at at time zone 'America/Sao_Paulo')::date = public.bicos_today()) >= v_cap then
        raise exception using errcode = 'BC409',
          message = 'Você já aprovou ' || v_cap || ' pessoas hoje. Aprove as próximas amanhã ou peça a verificação da empresa pela Ajuda.';
      end if;
    end if;
    perform public.application_step(v_app.id, 'aprovar', 'construtora');
    perform public.notify(p_worker_id, null, 'pre_selecionado', 'Você foi pré-selecionado',
      v_company || ' quer falar com você sobre ' || v_title || '. ' ||
      case when v_unverified then 'Toque em "Compartilhar meu WhatsApp" para ela falar com você.'
           else 'O WhatsApp está liberado.' end,
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

-- get_contact (de 20261021000500_u48_publico_geral.sql)
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
    raise exception using errcode = 'BC401', message = 'O contato abre quando a empresa aprova o candidato.';
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
      raise exception using errcode = 'BC404', message = 'A empresa ainda não cadastrou um WhatsApp.';
    end if;
  elsif v_job.company_id = public.my_company_id() then
    -- AUD-009: empresa sem selo só recebe o WhatsApp do trabalhador depois que ele compartilhar.
    if v_app.worker_shared_whatsapp_at is null
       and not coalesce((select verification_status = 'verificada' from public.companies where id = v_job.company_id), false) then
      raise exception using errcode = 'BC404',
        message = 'Esse trabalhador ainda não compartilhou o WhatsApp. Ele recebeu o aviso para fazer isso.';
    end if;
    return query select w.name, w.whatsapp from public.workers w where w.id = v_app.worker_id and w.whatsapp <> '';
    if not found then
      raise exception using errcode = 'BC404', message = 'Esse trabalhador ainda não cadastrou um WhatsApp.';
    end if;
  else
    raise exception using errcode = 'BC401', message = 'Esse contato é só de quem está nesse bico.';
  end if;
end;
$$;
