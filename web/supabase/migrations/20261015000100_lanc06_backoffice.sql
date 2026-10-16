-- L06 (lançamento): back-office mínimo — a equipe modera e verifica pelo app (/admin), sem SQL Editor e sem
-- chave service_role no navegador.
--
-- - staff_members: quem é da equipe (só entra por SQL/service_role: add_staff_member). is_staff() responde
--   pela sessão; toda RPC admin_* começa por staff_guard() e recusa (BC401) quem não é da equipe.
-- - staff_actions: registro de auditoria (quem, o quê, em quem, quando, motivo). Ninguém lê direto; a equipe
--   lê por admin_actions().
-- - Conta suspensa (accounts.suspended_at): não entra (banned_until no Auth e sessões encerradas), não publica
--   vaga e não se candidata (gatilhos — valem mesmo com um token ainda válido).
-- - Vaga oculta pela equipe (jobs.hidden_at): some do mural, da busca e do link público; a dona e quem já se
--   candidatou continuam vendo (como a vaga excluída).
-- - companies.cnpj_check: o que a Receita respondeu na verificação automática (verificar-cnpj), para a fila.
-- - Fotos de identidade: a equipe lê o bucket privado `identidade` (URL assinada de 5 min gerada no app).

-- ---------------------------------------------------------------------------------------------------
-- Equipe e auditoria
-- ---------------------------------------------------------------------------------------------------

create table if not exists public.staff_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'moderador' check (role in ('admin', 'moderador')),
  created_at timestamptz not null default now()
);
alter table public.staff_members enable row level security;
revoke all on public.staff_members from anon, authenticated;

create table if not exists public.staff_actions (
  id bigint generated always as identity primary key,
  staff_id uuid references auth.users (id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text not null,
  reason text,
  created_at timestamptz not null default now()
);
alter table public.staff_actions enable row level security;
revoke all on public.staff_actions from anon, authenticated;
create index if not exists staff_actions_staff_idx on public.staff_actions (staff_id);
create index if not exists staff_actions_target_idx on public.staff_actions (target_type, target_id);
create index if not exists staff_actions_created_idx on public.staff_actions (created_at desc);

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff_members where user_id = (select auth.uid()))
$$;

-- A primeira linha de toda RPC da equipe: a conta da sessão, ou BC401.
create or replace function public.staff_guard()
returns uuid language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.is_staff() then
    raise exception using errcode = 'BC401', message = 'Área só da equipe da Bicos.';
  end if;
  return auth.uid();
end;
$$;

create or replace function public.staff_log(p_action text, p_target_type text, p_target_id text, p_reason text)
returns void language sql security definer set search_path = public as $$
  insert into public.staff_actions (staff_id, action, target_type, target_id, reason)
  values (auth.uid(), p_action, p_target_type, p_target_id, nullif(btrim(coalesce(p_reason, '')), ''))
$$;

-- Só pelo SQL Editor (service_role): põe alguém na equipe pelo e-mail da conta.
create or replace function public.add_staff_member(p_email text, p_role text default 'moderador')
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  select id into v_id from public.accounts where email = lower(btrim(p_email));
  if v_id is null then
    raise exception using errcode = 'BC404', message = 'Nenhuma conta com esse e-mail.';
  end if;
  insert into public.staff_members (user_id, role) values (v_id, p_role)
  on conflict (user_id) do update set role = excluded.role;
  return v_id;
end;
$$;

create or replace function public.remove_staff_member(p_email text)
returns void language sql security definer set search_path = public as $$
  delete from public.staff_members where user_id = (select id from public.accounts where email = lower(btrim(p_email)))
$$;

-- ---------------------------------------------------------------------------------------------------
-- Conta suspensa e vaga oculta
-- ---------------------------------------------------------------------------------------------------

alter table public.accounts
  add column if not exists suspended_at timestamptz,
  add column if not exists suspended_reason text;
-- A própria conta sabe que está suspensa (o app mostra o aviso e sai); o motivo fica só com a equipe.
grant select (suspended_at) on public.accounts to authenticated;

alter table public.jobs
  add column if not exists hidden_at timestamptz,
  add column if not exists hidden_reason text;

alter table public.companies add column if not exists cnpj_check jsonb;

-- Vaga oculta não está aberta: sai do mural (feed_jobs), das candidaturas novas e do link público.
create or replace function public.job_is_open(p_job public.jobs)
returns boolean language sql stable set search_path = public as $$
  select not p_job.closed and p_job.deleted_at is null and p_job.hidden_at is null
     and public.job_last_day(p_job) >= public.bicos_today()
