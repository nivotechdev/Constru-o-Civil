-- X09: arquivos órfãos saem do Storage. Sobram arquivos quando um envio dá certo e a gravação depois não
-- (sinal caiu), quando uma vaga troca ou perde fotos, quando a vaga é excluída. E as fotos de identidade (F07)
-- não ficam guardadas além do necessário: 30 dias depois da decisão da equipe, saem.
--
-- * orphan_storage_objects(limite): o que pode ser apagado — arquivo com mais de 1 dia nos buckets avatars,
--   portfolio e vagas que nenhuma linha usa (perfil, capa, logo, post, fotos da vaga), e na `identidade`
--   o que não é de nenhum envio ou é de um envio decidido há mais de 30 dias. Só para service_role.
-- * O apagar de verdade é pela API do Storage (o arquivo e o registro): Edge Function `limpar-arquivos`,
--   chamada todo dia às 4h40 pelo pg_cron via pg_net (URL e segredo no Vault: bicos_cleanup_url,
--   bicos_cleanup_secret; sem eles, nada acontece).
-- Arquivos de antes do app novo (09/10/2026) ficam como estão (o app antigo os referenciava de outro jeito).
-- Idempotente.

alter table public.identity_submissions add column if not exists decided_at timestamptz;

-- A decisão da equipe marca o envio mais recente (para contar os 30 dias).
create or replace function public.mark_identity_decided()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.identity_status in ('verificado', 'recusado')
     and new.identity_status is distinct from old.identity_status then
    update public.identity_submissions s set decided_at = now()
     where s.worker_id = new.id and s.decided_at is null;
  end if;
  return new;
end;
$$;
revoke all on function public.mark_identity_decided() from public, anon, authenticated;
drop trigger if exists mark_identity_decided on public.workers;
create trigger mark_identity_decided after update of identity_status on public.workers
  for each row execute function public.mark_identity_decided();

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
       and o.created_at < now() - interval '1 day'
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

-- Chamada diária da Edge Function (sem esperar a resposta).
create or replace function public.call_storage_cleanup()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_url text;
  v_secret text;
begin
  if to_regnamespace('net') is null or to_regnamespace('vault') is null then
    return;
  end if;
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1' into v_url using 'bicos_cleanup_url';
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1' into v_secret using 'bicos_cleanup_secret';
  if v_url is null or v_secret is null then
    return;
  end if;
  execute 'select net.http_post(url := $1, body := $2, headers := $3)'
    using v_url, '{}'::jsonb, jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secret);
end;
$$;
revoke all on function public.call_storage_cleanup() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'bicos-limpar-arquivos';
    perform cron.schedule('bicos-limpar-arquivos', '40 4 * * *', 'select public.call_storage_cleanup()');
  end if;
end $$;
