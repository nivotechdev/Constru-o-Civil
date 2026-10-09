-- Z07 — Ninguém descobre quem tem conta pelo CPF/CNPJ.
--   * document_available deixa de ser chamável pelo app (visitante ou logado): era um oráculo grátis.
--   * O cadastro confere o documento dentro da própria criação da conta (gatilho do Auth). Documento de
--     conta confirmada: o cadastro falha e o app mostra uma mensagem genérica. Documento preso num
--     cadastro nunca confirmado: o cadastro antigo é liberado (o que reiniciar_cadastro_pendente_* fazia,
--     mas só dentro de um cadastro de verdade, com captcha e o limite do Auth).
--   * Entrar com CPF/CNPJ: a Edge Function confere a senha aqui (document_login_email) e só então devolve
--     o e-mail da própria conta; o navegador entra com e-mail e senha (do IP de quem está entrando).
--     Uma resposta só para "não existe" e "senha errada", e limite de tentativas por documento e por IP
--     (auth_attempts).
-- Idempotente.

revoke all on function public.document_available(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------
-- Limite de tentativas
-- ---------------------------------------------------------------------------------------------------

create table if not exists public.auth_attempts (
  id bigint generated always as identity primary key,
  key text not null,
  at timestamptz not null default now()
);
create index if not exists auth_attempts_key_at_idx on public.auth_attempts (key, at desc);
alter table public.auth_attempts enable row level security;
revoke all on table public.auth_attempts from anon, authenticated;

-- Registra uma tentativa e diz se passou do limite (mais de p_max na janela).
create or replace function public.rate_limit_hit(p_key text, p_max integer, p_window interval)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  n integer;
begin
  insert into public.auth_attempts (key) values (p_key);
  select count(*) into n from public.auth_attempts where key = p_key and at > now() - p_window;
  return n > p_max;
end;
$$;

-- Limpeza diária das tentativas antigas.
create or replace function public.purge_auth_attempts()
returns integer language sql security definer set search_path = public as $$
  with x as (delete from public.auth_attempts where at < now() - interval '1 day' returning 1)
  select count(*)::int from x
$$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'bicos-limpar-tentativas';
    perform cron.schedule('bicos-limpar-tentativas', '17 4 * * *', 'select public.purge_auth_attempts()');
  end if;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- Entrar com CPF/CNPJ: o e-mail da conta só sai com a senha certa
-- ---------------------------------------------------------------------------------------------------

create or replace function public.document_login_email(p_document text, p_password text)
returns text language plpgsql stable security definer set search_path = public, extensions as $$
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
  if v_user.id is null or v_user.encrypted_password is null or v_user.encrypted_password = ''
     or extensions.crypt(coalesce(p_password, ''), v_user.encrypted_password) <> v_user.encrypted_password then
    return null;
  end if;
  return v_user.email;
end;
$$;

-- ---------------------------------------------------------------------------------------------------
-- O cadastro confere o documento (dentro do gatilho do Auth)
-- ---------------------------------------------------------------------------------------------------

create or replace function public.claim_document_for(p_user_id uuid, p_digits text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  v_hash text := public.document_hash(p_digits);
  r record;
begin
  -- Contas do app novo com o mesmo documento.
  for r in
    select a.id, u.email_confirmed_at from public.accounts a join auth.users u on u.id = a.id
     where a.document_hash = v_hash and a.id <> p_user_id
  loop
    if r.email_confirmed_at is not null then
      raise exception using errcode = 'BC409', message = 'Documento já cadastrado.';
    end if;
    delete from auth.users where id = r.id;  -- cadastro nunca confirmado: libera o documento
  end loop;
  -- Perfis do app antigo com o mesmo documento.
  for r in
    select p.id, u.email_confirmed_at from public.profiles p join auth.users u on u.id = p.id
     where p.documento_hash = v_hash and p.id <> p_user_id
  loop
    if r.email_confirmed_at is not null then
      raise exception using errcode = 'BC409', message = 'Documento já cadastrado.';
    end if;
    delete from auth.users where id = r.id;
  end loop;
end;
$$;

-- Antes de o Auth gravar a conta (e antes do gatilho do app antigo, que recusaria o documento repetido
-- com um erro de chave única): libera o documento de cadastro nunca confirmado ou recusa o cadastro.
create or replace function public.claim_document_v2()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_digits text := regexp_replace(coalesce(new.raw_user_meta_data->>'documento', ''), '[^0-9]', '', 'g');
begin
  if length(v_digits) > 0 then
    perform public.claim_document_for(new.id, v_digits);
  end if;
  return new;
end;
$$;

drop trigger if exists before_auth_user_created_v2 on auth.users;
create trigger before_auth_user_created_v2
  before insert on auth.users
  for each row execute function public.claim_document_v2();

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

revoke all on function
  public.rate_limit_hit(text, integer, interval), public.purge_auth_attempts(),
  public.document_login_email(text, text), public.claim_document_for(uuid, text), public.claim_document_v2(),
  public.create_account_for(uuid, text, public.app_role, text, text, text, text, timestamptz)
from public, anon, authenticated;
grant execute on function
  public.rate_limit_hit(text, integer, interval), public.document_login_email(text, text),
  public.document_available(text)
to service_role;
