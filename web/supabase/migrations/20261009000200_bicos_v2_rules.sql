-- Bicos v2 — regras: políticas RLS, conta criada no cadastro, máquina de status da candidatura e as
-- RPCs que o front chama (services/*.ts). Cada RPC faz numa transação só o que o serviço do modo de
-- demonstração faz no store em memória, com as mesmas mensagens.
--
-- Erros: as RPCs levantam SQLSTATE próprios, traduzidos pelo front (services/remote/client.ts):
--   BC401 nao_autorizado · BC404 nao_encontrado · BC409 conflito · BC422 validacao
-- A mensagem (`message`) já é o texto em português mostrado na tela.

-- ---------------------------------------------------------------------------------------------------
-- Quem é a sessão
-- ---------------------------------------------------------------------------------------------------

create or replace function public.my_worker_id()
returns uuid language sql stable security definer set search_path = public as $$
  select worker_id from public.accounts where id = auth.uid()
$$;

create or replace function public.my_company_id()
returns uuid language sql stable security definer set search_path = public as $$
  select company_id from public.accounts where id = auth.uid()
$$;

create or replace function public.is_my_job(p_job_id text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.jobs j
     where j.id = p_job_id and j.company_id = (select company_id from public.accounts where id = auth.uid())
  )
$$;

-- ---------------------------------------------------------------------------------------------------
-- Políticas
-- ---------------------------------------------------------------------------------------------------

create policy "Catálogo de ofícios é público" on public.oficios for select using (true);

create policy "Perfis de trabalhador visíveis para quem está logado" on public.workers
  for select to authenticated using (true);
create policy "Trabalhador edita o próprio perfil" on public.workers
  for update to authenticated
  using (id = (select public.my_worker_id())) with check (id = (select public.my_worker_id()));

create policy "Perfis de construtora visíveis para quem está logado" on public.companies
  for select to authenticated using (true);
create policy "Construtora edita o próprio perfil" on public.companies
  for update to authenticated
  using (id = (select public.my_company_id())) with check (id = (select public.my_company_id()));

create policy "Cada um vê a própria conta" on public.accounts
  for select to authenticated using (id = (select auth.uid()));

create policy "Vagas visíveis (as excluídas só para a dona e para quem se candidatou)" on public.jobs
  for select to authenticated
  using (
    deleted_at is null
    or company_id = (select public.my_company_id())
    or exists (
      select 1 from public.applications a
       where a.job_id = jobs.id and a.worker_id = (select public.my_worker_id())
    )
  );

create policy "Candidatura visível para o trabalhador e para a construtora da vaga" on public.applications
  for select to authenticated
  using (worker_id = (select public.my_worker_id()) or public.is_my_job(job_id));

create policy "Histórico segue a candidatura" on public.application_events
  for select to authenticated
  using (exists (select 1 from public.applications a where a.id = application_events.application_id));

create policy "Trabalhador vê as próprias vagas salvas" on public.saved_jobs
  for select to authenticated using (worker_id = (select public.my_worker_id()));
create policy "Trabalhador salva vaga" on public.saved_jobs
  for insert to authenticated with check (worker_id = (select public.my_worker_id()));
create policy "Trabalhador tira vaga das salvas" on public.saved_jobs
  for delete to authenticated using (worker_id = (select public.my_worker_id()));

create policy "Avaliações são públicas para quem está logado" on public.reviews
  for select to authenticated using (true);

create policy "Portfólio visível para quem está logado" on public.worker_posts
  for select to authenticated using (true);
create policy "Trabalhador publica no próprio portfólio" on public.worker_posts
  for insert to authenticated with check (worker_id = (select public.my_worker_id()));
create policy "Trabalhador apaga o próprio post" on public.worker_posts
  for delete to authenticated using (worker_id = (select public.my_worker_id()));

create policy "Cada um vê as próprias notificações" on public.notifications
  for select to authenticated
  using (worker_id = (select public.my_worker_id()) or company_id = (select public.my_company_id()));
create policy "Cada um marca as próprias notificações como lidas" on public.notifications
  for update to authenticated
  using (worker_id = (select public.my_worker_id()) or company_id = (select public.my_company_id()))
  with check (worker_id = (select public.my_worker_id()) or company_id = (select public.my_company_id()));

create policy "Construtora vê os próprios pagamentos" on public.boost_payments
  for select to authenticated using (company_id = (select public.my_company_id()));

-- ---------------------------------------------------------------------------------------------------
-- Utilidades internas (não expostas)
-- ---------------------------------------------------------------------------------------------------

create or replace function public.bicos_today()
returns date language sql stable set search_path = public as $$
  select (now() at time zone 'America/Sao_Paulo')::date
$$;

create or replace function public.initials_of(p_name text)
returns text language sql immutable set search_path = public as $$
  with parts as (
    select array_remove(regexp_split_to_array(btrim(coalesce(p_name, '')), '\s+'), '') as p
  )
  select coalesce(nullif(upper(
    coalesce(left(p[1], 1), '') ||
    case when cardinality(p) > 1 then left(p[cardinality(p)], 1) else '' end
  ), ''), '?') from parts
$$;

create or replace function public.first_name(p_name text)
returns text language sql immutable set search_path = public as $$
  select split_part(btrim(coalesce(p_name, '')), ' ', 1)
$$;

-- Como a vaga é chamada em todo lugar: o título dela, ou o nome do ofício (services/catalog.ts › jobTitle).
create or replace function public.job_title(p_job public.jobs)
returns text language sql stable set search_path = public as $$
  select coalesce(nullif(btrim(p_job.title), ''), (select o.nome from public.oficios o where o.id = p_job.oficio_id), 'Bico')
$$;

create or replace function public.mask_document(p_digits text)
returns text language sql immutable set search_path = public as $$
  select case
    when length(p_digits) = 11 then '***.' || substr(p_digits, 4, 3) || '.' || substr(p_digits, 7, 3) || '-**'
    when length(p_digits) = 14 then substr(p_digits, 1, 2) || '.' || substr(p_digits, 3, 3) || '.' ||
                                    substr(p_digits, 6, 3) || '/****-**'
    else ''
  end
$$;

create or replace function public.document_hash(p_document text)
returns text language sql immutable set search_path = public, extensions as $$
  select encode(extensions.digest(regexp_replace(coalesce(p_document, ''), '[^0-9]', '', 'g'), 'sha256'), 'hex')
$$;

-- "9 de out., 14:30" — como o front mostra (toLocaleString pt-BR), no fuso de São Paulo.
create or replace function public.short_datetime_br(p_at timestamptz)
returns text language sql stable set search_path = public as $$
  select extract(day from l)::int || ' de ' ||
         (array['jan.','fev.','mar.','abr.','mai.','jun.','jul.','ago.','set.','out.','nov.','dez.'])[extract(month from l)::int]
         || ', ' || to_char(l, 'HH24:MI')
    from (select p_at at time zone 'America/Sao_Paulo' as l) t
$$;

create or replace function public.notify(
  p_worker uuid, p_company uuid, p_kind public.notification_kind, p_title text, p_body text, p_target text
) returns void language sql security definer set search_path = public as $$
  insert into public.notifications (worker_id, company_id, kind, title, body, target)
  values (p_worker, p_company, p_kind, p_title, p_body, p_target)
$$;

-- ---------------------------------------------------------------------------------------------------
-- Conta criada no cadastro (Auth → accounts + workers/companies), numa transação com o próprio
-- cadastro. Serve aos dois apps: o front novo manda `role`; o antigo manda `tipo` (pedreiro/construtora).
-- ---------------------------------------------------------------------------------------------------

create or replace function public.create_account_for(
  p_user_id uuid, p_email text, p_role public.app_role, p_name text, p_document text, p_whatsapp text,
  p_terms_version text, p_email_confirmed_at timestamptz
) returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  v_digits text := regexp_replace(coalesce(p_document, ''), '[^0-9]', '', 'g');
  v_phone text := regexp_replace(coalesce(p_whatsapp, ''), '[^0-9]', '', 'g');
  v_key text;
  v_name text := coalesce(nullif(btrim(p_name), ''), split_part(p_email, '@', 1));
begin
  if exists (select 1 from public.accounts where id = p_user_id) then return; end if;

  if p_role = 'trabalhador' then
    insert into public.workers (id, name, initials, whatsapp, city, lat, lon)
    values (p_user_id, v_name, public.initials_of(v_name), v_phone, 'São Paulo, SP', -23.5505, -46.6333)
    on conflict (id) do nothing;
  else
    insert into public.companies (id, name, cnpj, whatsapp, location)
    values (p_user_id, v_name, nullif(public.mask_document(v_digits), ''), v_phone, 'São Paulo, SP')
    on conflict (id) do nothing;
  end if;

  if length(v_digits) > 0 then
    select decrypted_secret into v_key from vault.decrypted_secrets where name = 'nivotech_documento_key';
  end if;

  insert into public.accounts (
    id, email, role, document, document_hash, document_cipher, whatsapp, email_confirmed_at,
    terms_version, worker_id, company_id
  ) values (
    p_user_id, p_email, p_role, public.mask_document(v_digits),
    case when length(v_digits) > 0 then public.document_hash(v_digits) end,
    case when length(v_digits) > 0 and v_key is not null then extensions.pgp_sym_encrypt(v_digits, v_key) end,
    v_phone, p_email_confirmed_at, coalesce(p_terms_version, ''),
    case when p_role = 'trabalhador' then p_user_id end,
    case when p_role = 'recrutador' then p_user_id end
  );

  -- Prova do aceite (LGPD) na mesma tabela de consentimentos do app antigo, com a versão aceita. Só
  -- quando o cadastro informou a versão (o front novo informa; o antigo grava o próprio aceite). Sem
  -- versão, a conta fica com terms_version vazio: nada é registrado em nome de quem não viu os termos.
  if nullif(p_terms_version, '') is not null and exists (select 1 from public.profiles where id = p_user_id) then
    insert into public.consentimentos (usuario_id, documento, versao)
    select p_user_id, d, p_terms_version
      from unnest(array['termos_de_uso', 'politica_privacidade']) d
     where not exists (
       select 1 from public.consentimentos c
        where c.usuario_id = p_user_id and c.documento = d and c.versao = p_terms_version
     );
  end if;
end;
$$;

create or replace function public.handle_new_user_v2()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_role public.app_role := case
    when m->>'role' in ('trabalhador', 'recrutador') then (m->>'role')::public.app_role
    when m->>'tipo' = 'pedreiro' then 'trabalhador'
    when m->>'tipo' = 'construtora' then 'recrutador'
  end;
begin
  -- Sem lado definido (ex.: login com Google no app antigo): a conta nasce depois, em ensure_my_account.
  if v_role is null then return new; end if;
  perform public.create_account_for(
    new.id, new.email, v_role, m->>'nome', m->>'documento', m->>'whatsapp', m->>'terms_version',
    new.email_confirmed_at
  );
  return new;
end;
$$;

-- Dispara depois do gatilho do app antigo (ordem alfabética): o profile já existe para o consentimento.
create trigger on_auth_user_created_v2
  after insert on auth.users
  for each row execute function public.handle_new_user_v2();

create or replace function public.sync_account_auth_v2()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.accounts
     set email_confirmed_at = new.email_confirmed_at, email = new.email
   where id = new.id
     and (email_confirmed_at is distinct from new.email_confirmed_at or email is distinct from new.email);
  return new;
end;
$$;

create trigger on_auth_user_updated_v2
  after update of email_confirmed_at, email on auth.users
  for each row execute function public.sync_account_auth_v2();

-- Cadastro nunca confirmado apagado do Auth (limpeza do app antigo): leva junto o perfil vazio.
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

create trigger on_account_deleted_v2
  after delete on public.accounts
  for each row execute function public.cleanup_unconfirmed_profile_v2();

-- Iniciais acompanham o nome; o WhatsApp da construtora acompanha a conta.
create or replace function public.worker_initials_v2()
returns trigger language plpgsql set search_path = public as $$
begin
  new.initials := public.initials_of(new.name);
  return new;
end;
$$;
create trigger worker_initials_v2 before update of name on public.workers
  for each row execute function public.worker_initials_v2();

create or replace function public.company_whatsapp_v2()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.whatsapp := regexp_replace(coalesce(new.whatsapp, ''), '[^0-9]', '', 'g');
  update public.accounts set whatsapp = new.whatsapp where company_id = new.id;
  return new;
end;
$$;
create trigger company_whatsapp_v2 before update of whatsapp on public.companies
  for each row execute function public.company_whatsapp_v2();

create or replace function public.touch_job_v2()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger touch_job_v2 before update on public.jobs
  for each row execute function public.touch_job_v2();

-- ---------------------------------------------------------------------------------------------------
-- Conta: garantir que exista (contas do app antigo), terminar o cadastro, documento livre
-- ---------------------------------------------------------------------------------------------------

-- Conta do app antigo sem linha em accounts (ex.: criada antes desta migration): cria a partir do profile.
create or replace function public.account_from_old_profile(p_user_id uuid)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  v_profile public.profiles;
  v_user auth.users;
  v_key text;
begin
  if exists (select 1 from public.accounts where id = p_user_id) then return; end if;
  select * into v_profile from public.profiles where id = p_user_id;
  select * into v_user from auth.users where id = p_user_id;
  if v_profile.tipo is null or v_user.id is null then return; end if;
  perform public.create_account_for(
    p_user_id, v_user.email,
    case v_profile.tipo when 'pedreiro' then 'trabalhador'::public.app_role else 'recrutador'::public.app_role end,
    v_profile.nome, null, v_profile.whatsapp,
    (select c.versao from public.consentimentos c where c.usuario_id = p_user_id order by c.aceito_em desc limit 1),
    v_user.email_confirmed_at
  );
  -- O documento do app antigo já está cifrado com a mesma chave: copia o hash e a cifra.
  if v_profile.documento_hash is not null
     and not exists (select 1 from public.accounts x where x.document_hash = v_profile.documento_hash) then
    select decrypted_secret into v_key from vault.decrypted_secrets where name = 'nivotech_documento_key';
    update public.accounts
       set document_hash = v_profile.documento_hash,
           document_cipher = v_profile.documento_cifrado,
           document = case when v_key is not null and v_profile.documento_cifrado is not null
                           then public.mask_document(extensions.pgp_sym_decrypt(v_profile.documento_cifrado, v_key))
                           else document end
     where id = p_user_id;
  end if;
end;
$$;

create or replace function public.ensure_my_account()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception using errcode = 'BC401', message = 'Entre na sua conta de novo para continuar.';
  end if;
  perform public.account_from_old_profile(auth.uid());
  if not exists (select 1 from public.accounts where id = auth.uid()) then
    raise exception using errcode = 'BC404', message = 'Não achamos o cadastro dessa conta. Crie uma conta nova.';
  end if;
end;
$$;

-- Antes de criar a conta: o CPF/CNPJ ainda não está em uso (nem no app antigo).
create or replace function public.document_available(p_document text)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select length(regexp_replace(coalesce(p_document, ''), '[^0-9]', '', 'g')) in (11, 14)
     and not exists (select 1 from public.accounts where document_hash = public.document_hash(p_document))
     and not exists (
       select 1 from public.profiles p join auth.users u on u.id = p.id
        where p.documento_hash = public.document_hash(p_document) and u.email_confirmed_at is not null
     )
$$;

-- "Completar perfil": salva o perfil e libera o app (accounts.profile_completed_at).
create or replace function public.finish_sign_up(p jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_account public.accounts;
  v_city text := btrim(coalesce(p->>'city', ''));
begin
  select * into v_account from public.accounts where id = auth.uid();
  if not found then
    raise exception using errcode = 'BC401', message = 'Entre na sua conta de novo para continuar.';
  end if;
  if v_city = '' then
    raise exception using errcode = 'BC422', message = 'Escolha a cidade na lista.';
  end if;
  if v_account.role = 'trabalhador' then
    if not exists (select 1 from public.oficios where id = p->>'oficio_id') then
      raise exception using errcode = 'BC422', message = 'Escolha seu ofício na lista.';
    end if;
    update public.workers
       set oficio_id = p->>'oficio_id',
           city = v_city,
           neighborhood = null,
           lat = coalesce((p->>'lat')::double precision, lat),
           lon = coalesce((p->>'lon')::double precision, lon),
           specialties = coalesce(array(select jsonb_array_elements_text(p->'specialties')), '{}')
     where id = v_account.worker_id;
  else
    update public.companies
       set tipo_obra = nullif(btrim(coalesce(p->>'tipo_obra', '')), ''),
           location = v_city
     where id = v_account.company_id;
  end if;
  update public.accounts set profile_completed_at = coalesce(profile_completed_at, now()) where id = v_account.id;
end;
$$;

-- ---------------------------------------------------------------------------------------------------
-- Máquina de status da candidatura (a mesma tabela de services/applicationMachine.ts)
-- ---------------------------------------------------------------------------------------------------

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
  end)::public.application_status
$$;

create or replace function public.application_step(
  p_app_id uuid, p_action text, p_actor public.application_actor, p_reason text default null
) returns public.applications language plpgsql security definer set search_path = public as $$
declare
  v_app public.applications;
  v_to public.application_status;
  v_at timestamptz := now();
begin
  select * into v_app from public.applications where id = p_app_id for update;
  if not found then
    raise exception using errcode = 'BC404', message = 'Essa candidatura não existe mais.';
  end if;
  v_to := public.application_next_status(p_action, v_app.status, p_actor);
  if v_to is null then
    raise exception using errcode = 'BC409', message = 'Essa candidatura mudou de situação. Atualize a tela e confira.';
  end if;
  update public.applications
     set status = v_to,
         status_changed_at = v_at,
         auto_rejected = (p_action = 'recusar' and p_actor = 'sistema' and p_reason = 'vaga_preenchida')
   where id = p_app_id
  returning * into v_app;
  insert into public.application_events (application_id, status, at, "by", reason)
  values (p_app_id, v_to, v_at, p_actor, p_reason);
  return v_app;
end;
$$;

-- Diária concluída: pede a avaliação dos dois lados.
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
end;
$$;

-- Encerrar a vaga recusa quem ainda esperava e torna definitivas as recusas automáticas.
create or replace function public.job_close_applications(p_job public.jobs)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_company text;
  r record;
begin
  select name into v_company from public.companies where id = p_job.company_id;
  update public.applications set auto_rejected = false where job_id = p_job.id and auto_rejected;
  for r in
    select id, worker_id from public.applications
     where job_id = p_job.id and status in ('enviada', 'em_analise')
  loop
    perform public.application_step(r.id, 'recusar', 'sistema', 'vaga_encerrada');
    perform public.notify(r.worker_id, null, 'nao_selecionado', 'Vaga encerrada',
      v_company || ' encerrou ' || public.job_title(p_job) || '. Tem outros bicos no mural.', '/mural');
  end loop;
end;
$$;

-- Diárias contratadas cujo último dia já passou viram "concluída" (rotina do sistema).
create or replace function public.conclude_finished_jobs(p_worker uuid default null, p_company uuid default null)
returns integer language plpgsql security definer set search_path = public as $$
declare
  r record;
  n integer := 0;
begin
  for r in
    select a.id from public.applications a join public.jobs j on j.id = a.job_id
     where a.status = 'contratado' and not j.date_to_arrange and j.end_date < public.bicos_today()
       and (p_worker is null or a.worker_id = p_worker)
       and (p_company is null or j.company_id = p_company)
     order by a.id
  loop
    perform public.application_conclude(r.id, 'sistema');
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- A mesma rotina, só para a sessão (o front chama ao abrir candidaturas, como o modo de demonstração).
create or replace function public.conclude_my_finished_jobs()
returns integer language plpgsql security definer set search_path = public as $$
begin
  if public.my_worker_id() is not null then return public.conclude_finished_jobs(public.my_worker_id(), null); end if;
  if public.my_company_id() is not null then return public.conclude_finished_jobs(null, public.my_company_id()); end if;
  return 0;
end;
$$;

-- Vagas preenchidas/pendentes, sem expor quem são os candidatos (o mural esconde vaga lotada).
create or replace function public.job_stats(p_job_ids text[])
returns table (job_id text, holding integer, pending integer, total integer)
language sql stable security definer set search_path = public as $$
  select a.job_id,
         count(*) filter (where a.status in ('pre_selecionado', 'contratado'))::int,
         count(*) filter (where a.status in ('enviada', 'em_analise'))::int,
         count(*)::int
    from public.applications a
   where a.job_id = any (p_job_ids)
   group by a.job_id
$$;

-- ---------------------------------------------------------------------------------------------------
-- Candidaturas: trabalhador
-- ---------------------------------------------------------------------------------------------------

create or replace function public.submit_application(p_job_id text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_worker uuid := public.my_worker_id();
  v_job public.jobs;
  v_app_id uuid;
  v_name text;
  v_holding integer;
begin
  if v_worker is null then
    raise exception using errcode = 'BC401', message = 'Só a conta de trabalhador pode se candidatar.';
  end if;
  if not exists (select 1 from public.accounts where id = auth.uid() and profile_completed_at is not null) then
    raise exception using errcode = 'BC409', message = 'Complete seu perfil antes de se candidatar.';
  end if;
  select * into v_job from public.jobs where id = p_job_id and deleted_at is null for update;
  if not found then
    raise exception using errcode = 'BC404', message = 'Essa vaga não existe mais.';
  end if;
  if exists (select 1 from public.applications where job_id = p_job_id and worker_id = v_worker) then return; end if;
  select count(*) into v_holding from public.applications
   where job_id = p_job_id and status in ('pre_selecionado', 'contratado');
  if v_job.closed or v_holding >= v_job.slots
     or (not v_job.date_to_arrange and v_job.end_date < public.bicos_today()) then
    raise exception using errcode = 'BC409', message = 'Essa vaga não está mais aberta.';
  end if;

  insert into public.applications (job_id, worker_id) values (p_job_id, v_worker) returning id into v_app_id;
  insert into public.application_events (application_id, status, "by") values (v_app_id, 'enviada', 'trabalhador');
  select name into v_name from public.workers where id = v_worker;
  perform public.notify(null, v_job.company_id, 'novos_candidatos', 'Nova candidatura',
    coalesce(v_name, 'Um trabalhador') || ' se candidatou para ' || public.job_title(v_job) || '.',
    '/vaga-gerenciar/' || p_job_id);
end;
$$;

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

-- ---------------------------------------------------------------------------------------------------
-- Candidaturas: as decisões (construtora) e a desistência (trabalhador), numa RPC só
-- ---------------------------------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------------------------------
-- Vagas: publicar, editar, fotos, encerrar, excluir
-- ---------------------------------------------------------------------------------------------------

-- Confere uma vaga (as mesmas regras do formulário, pages/recruiter/jobForm.ts) e devolve a linha.
create or replace function public.job_from_draft(p jsonb, p_original_start date default null)
returns public.jobs language plpgsql stable set search_path = public as $$
declare
  j public.jobs;
  v_today date := public.bicos_today();
begin
  j.oficio_id := p->>'oficio_id';
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

  if not exists (select 1 from public.oficios where id = j.oficio_id) then
    raise exception using errcode = 'BC422', message = 'Escolha o ofício que a vaga precisa.';
  end if;
  if j.cep is null or j.cep !~ '^\d{5}-\d{3}$' then
    raise exception using errcode = 'BC422', message = 'Digite o CEP da obra (8 números).';
  end if;
  -- O ponto precisa cair no Brasil (sem ele, a distância no mural sai errada).
  if j.street = '' or j.number = '' or j.neighborhood = '' or j.city = '' or j.uf !~ '^[A-Z]{2}$'
     or j.lat is null or j.lon is null or j.lat not between -34 and 6 or j.lon not between -74 and -28 then
    raise exception using errcode = 'BC422', message = 'Confira o endereço da obra.';
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
  if j.start_time is not null and (j.start_time !~ '^([01]\d|2[0-3]):[0-5]\d$'
     or j.end_time !~ '^([01]\d|2[0-3]):[0-5]\d$' or j.start_time >= j.end_time) then
    raise exception using errcode = 'BC422', message = 'O fim tem que ser depois do início.';
  end if;
  if j.slots < 1 or j.slots > 50 then
    raise exception using errcode = 'BC422', message = 'Informe quantas pessoas a vaga precisa (de 1 a 50).';
  end if;
  if j.pay is not null and j.pay < 80 then
    raise exception using errcode = 'BC422', message = 'Informe um valor de R$ 80 ou mais.';
  end if;
  if j.description = '' then
    raise exception using errcode = 'BC422', message = 'Descreva o serviço da vaga.';
  end if;
  return j;
end;
$$;

create or replace function public.publish_job(p jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_company uuid := public.my_company_id();
  j public.jobs;
  v_id text;
begin
  if v_company is null then
    raise exception using errcode = 'BC401', message = 'Só a conta de construtora pode publicar vagas.';
  end if;
  if not exists (select 1 from public.accounts where id = auth.uid() and profile_completed_at is not null) then
    raise exception using errcode = 'BC409', message = 'Complete o perfil da empresa antes de publicar.';
  end if;
  j := public.job_from_draft(p);
  insert into public.jobs (
    company_id, oficio_id, title, pay, cep, street, number, complement, neighborhood, city, uf, lat, lon,
    date_to_arrange, start_date, end_date, start_time, end_time, diarias, dias, urgent, photos, slots,
    description, requirements
  ) values (
    v_company, j.oficio_id, j.title, j.pay, j.cep, j.street, j.number, j.complement, j.neighborhood, j.city,
    j.uf, j.lat, j.lon, j.date_to_arrange, j.start_date, j.end_date, j.start_time, j.end_time, j.diarias,
    j.dias, j.urgent, j.photos, j.slots, j.description, j.requirements
  ) returning id into v_id;
  return v_id;
end;
$$;

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
    raise exception using errcode = 'BC401', message = 'Só a construtora da vaga pode fazer isso.';
  end if;
  return v_job;
end;
$$;

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
  select count(*) into v_holding from public.applications
   where job_id = p_job_id and status in ('pre_selecionado', 'contratado');
  if j.slots < v_holding then
    raise exception using errcode = 'BC422',
      message = 'Você já aprovou ' || v_holding || ' pessoas. Não dá para pedir menos que isso.';
  end if;

  if v_old.pay is distinct from j.pay then v_changes := v_changes || 'valor'; end if;
  if v_old.date_to_arrange is distinct from j.date_to_arrange or v_old.start_date is distinct from j.start_date
     or v_old.end_date is distinct from j.end_date or v_old.start_time is distinct from j.start_time
     or v_old.end_time is distinct from j.end_time then
    v_changes := v_changes || 'data';
  end if;
  if v_old.cep is distinct from j.cep or v_old.street is distinct from j.street
     or v_old.number is distinct from j.number or v_old.city is distinct from j.city
     or v_old.uf is distinct from j.uf then
    v_changes := v_changes || 'endereço';
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

create or replace function public.set_job_photos(p_job_id text, p_photos text[])
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.own_job_for_update(p_job_id);
  update public.jobs set photos = coalesce(p_photos, '{}') where id = p_job_id;
end;
$$;

create or replace function public.close_job(p_job_id text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_job public.jobs := public.own_job_for_update(p_job_id);
  v_hired boolean;
begin
  if v_job.closed then return; end if;
  v_hired := exists (
    select 1 from public.applications
     where job_id = p_job_id and status in ('pre_selecionado', 'contratado', 'concluida')
  );
  update public.jobs set closed = true, sem_contratacao = sem_contratacao or not v_hired
   where id = p_job_id returning * into v_job;
  perform public.job_close_applications(v_job);
end;
$$;

-- Excluir o anúncio: some do mural; quem ainda esperava é avisado (como ao encerrar).
create or replace function public.delete_job(p_job_id text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.close_job(p_job_id);
  update public.jobs set deleted_at = coalesce(deleted_at, now()) where id = p_job_id;
end;
$$;

-- ---------------------------------------------------------------------------------------------------
-- Avaliações
-- ---------------------------------------------------------------------------------------------------

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
               '. · ' || lower(coalesce((select nome from public.oficios where id = v_worker.oficio_id), ''));
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

-- ---------------------------------------------------------------------------------------------------
-- Contato por WhatsApp (o número é privado dos dois lados)
-- ---------------------------------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------------------------------
-- Impulsionar vaga. O provedor de pagamento ainda não está integrado: a cobrança é registrada aqui e
-- confirmada pela simulação do app (PIX) ou na hora (cartão; final 0000 é recusado), como no modo de
-- demonstração. Ao integrar o provedor, a confirmação passa a vir do webhook (confirm_boost_payment).
-- ---------------------------------------------------------------------------------------------------

create or replace function public.boost_plan_cents(p_plan public.boost_plan)
returns integer language sql immutable set search_path = public as $$
  select case p_plan when '24h' then 1200 when '3d' then 2800 when 'whats' then 3900 end
$$;

create or replace function public.boost_plan_hours(p_plan public.boost_plan)
returns integer language sql immutable set search_path = public as $$
  select case p_plan when '24h' then 24 when '3d' then 72 when 'whats' then 24 end
$$;

create or replace function public.boost_blocker(p_job public.jobs)
returns text language sql stable security definer set search_path = public as $$
  select case
    when p_job.company_id is distinct from public.my_company_id() then 'Só a construtora da vaga pode impulsionar.'
    when p_job.deleted_at is not null or p_job.closed
      or (not p_job.date_to_arrange and p_job.end_date < public.bicos_today())
      or (select count(*) from public.applications a
           where a.job_id = p_job.id and a.status in ('pre_selecionado', 'contratado')) >= p_job.slots
      then 'Só dá para impulsionar uma vaga aberta.'
    when p_job.boost_ends_at > now() then 'Essa vaga já está impulsionada.'
  end
$$;

create or replace function public.expire_pix_payments()
returns integer language sql security definer set search_path = public as $$
  with x as (
    update public.boost_payments set status = 'expirado'
     where status = 'aguardando' and expires_at <= now()
    returning 1
  ) select count(*)::int from x
$$;

create or replace function public.confirm_boost_payment(p_payment_id uuid)
returns public.boost_payments language plpgsql security definer set search_path = public as $$
declare
  v_pay public.boost_payments;
  v_job public.jobs;
  v_ends timestamptz;
begin
  select * into v_pay from public.boost_payments where id = p_payment_id for update;
  if v_pay.status <> 'aguardando' then return v_pay; end if;
  v_ends := now() + make_interval(hours => public.boost_plan_hours(v_pay.plan));
  update public.jobs set boost_ends_at = v_ends where id = v_pay.job_id returning * into v_job;
  update public.boost_payments
     set status = 'confirmado', confirmed_at = now(), boost_ends_at = v_ends
   where id = p_payment_id returning * into v_pay;
  perform public.notify(null, v_job.company_id, 'impulsionamento', 'Vaga impulsionada',
    public.job_title(v_job) || ' está no topo do mural até ' || public.short_datetime_br(v_ends) || '.',
    '/vaga-gerenciar/' || v_job.id);
  return v_pay;
end;
$$;

create or replace function public.boostable_job(p_job_id text)
returns public.jobs language plpgsql security definer set search_path = public as $$
declare
  v_job public.jobs;
  v_blocker text;
begin
  select * into v_job from public.jobs where id = p_job_id for update;
  if not found then
    raise exception using errcode = 'BC404', message = 'Essa vaga não existe mais.';
  end if;
  v_blocker := public.boost_blocker(v_job);
  if v_blocker is not null then
    raise exception using errcode = 'BC409', message = v_blocker;
  end if;
  return v_job;
end;
$$;

create or replace function public.start_pix_payment(p_job_id text, p_plan public.boost_plan)
returns public.boost_payments language plpgsql security definer set search_path = public as $$
declare
  v_job public.jobs := public.boostable_job(p_job_id);
  v_cents integer := public.boost_plan_cents(p_plan);
  v_pay public.boost_payments;
  v_id uuid := gen_random_uuid();
begin
  insert into public.boost_payments (id, job_id, company_id, plan, method, amount_cents, pix_code, expires_at)
  values (
    v_id, v_job.id, v_job.company_id, p_plan, 'pix', v_cents,
    '00020126580014BR.GOV.BCB.PIX0136bicos-' || replace(v_id::text, '-', '') || '520400005303986540' ||
      to_char(v_cents / 100.0, 'FM9990.00') || '5802BR5905BICOS6009SAO PAULO62070503***6304',
    now() + interval '30 minutes'
  ) returning * into v_pay;
  return v_pay;
end;
$$;

create or replace function public.get_payment(p_payment_id uuid)
returns public.boost_payments language plpgsql security definer set search_path = public as $$
declare
  v_pay public.boost_payments;
begin
  update public.boost_payments set status = 'expirado'
   where id = p_payment_id and status = 'aguardando' and expires_at <= now();
  select * into v_pay from public.boost_payments
   where id = p_payment_id and company_id = public.my_company_id();
  if not found then
    raise exception using errcode = 'BC404', message = 'Esse pagamento não existe.';
  end if;
  return v_pay;
end;
$$;

create or replace function public.simulate_pix_paid(p_payment_id uuid)
returns public.boost_payments language plpgsql security definer set search_path = public as $$
declare
  v_pay public.boost_payments := public.get_payment(p_payment_id);
begin
  if v_pay.status = 'expirado' then
    raise exception using errcode = 'BC409', message = 'Esse código PIX venceu. Gere um novo.';
  end if;
  if v_pay.status <> 'aguardando' then return v_pay; end if;
  return public.confirm_boost_payment(p_payment_id);
end;
$$;

-- O número do cartão nunca chega ao banco: só os 4 últimos dígitos, para o recibo.
create or replace function public.pay_with_card(p_job_id text, p_plan public.boost_plan, p_card_last4 text)
returns public.boost_payments language plpgsql security definer set search_path = public as $$
declare
  v_job public.jobs := public.boostable_job(p_job_id);
  v_pay public.boost_payments;
begin
  if p_card_last4 is null or p_card_last4 !~ '^\d{4}$' then
    raise exception using errcode = 'BC422', message = 'Confira os dados do cartão.';
  end if;
  insert into public.boost_payments (job_id, company_id, plan, method, amount_cents, status, card_last4)
  values (v_job.id, v_job.company_id, p_plan, 'cartao', public.boost_plan_cents(p_plan),
          case when p_card_last4 = '0000' then 'recusado'::public.payment_status else 'aguardando' end, p_card_last4)
  returning * into v_pay;
  if v_pay.status = 'recusado' then return v_pay; end if;
  return public.confirm_boost_payment(v_pay.id);
end;
$$;

-- ---------------------------------------------------------------------------------------------------
-- Privacidade (LGPD): exportar e excluir
-- ---------------------------------------------------------------------------------------------------

create or replace function public.export_my_data()
returns jsonb language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_account public.accounts;
  v_key text;
  v_doc text;
begin
  select * into v_account from public.accounts where id = auth.uid();
  if not found then
    raise exception using errcode = 'BC401', message = 'Entre na sua conta de novo para continuar.';
  end if;
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'nivotech_documento_key';
  if v_key is not null and v_account.document_cipher is not null then
    v_doc := extensions.pgp_sym_decrypt(v_account.document_cipher, v_key);
  end if;
  return jsonb_build_object(
    'gerado_em', now(),
    'conta', jsonb_build_object(
      'email', v_account.email, 'lado', v_account.role, 'documento', v_doc, 'whatsapp', v_account.whatsapp,
      'email_confirmado_em', v_account.email_confirmed_at, 'perfil_completo_em', v_account.profile_completed_at,
      'termos_versao', v_account.terms_version, 'termos_aceitos_em', v_account.terms_accepted_at,
      'criada_em', v_account.created_at),
    'perfil', coalesce(
      (select to_jsonb(w) from public.workers w where w.id = v_account.worker_id),
      (select to_jsonb(c) from public.companies c where c.id = v_account.company_id)),
    'vagas', coalesce((select jsonb_agg(to_jsonb(j)) from public.jobs j where j.company_id = v_account.company_id), '[]'),
    'candidaturas', coalesce((
      select jsonb_agg(to_jsonb(a) || jsonb_build_object('historico', (
        select jsonb_agg(to_jsonb(e) order by e.at) from public.application_events e where e.application_id = a.id)))
        from public.applications a
       where a.worker_id = v_account.worker_id
          or a.job_id in (select id from public.jobs where company_id = v_account.company_id)), '[]'),
    'avaliacoes_recebidas', coalesce((
      select jsonb_agg(to_jsonb(r)) from public.reviews r
       where r.worker_id = v_account.worker_id or r.company_id = v_account.company_id), '[]'),
    'vagas_salvas', coalesce((select jsonb_agg(to_jsonb(s)) from public.saved_jobs s where s.worker_id = v_account.worker_id), '[]'),
    'portfolio', coalesce((select jsonb_agg(to_jsonb(p)) from public.worker_posts p where p.worker_id = v_account.worker_id), '[]'),
    'notificacoes', coalesce((
      select jsonb_agg(to_jsonb(n)) from public.notifications n
       where n.worker_id = v_account.worker_id or n.company_id = v_account.company_id), '[]'),
    'pagamentos', coalesce((select jsonb_agg(to_jsonb(b) - 'pix_code') from public.boost_payments b where b.company_id = v_account.company_id), '[]'),
    'consentimentos', coalesce((select jsonb_agg(to_jsonb(c)) from public.consentimentos c where c.usuario_id = v_account.id), '[]')
  );
end;
$$;

-- Excluir a conta (a senha é conferida no app antes). Trabalhador desiste do que está combinado e
-- retira as candidaturas pendentes; construtora cancela as contratações e encerra as vagas abertas.
-- O perfil fica anonimizado para o histórico do outro lado; a conta de acesso é apagada.
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

-- ---------------------------------------------------------------------------------------------------
-- Quem pode chamar o quê
-- ---------------------------------------------------------------------------------------------------

revoke all on function
  public.my_worker_id(), public.my_company_id(), public.is_my_job(text), public.bicos_today(),
  public.initials_of(text), public.first_name(text), public.job_title(public.jobs), public.mask_document(text),
  public.document_hash(text), public.short_datetime_br(timestamptz),
  public.notify(uuid, uuid, public.notification_kind, text, text, text),
  public.create_account_for(uuid, text, public.app_role, text, text, text, text, timestamptz),
  public.handle_new_user_v2(), public.sync_account_auth_v2(), public.cleanup_unconfirmed_profile_v2(),
  public.worker_initials_v2(), public.company_whatsapp_v2(), public.touch_job_v2(),
  public.account_from_old_profile(uuid), public.ensure_my_account(), public.document_available(text),
  public.finish_sign_up(jsonb), public.application_next_status(text, public.application_status, public.application_actor),
  public.application_step(uuid, text, public.application_actor, text),
  public.application_conclude(uuid, public.application_actor), public.job_close_applications(public.jobs),
  public.conclude_finished_jobs(uuid, uuid), public.conclude_my_finished_jobs(), public.job_stats(text[]),
  public.submit_application(text), public.withdraw_application(text),
  public.transition_application(text, uuid, text, text), public.job_from_draft(jsonb, date),
  public.publish_job(jsonb), public.own_job_for_update(text), public.update_job(text, jsonb),
  public.set_job_photos(text, text[]), public.close_job(text), public.delete_job(text),
  public.submit_review(uuid, public.review_direction, integer, text[], text), public.get_contact(uuid),
  public.boost_plan_cents(public.boost_plan), public.boost_plan_hours(public.boost_plan),
  public.boost_blocker(public.jobs), public.expire_pix_payments(), public.confirm_boost_payment(uuid),
  public.boostable_job(text), public.start_pix_payment(text, public.boost_plan), public.get_payment(uuid),
  public.simulate_pix_paid(uuid), public.pay_with_card(text, public.boost_plan, text),
  public.export_my_data(), public.delete_my_account(boolean)
from public, anon, authenticated;

-- Usadas pelas políticas RLS (rodam como quem consulta).
grant execute on function public.my_worker_id(), public.my_company_id(), public.is_my_job(text)
  to authenticated;

-- O que o app chama.
grant execute on function public.document_available(text) to anon, authenticated;
grant execute on function
  public.ensure_my_account(), public.finish_sign_up(jsonb), public.conclude_my_finished_jobs(),
  public.job_stats(text[]), public.submit_application(text), public.withdraw_application(text),
  public.transition_application(text, uuid, text, text), public.publish_job(jsonb),
  public.update_job(text, jsonb), public.set_job_photos(text, text[]), public.close_job(text),
  public.delete_job(text), public.submit_review(uuid, public.review_direction, integer, text[], text),
  public.get_contact(uuid), public.start_pix_payment(text, public.boost_plan), public.get_payment(uuid),
  public.simulate_pix_paid(uuid), public.pay_with_card(text, public.boost_plan, text),
  public.export_my_data(), public.delete_my_account(boolean)
to authenticated;
