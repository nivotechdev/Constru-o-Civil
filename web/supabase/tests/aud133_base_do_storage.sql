-- AUD-133 — sem a linha storage_public_base (ou com formato errado) a conferência das fotos e a limpeza recusam, em vez de
-- aprovar tudo / apagar tudo.
begin;
select pg_temp.ok(public.storage_public_base() like 'https://%/storage/v1/object/public/', 'a base existe e tem o formato');
select pg_temp.ok(public.storage_url_ok(null, 'avatars', gen_random_uuid()), 'sem foto, tudo bem');
select pg_temp.ok(not public.storage_url_ok('https://outro.site/x.png', 'avatars', gen_random_uuid()), 'foto de fora é recusada');

insert into storage.objects (bucket_id, name, created_at)
values ('avatars', '00000000-0000-0000-0000-0000000000f1/velha.png', now() - interval '5 days');

delete from public.app_config where key = 'storage_public_base';
select pg_temp.fails($$select public.storage_url_ok('https://x/storage/v1/object/public/avatars/a/b.png', 'avatars', gen_random_uuid())$$, 'P0001');
select pg_temp.fails($$select * from public.orphan_storage_objects()$$, 'P0001');

update public.app_config set value = value where false;
insert into public.app_config (key, value) values ('storage_public_base', 'não é um endereço');
select pg_temp.fails($$select * from public.orphan_storage_objects()$$, 'P0001');
rollback;
