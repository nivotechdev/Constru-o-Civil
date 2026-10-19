-- U06 (19/10): a construtora não encerra mais a vaga à mão. Na tela "Sua vaga" ficam só "Editar vaga" e
-- "Excluir vaga". A vaga continua fechando sozinha quando a equipe termina, quando o prazo passa ou quando a
-- conta da construtora é excluída (job_close_applications segue servindo esses casos).
--   * sai a RPC close_job: só o botão "Encerrar vaga" a chamava (delete_job não depende dela desde a Z01);
--   * delete_job: a mensagem de "tem gente escolhida ou contratada" não manda mais encerrar a vaga.
-- Idempotente.

drop function if exists public.close_job(text);

-- Excluir o anúncio (Y08): só sem gente escolhida ou contratada. Quem esperava vira "não selecionado"
-- e é avisado; a vaga sai do mural e fica fechada. (Igual à Z01, só muda a mensagem do BC409.)
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
      message = 'Essa vaga tem gente escolhida ou contratada. Ela não pode ser excluída.';
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
