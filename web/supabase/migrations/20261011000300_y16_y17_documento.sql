-- Y16 + Y17: documento com dígito verificador no servidor e CPF fora do campo público da empresa.
--
-- - cpf_valid / cnpj_valid: as mesmas contas de utils/document.ts.
-- - O cadastro (gatilho BEFORE INSERT em auth.users) recusa conta com lado definido (trabalhador ou
--   recrutador) sem documento válido: trabalhador com CPF; recrutador com CNPJ ou, por conta própria, CPF.
--   Conta sem lado (login com Google) não tem documento ainda: completa em "Escolher perfil" (L13).
-- - create_account_for recusa documento inválido.
-- - Y16: companies.cnpj de quem se cadastrou com CPF (máscara '***.') volta a vazio.

create or replace function public.cpf_valid(p_document text)
returns boolean language plpgsql immutable set search_path = public as $$
declare
  d text := regexp_replace(coalesce(p_document, ''), '[^0-9]', '', 'g');
  s int;
  r int;
  n int;
begin
  if length(d) <> 11 or d ~ '^(\d)\1{10}$' then return false; end if;
  foreach n in array array[9, 10] loop
    s := 0;
    for i in 1..n loop
      s := s + substr(d, i, 1)::int * (n + 2 - i);
    end loop;
    r := (s * 10) % 11;
    if r = 10 then r := 0; end if;
    if r <> substr(d, n + 1, 1)::int then return false; end if;
  end loop;
  return true;
end;
$$;

create or replace function public.cnpj_valid(p_document text)
returns boolean language plpgsql immutable set search_path = public as $$
declare
  d text := regexp_replace(coalesce(p_document, ''), '[^0-9]', '', 'g');
  w int[] := array[6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  s int;
  r int;
  n int;
begin
  if length(d) <> 14 or d ~ '^(\d)\1{13}$' then return false; end if;
  foreach n in array array[12, 13] loop
    s := 0;
    for i in 1..n loop
      -- Pesos 5,4,3,2,9,…,2 para o 1º dígito e 6,5,4,…,2 para o 2º.
      s := s + substr(d, i, 1)::int * w[i + 13 - n];
    end loop;
    r := s % 11;
    r := case when r < 2 then 0 else 11 - r end;
    if r <> substr(d, n + 1, 1)::int then return false; end if;
  end loop;
  return true;
end;
$$;

-- O documento serve para o lado da conta?
create or replace function public.document_valid_for(p_role public.app_role, p_document text)
returns boolean language sql immutable set search_path = public as $$
  select case p_role
    when 'trabalhador' then public.cpf_valid(p_document)
    else public.cnpj_valid(p_document) or public.cpf_valid(p_document)
  end
$$;

create or replace function public.claim_document_v2()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_digits text := regexp_replace(coalesce(m->>'documento', ''), '[^0-9]', '', 'g');
  v_role public.app_role := case
    when m->>'role' in ('trabalhador', 'recrutador') then (m->>'role')::public.app_role
    when m->>'tipo' = 'pedreiro' then 'trabalhador'
    when m->>'tipo' = 'construtora' then 'recrutador'
  end;
begin
  -- Y17: cadastro com lado definido precisa de documento válido (o app confere antes; isto é a garantia).
  if v_role is not null and not public.document_valid_for(v_role, v_digits) then
    raise exception using errcode = 'BC422', message = 'Documento inválido.';
  end if;
  if length(v_digits) > 0 then
    perform public.claim_document_for(new.id, v_digits);
  end if;
  -- Só nesta transação (o cadastro): handle_new_user_v2 lê e apaga.
  perform set_config('bicos.cadastro_documento', v_digits, true);
  new.raw_user_meta_data := m - 'documento';
  return new;
end;
$$;

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

-- Y16: o CPF mascarado ('***.456.789-**') que foi parar no campo público da empresa.
update public.companies set cnpj = null where cnpj like '***%';

revoke all on function
  public.claim_document_v2(),
  public.create_account_for(uuid, text, public.app_role, text, text, text, text, timestamptz)
from public, anon, authenticated;
grant execute on function public.cpf_valid(text), public.cnpj_valid(text),
  public.document_valid_for(public.app_role, text) to authenticated, service_role;
