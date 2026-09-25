-- Fase 3 do front novo (Bicos): telefone/WhatsApp de contato, para os dois
-- tipos de perfil (pedreiro E construtora — o front antigo só tinha esse
-- campo para construtora; o design novo libera o contato nos dois sentidos
-- depois que a construtora pré-seleciona/contrata um candidato).
--
-- Aditivo, nullable — não quebra nenhuma linha existente.
-- Reverter: alter table public.profiles drop column whatsapp;

alter table public.profiles add column if not exists whatsapp text;

comment on column public.profiles.whatsapp is
  'Telefone/WhatsApp de contato. NUNCA exposto por select direto nem por perfil_publico() '
  '— só sai pela RPC contato_whatsapp(), e só depois de pré-seleção/contratação.';
