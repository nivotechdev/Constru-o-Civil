-- X22 — a limpeza diária volta a apagar as tentativas de login e as confirmações de WhatsApp velhas, além
-- dos registros de candidatura (X15).
begin;
select pg_temp.ok((select command from cron.job where jobname = 'bicos-limpar-tentativas') = 'select public.purge_auth_attempts()',
  'o cron chama a limpeza completa');

select pg_temp.new_user('7d000000-0000-0000-0000-0000000000e9', 'trabalhador', 'Ana Limpeza');
insert into public.auth_attempts (key, at) values ('x22:velha', now() - interval '2 days'), ('x22:nova', now());
insert into public.whatsapp_verifications (phone, verified_at)
values ('11922220001', now() - interval '2 days'), ('11922220002', now());
insert into public.application_attempts (worker_id, job_id, created_at)
values ('7d000000-0000-0000-0000-0000000000e9', 'X-velha', now() - interval '3 days'),
       ('7d000000-0000-0000-0000-0000000000e9', 'X-nova', now());

select public.purge_auth_attempts();
select pg_temp.ok((select array_agg(key) from public.auth_attempts where key like 'x22:%') = array['x22:nova'],
  'tentativa de login velha sai');
select pg_temp.ok((select array_agg(phone) from public.whatsapp_verifications where phone like '1192222000%') = array['11922220002'],
  'confirmação de WhatsApp velha sai');
select pg_temp.ok((select array_agg(job_id) from public.application_attempts
                    where worker_id = '7d000000-0000-0000-0000-0000000000e9') = array['X-nova'],
  'registro de candidatura velho sai');
rollback;
