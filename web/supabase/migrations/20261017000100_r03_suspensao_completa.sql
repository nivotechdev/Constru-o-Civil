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
