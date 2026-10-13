-- Y18: a média das notas é sempre round(avg(value), 1) sobre todas as avaliações do perfil.
--
-- submit_review continua somando 1 em review_count; um gatilho BEFORE UPDATE nesse campo recalcula nota e
-- quantidade a partir de public.reviews (que já tem a avaliação nova), então o arredondamento não acumula.
-- No fim, recalcula todos os perfis.

create or replace function public.recount_rating()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'workers' then
    select coalesce(round(avg(value)::numeric, 1), 0), count(*)::int into new.rating, new.review_count
      from public.reviews where worker_id = new.id and direction = 'para_trabalhador';
  else
    select coalesce(round(avg(value)::numeric, 1), 0), count(*)::int into new.rating, new.review_count
      from public.reviews where company_id = new.id and direction = 'para_construtora';
  end if;
  return new;
end;
$$;
revoke all on function public.recount_rating() from public, anon, authenticated;

drop trigger if exists workers_recount_rating on public.workers;
create trigger workers_recount_rating before update of review_count, rating on public.workers
  for each row execute function public.recount_rating();
drop trigger if exists companies_recount_rating on public.companies;
create trigger companies_recount_rating before update of review_count, rating on public.companies
  for each row execute function public.recount_rating();

-- Recalcula todos (o gatilho preenche os valores certos).
update public.workers set review_count = review_count;
update public.companies set review_count = review_count;
