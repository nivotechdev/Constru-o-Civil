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
