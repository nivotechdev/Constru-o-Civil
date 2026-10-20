-- U37 — cadastro com o Google pelo cadastro normal. O app agora leva o login do Google sem conta pelos mesmos passos
-- do cadastro (sem e-mail e sem confirmação de e-mail) e cria a conta com create_my_account (sem mudança aqui).
-- O que muda no banco: um login do Google que nunca terminou o cadastro (login criado, conta nunca criada) também é
-- apagado depois de 7 dias, como o cadastro por e-mail nunca confirmado. Não toca em conta do app antigo com perfil
-- preenchido (`profiles.tipo`), que ainda ganha a conta nova ao entrar (ensure_my_account).
create or replace function public.purge_unconfirmed_signups()
returns integer language sql security definer set search_path = public as $$
  with x as (
    delete from auth.users u
     where u.created_at < now() - interval '7 days'
       and (
         u.email_confirmed_at is null
         or (
           (u.raw_app_meta_data->>'provider' = 'google' or u.raw_app_meta_data->>'via' = 'firebase')
           and not exists (select 1 from public.accounts a where a.id = u.id)
           and not exists (select 1 from public.profiles p where p.id = u.id and p.tipo is not null)
         )
       )
    returning 1
  ) select count(*)::int from x
$$;
revoke all on function public.purge_unconfirmed_signups() from public, anon, authenticated;
