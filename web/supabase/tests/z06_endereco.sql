-- Z06 — rua, número, complemento, CEP e o ponto exato só para a dona e para quem foi escolhido.
begin;

select pg_temp.new_user('60000000-0000-0000-0000-0000000000c1', 'recrutador', 'Dona da Obra');
select pg_temp.new_user('60000000-0000-0000-0000-0000000000a1', 'trabalhador', 'Escolhido');
select pg_temp.new_user('60000000-0000-0000-0000-0000000000a2', 'trabalhador', 'Curioso');
create temp table t_ids (k text primary key, v text);
grant all on t_ids to authenticated;
insert into t_ids values ('vaga', pg_temp.new_job('60000000-0000-0000-0000-0000000000c1', 2, 2));

-- Qualquer conta logada: bairro, cidade e ponto aproximado (e, desde o U53, também rua, CEP e ponto exato).
select pg_temp.login('60000000-0000-0000-0000-0000000000a2');
select pg_temp.fails('select * from public.jobs', '42501');
-- U51: o ponto aproximado é o exato (-23.54, -46.57) deslocado 100–200 m (~0,001–0,002°).
select pg_temp.ok((select neighborhood = 'Tatuapé' and abs(area_lat + 23.54) < 0.0025 and abs(area_lon + 46.57) < 0.0025
                     from public.jobs where id = (select v from t_ids where k = 'vaga')),
  'bairro e ponto aproximado são públicos');
select public.submit_application((select v from t_ids where k = 'vaga'));
select pg_temp.ok(not exists (select 1 from public.get_job_addresses(array[(select v from t_ids where k = 'vaga')])),
  'candidato ainda não escolhido não recebe o endereço');

select pg_temp.login('60000000-0000-0000-0000-0000000000a1');
select public.submit_application((select v from t_ids where k = 'vaga'));
select pg_temp.login('60000000-0000-0000-0000-0000000000c1');
select pg_temp.ok((select street = 'Rua Teste' from public.get_job_addresses(array[(select v from t_ids where k = 'vaga')])),
  'a dona recebe o endereço');
select public.transition_application((select v from t_ids where k = 'vaga'), '60000000-0000-0000-0000-0000000000a1', 'aprovar');
select pg_temp.login('60000000-0000-0000-0000-0000000000a1');
select pg_temp.ok((select street = 'Rua Teste' and number = '10' and cep = '03307-000'
                     from public.get_job_addresses(array[(select v from t_ids where k = 'vaga')])),
  'pré-selecionado recebe o endereço completo');
select pg_temp.login('60000000-0000-0000-0000-0000000000a2');
select pg_temp.ok(not exists (select 1 from public.get_job_addresses(array[(select v from t_ids where k = 'vaga')])),
  'os outros continuam sem');
select pg_temp.logout();

set local role anon;
select pg_temp.fails('select id from public.jobs', '42501');
reset role;

rollback;
