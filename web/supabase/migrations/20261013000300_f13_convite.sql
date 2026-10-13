-- F13: a construtora convida um trabalhador para uma vaga aberta (da busca ou do perfil). Ele aceita — vira
-- candidatura, com as regras de sempre (submit_application) — ou recusa. Os dois lados recebem o aviso.

alter type public.notification_kind add value if not exists 'convite';

create table if not exists public.job_invites (
  job_id text not null references public.jobs (id) on delete cascade,
  worker_id uuid not null references public.workers (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  status text not null default 'pendente' check (status in ('pendente', 'aceito', 'recusado')),
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  primary key (job_id, worker_id)
);
create index if not exists job_invites_worker_idx on public.job_invites (worker_id);
alter table public.job_invites enable row level security;
revoke all on public.job_invites from anon, authenticated;
grant select on public.job_invites to authenticated;
drop policy if exists "Convite visível aos dois lados" on public.job_invites;
create policy "Convite visível aos dois lados" on public.job_invites
  for select to authenticated
  using (worker_id = (select public.my_worker_id()) or company_id = (select public.my_company_id()));

create or replace function public.invite_worker(p_job_id text, p_worker_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_job public.jobs := public.own_job_for_update(p_job_id);
  v_company text;
  v_count integer;
begin
  if not public.job_is_open(v_job) or public.job_holding(p_job_id) >= v_job.slots then
    raise exception using errcode = 'BC409', message = 'Essa vaga não está aberta para convites.';
  end if;
  if not exists (select 1 from public.workers where id = p_worker_id and name <> 'Conta excluída') then
    raise exception using errcode = 'BC404', message = 'Esse trabalhador não está mais na Bicos.';
  end if;
  if exists (select 1 from public.applications where job_id = p_job_id and worker_id = p_worker_id) then
    raise exception using errcode = 'BC409', message = 'Essa pessoa já se candidatou a essa vaga.';
  end if;
  if exists (select 1 from public.job_invites where job_id = p_job_id and worker_id = p_worker_id) then
    raise exception using errcode = 'BC409', message = 'Você já convidou essa pessoa para essa vaga.';
  end if;
  -- Sem spam: até 20 convites por dia por construtora.
  select count(*) into v_count from public.job_invites
   where company_id = v_job.company_id and created_at > now() - interval '1 day';
  if v_count >= 20 then
    raise exception using errcode = 'BC409', message = 'Você já mandou muitos convites hoje. Tente amanhã.';
  end if;
  insert into public.job_invites (job_id, worker_id, company_id) values (p_job_id, p_worker_id, v_job.company_id);
  select name into v_company from public.companies where id = v_job.company_id;
  perform public.notify(p_worker_id, null, 'convite', v_company || ' convidou você',
    'Para ' || public.job_title(v_job) || ' em ' || coalesce(nullif(v_job.neighborhood, ''), v_job.city) ||
    '. Veja a vaga e responda.', '/vaga/' || p_job_id);
end;
$$;

create or replace function public.answer_invite(p_job_id text, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_invite public.job_invites;
  v_worker text;
begin
  select * into v_invite from public.job_invites
   where job_id = p_job_id and worker_id = public.my_worker_id() for update;
  if not found then
    raise exception using errcode = 'BC404', message = 'Esse convite não existe mais.';
  end if;
  if v_invite.status <> 'pendente' then return; end if;
  if p_accept then
    perform public.submit_application(p_job_id);  -- mesmas regras de sempre (vaga cheia, encerrada…)
  end if;
  update public.job_invites set status = case when p_accept then 'aceito' else 'recusado' end, answered_at = now()
   where job_id = p_job_id and worker_id = v_invite.worker_id;
  select name into v_worker from public.workers where id = v_invite.worker_id;
  perform public.notify(null, v_invite.company_id, 'convite',
    coalesce(nullif(public.first_name(v_worker), ''), 'O trabalhador') ||
      case when p_accept then ' aceitou o convite' else ' recusou o convite' end,
    case when p_accept then 'A candidatura já está na lista da vaga.' else 'Convide outra pessoa ou espere candidatos.' end,
    '/vaga-gerenciar/' || p_job_id);
end;
$$;

revoke all on function public.invite_worker(text, uuid), public.answer_invite(text, boolean) from public, anon;
grant execute on function public.invite_worker(text, uuid), public.answer_invite(text, boolean) to authenticated;
