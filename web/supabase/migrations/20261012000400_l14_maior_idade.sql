-- L14: os termos exigem 18 anos ou mais. O cadastro com lado definido precisa trazer a confirmação
-- ("Tenho 18 anos ou mais") nos metadados; sem ela, o Auth recusa.

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
  if v_role is not null and not public.document_valid_for(v_role, v_digits) then
    raise exception using errcode = 'BC422', message = 'Documento inválido.';
  end if;
  if v_role is not null and not public.whatsapp_valid(m->>'whatsapp') then
    raise exception using errcode = 'BC422', message = 'WhatsApp inválido.';
  end if;
  if v_role is not null and coalesce(m->>'maior_de_idade', '') <> 'true' then
    raise exception using errcode = 'BC422', message = 'A Bicos é só para maiores de 18 anos.';
  end if;
  if length(v_digits) > 0 then
    perform public.claim_document_for(new.id, v_digits);
  end if;
  perform set_config('bicos.cadastro_documento', v_digits, true);
  new.raw_user_meta_data := m - 'documento';
  return new;
end;
$$;

revoke all on function public.claim_document_v2() from public, anon, authenticated;
