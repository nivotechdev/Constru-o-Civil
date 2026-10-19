-- Fase 2 do front novo (Bicos): colunas novas em `vagas` para suportar o
-- design novo (quantidade de vagas, requisitos, foto, urgente, impulsionar,
-- descrição). Tudo aditivo — nenhuma coluna existente é removida ou renomeada,
-- então o front antigo continua funcionando sem nenhuma mudança nele.
--
-- Como reverter (se precisar): "alter table public.vagas drop column <nome>"
-- para cada coluna abaixo, na ordem inversa.

alter table public.vagas
  add column if not exists slots int not null default 1,
  add column if not exists endereco text,
  add column if not exists duracao text,
  add column if not exists requisitos text[],
  add column if not exists foto_url text,
  add column if not exists descricao text,
  add column if not exists urgente boolean not null default false,
  add column if not exists impulsionada boolean not null default false,
  add column if not exists sem_contratacao boolean not null default false;

comment on column public.vagas.slots is 'Quantas pessoas essa vaga precisa contratar (front novo).';
comment on column public.vagas.endereco is 'Endereço completo da obra (front novo) — cidade continua em `cidade`.';
comment on column public.vagas.duracao is 'Texto livre tipo "1 diária"/"3 diárias" (front novo).';
comment on column public.vagas.requisitos is 'O que o trabalhador precisa levar (front novo).';
comment on column public.vagas.foto_url is 'Foto do canteiro/vaga, se a construtora enviar uma (front novo).';
comment on column public.vagas.descricao is 'Descrição livre da vaga (front novo — front antigo não tinha esse campo).';
comment on column public.vagas.urgente is 'Selo de urgente no mural (front novo).';
comment on column public.vagas.impulsionada is 'Vaga impulsionada (recurso pago fictício no front novo, sem cobrança real ainda).';
comment on column public.vagas.sem_contratacao is 'Marcado quando a vaga fecha sem ninguém contratado (fluxo de fechar vaga do front novo).';
