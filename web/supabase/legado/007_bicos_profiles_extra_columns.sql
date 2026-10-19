-- Fase 4 do front novo (Bicos): campos de perfil que a tela de editar
-- perfil/empresa e o "completar cadastro" coletam. Aditivo — nullable, sem
-- afetar nenhuma linha existente.
--
-- `perfil_publico()` precisa ser recriada (não só substituída) porque muda a
-- lista de colunas do retorno — Postgres não deixa trocar o "returns table"
-- de uma função só com CREATE OR REPLACE.
--
-- Reverter:
--   alter table public.profiles drop column cargo, drop column regiao,
--     drop column especialidades, drop column tipo_obra,
--     drop column regiao_atuacao, drop column capa_url;
--   -- e recriar perfil_publico() com a lista de colunas antiga (ver
--   -- supabase/migrations/000_baseline.sql linha ~734).

alter table public.profiles
  add column if not exists cargo text,
  add column if not exists regiao text,
  add column if not exists especialidades text[],
  add column if not exists tipo_obra text,
  add column if not exists regiao_atuacao text,
  add column if not exists capa_url text;

comment on column public.profiles.cargo is 'Cargo/especialidade principal do trabalhador (front novo).';
comment on column public.profiles.regiao is 'Região de atuação do trabalhador (front novo).';
comment on column public.profiles.especialidades is 'Lista de especialidades do trabalhador (front novo).';
comment on column public.profiles.tipo_obra is 'Tipo de obra da construtora (front novo).';
comment on column public.profiles.regiao_atuacao is 'Região onde a construtora contrata (front novo).';
comment on column public.profiles.capa_url is 'Foto de capa do perfil — trabalhador ou construtora (front novo). `foto_url` já existente serve de logo/avatar.';

drop function if exists public.perfil_publico(uuid);

create or replace function public.perfil_publico(p_id uuid)
returns table (
  id uuid,
  nome text,
  tipo text,
  foto_url text,
  capa_url text,
  biografia text,
  cargo text,
  regiao text,
  especialidades text[],
  tipo_obra text,
  regiao_atuacao text,
  criado_em timestamptz,
  documento text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if auth.role() <> 'authenticated' or not email_verificado() then
    raise exception 'Acesso restrito a usuários autenticados e verificados.';
  end if;

  return query
    select
      p.id, p.nome, p.tipo, p.foto_url, p.capa_url, p.biografia,
      p.cargo, p.regiao, p.especialidades, p.tipo_obra, p.regiao_atuacao, p.criado_em,
      case
        when p.tipo = 'construtora' and p.documento_cifrado is not null then
          pgp_sym_decrypt(
            p.documento_cifrado,
            (select decrypted_secret from vault.decrypted_secrets where name = 'nivotech_documento_key')
          )
        else null
      end as documento
    from public.profiles p
    where p.id = p_id and p.ativo = true and p.tipo is not null;
end;
$$;

revoke all on function public.perfil_publico(uuid) from public;
grant execute on function public.perfil_publico(uuid) to authenticated;
