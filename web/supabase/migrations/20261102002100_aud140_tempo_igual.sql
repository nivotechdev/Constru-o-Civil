-- AUD-140 — o login por CPF/CNPJ respondia 140 vezes mais devagar quando o documento tinha conta (só então conferia a senha
-- com bcrypt), o que revelava quais documentos têm conta. Agora a conta que não existe também gasta uma conferência
-- bcrypt contra um hash fixo. Idempotente.

CREATE OR REPLACE FUNCTION public.document_login_email(p_document text, p_password text)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_hash text := public.document_hash(p_document);
  v_user auth.users;
begin
  select u.* into v_user from public.accounts a join auth.users u on u.id = a.id where a.document_hash = v_hash;
  if v_user.id is null then
    -- Conta do app antigo ainda sem conta nova (o hash do documento é o mesmo).
    select u.* into v_user from public.profiles p join auth.users u on u.id = p.id
     where p.documento_hash = v_hash
     order by u.email_confirmed_at desc nulls last limit 1;
  end if;
  if v_user.id is null then
    -- AUD-140: conta que não existe gasta o mesmo tempo de uma senha errada (uma conferência bcrypt), para o tempo da
    -- resposta não revelar se o documento tem conta.
    perform extensions.crypt(coalesce(p_password, ''), '$2a$10$DDLb6h3pZuW2JLYpc11QHeXgO05MZKU2aq1yMhKdQpe2fuyCCdE4q');
    return null;
  end if;
  if v_user.encrypted_password is null or v_user.encrypted_password = ''
     or extensions.crypt(coalesce(p_password, ''), v_user.encrypted_password) <> v_user.encrypted_password then
    return null;
  end if;
  return v_user.email;
end;
$function$;
