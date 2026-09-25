-- Fase 5 do front novo (Bicos): vagas salvas pelo trabalhador ("guardar pra
-- decidir depois", tela SavedJobs.js).
--
-- Reverter: drop table if exists public.vagas_salvas;

create table if not exists public.vagas_salvas (
  trabalhador_id uuid not null references public.profiles(id) on delete cascade,
  vaga_id uuid not null references public.vagas(id) on delete cascade,
  salva_em timestamptz not null default now(),
  primary key (trabalhador_id, vaga_id)
);

comment on table public.vagas_salvas is 'Vagas que um trabalhador marcou para decidir depois.';

alter table public.vagas_salvas enable row level security;

drop policy if exists "Trabalhador ve as proprias vagas salvas" on public.vagas_salvas;
create policy "Trabalhador ve as proprias vagas salvas"
  on public.vagas_salvas for select
  using (trabalhador_id = auth.uid());

drop policy if exists "Trabalhador salva vaga" on public.vagas_salvas;
create policy "Trabalhador salva vaga"
  on public.vagas_salvas for insert
  with check (trabalhador_id = auth.uid());

drop policy if exists "Trabalhador remove vaga salva" on public.vagas_salvas;
create policy "Trabalhador remove vaga salva"
  on public.vagas_salvas for delete
  using (trabalhador_id = auth.uid());
