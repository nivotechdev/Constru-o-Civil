-- Z09 — O CPF/CNPJ não fica em texto puro nos metadados do Auth (auth.users.raw_user_meta_data).
-- O cadastro manda o documento nos metadados (é o único jeito de o gatilho recebê-lo junto com a conta).
-- Agora o gatilho que roda antes de gravar a conta tira o documento dos metadados e o guarda só durante a
-- transação (configuração local); o gatilho seguinte cifra e grava em accounts. O documento nunca chega a
-- ser gravado em auth.users. As contas que já existiam têm a chave removida.
-- Idempotente.

create or replace function public.claim_document_v2()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_digits text := regexp_replace(coalesce(new.raw_user_meta_data->>'documento', ''), '[^0-9]', '', 'g');
begin
  if length(v_digits) > 0 then
    perform public.claim_document_for(new.id, v_digits);
  end if;
  -- Só nesta transação (o cadastro): handle_new_user_v2 lê e apaga.
  perform set_config('bicos.cadastro_documento', v_digits, true);
  new.raw_user_meta_data := coalesce(new.raw_user_meta_data, '{}'::jsonb) - 'documento';
  return new;
end;
$$;

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

revoke all on function public.claim_document_v2(), public.handle_new_user_v2() from public, anon, authenticated;

-- As contas que já existem: o documento já está cifrado (accounts.document_cipher ou, nas antigas,
-- profiles.documento_cifrado). Tira a cópia em texto puro dos metadados.
update auth.users
   set raw_user_meta_data = raw_user_meta_data - 'documento'
 where raw_user_meta_data ? 'documento';
