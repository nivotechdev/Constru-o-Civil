-- L13 — Apaga TODOS os dados sintéticos do teste de volume (popular.sql) e confere que nada ficou.
\set ON_ERROR_STOP on
set client_min_messages = warning;
begin;
create temp table vol_users as select id from auth.users where email like 'volume+%@bicos.invalid';
create temp table vol_jobs as select id from public.jobs where description like '[volume]%';

delete from public.notifications where worker_id in (select id from vol_users) or company_id in (select id from vol_users);
delete from public.application_attempts where worker_id in (select id from vol_users);
delete from public.applications where job_id in (select id from vol_jobs) or worker_id in (select id from vol_users);
delete from public.jobs where id in (select id from vol_jobs);
delete from auth.users where id in (select id from vol_users);
-- Apagar a conta no Auth não leva o perfil junto (o app apaga pela excluir-conta): sai à parte.
delete from public.workers where id in (select id from vol_users);
delete from public.companies where id in (select id from vol_users);

select (select count(*) from auth.users where email like 'volume+%@bicos.invalid') as contas,
       (select count(*) from public.accounts where id in (select id from vol_users)) as perfis,
       (select count(*) from public.workers where id in (select id from vol_users)) as trabalhadores,
       (select count(*) from public.companies where id in (select id from vol_users)) as construtoras,
       (select count(*) from public.jobs where description like '[volume]%') as vagas,
       (select count(*) from public.applications where worker_id in (select id from vol_users)) as candidaturas;
do $$
begin
  if exists (select 1 from auth.users where email like 'volume+%@bicos.invalid')
     or exists (select 1 from public.jobs where description like '[volume]%')
     or exists (select 1 from public.workers w join vol_users v on v.id = w.id)
     or exists (select 1 from public.companies c join vol_users v on v.id = c.id) then
    raise exception 'Sobrou dado sintético — nada foi apagado (transação desfeita).';
  end if;
end $$;
commit;