$$;

do $$
declare
  p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'jobs' and policyname like 'Vagas visíveis%'
  loop
    execute format('drop policy %I on public.jobs', p.policyname);
  end loop;
end $$;
create policy "Vagas visíveis (excluídas e ocultas só para a dona e candidatos)" on public.jobs
  for select to authenticated
  using (
    (deleted_at is null and hidden_at is null)
    or company_id = (select public.my_company_id())
    or exists (
      select 1 from public.applications a
       where a.job_id = jobs.id and a.worker_id = (select public.my_worker_id())
    )
  );

create or replace function public.public_job_card(p_job_id text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', j.id, 'oficio_id', j.oficio_id, 'title', j.title, 'pay', j.pay,
    'neighborhood', j.neighborhood, 'city', j.city, 'uf', j.uf,
    'date_to_arrange', j.date_to_arrange, 'start_date', j.start_date, 'end_date', j.end_date,
    'start_time', j.start_time, 'end_time', j.end_time, 'diarias', j.diarias, 'dias', j.dias,
    'slots', j.slots, 'urgent', j.urgent, 'photos', j.photos, 'description', j.description,
    'requirements', j.requirements, 'payment_method', j.payment_method, 'payment_note', j.payment_note,
    'created_at', j.created_at,
    'aberta', public.job_is_open(j) and public.job_holding(j.id) < j.slots,
    'company', jsonb_build_object('name', c.name, 'logo_url', c.logo_url, 'rating', c.rating,
                                  'review_count', c.review_count, 'verified', c.verified)
  )
  from public.jobs j join public.companies c on c.id = j.company_id
  where j.id = p_job_id and j.deleted_at is null and j.hidden_at is null
$$;

-- Conta suspensa não publica nem se candidata — mesmo com um token emitido antes da suspensão.
create or replace function public.refuse_suspended_job()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.accounts where company_id = new.company_id and suspended_at is not null) then
    raise exception using errcode = 'BC401', message = 'Sua conta está suspensa. Fale com o suporte pela Ajuda.';
  end if;
  return new;
end;
$$;
drop trigger if exists jobs_refuse_suspended on public.jobs;
create trigger jobs_refuse_suspended before insert on public.jobs
  for each row execute function public.refuse_suspended_job();

create or replace function public.refuse_suspended_application()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.accounts where worker_id = new.worker_id and suspended_at is not null) then
    raise exception using errcode = 'BC401', message = 'Sua conta está suspensa. Fale com o suporte pela Ajuda.';
  end if;
  return new;
end;
$$;
drop trigger if exists applications_refuse_suspended on public.applications;
create trigger applications_refuse_suspended before insert on public.applications
  for each row execute function public.refuse_suspended_application();

-- ---------------------------------------------------------------------------------------------------
-- Denúncias: resolução
-- ---------------------------------------------------------------------------------------------------

alter table public.reports
  add column if not exists resolution text check (resolution is null or resolution in ('arquivar', 'ocultar_vaga', 'suspender_conta')),
  add column if not exists resolved_by uuid references auth.users (id) on delete set null,
  add column if not exists resolved_at timestamptz;
create index if not exists reports_resolved_by_idx on public.reports (resolved_by);
create index if not exists reports_open_idx on public.reports (created_at) where status = 'aberta';
create index if not exists reports_target_idx on public.reports (target_type, target_id);

