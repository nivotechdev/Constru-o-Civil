-- F04: denunciar (vaga, perfil, avaliação, post) e bloquear uma conta.
--
-- - reports: a denúncia, com motivo; só quem denunciou lê a própria (a equipe lê pelo painel).
-- - blocks: quem bloqueou quem. Bloquear encerra as candidaturas pendentes entre os dois e impede novas
--   candidaturas e convites (gatilhos), nos dois sentidos. O app tira os bloqueados do mural e da busca.

do $$ begin
  create type public.report_target as enum ('vaga', 'perfil', 'avaliacao', 'post');
exception when duplicate_object then null;
end $$;

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users (id) on delete cascade,
  target_type public.report_target not null,
  target_id text not null,
  reason text not null check (reason in ('golpe', 'ofensa', 'falso', 'perigoso', 'spam', 'outro')),
  details text check (details is null or char_length(details) <= 500),
  status text not null default 'aberta' check (status in ('aberta', 'analisada')),
  created_at timestamptz not null default now(),
  unique (reporter_id, target_type, target_id)
);
alter table public.reports enable row level security;
revoke all on public.reports from anon, authenticated;
grant select on public.reports to authenticated;
drop policy if exists "Quem denunciou vê a própria denúncia" on public.reports;
create policy "Quem denunciou vê a própria denúncia" on public.reports
  for select to authenticated using (reporter_id = (select auth.uid()));

create table if not exists public.blocks (
  blocker_id uuid not null references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table public.blocks enable row level security;
revoke all on public.blocks from anon, authenticated;
grant select on public.blocks to authenticated;
drop policy if exists "Quem bloqueou vê os próprios bloqueios" on public.blocks;
create policy "Quem bloqueou vê os próprios bloqueios" on public.blocks
  for select to authenticated using (blocker_id = (select auth.uid()));

-- Um bloqueio entre as duas contas, em qualquer sentido?
create or replace function public.blocked_between(p_a uuid, p_b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.blocks
                  where (blocker_id = p_a and blocked_id = p_b) or (blocker_id = p_b and blocked_id = p_a))
$$;

create or replace function public.report_content(
  p_target_type public.report_target, p_target_id text, p_reason text, p_details text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_count integer;
begin
  if auth.uid() is null then
    raise exception using errcode = 'BC401', message = 'Entre na sua conta de novo para continuar.';
  end if;
  if p_reason not in ('golpe', 'ofensa', 'falso', 'perigoso', 'spam', 'outro') then
    raise exception using errcode = 'BC422', message = 'Escolha o motivo da denúncia.';
  end if;
  select count(*) into v_count from public.reports where reporter_id = auth.uid() and created_at > now() - interval '1 day';
  if v_count >= 20 then
    raise exception using errcode = 'BC409', message = 'Você já mandou muitas denúncias hoje. Tente amanhã.';
  end if;
  insert into public.reports (reporter_id, target_type, target_id, reason, details)
  values (auth.uid(), p_target_type, p_target_id, p_reason, nullif(btrim(left(coalesce(p_details, ''), 500)), ''))
  on conflict (reporter_id, target_type, target_id) do update
    set reason = excluded.reason, details = excluded.details, created_at = now(), status = 'aberta';
end;
$$;

create or replace function public.block_account(p_account uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then
    raise exception using errcode = 'BC401', message = 'Entre na sua conta de novo para continuar.';
  end if;
  if p_account = v_me or not exists (select 1 from public.accounts where id = p_account) then
    raise exception using errcode = 'BC404', message = 'Essa conta não existe mais.';
  end if;
  insert into public.blocks (blocker_id, blocked_id) values (v_me, p_account) on conflict do nothing;
  -- Candidaturas e convites pendentes entre os dois deixam de existir.
  delete from public.applications a using public.jobs j
   where j.id = a.job_id and a.status in ('enviada', 'em_analise')
     and ((a.worker_id = v_me and j.company_id = p_account) or (a.worker_id = p_account and j.company_id = v_me));
  delete from public.job_invites
   where status = 'pendente'
     and ((worker_id = v_me and company_id = p_account) or (worker_id = p_account and company_id = v_me));
end;
$$;

create or replace function public.unblock_account(p_account uuid)
returns void language sql security definer set search_path = public as $$
  delete from public.blocks where blocker_id = auth.uid() and blocked_id = p_account
$$;

-- Ninguém se candidata nem convida através de um bloqueio.
create or replace function public.refuse_blocked_application()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_company uuid;
begin
  select company_id into v_company from public.jobs where id = new.job_id;
  if public.blocked_between(new.worker_id, v_company) then
    raise exception using errcode = 'BC409', message = 'Não é possível se candidatar a essa vaga.';
  end if;
  return new;
end;
$$;
drop trigger if exists applications_refuse_blocked on public.applications;
create trigger applications_refuse_blocked before insert on public.applications
  for each row execute function public.refuse_blocked_application();

create or replace function public.refuse_blocked_invite()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.blocked_between(new.worker_id, new.company_id) then
    raise exception using errcode = 'BC409', message = 'Não é possível convidar essa pessoa.';
  end if;
  return new;
end;
$$;
drop trigger if exists job_invites_refuse_blocked on public.job_invites;
create trigger job_invites_refuse_blocked before insert on public.job_invites
  for each row execute function public.refuse_blocked_invite();

revoke all on function public.blocked_between(uuid, uuid), public.refuse_blocked_application(),
  public.refuse_blocked_invite() from public, anon, authenticated;
revoke all on function public.report_content(public.report_target, text, text, text), public.block_account(uuid),
  public.unblock_account(uuid) from public, anon;
grant execute on function public.report_content(public.report_target, text, text, text), public.block_account(uuid),
  public.unblock_account(uuid) to authenticated;
