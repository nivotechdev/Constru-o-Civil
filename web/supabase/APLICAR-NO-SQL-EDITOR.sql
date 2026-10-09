-- Bicos v2 — o último lote, para colar no SQL Editor do Supabase (projeto ppnxdajiihsjaojxokzh).
--
-- O resto das migrations já está aplicado. Este lote ficou de fora porque tem comandos DELETE dentro das
-- funções, e o conector usado na sessão pede uma aprovação que não chegou a tempo. Ele cria:
--   * transition_application — aprovar, recusar, desfazer, contratar, cancelar, concluir, falta, desistir;
--   * withdraw_application — o trabalhador retira a candidatura enquanto a construtora não decidiu;
--   * delete_job — excluir o anúncio (encerra e avisa quem esperava);
--   * delete_my_account — excluir a conta (LGPD);
--   * cleanup_unconfirmed_profile_v2 — apaga o perfil vazio de cadastro nunca confirmado;
--   * a política de apagar foto da própria vaga no Storage.
-- Roda inteiro ou não roda nada (uma transação). Pode rodar de novo sem problema.

begin;
create or replace function public.cleanup_unconfirmed_profile_v2()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.email_confirmed_at is null and old.profile_completed_at is null then
    delete from public.workers w
     where w.id = old.worker_id and not exists (select 1 from public.applications a where a.worker_id = w.id);
    delete from public.companies c
     where c.id = old.company_id and not exists (select 1 from public.jobs j where j.company_id = c.id);
  end if;
  return old;
end;
$$;

drop trigger if exists on_account_deleted_v2 on public.accounts;
create trigger on_account_deleted_v2
  after delete on public.accounts
  for each row execute function public.cleanup_unconfirmed_profile_v2();

