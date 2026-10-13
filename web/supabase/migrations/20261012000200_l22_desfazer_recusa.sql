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
