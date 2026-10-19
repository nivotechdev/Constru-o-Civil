-- L07 (lançamento) — PENDENTE: apaga os dados e o código do app antigo (desligado no Z08).
--
-- ⚠ NÃO está em migrations/ de propósito: só entra com o "pode" do responsável, e DEPOIS de:
--   1. backup do banco (plano Free não tem backup diário — Database › Backups ou pg_dump);
--   2. exportar as tabelas antigas com  ./scripts/exportar-app-antigo.sh  e guardar o arquivo fora do repositório.
-- Para aplicar: mover este arquivo para supabase/migrations/, rodar `node scripts/aplicar-tudo.mjs` e
-- `npm run gen:types`, aplicar no staging, conferir, e só então na produção.
--
-- O que sai: as tabelas profiles, vagas, candidaturas, avaliacoes, vagas_salvas, publicacoes_trabalhador e
-- consentimentos (os aceites já foram copiados para terms_acceptances na lanc07_aceites); o gatilho
-- on_auth_user_created, que ainda copiava cada cadastro novo (nome, e-mail e documento cifrado) para `profiles`;
-- as funções do app antigo; e os ramos "conta do app antigo" das funções de documento.
--
-- O que FICA: a chave do Vault `nivotech_documento_key`. Ela não é só do app antigo — cifra o CPF/CNPJ das
-- contas atuais (accounts.document_cipher). Apagá-la tornaria esses documentos ilegíveis para sempre.

-- 0. Ninguém do app antigo fica sem conta no app novo (em 15/10/2026: 4 perfis, 4 com conta nova).
do $$
begin
  if to_regclass('public.profiles') is not null and exists (
    select 1 from public.profiles p join auth.users u on u.id = p.id
     where not exists (select 1 from public.accounts a where a.id = p.id)
  ) then
    raise exception 'Há perfis do app antigo sem conta no app novo. Migre (account_from_old_profile) antes de apagar.';
  end if;
end $$;

-- 1. O cadastro para de copiar dados para o app antigo.
drop trigger if exists on_auth_user_created on auth.users;

-- 2. Funções de documento sem o ramo do app antigo.
create or replace function public.claim_document_for(p_user_id uuid, p_digits text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  v_hash text := public.document_hash(p_digits);
  r record;
begin
  for r in
    select a.id, u.email_confirmed_at from public.accounts a join auth.users u on u.id = a.id
     where a.document_hash = v_hash and a.id <> p_user_id
  loop
    if r.email_confirmed_at is not null then
      raise exception using errcode = 'BC409', message = 'Documento já cadastrado.';
    end if;
    delete from auth.users where id = r.id;  -- cadastro nunca confirmado: libera o documento
  end loop;
end;
$$;

create or replace function public.document_available(p_document text)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select length(regexp_replace(coalesce(p_document, ''), '[^0-9]', '', 'g')) in (11, 14)
     and not exists (select 1 from public.accounts where document_hash = public.document_hash(p_document))
$$;

create or replace function public.document_login_email(p_document text, p_password text)
returns text language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_user auth.users;
begin
  select u.* into v_user from public.accounts a join auth.users u on u.id = a.id
   where a.document_hash = public.document_hash(p_document);
  if v_user.id is null or v_user.encrypted_password is null or v_user.encrypted_password = ''
     or extensions.crypt(coalesce(p_password, ''), v_user.encrypted_password) <> v_user.encrypted_password then
    return null;
  end if;
  return v_user.email;
end;
$$;

create or replace function public.ensure_my_account()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception using errcode = 'BC401', message = 'Entre na sua conta de novo para continuar.';
  end if;
  if not exists (select 1 from public.accounts where id = auth.uid()) then
    raise exception using errcode = 'BC404', message = 'Não achamos o cadastro dessa conta. Crie uma conta nova.';
  end if;
end;
$$;

-- 3. As funções do app antigo (todas as assinaturas de cada nome).
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname in (
       'account_from_old_profile', 'buscar_perfis', 'concluir_candidatura', 'contato_whatsapp',
       'criar_perfil_ao_cadastrar', 'decidir_candidatura', 'excluir_minha_conta', 'expirar_vagas_vencidas',
       'exportar_meus_dados', 'fechar_vaga', 'meu_documento', 'meu_tipo', 'perfil_publico', 'postar_avaliacao',
       'reiniciar_cadastro_pendente_documento', 'salvar_documento')
  loop
    execute format('drop function %s', f.sig);
  end loop;
end $$;

-- 4. As tabelas (e o que só elas usavam).
drop table if exists public.publicacoes_trabalhador, public.vagas_salvas, public.avaliacoes, public.candidaturas,
  public.consentimentos, public.vagas, public.profiles cascade;
