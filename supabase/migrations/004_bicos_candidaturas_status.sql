-- Fase 3 do front novo (Bicos): funil de status da candidatura (o front
-- antigo só sabia "existe candidatura ou não existe"). Valores EXATOS abaixo
-- são usados literalmente pela UI nova (app/js/utils/applicationStatus.js) —
-- não traduzir nem mudar a grafia.
--
-- Aditivo: linhas existentes caem em 'enviada', que já é verdade pra elas
-- (existem, nada mais foi registrado sobre elas até hoje).
--
-- Reverter: alter table public.candidaturas drop column status;
--           drop policy "Trabalhador cancela a propria candidatura" on public.candidaturas;

alter table public.candidaturas
  add column if not exists status text not null default 'enviada'
  check (status in ('enviada', 'em_analise', 'pre_selecionado', 'contratado', 'concluida', 'avaliada', 'nao_selecionado'));

comment on column public.candidaturas.status is
  'Funil: enviada -> em_analise -> pre_selecionado -> contratado -> concluida -> avaliada, '
  'com nao_selecionado como rejeição terminal a qualquer momento. Só é alterada pelas RPCs '
  'decidir_candidatura/fechar_vaga/concluir_candidatura (nunca por update direto do cliente).';

-- O trabalhador pode desistir enquanto a candidatura ainda não foi decidida
-- pela construtora — depois disso (pré-selecionado em diante), só a própria
-- construtora decide via RPC.
drop policy if exists "Trabalhador cancela a propria candidatura" on public.candidaturas;
create policy "Trabalhador cancela a propria candidatura"
  on public.candidaturas for delete
  using (candidato_id = auth.uid() and status in ('enviada', 'em_analise'));
