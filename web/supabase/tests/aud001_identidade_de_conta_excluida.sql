-- AUD-001 — selfie e documento de uma conta que já não existe saem do Storage sem esperar 1 dia.
begin;
select pg_temp.new_user('7d000000-0000-0000-0000-0000000000b1', 'trabalhador', 'Vera Viva');
insert into storage.objects (bucket_id, name, created_at) values
  -- dono que não existe mais (conta excluída pelo painel, sem passar pela Edge Function): sai já
  ('identidade', '7d000000-0000-0000-0000-0000000000c9/selfie.jpg', now() - interval '1 hour'),
  ('identidade', '7d000000-0000-0000-0000-0000000000c9/doc.jpg', now() - interval '1 hour'),
  -- dono que existe e acabou de enviar (ainda não gravou o envio): continua protegido por 1 dia
  ('identidade', '7d000000-0000-0000-0000-0000000000b1/selfie.jpg', now() - interval '1 hour'),
  -- dono que existe e largou o arquivo há mais de 1 dia: sai como antes
  ('identidade', '7d000000-0000-0000-0000-0000000000b1/velha.jpg', now() - interval '25 hours'),
  -- fotos públicas de conta que não existe mais: seguem a regra de 1 dia (a vaga ainda pode usar)
  ('avatars', '7d000000-0000-0000-0000-0000000000c9/foto.webp', now() - interval '1 hour');

select pg_temp.ok((select array_agg(name order by name) from public.orphan_storage_objects(100)
                    where bucket = 'identidade') =
  array['7d000000-0000-0000-0000-0000000000b1/velha.jpg',
        '7d000000-0000-0000-0000-0000000000c9/doc.jpg',
        '7d000000-0000-0000-0000-0000000000c9/selfie.jpg'],
  'identidade de conta inexistente sai já; a de conta viva só depois de 1 dia');
select pg_temp.ok((select count(*) from public.orphan_storage_objects(100) where bucket = 'avatars') = 0,
  'foto pública recente não sai antes de 1 dia');
rollback;
