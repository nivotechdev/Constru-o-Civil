-- U63 — quem contrata tem um nome só: o da empresa ou o da própria pessoa (quem pede serviço nem sempre tem empresa).
-- Sai o "responsável" (companies.contact_name, do F15): o cadastro (por e-mail ou pelo Google) não grava mais esse
-- segundo nome e a coluna é apagada. create_my_account mantém o parâmetro p_contact_name (ignorado) para o app antigo.

create or replace function public.handle_new_user_v2()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_document text := coalesce(nullif(m->>'documento', ''), nullif(current_setting('bicos.cadastro_documento', true), ''));
  v_role public.app_role := case
    when m->>'role' in ('trabalhador', 'recrutador') then (m->>'role')::public.app_role
    when m->>'tipo' = 'pedreiro' then 'trabalhador'
    when m->>'tipo' = 'construtora' then 'recrutador'
  end;
begin
  perform set_config('bicos.cadastro_documento', '', true);
  -- Sem lado definido (ex.: login com Google): a conta nasce depois, em "Escolher perfil".
  if v_role is null then return new; end if;
  perform public.create_account_for(
    new.id, new.email, v_role, m->>'nome', v_document, m->>'whatsapp', m->>'terms_version',
    new.email_confirmed_at
  );
  return new;
end;
$$;
revoke all on function public.handle_new_user_v2() from public, anon, authenticated;

create or replace function public.create_my_account(
  p_role public.app_role, p_name text, p_document text, p_whatsapp text, p_terms_version text,
  p_adult boolean, p_contact_name text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_user auth.users;
  v_digits text := regexp_replace(coalesce(p_document, ''), '[^0-9]', '', 'g');
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
end;
$$;
revoke all on function public.create_my_account(public.app_role, text, text, text, text, boolean, text)
  from public, anon;
grant execute on function public.create_my_account(public.app_role, text, text, text, text, boolean, text)
  to authenticated;

alter table public.companies drop column if exists contact_name;
