-- X09 — o que pode sair do Storage: sem uso há mais de 1 dia; identidade 30 dias depois da decisão.
begin;
select pg_temp.new_user('7d000000-0000-0000-0000-0000000000a9', 'trabalhador', 'Ana Arquivos');
create temp table t_base as select value as url from public.app_config where key = 'storage_public_base';
insert into storage.objects (bucket_id, name, created_at) values
  ('avatars', '7d000000-0000-0000-0000-0000000000a9/usada.webp', now() - interval '25 hours'),
  ('avatars', '7d000000-0000-0000-0000-0000000000a9/orfa.webp', now() - interval '25 hours'),
  ('avatars', '7d000000-0000-0000-0000-0000000000a9/recente.webp', now() - interval '1 hour'),
  ('avatars', 'antigo/do-app-velho.jpg', timestamptz '2025-01-01'),
  ('identidade', '7d000000-0000-0000-0000-0000000000a9/selfie.jpg', now() - interval '25 hours'),
  ('identidade', '7d000000-0000-0000-0000-0000000000a9/doc.jpg', now() - interval '25 hours'),
  ('identidade', '7d000000-0000-0000-0000-0000000000a9/solta.jpg', now() - interval '25 hours');
update public.workers set photo_url = (select url from t_base) || 'avatars/7d000000-0000-0000-0000-0000000000a9/usada.webp'
 where id = '7d000000-0000-0000-0000-0000000000a9';

select pg_temp.login('7d000000-0000-0000-0000-0000000000a9');
select public.submit_identity('7d000000-0000-0000-0000-0000000000a9/selfie.jpg', '7d000000-0000-0000-0000-0000000000a9/doc.jpg');
select pg_temp.fails($$select * from public.orphan_storage_objects(10)$$, '42501');
reset role;

select pg_temp.ok((select array_agg(name order by name) from public.orphan_storage_objects(100)) =
  array['7d000000-0000-0000-0000-0000000000a9/orfa.webp', '7d000000-0000-0000-0000-0000000000a9/solta.jpg'],
  'só a sem uso e a de identidade solta');

-- Decidida há mais de 30 dias: as fotos do envio saem.
select public.set_identity_status('7d000000-0000-0000-0000-0000000000a9', 'verificado');
select pg_temp.ok((select decided_at is not null from public.identity_submissions
                    where worker_id = '7d000000-0000-0000-0000-0000000000a9'), 'decisão marcada');
update public.identity_submissions set decided_at = now() - interval '31 days'
 where worker_id = '7d000000-0000-0000-0000-0000000000a9';
select pg_temp.ok((select count(*) from public.orphan_storage_objects(100) where bucket = 'identidade') = 3,
  'identidade decidida há 30 dias sai');
rollback;
