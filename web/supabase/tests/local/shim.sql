-- O que a imagem supabase/postgres não traz e o projeto hospedado tem (o Auth e o Storage criam isso
-- nas próprias migrations). Só para o banco local de testes (supabase/tests/local/setup.sh).
alter table auth.users
  add column if not exists email_confirmed_at timestamptz,
  add column if not exists phone text,
  add column if not exists phone_confirmed_at timestamptz,
  add column if not exists banned_until timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists is_anonymous boolean not null default false;

create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim', true), ''),
                  nullif(current_setting('request.jwt.claims', true), ''))::jsonb
$$;
grant execute on function auth.jwt() to anon, authenticated, service_role;

create or replace function storage.foldername(name text) returns text[] language plpgsql immutable as $$
declare _parts text[];
begin
  select string_to_array(name, '/') into _parts;
  return _parts[1:array_length(_parts, 1) - 1];
end
$$;
grant execute on function storage.foldername(text) to anon, authenticated, service_role;
alter table storage.buckets
  add column if not exists public boolean default false,
  add column if not exists file_size_limit bigint,
  add column if not exists allowed_mime_types text[];

create extension if not exists pg_cron;
create extension if not exists postgis;
create extension if not exists pgcrypto with schema extensions;
select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'nivotech_documento_key');

-- Publicação do Realtime (o hospedado já tem).
do $$ begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

-- auth.uid()/auth.role() como no hospedado: leem o JSON de request.jwt.claims.
create or replace function auth.uid() returns uuid language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
                  (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid
$$;
create or replace function auth.role() returns text language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''),
                  (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'))::text
$$;
