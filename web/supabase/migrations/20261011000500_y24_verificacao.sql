-- Y24 (+ L10): verificação da construtora com status de verdade — pendente | verificada | reprovada.
--
-- Ninguém nasce "verificada": a conta entra como pendente e só a equipe da Bicos muda o status, pela
-- função set_company_verification (service_role: painel do Supabase ou uma futura área de admin). A coluna
-- `verified` (usada pelo selo) acompanha o status por gatilho; `verified_at` guarda quando.

do $$ begin
  create type public.company_verification as enum ('pendente', 'verificada', 'reprovada');
exception when duplicate_object then null;
end $$;

alter type public.notification_kind add value if not exists 'verificacao';

alter table public.companies
  add column if not exists verification_status public.company_verification not null default 'pendente',
  add column if not exists verified_at timestamptz;

create or replace function public.sync_company_verified()
returns trigger language plpgsql set search_path = public as $$
begin
  new.verified := new.verification_status = 'verificada';
  if new.verification_status = 'verificada' then
    if tg_op = 'INSERT' or old.verification_status is distinct from 'verificada' then
      new.verified_at := coalesce(new.verified_at, now());
    end if;
  else
    new.verified_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists companies_sync_verified on public.companies;
create trigger companies_sync_verified before insert or update of verification_status, verified on public.companies
  for each row execute function public.sync_company_verified();

-- As que já estavam marcadas como verificadas continuam (com a data em que entraram).
update public.companies
   set verification_status = 'verificada', verified_at = coalesce(verified_at, created_at)
 where verified and verification_status = 'pendente';
-- E nenhuma outra fica com o selo.
update public.companies set verified = false where verification_status <> 'verificada' and verified;

create or replace function public.set_company_verification(p_company uuid, p_status public.company_verification)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.companies set verification_status = p_status where id = p_company;
  if not found then
    raise exception using errcode = 'BC404', message = 'Construtora não encontrada.';
  end if;
  if p_status = 'verificada' then
    perform public.notify(null, p_company, 'verificacao', 'Empresa verificada',
      'Conferimos os dados da empresa. O selo "Verificada" já aparece no seu perfil.', '/empresa');
  elsif p_status = 'reprovada' then
    perform public.notify(null, p_company, 'verificacao', 'Não conseguimos verificar a empresa',
      'Os dados não bateram. Fale com a gente pela Ajuda para resolver.', '/ajuda');
  end if;
end;
$$;

revoke all on function public.set_company_verification(uuid, public.company_verification), public.sync_company_verified()
  from public, anon, authenticated;
grant execute on function public.set_company_verification(uuid, public.company_verification) to service_role;
grant select (verification_status, verified_at) on public.companies to authenticated;
