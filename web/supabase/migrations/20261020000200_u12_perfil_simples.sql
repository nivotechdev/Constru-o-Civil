-- U12 (20/10): completar o perfil numa tela só — capa, foto e a localização atual. Saem do app e do banco, a
-- pedido do responsável, o ofício principal e as especialidades do trabalhador e o tipo de obra da construtora.
--   * finish_sign_up(p): só a localização — cidade (rótulo "Cidade, UF") e o ponto, arredondado a 2 casas (~1 km,
--     para não guardar onde a pessoa mora); a construtora guarda a cidade em companies.location;
--   * admin_identity_queue / admin_company_queue sem esses campos (drop + create: o retorno muda);
--   * anonymize_account sem specialties; submit_review assina a avaliação só com o nome ("Jorge M."), sem o ofício;
--   * colunas workers.oficio_id e workers.specialties (com o índice e a regra de tamanho) e companies.tipo_obra.
-- O ofício das VAGAS (jobs.oficio_id, das vagas antigas) e do alerta (job_alerts.oficio_id) não mudam.
-- Idempotente.

create or replace function public.finish_sign_up(p jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_account public.accounts;
  v_city text := btrim(coalesce(p->>'city', ''));
  v_lat double precision;
  v_lon double precision;
begin
  select * into v_account from public.accounts where id = auth.uid();
  if not found then
    raise exception using errcode = 'BC401', message = 'Entre na sua conta de novo para continuar.';
  end if;
  begin
    v_lat := round((p->>'lat')::numeric, 2);
    v_lon := round((p->>'lon')::numeric, 2);
  exception when others then
    v_lat := null;
  end;
  if v_city = '' or char_length(v_city) > 80 or v_lat is null or v_lon is null
     or v_lat not between -34 and 6 or v_lon not between -74 and -34 then
    raise exception using errcode = 'BC422', message = 'Toque em "Usar minha localização atual" para continuar.';
  end if;
  if v_account.role = 'trabalhador' then
    update public.workers set city = v_city, neighborhood = null, lat = v_lat, lon = v_lon
     where id = v_account.worker_id;
  else
    update public.companies set location = v_city where id = v_account.company_id;
  end if;
  update public.accounts set profile_completed_at = coalesce(profile_completed_at, now()) where id = v_account.id;
end;
$$;

drop function if exists public.admin_identity_queue();
create or replace function public.admin_identity_queue()
returns table (
  worker_id uuid, name text, city text, photo_url text, document text, created_at timestamptz,
  submitted_at timestamptz, selfie_path text, document_path text, submissions bigint
) language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  perform public.staff_guard();
  return query
    select w.id, w.name, w.city, w.photo_url, a.document, a.created_at, w.identity_submitted_at,
           s.selfie_path, s.document_path,
           (select count(*) from public.identity_submissions x where x.worker_id = w.id)
      from public.workers w
      join public.accounts a on a.worker_id = w.id
      left join lateral (
        select selfie_path, document_path from public.identity_submissions
         where identity_submissions.worker_id = w.id order by identity_submissions.created_at desc limit 1
      ) s on true
     where w.identity_status = 'em_analise'
     order by w.identity_submitted_at nulls last
     limit 200;
end;
$$;

drop function if exists public.admin_company_queue();
create or replace function public.admin_company_queue()
returns table (
  company_id uuid, name text, location text, email text, document text, document_kind text,
  created_at timestamptz, cnpj_check jsonb
) language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  perform public.staff_guard();
  return query
    select c.id, c.name, c.location, a.email,
           coalesce(public.company_cnpj_for_check(c.id), a.document),
           case when public.company_cnpj_for_check(c.id) is not null then 'cnpj' else 'cpf' end,
           a.created_at, c.cnpj_check
      from public.companies c
      join public.accounts a on a.company_id = c.id
     where c.verification_status = 'pendente' and a.profile_completed_at is not null and a.suspended_at is null
     order by a.created_at
     limit 200;
end;
$$;

revoke all on function public.admin_identity_queue(), public.admin_company_queue() from public, anon;
grant execute on function public.admin_identity_queue(), public.admin_company_queue() to authenticated;

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
       set name = 'Conta excluída', initials = '–', whatsapp = '', facts = '{}',
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


create or replace function public.submit_review(
  p_application_id uuid, p_direction public.review_direction, p_value integer, p_tags text[], p_comment text
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_app public.applications;
  v_job public.jobs;
  v_side text := case p_direction when 'para_construtora' then 'trabalhador' else 'construtora' end;
  v_comment text := btrim(coalesce(p_comment, ''));
  v_allowed text[] := case p_direction
    when 'para_construtora' then array['Pagou no dia', 'EPI no local', 'Horário combinado', 'Equipe respeitosa']
    else array['Chegou no horário', 'Trabalho caprichado', 'Usou EPI', 'Respeitou a equipe', 'Deixou o local limpo']
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


drop index if exists public.workers_oficio_idx;
alter table public.workers drop constraint if exists workers_specialties_limit;
alter table public.workers drop column if exists oficio_id;
alter table public.workers drop column if exists specialties;
alter table public.companies drop column if exists tipo_obra;
