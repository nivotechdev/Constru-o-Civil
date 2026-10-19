-- Fase 5 do front novo (Bicos): portfólio do trabalhador (fotos/vídeos dos
-- próprios bicos, estilo Instagram, exibido no perfil público). Bucket
-- separado do "avatars" porque aceita vídeo e tem outro propósito de acesso.
--
-- Reverter:
--   drop table if exists public.publicacoes_trabalhador;
--   delete from storage.objects where bucket_id = 'portfolio';
--   delete from storage.buckets where id = 'portfolio';

create table if not exists public.publicacoes_trabalhador (
  id uuid primary key default gen_random_uuid(),
  trabalhador_id uuid not null references public.profiles(id) on delete cascade,
  midia_url text not null,
  midia_tipo text not null check (midia_tipo in ('imagem', 'video')),
  legenda text,
  criado_em timestamptz not null default now()
);

comment on table public.publicacoes_trabalhador is 'Portfólio (fotos/vídeos) que um trabalhador publica no próprio perfil público.';

create index if not exists publicacoes_trabalhador_idx on public.publicacoes_trabalhador (trabalhador_id, criado_em desc);

alter table public.publicacoes_trabalhador enable row level security;

drop policy if exists "Portfolio publico para leitura" on public.publicacoes_trabalhador;
create policy "Portfolio publico para leitura"
  on public.publicacoes_trabalhador for select
  using (auth.role() = 'authenticated' and email_verificado());

drop policy if exists "Trabalhador publica no proprio portfolio" on public.publicacoes_trabalhador;
create policy "Trabalhador publica no proprio portfolio"
  on public.publicacoes_trabalhador for insert
  with check (trabalhador_id = auth.uid());

drop policy if exists "Trabalhador apaga o proprio post" on public.publicacoes_trabalhador;
create policy "Trabalhador apaga o proprio post"
  on public.publicacoes_trabalhador for delete
  using (trabalhador_id = auth.uid());

-- Bucket "portfolio": mesmo padrão de pasta-por-usuário do bucket "avatars"
-- já existente (leitura pública, escrita só na própria pasta {uid}/...).
insert into storage.buckets (id, name, public)
values ('portfolio', 'portfolio', true)
on conflict (id) do nothing;

drop policy if exists "Portfolio publico para leitura (storage)" on storage.objects;
create policy "Portfolio publico para leitura (storage)"
  on storage.objects for select
  using (bucket_id = 'portfolio');

drop policy if exists "Cada um envia seu proprio portfolio" on storage.objects;
create policy "Cada um envia seu proprio portfolio"
  on storage.objects for insert
  with check (bucket_id = 'portfolio' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Cada um remove seu proprio portfolio" on storage.objects;
create policy "Cada um remove seu proprio portfolio"
  on storage.objects for delete
  using (bucket_id = 'portfolio' and (storage.foldername(name))[1] = auth.uid()::text);
