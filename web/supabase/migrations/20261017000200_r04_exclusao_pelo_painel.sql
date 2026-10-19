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
