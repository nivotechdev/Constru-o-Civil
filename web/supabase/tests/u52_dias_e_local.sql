-- U52 — a vaga com os dias da semana marcados (o resumo em "dias") e o tipo do local; a data de início cai num dos
-- dias; Hoje/Amanhã e o mural seguem os dias marcados.
begin;

select pg_temp.new_user('96000000-0000-0000-0000-0000000006c1', 'recrutador', 'Empresa Dias', '51.826.049/0001-39');
update public.accounts set profile_completed_at = now() where id = '96000000-0000-0000-0000-0000000006c1';

create temp table t_draft (p jsonb);
grant all on t_draft to authenticated;
insert into t_draft select jsonb_build_object(
  'title', 'Garçom para festa', 'pay', 150, 'cep', '95020-000', 'street', 'Rua Sinimbu', 'number', '120',
  'neighborhood', 'Centro', 'city', 'Caxias do Sul', 'uf', 'RS', 'lat', -29.1688, 'lon', -51.1787,
  'date_to_arrange', true, 'diarias', 2, 'slots', 1, 'weekdays', '[6, 7]'::jsonb, 'place_type', 'casa',
  'description', 'Servir as mesas numa festa de aniversário', 'requirements', '[]'::jsonb);
create temp table t_ids (k text primary key, v text);
grant all on t_ids to authenticated;
-- As datas da próxima segunda e do próximo sábado (calculadas aqui: a conta logada não chama bicos_today).
create temp table t_dias as
  select public.bicos_today() + (8 - extract(isodow from public.bicos_today())::int) as segunda,
         public.bicos_today() + (13 - extract(isodow from public.bicos_today())::int) as sabado;
grant all on t_dias to authenticated;

select pg_temp.login('96000000-0000-0000-0000-0000000006c1');
insert into t_ids values ('fds', public.publish_job((select p from t_draft)));
insert into t_ids values ('semana', public.publish_job((select p || '{"weekdays": [5, 1, 3, 3]}' from t_draft)));
insert into t_ids values ('todos', public.publish_job((select p || '{"weekdays": [1, 2, 3, 4, 5, 6, 7]}' from t_draft)));
insert into t_ids values ('misto', public.publish_job((select p || '{"weekdays": [2, 6]}' from t_draft)));
insert into t_ids values ('antiga', public.publish_job((select (p - 'weekdays' - 'place_type') || '{"dias": "semana"}' from t_draft)));
select pg_temp.fails($$select public.publish_job((select p || '{"weekdays": [8]}' from t_draft))$$, 'BC422');
select pg_temp.fails($$select public.publish_job((select p || '{"weekdays": []}' from t_draft))$$, 'BC422');
select pg_temp.fails($$select public.publish_job((select p || '{"weekdays": ["seg"]}' from t_draft))$$, 'BC422');
select pg_temp.fails($$select public.publish_job((select p || '{"place_type": "castelo"}' from t_draft))$$, 'BC422');
-- Com a data marcada: o primeiro dia tem que ser um dos dias escolhidos (aqui, sábado ou domingo).
select pg_temp.fails($$select public.publish_job((select p || jsonb_build_object(
  'date_to_arrange', false, 'start_date', d.segunda, 'end_date', d.segunda + 6) from t_draft, t_dias d))$$, 'BC422');
insert into t_ids values ('sabado', public.publish_job((select p || jsonb_build_object(
  'date_to_arrange', false, 'start_date', d.sabado, 'end_date', d.sabado + 1) from t_draft, t_dias d)));
select pg_temp.logout();

select pg_temp.ok((select dias = 'fimdesemana' and weekdays = '{6,7}' and place_type = 'casa'
                     from public.jobs where id = (select v from t_ids where k = 'fds')), 'só sábado e domingo: fim de semana');
select pg_temp.ok((select dias = 'semana' and weekdays = '{1,3,5}' from public.jobs where id = (select v from t_ids where k = 'semana')),
                  'dias da semana, em ordem e sem repetir: semana');
select pg_temp.ok((select dias = 'qualquer' and cardinality(weekdays) = 7 from public.jobs where id = (select v from t_ids where k = 'todos')),
                  'os sete dias: qualquer');
select pg_temp.ok((select dias = 'qualquer' and weekdays = '{2,6}' from public.jobs where id = (select v from t_ids where k = 'misto')),
                  'terça e sábado: qualquer (aparece nos dois filtros)');
select pg_temp.ok((select dias = 'semana' and weekdays is null and place_type is null
                     from public.jobs where id = (select v from t_ids where k = 'antiga')), 'o formato antigo (só "dias") continua');

-- Hoje/Amanhã: a vaga de sábado a domingo só "acontece" nesses dias.
select pg_temp.ok((select public.job_runs_on(j, j.start_date) and public.job_runs_on(j, j.end_date)
                          and not public.job_runs_on(j, j.start_date - 1)
                     from public.jobs j where id = (select v from t_ids where k = 'sabado')), 'roda só nos dias marcados');
update public.jobs set weekdays = '{6}' where id = (select v from t_ids where k = 'sabado');
select pg_temp.ok((select not public.job_runs_on(j, j.end_date) from public.jobs j where id = (select v from t_ids where k = 'sabado')),
                  'tirar o domingo tira o domingo');

-- Editar: os dias e o tipo do local mudam.
select pg_temp.login('96000000-0000-0000-0000-0000000006c1');
select public.update_job((select v from t_ids where k = 'fds'), (select p || '{"weekdays": [1], "place_type": "apartamento"}' from t_draft));
select pg_temp.ok((select weekdays = '{1}' and dias = 'semana' and place_type = 'apartamento'
                     from public.jobs where id = (select v from t_ids where k = 'fds')), 'editar troca os dias e o tipo do local');
-- Quem lê a vaga vê os dias e o tipo.
select pg_temp.ok((select weekdays = '{2,6}' and place_type = 'casa' from public.jobs where id = (select v from t_ids where k = 'misto')),
                  'os dias e o tipo saem por select');
select pg_temp.ok(exists (select 1 from public.feed_jobs('Caxias do Sul', 'RS', -29.17, -51.18) f
                           where f->>'id' = (select v from t_ids where k = 'misto')
                             and f->'weekdays' = '[2, 6]'::jsonb and f->>'place_type' = 'casa'), 'o mural manda os dias e o tipo');
select pg_temp.logout();
select pg_temp.ok((select public_job_card(public_slug)->'weekdays' = '[2, 6]'::jsonb
                     from public.jobs where id = (select v from t_ids where k = 'misto')), 'o link público também');
rollback;
