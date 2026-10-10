-- F07: verificação de identidade do trabalhador (selfie + foto do documento). Estados: nao_enviado,
-- em_analise, verificado, recusado (com motivo). Os arquivos ficam no bucket PRIVADO `identidade`, na pasta
-- do próprio trabalhador; só ele envia e só a equipe (service_role) lê. O selo "Verificado" (workers.verified)
-- passa a significar exatamente isso.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('identidade', 'identidade', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Trabalhador envia a própria identidade" on storage.objects;
create policy "Trabalhador envia a própria identidade" on storage.objects for insert to authenticated
  with check (bucket_id = 'identidade' and (storage.foldername(name))[1] = (select auth.uid())::text
              and public.my_worker_id() is not null);
-- Sem política de select/update/delete para authenticated: ninguém lê os arquivos pelo app.

alter type public.notification_kind add value if not exists 'verificacao';

alter table public.workers
  add column if not exists identity_status text not null default 'nao_enviado',
  add column if not exists identity_reason text,
  add column if not exists identity_submitted_at timestamptz;
do $$ begin
  alter table public.workers add constraint workers_identity_status_check
    check (identity_status in ('nao_enviado', 'em_analise', 'verificado', 'recusado'));
exception when duplicate_object then null;
end $$;

create table if not exists public.identity_submissions (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.workers (id) on delete cascade,
  selfie_path text not null,
  document_path text not null,
  created_at timestamptz not null default now()
);
alter table public.identity_submissions enable row level security;
revoke all on public.identity_submissions from anon, authenticated;

-- O selo acompanha o status (quem já era "verificado" antes desta regra continua até a equipe revisar).
create or replace function public.sync_worker_verified()
returns trigger language plpgsql set search_path = public as $$
begin
  new.verified := new.identity_status = 'verificado';
  return new;
end;
$$;
drop trigger if exists workers_sync_verified on public.workers;
create trigger workers_sync_verified before update of identity_status on public.workers
  for each row execute function public.sync_worker_verified();
update public.workers set identity_status = 'verificado' where verified and identity_status = 'nao_enviado';

create or replace function public.submit_identity(p_selfie_path text, p_document_path text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_worker uuid := public.my_worker_id();
  v_prefix text := auth.uid()::text || '/';
begin
  if v_worker is null then
    raise exception using errcode = 'BC401', message = 'Só a conta de trabalhador verifica a identidade.';
  end if;
  if left(coalesce(p_selfie_path, ''), length(v_prefix)) <> v_prefix
     or left(coalesce(p_document_path, ''), length(v_prefix)) <> v_prefix then
    raise exception using errcode = 'BC422', message = 'Envie a selfie e a foto do documento de novo.';
  end if;
  if exists (select 1 from public.workers where id = v_worker and identity_status in ('em_analise', 'verificado')) then
    raise exception using errcode = 'BC409', message = 'Sua identidade já está em análise ou verificada.';
  end if;
  insert into public.identity_submissions (worker_id, selfie_path, document_path)
  values (v_worker, p_selfie_path, p_document_path);
  update public.workers set identity_status = 'em_analise', identity_reason = null, identity_submitted_at = now()
   where id = v_worker;
end;
$$;

-- O status e o motivo do próprio trabalhador.
create or replace function public.my_identity()
returns table (status text, reason text, submitted_at timestamptz)
language sql stable security definer set search_path = public as $$
  select identity_status, identity_reason, identity_submitted_at from public.workers where id = public.my_worker_id()
$$;

-- A equipe decide (painel do Supabase, service_role).
create or replace function public.set_identity_status(p_worker uuid, p_status text, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_status not in ('verificado', 'recusado') then
    raise exception using errcode = 'BC422', message = 'Status inválido.';
  end if;
  if p_status = 'recusado' and nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception using errcode = 'BC422', message = 'Diga o motivo da recusa.';
  end if;
  update public.workers set identity_status = p_status,
         identity_reason = case when p_status = 'recusado' then btrim(p_reason) end
   where id = p_worker;
  if not found then
    raise exception using errcode = 'BC404', message = 'Trabalhador não encontrado.';
  end if;
  perform public.notify(p_worker, null, 'verificacao',
    case when p_status = 'verificado' then 'Identidade verificada' else 'Não conseguimos verificar sua identidade' end,
    case when p_status = 'verificado' then 'O selo "Verificado" já aparece no seu perfil.'
         else 'Motivo: ' || btrim(p_reason) || '. Envie as fotos de novo.' end,
    '/perfil/verificar');
end;
$$;

grant select (identity_status) on public.workers to authenticated;
revoke all on function public.sync_worker_verified(), public.submit_identity(text, text), public.my_identity(),
  public.set_identity_status(uuid, text, text) from public, anon, authenticated;
grant execute on function public.submit_identity(text, text), public.my_identity() to authenticated;
grant execute on function public.set_identity_status(uuid, text, text) to service_role;
