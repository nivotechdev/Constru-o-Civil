-- Fase 5 do front novo (Bicos): avaliações (trabalhador avalia a construtora
-- ao concluir a diária — único fluxo de avaliação que a tela realmente
-- implementa; "avaliar o trabalhador", mencionado como rótulo em
-- History.js, nunca teve uma tela própria no design original).
--
-- Leitura é pública (qualquer autenticado/verificado vê a reputação de
-- qualquer perfil, igual perfil_publico) — só a ESCRITA é restrita a quem
-- realmente participou da candidatura, e só depois de concluída.
--
-- Reverter: drop table if exists public.avaliacoes;

create table if not exists public.avaliacoes (
  id uuid primary key default gen_random_uuid(),
  candidatura_id uuid not null references public.candidaturas(id) on delete cascade,
  avaliador_id uuid not null references public.profiles(id) on delete cascade,
  avaliado_id uuid not null references public.profiles(id) on delete cascade,
  nota int not null check (nota between 1 and 5),
  comentario text,
  criado_em timestamptz not null default now(),
  unique (candidatura_id, avaliador_id)
);

comment on table public.avaliacoes is 'Avaliação de uma parte sobre a outra, após a diária concluída.';

create index if not exists avaliacoes_avaliado_idx on public.avaliacoes (avaliado_id);

alter table public.avaliacoes enable row level security;

drop policy if exists "Qualquer autenticado ve avaliacoes" on public.avaliacoes;
create policy "Qualquer autenticado ve avaliacoes"
  on public.avaliacoes for select
  using (auth.role() = 'authenticated' and email_verificado());

-- Sem policy de insert direto — só a RPC postar_avaliacao() (SECURITY
-- DEFINER, migração seguinte) grava aqui, depois de conferir participação
-- e status da candidatura. Sem policy de update/delete: avaliação é definitiva.
