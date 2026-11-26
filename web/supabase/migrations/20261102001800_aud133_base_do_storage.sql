-- AUD-133 — se a linha `storage_public_base` do app_config faltar (ou estiver errada), a conferência das fotos
-- deixava passar qualquer endereço e a limpeza diária apagava todas as fotos (nada batia com o endereço vazio).
-- Agora as duas funções recusam com erro claro (e o erro chega ao monitor). Idempotente.

create or replace function public.storage_public_base()
returns text language plpgsql stable security definer set search_path = public as $$
declare
  v text := (select value from public.app_config where key = 'storage_public_base');
begin
  if v is null or v !~ '^https://.+/storage/v1/object/public/$' then
    raise exception 'app_config.storage_public_base ausente ou fora do formato https://<projeto>/storage/v1/object/public/';
  end if;
  return v;
end;
$$;
revoke all on function public.storage_public_base() from public, anon, authenticated;
grant execute on function public.storage_public_base() to service_role;

create or replace function public.storage_url_ok(p_url text, p_bucket text, p_owner uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_url is null or p_url = '' or (
    p_owner is not null
    and starts_with(p_url, public.storage_public_base() || p_bucket || '/' || p_owner::text || '/')
    and p_url !~ '\.\.'
  )
$$;

create or replace function public.orphan_storage_objects(p_limit integer default 500)
returns table (bucket text, name text)
language sql stable security definer set search_path = public as $$
  with base as (
    select public.storage_public_base() as url
  ),
  used as (
    select photo_url as u from public.workers where photo_url is not null
    union all select cover_url from public.workers where cover_url is not null
    union all select logo_url from public.companies where logo_url is not null
    union all select cover_url from public.companies where cover_url is not null
    union all select media_url from public.worker_posts where media_url is not null
    union all select unnest(photos) from public.jobs where photos is not null
  ),
  public_files as (
    select o.bucket_id::text as bucket, o.name::text as name
      from storage.objects o, base
     where o.bucket_id in ('avatars', 'portfolio', 'vagas')
       and o.created_at < now() - interval '1 day'
       and o.created_at >= timestamptz '2026-10-09'
       and not exists (select 1 from used where used.u = base.url || o.bucket_id || '/' || o.name)
  ),
  identity_files as (
    select o.bucket_id::text, o.name::text
      from storage.objects o
     where o.bucket_id = 'identidade'
       and (
         o.created_at < now() - interval '1 day'
         or not exists (select 1 from auth.users u where u.id::text = (storage.foldername(o.name))[1])
       )
       and not exists (
         select 1 from public.identity_submissions s
          where (s.selfie_path = o.name or s.document_path = o.name)
            and (s.decided_at is null or s.decided_at > now() - interval '30 days')
       )
  )
  select * from (select * from public_files union all select * from identity_files) f
   limit greatest(1, least(coalesce(p_limit, 500), 1000))
$$;
revoke all on function public.orphan_storage_objects(integer) from public, anon, authenticated;
grant execute on function public.orphan_storage_objects(integer) to service_role;
