-- Z12 (+ X09) — Fotos de perfil, capa e logo salvas no Storage, e o banco só aceita imagens do próprio
-- Storage, na pasta de quem é dono.
--   * app_config.storage_public_base: o endereço público do Storage deste projeto (troque no staging);
--   * storage_url_ok(url, bucket, dono): a URL é deste projeto, do bucket certo e da pasta do dono;
--   * gatilhos em workers (photo_url, cover_url), companies (logo_url, cover_url), worker_posts
--     (media_url) e jobs (photos) recusam qualquer outra URL;
--   * Storage: ninguém lista arquivos (os buckets são públicos para abrir uma foto pelo endereço, sem
--     política de leitura que permita listar); cada conta só envia, troca e apaga na própria pasta; fotos
--     de vaga só por conta de construtora; limites de tamanho e tipo por bucket.
-- Idempotente.

create table if not exists public.app_config (
  key text primary key,
  value text not null
);
alter table public.app_config enable row level security;
revoke all on table public.app_config from anon, authenticated;

insert into public.app_config (key, value)
values ('storage_public_base', 'https://ppnxdajiihsjaojxokzh.supabase.co/storage/v1/object/public/')
on conflict (key) do nothing;

create or replace function public.storage_url_ok(p_url text, p_bucket text, p_owner uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_url is null or p_url = '' or (
    p_owner is not null
    and starts_with(p_url, (select value from public.app_config where key = 'storage_public_base') || p_bucket || '/' || p_owner::text || '/')
    and p_url !~ '\.\.'
  )
$$;

create or replace function public.check_profile_images_v2()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'workers' then
    if (new.photo_url is distinct from old.photo_url and not public.storage_url_ok(new.photo_url, 'avatars', new.id))
       or (new.cover_url is distinct from old.cover_url and not public.storage_url_ok(new.cover_url, 'avatars', new.id)) then
      raise exception using errcode = 'BC422', message = 'Essa foto não foi enviada pelo app. Escolha de novo.';
    end if;
  elsif tg_table_name = 'companies' then
    if (new.logo_url is distinct from old.logo_url and not public.storage_url_ok(new.logo_url, 'avatars', new.id))
       or (new.cover_url is distinct from old.cover_url and not public.storage_url_ok(new.cover_url, 'avatars', new.id)) then
      raise exception using errcode = 'BC422', message = 'Essa foto não foi enviada pelo app. Escolha de novo.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists check_worker_images_v2 on public.workers;
create trigger check_worker_images_v2 before update of photo_url, cover_url on public.workers
  for each row execute function public.check_profile_images_v2();
drop trigger if exists check_company_images_v2 on public.companies;
create trigger check_company_images_v2 before update of logo_url, cover_url on public.companies
  for each row execute function public.check_profile_images_v2();

create or replace function public.check_post_media_v2()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.storage_url_ok(new.media_url, 'portfolio', new.worker_id) then
    raise exception using errcode = 'BC422', message = 'Esse arquivo não foi enviado pelo app. Escolha de novo.';
  end if;
  return new;
end;
$$;
drop trigger if exists check_post_media_v2 on public.worker_posts;
create trigger check_post_media_v2 before insert or update of media_url on public.worker_posts
  for each row execute function public.check_post_media_v2();

create or replace function public.check_job_photos_v2()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  u text;
begin
  if tg_op = 'UPDATE' and new.photos is not distinct from old.photos then return new; end if;
  foreach u in array coalesce(new.photos, '{}') loop
    if not public.storage_url_ok(u, 'vagas', new.company_id) then
      raise exception using errcode = 'BC422', message = 'Essa foto não foi enviada pelo app. Escolha de novo.';
    end if;
  end loop;
  if cardinality(coalesce(new.photos, '{}')) > 8 then
    raise exception using errcode = 'BC422', message = 'Uma vaga tem até 8 fotos.';
  end if;
  return new;
end;
$$;
drop trigger if exists check_job_photos_v2 on public.jobs;
create trigger check_job_photos_v2 before insert or update of photos on public.jobs
  for each row execute function public.check_job_photos_v2();

revoke all on function
  public.storage_url_ok(text, text, uuid), public.check_profile_images_v2(), public.check_post_media_v2(),
  public.check_job_photos_v2()
from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------------------------------

update storage.buckets set file_size_limit = 10485760,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
 where id = 'avatars';
update storage.buckets set file_size_limit = 52428800,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm']
 where id = 'portfolio';
update storage.buckets set file_size_limit = 10485760,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
 where id = 'vagas';

-- Sem listagem: abrir a foto pelo endereço público não depende de política.
drop policy if exists "Avatar publico para leitura" on storage.objects;
drop policy if exists "Portfolio publico para leitura (storage)" on storage.objects;
drop policy if exists "Fotos de vaga públicas para leitura" on storage.objects;

-- Avatares e capas: cada conta na própria pasta (só contas logadas).
drop policy if exists "Cada um envia seu proprio avatar" on storage.objects;
drop policy if exists "Cada um atualiza seu proprio avatar" on storage.objects;
drop policy if exists "Cada um remove seu proprio avatar" on storage.objects;
create policy "Cada um envia seu proprio avatar" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Cada um atualiza seu proprio avatar" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Cada um remove seu proprio avatar" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Portfólio: só trabalhador, na própria pasta.
drop policy if exists "Cada um envia seu proprio portfolio" on storage.objects;
drop policy if exists "Cada um remove seu proprio portfolio" on storage.objects;
create policy "Cada um envia seu proprio portfolio" on storage.objects for insert to authenticated
  with check (bucket_id = 'portfolio' and (storage.foldername(name))[1] = (select auth.uid())::text
              and (select public.my_worker_id()) is not null);
create policy "Cada um remove seu proprio portfolio" on storage.objects for delete to authenticated
  using (bucket_id = 'portfolio' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Fotos de vaga: só construtora, na própria pasta.
drop policy if exists "Construtora envia foto da própria vaga" on storage.objects;
create policy "Construtora envia foto da própria vaga" on storage.objects for insert to authenticated
  with check (bucket_id = 'vagas' and (storage.foldername(name))[1] = (select auth.uid())::text
              and (select public.my_company_id()) is not null);
