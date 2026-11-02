-- AUD-061: cpf_valid, cnpj_valid, document_valid_for e whatsapp_valid eram executáveis por visitante (sem login). Quem
-- está logado continua usando; os gatilhos e as RPCs que as chamam são security definer e seguem como estavam.
-- AUD-072: o gatilho do app antigo (criar_perfil_ao_cadastrar) continuava copiando nome e e-mail de cada cadastro novo
-- para `profiles`; o app antigo foi desligado no Z08. O gatilho sai; as linhas que já existem ficam (nada é apagado
-- aqui). Idempotente.

revoke execute on function public.cpf_valid(text), public.cnpj_valid(text), public.whatsapp_valid(text)
  from public, anon;
revoke execute on function public.document_valid_for(public.app_role, text) from public, anon;
grant execute on function public.cpf_valid(text), public.cnpj_valid(text), public.whatsapp_valid(text)
  to authenticated, service_role;
grant execute on function public.document_valid_for(public.app_role, text) to authenticated, service_role;

drop trigger if exists on_auth_user_created on auth.users;
