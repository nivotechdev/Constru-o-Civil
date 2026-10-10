-- X13: zera os avisos de segurança do Supabase que se aplicam.
--
-- 1. PostGIS sai do schema `public` (aviso "extension_in_public" e o ERRO "rls_disabled_in_public" da
--    tabela `spatial_ref_sys`, que é do PostGIS e não aceita RLS de quem não é dono). O PostGIS não aceita
--    `alter extension … set schema`, então é reinstalado em `extensions` (fora da API). As colunas
--    geográficas são refeitas: `jobs.area_geog` é calculada da latitude/longitude; `vagas.localizacao`
--    (app antigo, desligado no Z08) estava vazia no banco (conferido: 0 de 3 linhas com ponto) e volta
--    vazia, com o mesmo tipo.
-- 2. `search_path` fixo nas três funções do app antigo que não tinham.
-- 3. Nenhuma função `security definer` do schema `public` fica executável por visitante (`anon`), a não
--    ser a vaga pública (F09); e as funções novas deixam de nascer abertas a visitantes.
-- 4. `buscar_perfis` (app antigo) fica fechada para todos.
--
-- O aviso "authenticated_security_definer_function_executable" lista as RPCs que o app chama logado: é o
-- desenho (regras no banco, em funções security definer com search_path fixo) e não se aplica.
-- "Leaked password protection" é uma opção do painel (Authentication › Policies) — ver SUPABASE.md.
-- Idempotente.

-- 1. PostGIS em `extensions` ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_extension e join pg_namespace n on n.oid = e.extnamespace
              where e.extname = 'postgis' and n.nspname = 'public') then
    drop extension postgis cascade;
  end if;
end $$;
create schema if not exists extensions;
create extension if not exists postgis with schema extensions;

do $$
begin
  if to_regclass('public.vagas') is not null then
    alter table public.vagas add column if not exists localizacao extensions.geography(Point, 4326);
    create index if not exists vagas_localizacao_idx on public.vagas using gist (localizacao);
  end if;
end $$;

alter table public.jobs
  add column if not exists area_geog extensions.geography(Point, 4326)
  generated always as (
    extensions.st_setsrid(
      extensions.st_makepoint(round(lon::numeric, 2)::double precision, round(lat::numeric, 2)::double precision),
      4326
    )::extensions.geography
  ) stored;
create index if not exists jobs_area_geog_idx on public.jobs using gist (area_geog);

-- As funções que medem distância passam a achar o PostGIS no novo lugar (lista fixa, como antes).
alter function public.feed_jobs(text, text, double precision, double precision, integer, text, text, text,
  boolean, text, integer, jsonb) set search_path = public, extensions;
alter function public.notify_job_alerts() set search_path = public, extensions;

-- 2. search_path fixo -----------------------------------------------------------------------------------
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.proname in ('impedir_troca_de_tipo', 'travar_autor_da_vaga', 'expirar_vagas_vencidas')
  loop
    execute format('alter function %s set search_path = public', f.sig);
  end loop;
end $$;

-- 3. Visitante só executa o que precisa ----------------------------------------------------------------
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.prosecdef
       and p.proname not in ('public_job_card')
       and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('revoke execute on function %s from public, anon', f.sig);
  end loop;
end $$;

-- Funções criadas daqui em diante não nascem executáveis por visitante: quem precisa ganha `grant` na
-- própria migration (vale para o `postgres`, que roda as migrations).
alter default privileges for role postgres in schema public revoke execute on functions from anon;
-- O EXECUTE para PUBLIC é um padrão global do Postgres (não sai por schema): as funções do `postgres`
-- passam a só valer para quem ganhar grant explícito (no public, os padrões do Supabase já dão a
-- authenticated e service_role).
alter default privileges for role postgres revoke execute on functions from public;

-- 4. App antigo -----------------------------------------------------------------------------------------
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig from pg_proc p
     where p.pronamespace = 'public'::regnamespace and p.proname = 'buscar_perfis'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;
