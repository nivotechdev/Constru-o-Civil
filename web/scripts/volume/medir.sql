-- L13 — Mede o feed_jobs (o mural) com os dados de popular.sql, como um trabalhador logado: 6 cenários, 50
-- chamadas cada, tempo de execução no banco. Resultado: p50, p95 e máximo em milissegundos por cenário.
\set ON_ERROR_STOP on
set client_min_messages = warning;
begin;
create temp table vol_tempos (cenario text, ms double precision);
grant all on vol_tempos to authenticated;
select set_config('request.jwt.claims', json_build_object('sub', w.id, 'role', 'authenticated')::text, true)
  from public.workers w join auth.users u on u.id = w.id
 where u.email like 'volume+%@bicos.invalid' order by u.email limit 1;
set local role authenticated;

do $$
declare
  t0 timestamptz;
  i int;
  lat double precision;
  lon double precision;
  cur jsonb;
  last jsonb;
begin
  for i in 1..50 loop
    lat := -23.55 + (i % 10 - 5) / 100.0;
    lon := -46.63 + (i % 7 - 3) / 100.0;

    t0 := clock_timestamp();
    perform * from public.feed_jobs('São Paulo', 'SP', lat, lon);
    insert into vol_tempos values ('1. cidade, mais perto', extract(epoch from clock_timestamp() - t0) * 1000);

    t0 := clock_timestamp();
    perform * from public.feed_jobs('São Paulo', 'SP', lat, lon, 30);
    insert into vol_tempos values ('2. raio de 30 km', extract(epoch from clock_timestamp() - t0) * 1000);

    t0 := clock_timestamp();
    perform * from public.feed_jobs('São Paulo', 'SP', lat, lon, null, null, null, 'pedreiro', true);
    insert into vol_tempos values ('3. busca "pedreiro" em todas as cidades', extract(epoch from clock_timestamp() - t0) * 1000);

    t0 := clock_timestamp();
    perform * from public.feed_jobs('São Paulo', 'SP', lat, lon, null, 'eletricista', 'Hoje');
    insert into vol_tempos values ('4. ofício + "Hoje"', extract(epoch from clock_timestamp() - t0) * 1000);

    t0 := clock_timestamp();
    perform * from public.feed_jobs('São Paulo', 'SP', lat, lon, null, null, null, null, false, 'valor');
    insert into vol_tempos values ('5. maior valor', extract(epoch from clock_timestamp() - t0) * 1000);

    select f into last from public.feed_jobs('São Paulo', 'SP', lat, lon) f offset 29 limit 1;
    cur := jsonb_build_object('r', last -> '_rank', 'k', last -> '_key', 'id', last ->> 'id');
    t0 := clock_timestamp();
    perform * from public.feed_jobs('São Paulo', 'SP', lat, lon, null, null, null, null, false, 'perto', 30, cur);
    insert into vol_tempos values ('6. segunda página', extract(epoch from clock_timestamp() - t0) * 1000);
  end loop;
end $$;

reset role;
select cenario, count(*) as chamadas,
       round(percentile_cont(0.5) within group (order by ms)::numeric, 1) as p50_ms,
       round(percentile_cont(0.95) within group (order by ms)::numeric, 1) as p95_ms,
       round(max(ms)::numeric, 1) as max_ms
  from vol_tempos group by cenario order by cenario;
select (select count(*) from public.feed_jobs('São Paulo', 'SP', -23.55, -46.63, null, null, null, null, false, 'perto', 60)) as vagas_na_1a_pagina_cheia;
rollback;
