-- Migração do front React (Bicos): duas colunas novas em `vagas` para as duas
-- funcionalidades do front rico que não existiam no schema até aqui — carrossel
-- de fotos da vaga e recorrência ("dias"). Tudo aditivo — nenhuma coluna
-- existente é removida ou renomeada, `foto_url` continua servindo de capa/
-- primeira foto para quem só olha essa coluna.
--
-- Como reverter (se precisar): "alter table public.vagas drop column fotos"
-- e "alter table public.vagas drop column dias".

alter table public.vagas
  add column if not exists fotos text[],
  add column if not exists dias text;

alter table public.vagas
  drop constraint if exists vagas_dias_check;

alter table public.vagas
  add constraint vagas_dias_check check (dias is null or dias in ('semana', 'fimdesemana', 'qualquer'));

comment on column public.vagas.fotos is 'Fotos do canteiro/vaga, em ordem de exibição no carrossel (front React). `foto_url` guarda a primeira/capa para compatibilidade com quem só lê essa coluna.';
comment on column public.vagas.dias is 'Recorrência da vaga: semana, fim de semana ou qualquer dia (front React). Nulo = sem recorrência informada.';