create or replace function public.withdraw_application(p_job_id text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_app public.applications;
begin
  select * into v_app from public.applications
   where job_id = p_job_id and worker_id = public.my_worker_id() for update;
  if not found then
    raise exception using errcode = 'BC404', message = 'Essa candidatura não existe mais.';
  end if;
  if v_app.status not in ('enviada', 'em_analise') then
    raise exception using errcode = 'BC409', message = 'A construtora já decidiu sobre essa candidatura. Atualize a tela.';
  end if;
  delete from public.applications where id = v_app.id;
end;
$$;

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

  -- O trabalhador desiste ("Não vou poder ir").
  if p_action = 'desistir' then
    if p_worker_id is distinct from public.my_worker_id() then
      raise exception using errcode = 'BC401', message = 'Essa candidatura não é sua.';
    end if;
    perform public.application_step(v_app.id, 'desistir', 'trabalhador', v_reason);
    perform public.notify(null, v_job.company_id, 'desistencia',
      coalesce(nullif(public.first_name(v_worker), ''), 'O trabalhador') || ' não vai poder ir',
      v_title || ': a vaga dele voltou a ficar aberta. Motivo: ' || coalesce(v_reason, 'não informado') || '.',
      '/vaga-gerenciar/' || p_job_id);
    return;
  end if;

  if v_job.company_id is distinct from public.my_company_id() then
    raise exception using errcode = 'BC401', message = 'Só a construtora da vaga pode decidir os candidatos.';
  end if;

  if p_action = 'analisar' then
    if v_app.status <> 'enviada' then return; end if;  -- nada a mudar: silencioso
    perform public.application_step(v_app.id, 'analisar', 'construtora');
    perform public.notify(p_worker_id, null, 'candidatura_em_analise', 'Candidatura em análise',
      v_company || ' está avaliando seu perfil para ' || v_title || '.', '/vaga/' || p_job_id);

  elsif p_action = 'aprovar' then
    select count(*) into v_holding from public.applications
     where job_id = p_job_id and status in ('pre_selecionado', 'contratado');
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
    perform public.application_step(v_app.id, 'desfazer_aprovacao', 'construtora');
    if not v_job.closed then
      for r in
        update public.applications
           set status = 'em_analise', status_changed_at = now(), auto_rejected = false
         where job_id = p_job_id and auto_rejected and status = 'nao_selecionado'
        returning id
      loop
        insert into public.application_events (application_id, status, "by", reason)
        values (r.id, 'em_analise', 'sistema', 'aprovacao_desfeita');
      end loop;
    end if;
    -- O aviso de pré-seleção sai, se o trabalhador ainda não viu.
    delete from public.notifications
     where kind = 'pre_selecionado' and worker_id = p_worker_id
       and target = '/selecionado/' || p_job_id and read_at is null;

  elsif p_action = 'contratar' then
    perform public.application_step(v_app.id, 'contratar', 'construtora');
    perform public.notify(p_worker_id, null, 'contratado', 'Contratação confirmada',
      v_company || ' confirmou você para ' || v_title || '.', '/selecionado/' || p_job_id);

  elsif p_action = 'cancelar_contratacao' then
    perform public.application_step(v_app.id, 'cancelar_contratacao', 'construtora', v_reason);
    perform public.notify(p_worker_id, null, 'contratacao_cancelada', 'Contratação cancelada',
      v_company || ' cancelou ' || v_title || '. Motivo: ' || coalesce(v_reason, 'não informado') || '.',
      '/vaga/' || p_job_id);

  elsif p_action = 'concluir' then
    perform public.application_conclude(v_app.id, 'construtora');

  elsif p_action = 'marcar_falta' then
    perform public.application_step(v_app.id, 'marcar_falta', 'construtora');
    perform public.notify(p_worker_id, null, 'nao_compareceu', 'Falta registrada',
      v_company || ' registrou que você não foi em ' || v_title ||
      '. Fale com a construtora se foi um engano.', '/vaga/' || p_job_id);

  else
    raise exception using errcode = 'BC422', message = 'Ação desconhecida.';
  end if;
end;
$$;

create or replace function public.delete_job(p_job_id text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.close_job(p_job_id);
  update public.jobs set deleted_at = coalesce(deleted_at, now()) where id = p_job_id;
end;
$$;

create or replace function public.delete_my_account(p_confirm_commitments boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_account public.accounts;
  v_reason text := 'Conta excluída';
  v_job public.jobs;
  r record;
begin
  select * into v_account from public.accounts where id = auth.uid() for update;
  if not found then
    raise exception using errcode = 'BC401', message = 'Entre na sua conta de novo para continuar.';
  end if;

  if v_account.role = 'trabalhador' then
    perform public.conclude_finished_jobs(v_account.worker_id, null);
    if not p_confirm_commitments and exists (
      select 1 from public.applications
       where worker_id = v_account.worker_id and status in ('pre_selecionado', 'contratado')) then
      raise exception using errcode = 'BC409', message = 'Confirme o que acontece com os bicos em andamento antes de excluir.';
    end if;
    for r in
      select a.id as app_id, j.id as job_id, j.company_id, public.job_title(j) as title
        from public.applications a join public.jobs j on j.id = a.job_id
       where a.worker_id = v_account.worker_id and a.status in ('pre_selecionado', 'contratado')
    loop
      perform public.application_step(r.app_id, 'desistir', 'trabalhador', v_reason);
      perform public.notify(null, r.company_id, 'desistencia', 'Um trabalhador saiu da Bicos',
        'A vaga dele em ' || r.title || ' voltou a ficar aberta.', '/vaga-gerenciar/' || r.job_id);
    end loop;
    delete from public.applications where worker_id = v_account.worker_id and status in ('enviada', 'em_analise');
    delete from public.worker_posts where worker_id = v_account.worker_id;
    delete from public.notifications where worker_id = v_account.worker_id;
    delete from public.saved_jobs where worker_id = v_account.worker_id;
    update public.workers
       set name = 'Conta excluída', initials = '–', whatsapp = '', specialties = '{}', facts = '{}',
           neighborhood = null, photo_url = null, cover_url = null
     where id = v_account.worker_id;
  else
    perform public.conclude_finished_jobs(null, v_account.company_id);
    if not p_confirm_commitments and exists (
      select 1 from public.applications a join public.jobs j on j.id = a.job_id
       where j.company_id = v_account.company_id and not j.closed and j.deleted_at is null
         and a.status in ('pre_selecionado', 'contratado')) then
      raise exception using errcode = 'BC409', message = 'Confirme o que acontece com os bicos em andamento antes de excluir.';
    end if;
    for r in
      select a.id as app_id, a.worker_id, public.job_title(j) as title
        from public.applications a join public.jobs j on j.id = a.job_id
       where j.company_id = v_account.company_id and not j.closed and j.deleted_at is null
         and a.status in ('pre_selecionado', 'contratado')
    loop
      perform public.application_step(r.app_id, 'cancelar_contratacao', 'construtora', v_reason);
      perform public.notify(r.worker_id, null, 'contratacao_cancelada', 'Contratação cancelada',
        'A construtora de ' || r.title || ' saiu da Bicos e o bico foi cancelado.', '/minhas-candidaturas');
    end loop;
    for v_job in
      select * from public.jobs where company_id = v_account.company_id and not closed and deleted_at is null
    loop
      update public.jobs set closed = true, sem_contratacao = true where id = v_job.id;
      perform public.job_close_applications(v_job);
    end loop;
    delete from public.notifications where company_id = v_account.company_id;
    update public.companies
       set name = 'Construtora (conta excluída)', whatsapp = '', cnpj = null, logo_url = null, cover_url = null
     where id = v_account.company_id;
  end if;

  -- A conta de acesso por último, na mesma transação: se algo acima falhar, nada fica pela metade.
  -- (Apagar o usuário do Auth leva junto a linha em accounts e, no app antigo, o profile.) Marcar o
  -- perfil como completo impede o gatilho de limpeza de cadastro abandonado de apagar o perfil
  -- anonimizado, que o histórico do outro lado ainda usa.
  update public.accounts set profile_completed_at = coalesce(profile_completed_at, now()) where id = v_account.id;
  delete from auth.users where id = v_account.id;
end;
$$;

drop policy if exists "Construtora remove foto da própria vaga" on storage.objects;
create policy "Construtora remove foto da própria vaga"
  on storage.objects for delete to authenticated
  using (bucket_id = 'vagas' and (storage.foldername(name))[1] = (select auth.uid())::text);

revoke all on function
  public.cleanup_unconfirmed_profile_v2(), public.withdraw_application(text),
  public.transition_application(text, uuid, text, text), public.delete_job(text), public.delete_my_account(boolean)
from public, anon, authenticated;

grant execute on function
  public.withdraw_application(text), public.transition_application(text, uuid, text, text),
  public.delete_job(text), public.delete_my_account(boolean)
to authenticated;

commit;
