-- F10 — campos do perfil profissional; faltas e desistências visíveis à construtora, não a outro trabalhador.
begin;
select pg_temp.new_user('7e000000-0000-0000-0000-0000000000a1', 'trabalhador', 'Perfil Completo');
select pg_temp.new_user('7e000000-0000-0000-0000-0000000000a2', 'trabalhador', 'Outro Trabalhador');
select pg_temp.new_user('7e000000-0000-0000-0000-0000000000c1', 'recrutador', 'Obra Olho', '11.222.333/0001-81');
select pg_temp.login('7e000000-0000-0000-0000-0000000000a1');
update public.workers set availability = 'semana', years_experience = 12, desired_pay = 200, travel_km = 15,
       bio = 'Reboco e acabamento.' where id = '7e000000-0000-0000-0000-0000000000a1';
select pg_temp.fails($$update public.workers set desired_pay = 10 where id = '7e000000-0000-0000-0000-0000000000a1'$$, '23514');
select pg_temp.logout();
insert into public.applications (job_id, worker_id, status)
values (pg_temp.new_job('7e000000-0000-0000-0000-0000000000c1'), '7e000000-0000-0000-0000-0000000000a1', 'nao_compareceu');
select pg_temp.login('7e000000-0000-0000-0000-0000000000c1');
select pg_temp.ok((select faltas = 1 and desistencias = 0 from public.worker_track_record(array['7e000000-0000-0000-0000-0000000000a1'::uuid])),
  'a construtora vê a falta');
select pg_temp.login('7e000000-0000-0000-0000-0000000000a2');
select pg_temp.ok(not exists (select 1 from public.worker_track_record(array['7e000000-0000-0000-0000-0000000000a1'::uuid])),
  'outro trabalhador não vê');
select pg_temp.logout();
rollback;
