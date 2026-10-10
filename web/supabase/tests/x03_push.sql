-- X03 — aparelho cadastrado só pela própria conta; sino contado no servidor; aviso não quebra sem push.
begin;
select pg_temp.new_user('7d000000-0000-0000-0000-0000000000f1', 'trabalhador', 'Ana Push');
select pg_temp.new_user('7d000000-0000-0000-0000-0000000000f2', 'trabalhador', 'Bia Push');

select pg_temp.login('7d000000-0000-0000-0000-0000000000f1');
select public.save_push_subscription('https://push.example/abc', repeat('k', 40), repeat('a', 16), 'Teste');
select pg_temp.fails($$select public.save_push_subscription('http://inseguro', repeat('k', 40), repeat('a', 16), null)$$, 'BC422');
select pg_temp.fails($$select * from public.push_subscriptions$$, '42501');
select pg_temp.ok(public.my_unread_count() = 0, 'sino zerado');
select pg_temp.logout();

-- Aviso novo com aparelho cadastrado e sem Vault configurado: grava normalmente.
select public.notify('7d000000-0000-0000-0000-0000000000f1', null, 'pre_selecionado', 'Oi', 'Teste', '/mural');
select public.notify('7d000000-0000-0000-0000-0000000000f2', null, 'pre_selecionado', 'Oi', 'Teste', '/mural');
select pg_temp.login('7d000000-0000-0000-0000-0000000000f1');
select pg_temp.ok(public.my_unread_count() = 1, 'conta só os próprios não lidos');
update public.notifications set read_at = now() where worker_id = '7d000000-0000-0000-0000-0000000000f1';
select pg_temp.ok(public.my_unread_count() = 0, 'lido some do contador');
select pg_temp.logout();

-- O mesmo aparelho passa para quem entrou por último; a outra conta não apaga o que não é dela.
select pg_temp.login('7d000000-0000-0000-0000-0000000000f2');
select public.delete_push_subscription('https://push.example/abc');
reset role;
select pg_temp.ok((select account_id from public.push_subscriptions where endpoint = 'https://push.example/abc')
                  = '7d000000-0000-0000-0000-0000000000f1', 'outra conta não apaga');
select pg_temp.login('7d000000-0000-0000-0000-0000000000f2');
select public.save_push_subscription('https://push.example/abc', repeat('k', 40), repeat('a', 16), 'Teste');
reset role;
select pg_temp.ok((select account_id from public.push_subscriptions where endpoint = 'https://push.example/abc')
                  = '7d000000-0000-0000-0000-0000000000f2', 'aparelho passa para quem entrou');

-- Com pg_net e os segredos no Vault: aviso para quem tem aparelho vira uma chamada à enviar-push.
create extension if not exists pg_net;
select vault.create_secret('https://x.supabase.co/functions/v1/enviar-push', 'bicos_push_url');
select vault.create_secret('segredo-teste', 'bicos_push_secret');
select public.notify('7d000000-0000-0000-0000-0000000000f2', null, 'contratado', 'Contratado', 'Teste', '/mural');
select public.notify('7d000000-0000-0000-0000-0000000000f1', null, 'contratado', 'Sem aparelho', 'Teste', '/mural');
select pg_temp.ok((select count(*) from net.http_request_queue) = 1, 'só quem tem aparelho gera chamada');
select pg_temp.ok((select headers ->> 'x-webhook-secret' from net.http_request_queue) = 'segredo-teste', 'com o segredo');
select pg_temp.ok((select convert_from(body, 'utf8')::jsonb #>> '{record,title}' from net.http_request_queue) = 'Contratado',
                  'com o aviso');
rollback;
