-- F18: modelo preparado para mais de uma pessoa por construtora (sem tela agora). Hoje a conta da
-- construtora é a própria empresa (accounts.company_id = id). A tabela registra quem é membro e com que papel;
-- quando houver a tela de convidar, my_company_id() passa a ler daqui.

do $$ begin
  create type public.company_member_role as enum ('dono', 'recrutador');
exception when duplicate_object then null;
end $$;

create table if not exists public.company_members (
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.company_member_role not null default 'recrutador',
  created_at timestamptz not null default now(),
  primary key (company_id, user_id)
);
alter table public.company_members enable row level security;
revoke all on public.company_members from anon, authenticated;
grant select on public.company_members to authenticated;
drop policy if exists "Membro vê a própria construtora" on public.company_members;
create policy "Membro vê a própria construtora" on public.company_members
  for select to authenticated using (user_id = (select auth.uid()));

-- Cada construtora que já existe tem a própria conta como dona; as novas também.
insert into public.company_members (company_id, user_id, role)
select a.company_id, a.id, 'dono' from public.accounts a
 where a.company_id is not null
on conflict do nothing;

create or replace function public.company_owner_member()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.company_id is not null then
    insert into public.company_members (company_id, user_id, role) values (new.company_id, new.id, 'dono')
    on conflict do nothing;
  end if;
  return null;
end;
$$;
drop trigger if exists accounts_company_owner on public.accounts;
create trigger accounts_company_owner after insert on public.accounts
  for each row execute function public.company_owner_member();
revoke all on function public.company_owner_member() from public, anon, authenticated;
