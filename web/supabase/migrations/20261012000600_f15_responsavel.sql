-- F15: o nome de quem fala com os candidatos pela construtora ("Fale com Ana"). Vem do cadastro
-- (metadado `responsavel`) e é editável no perfil da empresa.

alter table public.companies add column if not exists contact_name text;
do $$ begin
  alter table public.companies add constraint companies_contact_name_length
    check (contact_name is null or char_length(btrim(contact_name)) between 2 and 60);
exception when duplicate_object then null;
end $$;
grant select (contact_name) on public.companies to authenticated;
grant update (contact_name) on public.companies to authenticated;

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
  v_contact text := nullif(btrim(left(coalesce(m->>'responsavel', ''), 60)), '');
begin
  perform set_config('bicos.cadastro_documento', '', true);
  -- Sem lado definido (ex.: login com Google): a conta nasce depois, em "Escolher perfil".
  if v_role is null then return new; end if;
  perform public.create_account_for(
    new.id, new.email, v_role, m->>'nome', v_document, m->>'whatsapp', m->>'terms_version',
    new.email_confirmed_at
  );
  if v_role = 'recrutador' and char_length(coalesce(v_contact, '')) >= 2 then
    update public.companies set contact_name = v_contact where id = new.id;
  end if;
  return new;
end;
$$;

revoke all on function public.handle_new_user_v2() from public, anon, authenticated;
