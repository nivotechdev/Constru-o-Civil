-- AUD-004: excluir a conta não apagava (nem anonimizava) as avaliações que a pessoa ESCREVEU: o nome (author_label) e
-- o comentário ficavam publicados no perfil de quem foi avaliado. Decisão dos sócios (02/11/2026): anonimizar — tira
-- o nome e o comentário e mantém a nota na média de quem foi avaliado. As avaliações recebidas continuam saindo com a
-- conta. Idempotente.

-- anonymize_account (de 20261021000500_u48_publico_geral.sql)
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
    -- AUD-004: o que ele escreveu sobre as empresas perde o nome e o comentário (a nota continua na média delas).
    -- Tem que vir antes de apagar as candidaturas: é por elas que se acha o que ele avaliou.
    update public.reviews set author_label = 'Conta excluída', comment = ''
     where direction = 'para_construtora'
       and application_id in (select id from public.applications where worker_id = p_account.worker_id);
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
    -- AUD-004: o que a empresa escreveu sobre os trabalhadores perde o nome e o comentário (a nota continua na
    -- média deles). Antes de apagar as vagas: é pelas candidaturas delas que se acha o que ela avaliou.
    update public.reviews set author_label = 'Empresa (conta excluída)', comment = ''
     where direction = 'para_trabalhador'
       and application_id in (select a.id from public.applications a where a.job_id = any (coalesce(v_jobs, '{}')));
    -- As vagas levam junto candidaturas e eventos, vagas salvas, convites e impulsionamentos.
    delete from public.jobs where company_id = p_account.company_id;
    delete from public.accounts where id = p_account.id;
    -- A empresa leva as avaliações dos dois lados, as notificações, a equipe e o que restou dos pagamentos.
    delete from public.companies where id = p_account.company_id;
    update public.workers set review_count = review_count where id = any (coalesce(v_others, '{}'));
  end if;
end;
$$;
