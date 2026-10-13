-- L13: conta nova pelo Google. O Auth cria o usuário sem lado (sem `role` nos metadados), então nenhuma conta
-- nasce no gatilho; a pessoa escolhe o lado e completa CPF/CNPJ, WhatsApp e o aceite em "Completar
-- cadastro", que chama create_my_account. As mesmas regras do cadastro por e-mail (Y17, Y25, L14, Z07).

create or replace function public.create_my_account(
  p_role public.app_role, p_name text, p_document text, p_whatsapp text, p_terms_version text,
  p_adult boolean, p_contact_name text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_user auth.users;
  v_digits text := regexp_replace(coalesce(p_document, ''), '[^0-9]', '', 'g');
  v_contact text := nullif(btrim(left(coalesce(p_contact_name, ''), 60)), '');
begin
  select * into v_user from auth.users where id = auth.uid();
  if not found then
    raise exception using errcode = 'BC401', message = 'Entre na sua conta de novo para continuar.';
  end if;
  if exists (select 1 from public.accounts where id = v_user.id) then return; end if;
  if coalesce(p_adult, false) is not true then
    raise exception using errcode = 'BC422', message = 'A Bicos é só para maiores de 18 anos.';
  end if;
  if nullif(btrim(coalesce(p_name, '')), '') is null or char_length(btrim(p_name)) < 3 then
    raise exception using errcode = 'BC422', message = 'Informe seu nome completo.';
  end if;
  if not public.document_valid_for(p_role, v_digits) then
    raise exception using errcode = 'BC422', message = 'Documento inválido.';
  end if;
  if not public.whatsapp_valid(p_whatsapp) then
    raise exception using errcode = 'BC422', message = 'Confira o número: celular com DDD, 11 números.';
  end if;
  if nullif(p_terms_version, '') is null then
    raise exception using errcode = 'BC422', message = 'Aceite os termos para criar a conta.';
  end if;
  -- O documento de outra conta confirmada recusa sem dizer de quem (Z07): BC409 genérico.
  begin
    perform public.create_account_for(
      v_user.id, v_user.email, p_role, btrim(p_name), v_digits, p_whatsapp, p_terms_version,
      coalesce(v_user.email_confirmed_at, now())
    );
  exception when sqlstate 'BC409' then
    raise exception using errcode = 'BC409', message = 'Não deu para criar a conta com esses dados.';
  end;
  if p_role = 'recrutador' and char_length(coalesce(v_contact, '')) >= 2 then
    update public.companies set contact_name = v_contact where id = v_user.id;
  end if;
end;
$$;

revoke all on function public.create_my_account(public.app_role, text, text, text, text, boolean, text)
  from public, anon;
grant execute on function public.create_my_account(public.app_role, text, text, text, text, boolean, text)
  to authenticated;
