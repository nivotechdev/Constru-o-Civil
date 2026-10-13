-- X03: notificações no celular (Web Push) e o sino certo em qualquer aparelho.
--
-- * `push_subscriptions`: cada aparelho que aceitou receber notificações (o endereço do navegador e as
--   chaves dele). Só a própria conta grava/apaga, por RPC; ninguém lê pela API (a Edge Function `enviar-push`
--   lê com service_role).
-- * Cada aviso novo (`notifications`) chama a Edge Function `enviar-push` pelo pg_net — só se a conta tem
--   aparelho cadastrado e se a URL e o segredo estão no Vault (`bicos_push_url`, `bicos_push_secret`; ver
--   SUPABASE.md). Sem isso, nada acontece (o aviso no sino continua). A função respeita os grupos que a
--   pessoa escolheu (`notification_prefs.push_groups`, F06).
-- * `my_unread_count()`: o número do sino vem do servidor (não só dos 100 avisos carregados).
-- Idempotente.

create table if not exists public.push_subscriptions (
  endpoint text primary key check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  account_id uuid not null references auth.users (id) on delete cascade,
  p256dh text not null check (char_length(p256dh) between 20 and 200),
  auth text not null check (char_length(auth) between 8 and 100),
  user_agent text check (char_length(user_agent) <= 300),
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index if not exists push_subscriptions_account_idx on public.push_subscriptions (account_id);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;

-- Um aparelho só recebe as notificações de quem entrou nele por último (o endereço passa para a conta atual).
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception using errcode = 'BC401', message = 'Entre na sua conta de novo para continuar.';
  end if;
  if p_endpoint !~ '^https://' or char_length(p_endpoint) > 1000
     or char_length(coalesce(p_p256dh, '')) not between 20 and 200
     or char_length(coalesce(p_auth, '')) not between 8 and 100 then
    raise exception using errcode = 'BC422', message = 'Não deu para ativar as notificações neste aparelho.';
  end if;
  if (select count(*) from public.push_subscriptions where account_id = auth.uid() and endpoint <> p_endpoint) >= 10 then
    delete from public.push_subscriptions
     where endpoint = (select endpoint from public.push_subscriptions where account_id = auth.uid()
                        order by coalesce(last_used_at, created_at) limit 1);
  end if;
  insert into public.push_subscriptions (endpoint, account_id, p256dh, auth, user_agent)
  values (p_endpoint, auth.uid(), p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update
    set account_id = excluded.account_id, p256dh = excluded.p256dh, auth = excluded.auth,
        user_agent = excluded.user_agent, created_at = now();
end;
$$;

create or replace function public.delete_push_subscription(p_endpoint text)
returns void language sql security definer set search_path = public as $$
  delete from public.push_subscriptions where endpoint = p_endpoint and account_id = auth.uid()
$$;

create or replace function public.my_unread_count()
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::int from public.notifications
   where read_at is null
     and (worker_id = public.my_worker_id() or company_id = public.my_company_id())
$$;

revoke all on function public.save_push_subscription(text, text, text, text), public.delete_push_subscription(text),
  public.my_unread_count() from public, anon, authenticated;
grant execute on function public.save_push_subscription(text, text, text, text), public.delete_push_subscription(text),
  public.my_unread_count() to authenticated;

-- Aviso novo → Edge Function enviar-push (sem esperar a resposta; falha no envio nunca impede o aviso).
create or replace function public.push_new_notification()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_url text;
  v_secret text;
begin
  if to_regnamespace('net') is null or to_regnamespace('vault') is null then
    return new;
  end if;
  if not exists (select 1 from public.push_subscriptions where account_id = coalesce(new.worker_id, new.company_id)) then
    return new;
  end if;
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1' into v_url using 'bicos_push_url';
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1' into v_secret using 'bicos_push_secret';
  if v_url is null or v_secret is null then
    return new;
  end if;
  execute 'select net.http_post(url := $1, body := $2, headers := $3)'
    using v_url,
          jsonb_build_object('record', jsonb_build_object(
            'id', new.id, 'worker_id', new.worker_id, 'company_id', new.company_id, 'kind', new.kind,
            'title', new.title, 'body', new.body, 'target', new.target)),
          jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secret);
  return new;
exception when others then
  return new;
end;
$$;
revoke all on function public.push_new_notification() from public, anon, authenticated;

drop trigger if exists push_new_notification on public.notifications;
create trigger push_new_notification after insert on public.notifications
  for each row execute function public.push_new_notification();

-- O "lida" de um aparelho chega aos outros pelo Realtime (UPDATE em notifications).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
