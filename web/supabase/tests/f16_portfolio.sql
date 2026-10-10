-- F16 — legenda editável pelo dono, até 280 caracteres.
begin;
select pg_temp.new_user('80300000-0000-0000-0000-0000000000a1', 'trabalhador', 'Dono Do Post');
select pg_temp.new_user('80300000-0000-0000-0000-0000000000a2', 'trabalhador', 'Outro Alguem');
insert into public.worker_posts (worker_id, media_url, media_type, caption)
values ('80300000-0000-0000-0000-0000000000a1', null, 'image', 'antes');
select pg_temp.login('80300000-0000-0000-0000-0000000000a1');
update public.worker_posts set caption = 'depois' where worker_id = '80300000-0000-0000-0000-0000000000a1';
select pg_temp.fails($$update public.worker_posts set caption = repeat('x', 281) where worker_id = '80300000-0000-0000-0000-0000000000a1'$$, '23514');
select pg_temp.login('80300000-0000-0000-0000-0000000000a2');
update public.worker_posts set caption = 'invadido' where worker_id = '80300000-0000-0000-0000-0000000000a1';
select pg_temp.logout();
select pg_temp.ok((select caption = 'depois' from public.worker_posts where worker_id = '80300000-0000-0000-0000-0000000000a1'), 'só o dono edita');
rollback;
