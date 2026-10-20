-- U32/U33/U34 — perfis mais simples e mais falados:
--   * U33: o trabalhador não informa mais "dias que pode", "anos de experiência", "diária que pede" nem "até onde
--     vai" — as colunas saem do banco (availability, years_experience, desired_pay, travel_km). Ficam a bio
--     ("Sobre você") e, no lugar dos números, a lista de experiências.
--   * U34: experiências do trabalhador — até 10 itens curtos (2 a 80 caracteres cada), sem textão colado.
--   * U32: a construtora também ganha a sua descrição ("Sobre a empresa"); a bio do trabalhador vai a 500.
-- Idempotente; a regra dos textos fica no banco (o app confere antes, mas quem decide é o check).

-- Uma lista de experiências válida: até 10, cada uma de 2 a 80 caracteres, sem espaço sobrando nas pontas.
create or replace function public.valid_experiences(p text[])
returns boolean
language sql immutable set search_path = public as $$
  select coalesce(cardinality(p), 0) <= 10
     and not exists (
       select 1 from unnest(coalesce(p, '{}'::text[])) as e(item)
        where item is null or item <> btrim(item) or char_length(item) not between 2 and 80
     )
$$;
revoke all on function public.valid_experiences(text[]) from public, anon;

alter table public.workers drop constraint if exists workers_professional_check;
alter table public.workers
  drop column if exists availability,
  drop column if exists years_experience,
  drop column if exists desired_pay,
  drop column if exists travel_km,
  add column if not exists experiences text[] not null default '{}';
do $$ begin
  alter table public.workers add constraint workers_bio_check check (bio is null or char_length(bio) <= 500);
exception when duplicate_object then null;
end $$;
do $$ begin
  alter table public.workers add constraint workers_experiences_check check (public.valid_experiences(experiences));
exception when duplicate_object then null;
end $$;
grant select (experiences) on public.workers to authenticated;
grant update (experiences) on public.workers to authenticated;

alter table public.companies add column if not exists about text;
do $$ begin
  alter table public.companies add constraint companies_about_check check (about is null or char_length(about) <= 500);
exception when duplicate_object then null;
end $$;
grant select (about) on public.companies to authenticated;
grant update (about) on public.companies to authenticated;
