-- AUD-019: o "hash do documento" era SHA-256 sem segredo: com a coluna accounts.document_hash (banco, cópia de
-- segurança) os CPFs saem em minutos, o que anula a cifra de document_cipher. Agora, com a chave do Vault
-- `nivotech_documento_pepper` (diferente da de cifra), document_hash é HMAC-SHA256. SEM a chave criada, tudo segue como
-- antes (SHA-256), para a migration não derrubar nada: a troca acontece quando o responsável cria a chave e roda
-- `select public.rehash_document_hashes();` (recalcula as contas a partir de document_cipher, na mesma sessão).
-- A máscara do CPF mostra só os 2 últimos dígitos (antes, 6): vale para contas novas e, nas que já existem, quando
-- rehash_document_hashes() rodar. Idempotente.

create or replace function public.document_hash(p_document text)
returns text language plpgsql stable set search_path = public, extensions as $$
declare
  v_digits text := regexp_replace(coalesce(p_document, ''), '[^0-9]', '', 'g');
  v_pepper text;
begin
  if to_regnamespace('vault') is not null then
    execute 'select decrypted_secret from vault.decrypted_secrets where name = $1' into v_pepper
      using 'nivotech_documento_pepper';
  end if;
  if v_pepper is null then
    return encode(extensions.digest(v_digits, 'sha256'), 'hex');
  end if;
  return encode(extensions.hmac(v_digits, v_pepper, 'sha256'), 'hex');
end;
$$;

create or replace function public.mask_document(p_digits text)
returns text language sql immutable set search_path = public as $$
  select case
    when length(p_digits) = 11 then '***.***.***-' || substr(p_digits, 10, 2)
    when length(p_digits) = 14 then substr(p_digits, 1, 2) || '.' || substr(p_digits, 3, 3) || '.' ||
                                    substr(p_digits, 6, 3) || '/****-**'
    else ''
  end
$$;

-- Recalcula document_hash e a máscara de cada conta a partir de document_cipher. Só service_role (SQL Editor).
-- Devolve quantas contas recalculou; sem a chave de cifra ou sem a chave do hash, não faz nada (devolve 0).
create or replace function public.rehash_document_hashes()
returns integer language plpgsql security definer set search_path = public, extensions as $$
declare
  v_key text;
  v_pepper text;
  r record;
  v_doc text;
  n integer := 0;
begin
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'nivotech_documento_key';
  select decrypted_secret into v_pepper from vault.decrypted_secrets where name = 'nivotech_documento_pepper';
  if v_key is null or v_pepper is null then
    return 0;
  end if;
  for r in select id, document_cipher from public.accounts where document_cipher is not null loop
    v_doc := regexp_replace(extensions.pgp_sym_decrypt(r.document_cipher, v_key), '[^0-9]', '', 'g');
    update public.accounts
       set document_hash = public.document_hash(v_doc), document = public.mask_document(v_doc)
     where id = r.id;
    n := n + 1;
  end loop;
  return n;
end;
$$;
revoke all on function public.rehash_document_hashes() from public, anon, authenticated;
grant execute on function public.rehash_document_hashes() to service_role;
