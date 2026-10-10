-- F06: preferências de aviso por tipo e canal. Grupos: candidaturas, lembretes, bicos_novos (bico novo,
-- urgente, convite) e conta. No sino do app, só "bicos_novos" pode ser silenciado (o resto é o andamento do
-- próprio bico e sempre chega). O push escolhe os grupos (X03 lê `push_groups`). E-mail fica para depois.

create table if not exists public.notification_prefs (
  account_id uuid primary key references auth.users (id) on delete cascade,
  muted_groups text[] not null default '{}',
  push_groups text[] not null default array['candidaturas', 'lembretes', 'bicos_novos', 'conta'],
  updated_at timestamptz not null default now(),
  check (muted_groups <@ array['bicos_novos']::text[]),
  check (push_groups <@ array['candidaturas', 'lembretes', 'bicos_novos', 'conta']::text[])
);
alter table public.notification_prefs enable row level security;
revoke all on public.notification_prefs from anon, authenticated;
grant select on public.notification_prefs to authenticated;
drop policy if exists "Cada um lê as próprias preferências" on public.notification_prefs;
create policy "Cada um lê as próprias preferências" on public.notification_prefs
  for select to authenticated using (account_id = (select auth.uid()));

create or replace function public.notification_group(p_kind public.notification_kind)
returns text language sql immutable set search_path = public as $$
  select case
    when p_kind::text in ('bico_novo', 'bico_urgente', 'convite') then 'bicos_novos'
    when p_kind::text in ('confirmar_presenca', 'avaliar_diaria', 'avaliar_trabalhador') then 'lembretes'
    when p_kind::text in ('verificacao', 'impulsionamento') then 'conta'
    else 'candidaturas'
  end
$$;

create or replace function public.save_notification_prefs(p_muted text[], p_push text[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception using errcode = 'BC401', message = 'Entre na sua conta de novo para continuar.';
  end if;
  if not (coalesce(p_muted, '{}') <@ array['bicos_novos']::text[])
     or not (coalesce(p_push, '{}') <@ array['candidaturas', 'lembretes', 'bicos_novos', 'conta']::text[]) then
    raise exception using errcode = 'BC422', message = 'Preferência inválida.';
  end if;
  insert into public.notification_prefs (account_id, muted_groups, push_groups)
  values (auth.uid(), coalesce(p_muted, '{}'), coalesce(p_push, '{}'))
  on conflict (account_id) do update
    set muted_groups = excluded.muted_groups, push_groups = excluded.push_groups, updated_at = now();
end;
$$;

-- O aviso respeita o que a pessoa silenciou (a conta é o próprio id do trabalhador ou da construtora).
create or replace function public.notify(
  p_worker uuid, p_company uuid, p_kind public.notification_kind, p_title text, p_body text, p_target text
) returns void language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1 from public.notification_prefs np
     where np.account_id = coalesce(p_worker, p_company)
       and public.notification_group(p_kind) = any (np.muted_groups)
  ) then
    return;
  end if;
  insert into public.notifications (worker_id, company_id, kind, title, body, target)
  values (p_worker, p_company, p_kind, p_title, p_body, p_target);
end;
$$;

revoke all on function public.notify(uuid, uuid, public.notification_kind, text, text, text) from public, anon, authenticated;
revoke all on function public.save_notification_prefs(text[], text[]) from public, anon;
grant execute on function public.save_notification_prefs(text[], text[]) to authenticated;
