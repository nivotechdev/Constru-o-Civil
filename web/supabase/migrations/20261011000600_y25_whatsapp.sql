-- Y25: trocar o WhatsApp (trabalhador e construtora) com validação e, quando o envio de código estiver
-- ligado, confirmação por código.
--
-- - whatsapp_valid: celular com DDD, 11 números (DDD sem zero, começa com 9).
-- - O cadastro recusa WhatsApp inválido (gatilho do Auth).
-- - change_whatsapp: a única forma de trocar o número (a coluna companies.whatsapp deixa de ser editável
--   direto). Trocar zera accounts.whatsapp_verified_at, a não ser que o número novo tenha acabado de ser
--   confirmado por código.
-- - whatsapp_verifications: números confirmados por código nos últimos 30 minutos (só a Edge Function
--   codigo-whatsapp grava, com service_role, por mark_whatsapp_verified). Serve tanto para a troca quanto
--   para o cadastro (o código é conferido antes de a conta existir).

create or replace function public.whatsapp_valid(p_phone text)
returns boolean language sql immutable set search_path = public as $$
  select regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g') ~ '^[1-9][1-9]9[0-9]{8}$'
$$;

create table if not exists public.whatsapp_verifications (
  phone text primary key,
  verified_at timestamptz not null default now()
);
alter table public.whatsapp_verifications enable row level security;
revoke all on public.whatsapp_verifications from anon, authenticated;

create or replace function public.whatsapp_recently_verified(p_phone text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.whatsapp_verifications
     where phone = regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g')
       and verified_at > now() - interval '30 minutes')
$$;

-- Chamado pela Edge Function depois que o provedor aprovou o código.
create or replace function public.mark_whatsapp_verified(p_phone text, p_user uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_phone text := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
begin
  insert into public.whatsapp_verifications (phone, verified_at) values (v_phone, now())
  on conflict (phone) do update set verified_at = now();
  if p_user is not null then
    update public.accounts set whatsapp_verified_at = now() where id = p_user and whatsapp = v_phone;
  end if;
end;
$$;

-- A conta nova já nasce com o número confirmado se o código foi conferido no cadastro.
create or replace function public.accounts_whatsapp_verified()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.whatsapp_verified_at is null and public.whatsapp_recently_verified(new.whatsapp) then
    new.whatsapp_verified_at := now();
  end if;
  return new;
end;
$$;
drop trigger if exists accounts_whatsapp_verified on public.accounts;
create trigger accounts_whatsapp_verified before insert on public.accounts
  for each row execute function public.accounts_whatsapp_verified();

create or replace function public.change_whatsapp(p_whatsapp text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_phone text := regexp_replace(coalesce(p_whatsapp, ''), '[^0-9]', '', 'g');
  v_account public.accounts;
  v_verified timestamptz;
begin
  select * into v_account from public.accounts where id = auth.uid() for update;
  if not found then
    raise exception using errcode = 'BC401', message = 'Entre na sua conta de novo para continuar.';
  end if;
  if not public.whatsapp_valid(v_phone) then
    raise exception using errcode = 'BC422', message = 'Confira o número: celular com DDD, 11 números.';
  end if;
  if v_phone = v_account.whatsapp then
    return jsonb_build_object('whatsapp', v_phone, 'verified_at', v_account.whatsapp_verified_at);
  end if;
  v_verified := case when public.whatsapp_recently_verified(v_phone) then now() end;
  if v_account.worker_id is not null then
    update public.workers set whatsapp = v_phone where id = v_account.worker_id;
  else
    update public.companies set whatsapp = v_phone where id = v_account.company_id;
  end if;
  update public.accounts set whatsapp = v_phone, whatsapp_verified_at = v_verified where id = v_account.id;
  -- O código vale uma vez.
  delete from public.whatsapp_verifications where phone = v_phone;
  return jsonb_build_object('whatsapp', v_phone, 'verified_at', v_verified);
end;
$$;

-- O cadastro: além do documento (Y17), o WhatsApp precisa ser um celular válido.
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
  if length(v_digits) > 0 then
    perform public.claim_document_for(new.id, v_digits);
  end if;
  perform set_config('bicos.cadastro_documento', v_digits, true);
  new.raw_user_meta_data := m - 'documento';
  return new;
end;
$$;

-- A limpeza diária também tira as confirmações velhas.
create or replace function public.purge_auth_attempts()
returns integer language plpgsql security definer set search_path = public as $$
declare
  n integer;
begin
  with x as (delete from public.auth_attempts where at < now() - interval '1 day' returning 1)
  select count(*)::int into n from x;
  delete from public.whatsapp_verifications where verified_at < now() - interval '1 day';
  return n;
end;
$$;

revoke update (whatsapp) on public.companies from authenticated;
revoke all on function
  public.whatsapp_recently_verified(text), public.mark_whatsapp_verified(text, uuid),
  public.accounts_whatsapp_verified(), public.claim_document_v2(), public.purge_auth_attempts(),
  public.change_whatsapp(text)
from public, anon, authenticated;
grant execute on function public.change_whatsapp(text) to authenticated;
grant execute on function public.whatsapp_valid(text) to authenticated, service_role;
grant execute on function public.mark_whatsapp_verified(text, uuid) to service_role;
