-- AUD-010: o selo (empresa "Verificada", trabalhador "verificado") sobrevivia à troca do nome: dava para ser
-- verificado com um nome e passar a usar outro. Agora trocar o nome tira o selo: a empresa volta a "pendente" e o
-- trabalhador a "nao_enviado" (manda a selfie e o documento de novo); a empresa é avisada. Idempotente.

create or replace function public.reset_seal_on_rename()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.name is not distinct from old.name then
    return new;
  end if;
  if tg_table_name = 'companies' then
    if old.verification_status = 'verificada' then
      new.verification_status := 'pendente';
      new.verified := false;
      new.verified_at := null;
      perform public.notify(null, new.id, 'verificacao', 'O selo saiu da empresa',
        'Você trocou o nome da empresa, então o selo "Verificada" saiu. A equipe confere de novo.', '/empresa');
    end if;
  elsif old.identity_status = 'verificado' then
    new.identity_status := 'nao_enviado';
    new.verified := false;
  end if;
  return new;
end;
$$;
revoke all on function public.reset_seal_on_rename() from public, anon, authenticated;

drop trigger if exists companies_reset_seal on public.companies;
create trigger companies_reset_seal before update of name on public.companies
  for each row execute function public.reset_seal_on_rename();
drop trigger if exists workers_reset_seal on public.workers;
create trigger workers_reset_seal before update of name on public.workers
  for each row execute function public.reset_seal_on_rename();
