-- L13 — Dados SINTÉTICOS para o teste de volume do mural (só staging ou banco local; o rodar.sh recusa a
-- produção). Tudo marcado para sair depois com apagar.sql:
--   contas: e-mail volume+<n>@bicos.invalid · vagas: descrição começando com "[volume]".
-- 50 construtoras, 2.000 trabalhadores, 2.000 vagas (70% em São Paulo, o resto em 3 cidades vizinhas) e 20.000
-- candidaturas (10 por vaga). Pelas mesmas tabelas e gatilhos do app (cadastro → conta, limites, avisos).
\set ON_ERROR_STOP on
set client_min_messages = warning;

create or replace function pg_temp.cpf(p_seed text)
returns text language plpgsql as $$
declare
  d text := '';
  h text := md5(p_seed);
  s int;
  r int;
begin
  for i in 1..9 loop
    d := d || (('x' || substr(h, i * 2 - 1, 2))::bit(8)::int % 10)::text;
  end loop;
  foreach s in array array[9, 10] loop
    r := 0;
    for i in 1..s loop r := r + substr(d, i, 1)::int * (s + 2 - i); end loop;
    r := (r * 10) % 11;
    d := d || (case when r = 10 then 0 else r end)::text;
  end loop;
  return d;
end;
$$;

-- Contas (o gatilho do cadastro cria accounts + workers/companies, como no app).
insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
select gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       'volume+' || n || '@bicos.invalid', now(),
       jsonb_build_object('role', case when n <= 50 then 'recrutador' else 'trabalhador' end,
                          'nome', case when n <= 50 then 'Construtora Volume ' || n else 'Trabalhador Volume ' || n end,
                          'documento', pg_temp.cpf('volume-' || n), 'whatsapp', '11988887777',
                          'terms_version', '1.0', 'maior_de_idade', true),
       now(), now()
  from generate_series(1, 2050) n;

update public.accounts a set profile_completed_at = now()
  from auth.users u where u.id = a.id and u.email like 'volume+%@bicos.invalid';
update public.workers w set oficio_id = (array['pedreiro', 'eletricista', 'pintor', 'servente'])[1 + (abs(hashtext(w.id::text)) % 4)],
       city = 'São Paulo', neighborhood = 'Centro'
  from auth.users u where u.id = w.id and u.email like 'volume+%@bicos.invalid';

create temp table vol_companies as
  select row_number() over (order by u.email) as k, u.id
    from auth.users u join public.companies c on c.id = u.id
   where u.email like 'volume+%@bicos.invalid';
create temp table vol_workers as
  select row_number() over (order by u.email) - 1 as k, u.id
    from auth.users u join public.workers w on w.id = u.id
   where u.email like 'volume+%@bicos.invalid';

-- Vagas: datas de 5 dias atrás a 30 dias à frente (as passadas não aparecem no mural, como na vida real), 20%
-- "a combinar", 10% urgentes, 2% impulsionadas.
insert into public.jobs (company_id, oficio_id, pay, cep, street, number, neighborhood, city, uf, lat, lon,
                         date_to_arrange, start_date, end_date, start_time, end_time, diarias, urgent, boost_ends_at,
                         slots, description, created_at)
select c.id,
       (array['pedreiro', 'eletricista', 'pintor', 'servente', 'encanador', 'azulejista'])[1 + n % 6],
       case when n % 9 = 0 then null else 120 + (n % 15) * 20 end,
       '01000-000', 'Rua Sintética', n::text,
       (array['Centro', 'Tatuapé', 'Pinheiros', 'Mooca', 'Santana', 'Butantã', 'Itaquera', 'Lapa'])[1 + n % 8],
       city.name, 'SP',
       city.lat + ((abs(hashtext('lat' || n)) % 3000) - 1500) / 10000.0,
       city.lon + ((abs(hashtext('lon' || n)) % 3000) - 1500) / 10000.0,
       n % 5 = 0,
       case when n % 5 = 0 then null else public.bicos_today() + (n % 36) - 5 end,
       case when n % 5 = 0 then null else public.bicos_today() + (n % 36) - 5 + (n % 3) end,
       case when n % 4 = 0 then null else '07:00' end, case when n % 4 = 0 then null else '17:00' end,
       1 + n % 3, n % 10 = 0,
       case when n % 50 = 0 then now() + interval '2 days' end,
       1 + n % 3,
       '[volume] Serviço de obra para o teste de volume número ' || n || '. Levar ferramentas e EPI.',
       now() - (n % 30) * interval '1 day'
  from generate_series(1, 2000) n
  join vol_companies c on c.k = 1 + n % 50
  cross join lateral (
    select * from (values ('São Paulo', -23.55, -46.63), ('Guarulhos', -23.46, -46.53),
                          ('Osasco', -23.53, -46.79), ('Santo André', -23.66, -46.53)) v(name, lat, lon)
     where v.name = case when n % 10 < 7 then 'São Paulo' when n % 10 = 7 then 'Guarulhos'
                         when n % 10 = 8 then 'Osasco' else 'Santo André' end
  ) city;

create temp table vol_jobs as
  select row_number() over (order by id) - 1 as k, id, slots
    from public.jobs where description like '[volume]%';

-- Candidaturas: 10 trabalhadores diferentes por vaga (197 é primo com 2.000). Na 1ª, contratado em 1 de cada
-- 3 vagas; na 2ª, pré-selecionado em 1 de cada 10; o resto enviada, em análise ou não selecionado.
insert into public.applications (job_id, worker_id, status)
select j.id, w.id,
       (case
          when i = 0 and j.k % 3 = 0 then 'contratado'
          when i = 1 and j.k % 10 = 0 then 'pre_selecionado'
          when i % 3 = 0 then 'em_analise'
          when i % 4 = 0 then 'nao_selecionado'
          else 'enviada'
        end)::public.application_status
  from vol_jobs j
  cross join generate_series(0, 9) i
  join vol_workers w on w.k = (j.k * 7 + i * 197) % 2000;

analyze public.jobs;
analyze public.applications;
analyze public.companies;
analyze public.workers;

select (select count(*) from vol_companies) as construtoras, (select count(*) from vol_workers) as trabalhadores,
       (select count(*) from vol_jobs) as vagas,
       (select count(*) from public.applications a join vol_jobs j on j.id = a.job_id) as candidaturas;
