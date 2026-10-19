-- L07 (lançamento): LGPD — aceites registrados com versão e data, novo aceite quando os termos mudam, e
-- consentimento específico e destacado para a selfie e a foto do documento (dado biométrico: art. 11).
--
-- - terms_acceptances: cada aceite (termos de uso, política de privacidade, uso de imagem na verificação) com a
--   versão e a hora. Substitui `consentimentos` (tabela do app antigo, que o cadastro novo ainda alimentava);
--   o que já estava lá é copiado para cá.
-- - accept_terms(versão): o app pede o novo aceite no próximo login quando a versão dos termos muda.
-- - submit_identity passa a exigir a versão do consentimento mostrado na tela (identity_submissions.consent_*).
-- - export_my_data devolve os aceites e as verificações de identidade (sem as fotos).

create table if not exists public.terms_acceptances (
  id bigint generated always as identity primary key,
  account_id uuid not null references public.accounts (id) on delete cascade,
  document text not null check (document in ('termos_de_uso', 'politica_privacidade', 'uso_de_imagem_identidade')),
  version text not null check (char_length(version) between 1 and 20),
  accepted_at timestamptz not null default now(),
  unique (account_id, document, version)
);
alter table public.terms_acceptances enable row level security;
revoke all on public.terms_acceptances from anon, authenticated;

-- O que o app antigo registrou (só das contas que existem no app novo).
do $$
begin
  if to_regclass('public.consentimentos') is not null then
    insert into public.terms_acceptances (account_id, document, version, accepted_at)
    select c.usuario_id, c.documento, left(c.versao, 20), c.aceito_em
      from public.consentimentos c join public.accounts a on a.id = c.usuario_id
     where c.documento in ('termos_de_uso', 'politica_privacidade')
    on conflict do nothing;
  end if;
end $$;
-- E o aceite que cada conta já tem gravado em accounts.
insert into public.terms_acceptances (account_id, document, version, accepted_at)
select a.id, d, a.terms_version, a.terms_accepted_at
  from public.accounts a cross join unnest(array['termos_de_uso', 'politica_privacidade']) d
 where nullif(a.terms_version, '') is not null
on conflict do nothing;

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
  -- Y17: documento informado tem de ser válido para o lado da conta. (Sem documento só as contas do app
  -- antigo, migradas por account_from_old_profile, que copiam o documento cifrado depois.)
  if length(v_digits) > 0 and not public.document_valid_for(p_role, v_digits) then
    raise exception using errcode = 'BC422', message = 'Documento inválido.';
  end if;
  if length(v_digits) > 0 then
    perform public.claim_document_for(p_user_id, v_digits);
  end if;

  if p_role = 'trabalhador' then
    insert into public.workers (id, name, initials, whatsapp, city, lat, lon)
    values (p_user_id, v_name, public.initials_of(v_name), v_phone, 'São Paulo, SP', -23.5505, -46.6333)
    on conflict (id) do nothing;
  else
    -- Y16: o campo público "CNPJ" da empresa só recebe CNPJ (14 dígitos), nunca o CPF de quem recruta.
    insert into public.companies (id, name, cnpj, whatsapp, location)
    values (p_user_id, v_name, case when length(v_digits) = 14 then public.mask_document(v_digits) end,
            v_phone, 'São Paulo, SP')
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

  -- L07: o aceite fica registrado (com a versão e a hora) na tabela própria, não mais na do app antigo.
  if nullif(p_terms_version, '') is not null then
    insert into public.terms_acceptances (account_id, document, version)
    select p_user_id, d, p_terms_version from unnest(array['termos_de_uso', 'politica_privacidade']) d
    on conflict do nothing;
  end if;
end;
$$;

-- Novo aceite (versão nova dos termos e da política, aceitos juntos).
create or replace function public.accept_terms(p_version text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not exists (select 1 from public.accounts where id = auth.uid()) then
    raise exception using errcode = 'BC401', message = 'Entre na sua conta de novo para continuar.';
  end if;
  if nullif(btrim(coalesce(p_version, '')), '') is null or char_length(p_version) > 20 then
    raise exception using errcode = 'BC422', message = 'Versão dos termos inválida.';
  end if;
  update public.accounts set terms_version = btrim(p_version), terms_accepted_at = now() where id = auth.uid();
  insert into public.terms_acceptances (account_id, document, version)
  select auth.uid(), d, btrim(p_version) from unnest(array['termos_de_uso', 'politica_privacidade']) d
  on conflict do nothing;
end;
$$;

-- Verificação de identidade com consentimento específico.
alter table public.identity_submissions
  add column if not exists consent_version text,
  add column if not exists consent_at timestamptz;

drop function if exists public.submit_identity(text, text);
create or replace function public.submit_identity(p_selfie_path text, p_document_path text, p_consent_version text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_worker uuid := public.my_worker_id();
  v_prefix text := auth.uid()::text || '/';
begin
  if v_worker is null then
    raise exception using errcode = 'BC401', message = 'Só a conta de trabalhador verifica a identidade.';
  end if;
  if nullif(btrim(coalesce(p_consent_version, '')), '') is null or char_length(p_consent_version) > 20 then
    raise exception using errcode = 'BC422', message = 'Marque que você concorda com o uso das fotos para a verificação.';
  end if;
  if left(coalesce(p_selfie_path, ''), length(v_prefix)) <> v_prefix
     or left(coalesce(p_document_path, ''), length(v_prefix)) <> v_prefix then
    raise exception using errcode = 'BC422', message = 'Envie a selfie e a foto do documento de novo.';
  end if;
  if exists (select 1 from public.workers where id = v_worker and identity_status in ('em_analise', 'verificado')) then
    raise exception using errcode = 'BC409', message = 'Sua identidade já está em análise ou verificada.';
  end if;
  insert into public.identity_submissions (worker_id, selfie_path, document_path, consent_version, consent_at)
  values (v_worker, p_selfie_path, p_document_path, btrim(p_consent_version), now());
  insert into public.terms_acceptances (account_id, document, version)
  values (auth.uid(), 'uso_de_imagem_identidade', btrim(p_consent_version))
  on conflict do nothing;
  update public.workers set identity_status = 'em_analise', identity_reason = null, identity_submitted_at = now()
   where id = v_worker;
end;
$$;

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
    'aceites', coalesce((
      select jsonb_agg(jsonb_build_object('documento', t.document, 'versao', t.version, 'aceito_em', t.accepted_at)
                       order by t.accepted_at)
        from public.terms_acceptances t where t.account_id = v_account.id), '[]'),
    'verificacao_identidade', coalesce((
      select jsonb_agg(jsonb_build_object('enviada_em', s.created_at, 'consentimento_versao', s.consent_version,
                                          'consentimento_em', s.consent_at, 'decidida_em', s.decided_at)
                       order by s.created_at)
        from public.identity_submissions s where s.worker_id = v_account.worker_id), '[]')
  );
end;
$$;

revoke all on function public.create_account_for(uuid, text, public.app_role, text, text, text, text, timestamptz),
  public.accept_terms(text), public.submit_identity(text, text, text), public.export_my_data()
  from public, anon, authenticated;
grant execute on function public.accept_terms(text), public.submit_identity(text, text, text), public.export_my_data()
  to authenticated;
