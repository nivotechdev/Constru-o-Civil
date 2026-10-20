-- U10 (20/10): e-mail, CPF/CNPJ e WhatsApp são de uma conta só, e o cadastro confere cada um no passo em que é
-- digitado (antes só dava erro no fim, ao criar a conta).
--   * signup_taken(campo, valor): se o e-mail, o documento ou o WhatsApp já é de uma conta CONFIRMADA. Só para a
--     Edge Function verificar-cadastro (service_role), que limita as tentativas por IP e por valor;
--   * WhatsApp único: claim_whatsapp_for (como claim_document_for: libera o número de cadastro nunca confirmado,
--     recusa o de conta confirmada), chamada ao criar a conta (create_account_for) e ao trocar o número
--     (change_whatsapp); índice único em accounts.whatsapp (vazio não conta).
--   * números já repetidos (só no staging, contas de teste): fica com o número a conta confirmada mais antiga, as
--     outras ficam sem número. Na produção não havia repetido (conferido em 20/10).
-- E-mail e documento já eram únicos (auth.users e accounts.document_hash). Idempotente.

create or replace function public.signup_taken(p_kind text, p_value text)
returns boolean language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v text := btrim(coalesce(p_value, ''));
  v_digits text := regexp_replace(v, '[^0-9]', '', 'g');
begin
  if p_kind = 'email' then
    return v <> '' and exists (
      select 1 from auth.users where lower(email) = lower(v) and email_confirmed_at is not null);
  elsif p_kind = 'documento' then
    if length(v_digits) not in (11, 14) then return false; end if;
    return exists (select 1 from public.accounts a join auth.users u on u.id = a.id
                    where a.document_hash = public.document_hash(v_digits) and u.email_confirmed_at is not null)
        or exists (select 1 from public.profiles p join auth.users u on u.id = p.id
                    where p.documento_hash = public.document_hash(v_digits) and u.email_confirmed_at is not null);
  elsif p_kind = 'whatsapp' then
    return v_digits <> '' and exists (
      select 1 from public.accounts a join auth.users u on u.id = a.id
       where a.whatsapp = v_digits and u.email_confirmed_at is not null);
  end if;
  raise exception using errcode = 'BC422', message = 'Campo inválido.';
end;
$$;
revoke all on function public.signup_taken(text, text) from public, anon, authenticated;
grant execute on function public.signup_taken(text, text) to service_role;

create or replace function public.claim_whatsapp_for(p_user_id uuid, p_phone text)
returns void language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  if coalesce(p_phone, '') = '' then return; end if;
  for r in
    select a.id, u.email_confirmed_at from public.accounts a join auth.users u on u.id = a.id
     where a.whatsapp = p_phone and a.id <> p_user_id
  loop
    if r.email_confirmed_at is not null then
      raise exception using errcode = 'BC409', message = 'Esse WhatsApp já está em outra conta da Bicos.';
    end if;
    delete from auth.users where id = r.id;  -- cadastro nunca confirmado: libera o número
  end loop;
end;
$$;
revoke all on function public.claim_whatsapp_for(uuid, text) from public, anon, authenticated;

-- Números já repetidos: a conta confirmada mais antiga fica com ele; as outras ficam sem número.
do $$
declare
  r record;
begin
  for r in
    select id, worker_id, company_id from (
      select a.id, a.worker_id, a.company_id,
             row_number() over (partition by a.whatsapp
                                order by (u.email_confirmed_at is null), a.created_at, a.id) as n
        from public.accounts a left join auth.users u on u.id = a.id
       where a.whatsapp <> '') x
     where n > 1
  loop
    update public.workers set whatsapp = '' where id = r.worker_id;
    update public.companies set whatsapp = '' where id = r.company_id;
    update public.accounts set whatsapp = '', whatsapp_verified_at = null where id = r.id;
  end loop;
end $$;

create unique index if not exists accounts_whatsapp_key on public.accounts (whatsapp) where whatsapp <> '';

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
  -- U10: o WhatsApp também é de uma conta só (libera o de cadastro nunca confirmado).
  perform public.claim_whatsapp_for(p_user_id, v_phone);

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


create or replace function public.change_whatsapp(p_whatsapp text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_phone text := regexp_replace(coalesce(p_whatsapp, ''), '[^0-9]', '', 'g');
  v_account public.accounts;
  v_verified timestamptz;
begin
  select * into v_account from public.accounts where id = auth.uid() for update;
  if not found then
    raise exception using errcode = 'BC401', message = 'Entre na sua conta de novo para continuar.';
  end if;
  if not public.whatsapp_valid(v_phone) then
    raise exception using errcode = 'BC422', message = 'Confira o número: celular com DDD, 11 números.';
  end if;
  if v_phone = v_account.whatsapp then
    return jsonb_build_object('whatsapp', v_phone, 'verified_at', v_account.whatsapp_verified_at);
  end if;
  -- U10: número de outra conta confirmada é recusado; o de cadastro nunca confirmado é liberado.
  perform public.claim_whatsapp_for(v_account.id, v_phone);
  v_verified := case when public.whatsapp_recently_verified(v_phone) then now() end;
  if v_account.worker_id is not null then
    update public.workers set whatsapp = v_phone where id = v_account.worker_id;
  else
    update public.companies set whatsapp = v_phone where id = v_account.company_id;
  end if;
  update public.accounts set whatsapp = v_phone, whatsapp_verified_at = v_verified where id = v_account.id;
  -- O código vale uma vez.
  delete from public.whatsapp_verifications where phone = v_phone;
  return jsonb_build_object('whatsapp', v_phone, 'verified_at', v_verified);
end;
$$;
