-- U48 — A Bicos passa a ser para o público geral (quem procura bico e empresas ou pessoas que contratam qualquer
-- serviço), não só para construtoras e pedreiros. Só os TEXTOS que o banco manda para a tela mudam: as mensagens de erro,
-- os avisos e as etiquetas das avaliações ("EPI no local" → "Local seguro", "Usou EPI" → "Cuidadoso") passam a falar
-- de empresa, de serviço e de local, sem construtora nem obra. Os nomes internos ("construtora" como lado da
-- candidatura, "para_construtora", "cancelado_pela_construtora") ficam: não aparecem para ninguém.
-- Cada função abaixo é a versão em uso (a última migration que a definiu, conferida com o staging) só com os textos
-- trocados — create or replace, mesma assinatura e grants; idempotente. Não mexe em dado existente.

-- admin_suspend_account (de 20261017000100_r03_suspensao_completa.sql)
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
      ' foi cancelado pela equipe da Bicos. Não vá até o local. Veja outros bicos no mural.',
      '/vaga/' || r.job_id);
  end loop;
  perform public.staff_log('suspender_conta', 'conta', p_account::text, p_reason);
end;
$$;

-- anonymize_account (de 20261020000300_u24_exclusao_completa.sql)
create or replace function public.anonymize_account(p_account public.accounts, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_jobs text[];
  v_posts text[];
  v_others uuid[];
begin
  if p_account.role = 'trabalhador' then
    perform public.conclude_finished_jobs(p_account.worker_id, null);
    -- Quem contava com ele é avisado e a vaga volta a ter lugar.
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
    -- As construtoras que ele avaliou: a nota delas é refeita sem essas avaliações.
    select array_agg(distinct company_id) into v_others
      from public.reviews where worker_id = p_account.worker_id and direction = 'para_construtora';
    select array_agg(id::text) into v_posts from public.worker_posts where worker_id = p_account.worker_id;
    delete from public.reports
     where (target_type = 'perfil' and target_id in (p_account.worker_id::text, p_account.id::text))
        or (target_type = 'post' and target_id = any (coalesce(v_posts, '{}')))
        or (target_type = 'avaliacao' and target_id in (
              select id::text from public.reviews where worker_id = p_account.worker_id));
    delete from public.whatsapp_verifications
     where phone = (select whatsapp from public.workers where id = p_account.worker_id);
    -- O login primeiro (ele aponta para o perfil); o perfil leva junto, em cascata, candidaturas e seus eventos,
    -- vagas salvas, avaliações dos dois lados, publicações, notificações, alertas, convites, identidade e tentativas.
    delete from public.accounts where id = p_account.id;
    delete from public.workers where id = p_account.worker_id;
    update public.companies set review_count = review_count where id = any (coalesce(v_others, '{}'));
  else
    perform public.conclude_finished_jobs(null, p_account.company_id);
    -- Quem estava escolhido ou contratado é avisado de que o bico acabou.
    for r in
      select a.id as app_id, a.worker_id, public.job_title(j) as title
        from public.applications a join public.jobs j on j.id = a.job_id
       where j.company_id = p_account.company_id and a.status in ('pre_selecionado', 'contratado')
    loop
      perform public.notify(r.worker_id, null, 'contratacao_cancelada', 'Contratação cancelada',
        'A empresa de ' || r.title || ' saiu da Bicos e o bico foi cancelado.', '/minhas-candidaturas');
    end loop;
    select array_agg(id) into v_jobs from public.jobs where company_id = p_account.company_id;
    -- Os bicos concluídos com ela saem da contagem de cada trabalhador.
    for r in
      select a.worker_id, count(*)::int as done
        from public.applications a
       where a.job_id = any (coalesce(v_jobs, '{}')) and a.status = 'concluida'
       group by a.worker_id
    loop
      update public.workers set jobs_done = greatest(0, jobs_done - r.done) where id = r.worker_id;
    end loop;
    -- Os trabalhadores que ela avaliou: a nota deles é refeita sem essas avaliações.
    select array_agg(distinct worker_id) into v_others
      from public.reviews where company_id = p_account.company_id and direction = 'para_trabalhador';
    delete from public.reports
     where (target_type = 'perfil' and target_id in (p_account.company_id::text, p_account.id::text))
        or (target_type = 'vaga' and target_id = any (coalesce(v_jobs, '{}')))
        or (target_type = 'avaliacao' and target_id in (
              select id::text from public.reviews where company_id = p_account.company_id));
    -- As vagas levam junto candidaturas e eventos, vagas salvas, convites e impulsionamentos.
    delete from public.jobs where company_id = p_account.company_id;
    delete from public.accounts where id = p_account.id;
    -- A empresa leva as avaliações dos dois lados, as notificações, a equipe e o que restou dos pagamentos.
    delete from public.companies where id = p_account.company_id;
    update public.workers set review_count = review_count where id = any (coalesce(v_others, '{}'));
  end if;
end;
$$;

-- begin_boost_payment (de 20261010000200_z02_pagamentos.sql)
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

-- boost_blocker (de 20261010000100_z01_rpcs_candidatura.sql)
create or replace function public.boost_blocker(p_job public.jobs)
returns text language sql stable security definer set search_path = public as $$
  select case
    when p_job.company_id is distinct from public.my_company_id() then 'Só a empresa da vaga pode impulsionar.'
    when not public.job_is_open(p_job) or public.job_holding(p_job.id) >= p_job.slots
      then 'Só dá para impulsionar uma vaga aberta.'
    when p_job.boost_ends_at > now() then 'Essa vaga já está impulsionada.'
  end
$$;

-- get_contact (de 20261017000100_r03_suspensao_completa.sql)
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
    return query select w.name, w.whatsapp from public.workers w where w.id = v_app.worker_id and w.whatsapp <> '';
    if not found then
      raise exception using errcode = 'BC404', message = 'Esse trabalhador ainda não cadastrou um WhatsApp.';
    end if;
  else
    raise exception using errcode = 'BC401', message = 'Esse contato é só de quem está nesse bico.';
  end if;
end;
$$;

-- job_from_draft (de 20261019000100_u01_vaga_simples.sql)
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
    raise exception using errcode = 'BC422', message = 'Digite o CEP do local do serviço (8 números).';
  end if;
  -- O ponto precisa cair no Brasil (sem ele, a distância no mural sai errada). U01: o número é opcional.
  if j.street = '' or j.neighborhood = '' or j.city = '' or j.uf !~ '^[A-Z]{2}$'
     or j.lat is null or j.lon is null or j.lat not between -34 and 6 or j.lon not between -74 and -28 then
    raise exception using errcode = 'BC422', message = 'Confira o endereço do local do serviço.';
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

-- own_job_for_update (de 20261009000200_bicos_v2_rules.sql)
create or replace function public.own_job_for_update(p_job_id text)
returns public.jobs language plpgsql security definer set search_path = public as $$
declare
  v_job public.jobs;
begin
  select * into v_job from public.jobs where id = p_job_id for update;
  if not found then
    raise exception using errcode = 'BC404', message = 'Essa vaga não existe mais.';
  end if;
  if v_job.company_id is distinct from public.my_company_id() then
    raise exception using errcode = 'BC401', message = 'Só a empresa da vaga pode fazer isso.';
  end if;
  return v_job;
end;
$$;

-- publish_job (de 20261012000700_l10_cnpj_receita.sql)
create or replace function public.publish_job(p jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_company uuid := public.my_company_id();
  j public.jobs;
  x record;
  v_id text;
begin
  if v_company is null then
    raise exception using errcode = 'BC401', message = 'Só a conta de empresa pode publicar vagas.';
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

-- set_company_verification (de 20261011000500_y24_verificacao.sql)
create or replace function public.set_company_verification(p_company uuid, p_status public.company_verification)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.companies set verification_status = p_status where id = p_company;
  if not found then
    raise exception using errcode = 'BC404', message = 'Empresa não encontrada.';
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

-- submit_application (de 20261010000100_z01_rpcs_candidatura.sql)
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
    raise exception using errcode = 'BC409', message = 'Essa vaga foi removida pela empresa.';
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

-- submit_review (de 20261020000200_u12_perfil_simples.sql)
create or replace function public.submit_review(
  p_application_id uuid, p_direction public.review_direction, p_value integer, p_tags text[], p_comment text
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_app public.applications;
  v_job public.jobs;
  v_side text := case p_direction when 'para_construtora' then 'trabalhador' else 'construtora' end;
  v_comment text := btrim(coalesce(p_comment, ''));
  v_allowed text[] := case p_direction
    when 'para_construtora' then array['Pagou no dia', 'Local seguro', 'Horário combinado', 'Equipe respeitosa']
    else array['Chegou no horário', 'Trabalho caprichado', 'Cuidadoso', 'Respeitou a equipe', 'Deixou o local limpo']
  end;
  v_tags text[];
  v_label text;
  v_worker public.workers;
begin
  select * into v_app from public.applications where id = p_application_id for update;
  if not found then
    raise exception using errcode = 'BC404', message = 'Essa diária não existe mais.';
  end if;
  select * into v_job from public.jobs where id = v_app.job_id;
  if (v_side = 'trabalhador' and v_app.worker_id is distinct from public.my_worker_id())
     or (v_side = 'construtora' and v_job.company_id is distinct from public.my_company_id()) then
    raise exception using errcode = 'BC401', message = 'Essa avaliação não é sua para fazer.';
  end if;
  if v_app.status <> 'concluida'
     or (v_side = 'trabalhador' and v_app.worker_reviewed)
     or (v_side = 'construtora' and v_app.company_reviewed) then
    raise exception using errcode = 'BC409', message = 'Essa avaliação não está disponível.';
  end if;
  if p_value is null or p_value < 1 or p_value > 5 then
    raise exception using errcode = 'BC422', message = 'Escolha uma nota de 1 a 5 estrelas.';
  end if;
  if char_length(v_comment) > 300 then
    raise exception using errcode = 'BC422', message = 'Use até 300 caracteres.';
  end if;
  v_tags := array(select distinct t from unnest(coalesce(p_tags, '{}')) t where t = any (v_allowed));

  select * into v_worker from public.workers where id = v_app.worker_id;
  if v_side = 'trabalhador' then
    v_label := public.first_name(v_worker.name) || ' ' ||
               left((regexp_split_to_array(btrim(v_worker.name), '\s+'))[cardinality(regexp_split_to_array(btrim(v_worker.name), '\s+'))], 1) ||
               '.';
    insert into public.reviews (application_id, direction, company_id, author_label, value, tags, comment)
    values (v_app.id, 'para_construtora', v_job.company_id, v_label, p_value, v_tags, v_comment);
    update public.companies
       set rating = round((rating * review_count + p_value) / (review_count + 1), 1),
           review_count = review_count + 1
     where id = v_job.company_id;
    update public.applications set worker_reviewed = true where id = v_app.id;
  else
    select name into v_label from public.companies where id = v_job.company_id;
    insert into public.reviews (application_id, direction, worker_id, author_label, value, tags, comment)
    values (v_app.id, 'para_trabalhador', v_app.worker_id, v_label, p_value, v_tags, v_comment);
    update public.workers
       set rating = round((rating * review_count + p_value) / (review_count + 1), 1),
           review_count = review_count + 1
     where id = v_app.worker_id;
    update public.applications set company_reviewed = true where id = v_app.id;
  end if;
end;
$$;

-- transition_application (de 20261010000100_z01_rpcs_candidatura.sql)
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

-- withdraw_application (de 20261010000100_z01_rpcs_candidatura.sql)
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
    raise exception using errcode = 'BC409', message = 'A empresa já decidiu sobre essa candidatura. Atualize a tela.';
  end if;
  delete from public.applications where id = v_app.id;
end;
$$;

-- Contas de empresa excluídas antes do U24 (quando a exclusão anonimizava em vez de apagar) ficaram com o nome
-- "Construtora (conta excluída)", que aparece nas avaliações que elas deixaram. Nenhuma função gera mais esse nome;
-- o texto passa a "Empresa (conta excluída)". Idempotente.
update public.companies set name = 'Empresa (conta excluída)' where name = 'Construtora (conta excluída)';
update public.reviews set author_label = 'Empresa (conta excluída)' where author_label = 'Construtora (conta excluída)';
