-- L11: o banco também confere o nome do perfil (o app confere antes, por campo). NOT VALID: vale para o que
-- for gravado daqui em diante, sem travar linhas antigas.

do $$ begin
  alter table public.workers add constraint workers_name_length
    check (char_length(btrim(name)) between 3 and 80) not valid;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter table public.companies add constraint companies_name_length
    check (char_length(btrim(name)) between 3 and 80) not valid;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter table public.workers add constraint workers_specialties_limit
    check (cardinality(specialties) <= 10) not valid;
exception when duplicate_object then null;
end $$;