-- O que foi denunciado, para a fila: título/texto, a conta responsável e se já está oculto/suspenso.
create or replace function public.report_target_info(p_type public.report_target, p_id text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v jsonb;
begin
  if p_type = 'vaga' then
    select jsonb_build_object(
      'title', coalesce(j.title, o.nome), 'text', left(j.description, 600), 'job_id', j.id,
      'hidden', j.hidden_at is not null, 'deleted', j.deleted_at is not null,
      'account_id', a.id, 'account_name', c.name)
      into v
      from public.jobs j join public.companies c on c.id = j.company_id
      join public.oficios o on o.id = j.oficio_id
      left join public.accounts a on a.company_id = j.company_id
     where j.id = p_id;
  elsif p_type = 'perfil' then
    select jsonb_build_object(
      'title', coalesce(w.name, c.name), 'text', null, 'account_id', a.id,
      'account_name', coalesce(w.name, c.name))
      into v
      from public.accounts a
      left join public.workers w on w.id = a.worker_id
      left join public.companies c on c.id = a.company_id
     where a.id::text = p_id;
  elsif p_type = 'avaliacao' then
    select jsonb_build_object(
      'title', 'Avaliação ' || r.value || '★', 'text', r.comment,
      'account_id', a.id, 'account_name', coalesce(w.name, c.name))
      into v
      from public.reviews r
      left join public.applications ap on ap.id = r.application_id
      left join public.jobs j on j.id = ap.job_id
      left join public.accounts a on a.id = (
        case when r.direction = 'para_construtora'
             then (select x.id from public.accounts x where x.worker_id = ap.worker_id)
             else (select x.id from public.accounts x where x.company_id = j.company_id) end)
      left join public.workers w on w.id = a.worker_id
      left join public.companies c on c.id = a.company_id
     where r.id::text = p_id;
  elsif p_type = 'post' then
    select jsonb_build_object(
      'title', 'Publicação no portfólio', 'text', p.caption, 'media_url', p.media_url,
      'account_id', a.id, 'account_name', w.name)
      into v
      from public.worker_posts p join public.workers w on w.id = p.worker_id
      left join public.accounts a on a.worker_id = p.worker_id
     where p.id::text = p_id;
  end if;
  return coalesce(v, jsonb_build_object('title', 'Conteúdo que não existe mais', 'text', null, 'account_id', null));
end;
$$;

-- O histórico da conta denunciada, para decidir: idade da conta, lado, denúncias, vagas, candidaturas.
create or replace function public.account_history(p_account uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'account_id', a.id, 'role', a.role, 'name', coalesce(w.name, c.name), 'created_at', a.created_at,
    'suspended_at', a.suspended_at, 'suspended_reason', a.suspended_reason,
    'rating', coalesce(w.rating, c.rating), 'review_count', coalesce(w.review_count, c.review_count),
    'verified', coalesce(w.verified, c.verified),
    'reports_against', (
      select count(*) from public.reports r
       where (r.target_type = 'perfil' and r.target_id = a.id::text)
          or (r.target_type = 'vaga' and r.target_id in (select id from public.jobs where company_id = a.company_id))
          or (r.target_type = 'post' and r.target_id in (select id::text from public.worker_posts where worker_id = a.worker_id))),
    'jobs', (select count(*) from public.jobs where company_id = a.company_id),
    'applications', (select count(*) from public.applications where worker_id = a.worker_id),
    'staff_actions', (select count(*) from public.staff_actions where target_type = 'conta' and target_id = a.id::text)
  )
  from public.accounts a
  left join public.workers w on w.id = a.worker_id
  left join public.companies c on c.id = a.company_id
  where a.id = p_account
$$;

-- ---------------------------------------------------------------------------------------------------
-- RPCs da equipe (todas começam por staff_guard)
-- ---------------------------------------------------------------------------------------------------

-- Fila de identidades: trabalhadores "em análise", o envio mais antigo primeiro.
create or replace function public.admin_identity_queue()
returns table (
  worker_id uuid, name text, oficio text, city text, photo_url text, document text, created_at timestamptz,
  submitted_at timestamptz, selfie_path text, document_path text, submissions bigint
) language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  perform public.staff_guard();
  return query
    select w.id, w.name, o.nome, w.city, w.photo_url, a.document, a.created_at, w.identity_submitted_at,
           s.selfie_path, s.document_path,
           (select count(*) from public.identity_submissions x where x.worker_id = w.id)
      from public.workers w
      join public.accounts a on a.worker_id = w.id
      left join public.oficios o on o.id = w.oficio_id
      left join lateral (
        select selfie_path, document_path from public.identity_submissions
         where identity_submissions.worker_id = w.id order by identity_submissions.created_at desc limit 1
      ) s on true
     where w.identity_status = 'em_analise'
     order by w.identity_submitted_at nulls last
     limit 200;
end;
$$;

create or replace function public.admin_decide_identity(p_worker uuid, p_status text, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.staff_guard();
  if not exists (select 1 from public.workers where id = p_worker and identity_status = 'em_analise') then
    raise exception using errcode = 'BC409', message = 'Essa identidade já foi decidida.';
  end if;
  perform public.set_identity_status(p_worker, p_status, p_reason);
  perform public.staff_log(case when p_status = 'verificado' then 'aprovar_identidade' else 'recusar_identidade' end,
                           'trabalhador', p_worker::text, p_reason);
end;
$$;

-- Fila de construtoras: "pendente" com o perfil completo. CNPJ inteiro para a equipe conferir; CPF mascarado.
create or replace function public.admin_company_queue()
returns table (
  company_id uuid, name text, location text, tipo_obra text, email text, document text, document_kind text,
  created_at timestamptz, cnpj_check jsonb
) language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  perform public.staff_guard();
  return query
    select c.id, c.name, c.location, c.tipo_obra, a.email,
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

create or replace function public.admin_decide_company(p_company uuid, p_status public.company_verification, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.staff_guard();
  if p_status not in ('verificada', 'reprovada') then
    raise exception using errcode = 'BC422', message = 'Escolha aprovar ou recusar.';
  end if;
  if p_status = 'reprovada' and nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception using errcode = 'BC422', message = 'Diga o motivo da recusa.';
  end if;
  perform public.set_company_verification(p_company, p_status);
  perform public.staff_log(case when p_status = 'verificada' then 'aprovar_construtora' else 'recusar_construtora' end,
                           'construtora', p_company::text, p_reason);
end;
$$;

-- Fila de denúncias ('aberta' por padrão; 'analisada' para o histórico).
create or replace function public.admin_report_queue(p_status text default 'aberta')
returns table (
  id uuid, target_type public.report_target, target_id text, reason text, details text, status text,
  resolution text, created_at timestamptz, resolved_at timestamptz, reports_on_target bigint, target jsonb,
  account jsonb
) language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  perform public.staff_guard();
  return query
    select r.id, r.target_type, r.target_id, r.reason, r.details, r.status, r.resolution, r.created_at,
           r.resolved_at,
           (select count(*) from public.reports x where x.target_type = r.target_type and x.target_id = r.target_id),
           t.info,
           case when t.info ->> 'account_id' is not null
                then public.account_history((t.info ->> 'account_id')::uuid) end
      from public.reports r
      cross join lateral (select public.report_target_info(r.target_type, r.target_id) as info) t
     where r.status = coalesce(p_status, 'aberta')
     order by case when r.status = 'aberta' then r.created_at end asc, r.resolved_at desc nulls last
     limit 200;
end;
$$;

create or replace function public.admin_hide_job(p_job text, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_company uuid;
begin
  perform public.staff_guard();
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception using errcode = 'BC422', message = 'Diga o motivo.';
  end if;
  update public.jobs set hidden_at = now(), hidden_reason = btrim(p_reason)
   where id = p_job and hidden_at is null returning company_id into v_company;
  if v_company is null then
    if not exists (select 1 from public.jobs where id = p_job) then
      raise exception using errcode = 'BC404', message = 'Vaga não encontrada.';
    end if;
    return; -- já estava oculta
  end if;
  perform public.notify(null, v_company, 'verificacao', 'Vaga retirada do mural',
    'A vaga ' || p_job || ' foi retirada do mural pela equipe da Bicos. Motivo: ' || btrim(p_reason)
    || '. Fale com a gente pela Ajuda se achar que foi engano.', '/minhas-vagas');
  perform public.staff_log('ocultar_vaga', 'vaga', p_job, p_reason);
end;
$$;

create or replace function public.admin_unhide_job(p_job text, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.staff_guard();
  update public.jobs set hidden_at = null, hidden_reason = null where id = p_job and hidden_at is not null;
  if not found then
    raise exception using errcode = 'BC404', message = 'Essa vaga não está oculta.';
  end if;
  perform public.staff_log('mostrar_vaga', 'vaga', p_job, p_reason);
end;
$$;

create or replace function public.admin_suspend_account(p_account uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_staff uuid := public.staff_guard();
  v_account public.accounts;
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
  perform public.staff_log('suspender_conta', 'conta', p_account::text, p_reason);
end;
$$;

create or replace function public.admin_unsuspend_account(p_account uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_company uuid;
begin
  perform public.staff_guard();
  update public.accounts set suspended_at = null, suspended_reason = null
   where id = p_account and suspended_at is not null returning company_id into v_company;
  if not found then
    raise exception using errcode = 'BC404', message = 'Essa conta não está suspensa.';
  end if;
  update auth.users set banned_until = null where id = p_account;
  update public.jobs set hidden_at = null, hidden_reason = null
   where company_id = v_company and hidden_reason = 'conta suspensa';
  perform public.staff_log('reativar_conta', 'conta', p_account::text, p_reason);
end;
$$;

-- Resolve uma denúncia (e as outras abertas sobre o mesmo conteúdo): arquivar, ocultar a vaga ou suspender
-- a conta responsável.
create or replace function public.admin_resolve_report(p_report uuid, p_action text, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_staff uuid := public.staff_guard();
  r public.reports;
  v_info jsonb;
begin
  select * into r from public.reports where id = p_report;
  if r.id is null then
    raise exception using errcode = 'BC404', message = 'Denúncia não encontrada.';
  end if;
  if r.status <> 'aberta' then
    raise exception using errcode = 'BC409', message = 'Essa denúncia já foi resolvida.';
  end if;
  v_info := public.report_target_info(r.target_type, r.target_id);
  if p_action = 'arquivar' then
    perform public.staff_log('arquivar_denuncia', 'denuncia', r.id::text, p_reason);
  elsif p_action = 'ocultar_vaga' then
    if r.target_type <> 'vaga' then
      raise exception using errcode = 'BC422', message = 'Só dá para ocultar quando a denúncia é de uma vaga.';
    end if;
    perform public.admin_hide_job(r.target_id, coalesce(nullif(btrim(coalesce(p_reason, '')), ''), 'denúncia de ' || r.reason));
  elsif p_action = 'suspender_conta' then
    if v_info ->> 'account_id' is null then
      raise exception using errcode = 'BC404', message = 'A conta responsável não existe mais.';
    end if;
    perform public.admin_suspend_account((v_info ->> 'account_id')::uuid,
      coalesce(nullif(btrim(coalesce(p_reason, '')), ''), 'denúncia de ' || r.reason));
  else
    raise exception using errcode = 'BC422', message = 'Ação inválida.';
  end if;
  update public.reports set status = 'analisada', resolution = p_action, resolved_by = v_staff, resolved_at = now()
   where status = 'aberta' and target_type = r.target_type and target_id = r.target_id;
end;
$$;

-- O registro de auditoria, mais recente primeiro.
create or replace function public.admin_actions(p_limit integer default 100)
returns table (id bigint, staff_email text, action text, target_type text, target_id text, reason text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  perform public.staff_guard();
  return query
    select s.id, a.email, s.action, s.target_type, s.target_id, s.reason, s.created_at
      from public.staff_actions s left join public.accounts a on a.id = s.staff_id
     order by s.created_at desc, s.id desc
     limit least(greatest(coalesce(p_limit, 100), 1), 500);
end;
$$;

-- ---------------------------------------------------------------------------------------------------
-- Fotos de identidade: a equipe lê (para gerar a URL assinada); ninguém mais.
-- ---------------------------------------------------------------------------------------------------

drop policy if exists "Equipe lê as fotos de identidade" on storage.objects;
create policy "Equipe lê as fotos de identidade" on storage.objects for select to authenticated
  using (bucket_id = 'identidade' and (select public.is_staff()));

-- ---------------------------------------------------------------------------------------------------
-- Permissões
-- ---------------------------------------------------------------------------------------------------

revoke all on function public.is_staff(), public.staff_guard(), public.staff_log(text, text, text, text),
  public.add_staff_member(text, text), public.remove_staff_member(text), public.refuse_suspended_job(),
  public.refuse_suspended_application(), public.report_target_info(public.report_target, text),
  public.account_history(uuid), public.admin_identity_queue(), public.admin_decide_identity(uuid, text, text),
  public.admin_company_queue(), public.admin_decide_company(uuid, public.company_verification, text),
  public.admin_report_queue(text), public.admin_hide_job(text, text), public.admin_unhide_job(text, text),
  public.admin_suspend_account(uuid, text), public.admin_unsuspend_account(uuid, text),
  public.admin_resolve_report(uuid, text, text), public.admin_actions(integer)
  from public, anon, authenticated;
grant execute on function public.is_staff(), public.admin_identity_queue(), public.admin_decide_identity(uuid, text, text),
  public.admin_company_queue(), public.admin_decide_company(uuid, public.company_verification, text),
  public.admin_report_queue(text), public.admin_hide_job(text, text), public.admin_unhide_job(text, text),
  public.admin_suspend_account(uuid, text), public.admin_unsuspend_account(uuid, text),
  public.admin_resolve_report(uuid, text, text), public.admin_actions(integer)
  to authenticated;
grant execute on function public.add_staff_member(text, text), public.remove_staff_member(text) to service_role;
