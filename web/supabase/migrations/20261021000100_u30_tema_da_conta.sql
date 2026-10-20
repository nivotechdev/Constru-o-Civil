-- U30 (21/10): o tema claro/escuro é da CONTA, guardado no banco — o mesmo em todo navegador e celular onde a conta
-- entrar, e trocado ao vivo nos que estiverem abertos (Realtime). Antes (U26) ficava no armazenamento de cada
-- aparelho, e dois navegadores da mesma conta podiam ficar em temas diferentes.
--   * account_prefs: uma linha por conta (só o tema por enquanto); RLS: cada conta lê só a sua;
--   * set_my_theme(tema): a única forma de mudar (a RPC grava para a conta da sessão);
--   * na publicação supabase_realtime, para os aparelhos abertos receberem a troca na hora.
-- A exclusão da conta leva a linha junto (cascade de accounts). Idempotente.

create table if not exists public.account_prefs (
  account_id uuid primary key references public.accounts (id) on delete cascade,
  theme text not null default 'claro' check (theme in ('claro', 'escuro')),
  updated_at timestamptz not null default now()
);
alter table public.account_prefs enable row level security;
revoke all on public.account_prefs from public, anon, authenticated;
grant select on public.account_prefs to authenticated;

drop policy if exists account_prefs_own on public.account_prefs;
create policy account_prefs_own on public.account_prefs
  for select to authenticated using (account_id = (select auth.uid()));

create or replace function public.set_my_theme(p_theme text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.accounts where id = auth.uid()) then
    raise exception using errcode = 'BC401', message = 'Entre na sua conta de novo para continuar.';
  end if;
  if p_theme is null or p_theme not in ('claro', 'escuro') then
    raise exception using errcode = 'BC422', message = 'Tema inválido.';
  end if;
  insert into public.account_prefs (account_id, theme, updated_at) values (auth.uid(), p_theme, now())
  on conflict (account_id) do update set theme = excluded.theme, updated_at = excluded.updated_at;
end;
$$;
revoke all on function public.set_my_theme(text) from public, anon;
grant execute on function public.set_my_theme(text) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'account_prefs') then
    alter publication supabase_realtime add table public.account_prefs;
  end if;
end;
$$;
