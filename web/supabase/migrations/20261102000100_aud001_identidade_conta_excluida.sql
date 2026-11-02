-- AUD-001: a selfie e o documento de uma conta que já não existe saem do Storage sem esperar 1 dia.
-- A Edge Function excluir-conta agora apaga a pasta `identidade/<id>/`; este ajuste cobre a exclusão pelo painel
-- (sem passar pela função), em que o arquivo ficava 1 dia à espera da limpeza diária. Arquivo de dono que ainda
-- existe segue a regra de antes (1 dia para dar tempo de gravar o envio). Idempotente.

create or replace function public.orphan_storage_objects(p_limit integer default 500)
returns table (bucket text, name text)
language sql stable security definer set search_path = public as $$
  with base as (
    select coalesce((select value from public.app_config where key = 'storage_public_base'), '') as url
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
