-- AUD-003: texto sem limite derrubava o mural (uma vaga com 1 milhão de letras no endereço pesava MB por página).
--   * jobs: CHECK de tamanho nas colunas de endereço, e job_from_draft recusa com BC422 antes de gravar;
--   * fotos da vaga: o endereço (URL) de cada foto tem até 300 letras;
--   * perfis (escrita direta pela API): cidade, bairro, links de foto e capa, localização da empresa, coordenada
--     dentro do Brasil (recusa 999 e NaN);
--   * portfólio: no máximo 50 itens por trabalhador.
-- As restrições entram como NOT VALID (valem para o que for gravado daqui em diante) e são validadas em seguida;
-- se existir linha antiga fora do limite, a validação fica para depois e a migration não quebra. Idempotente.

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'jobs_street_length') then
    alter table public.jobs add constraint jobs_street_length check (char_length(street) <= 120) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'jobs_number_length') then
    alter table public.jobs add constraint jobs_number_length check (char_length(number) <= 10) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'jobs_complement_length') then
    alter table public.jobs add constraint jobs_complement_length check (complement is null or char_length(complement) <= 60) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'jobs_neighborhood_length') then
    alter table public.jobs add constraint jobs_neighborhood_length check (char_length(neighborhood) <= 80) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'jobs_city_length') then
    alter table public.jobs add constraint jobs_city_length check (char_length(city) <= 80) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'workers_city_length') then
    alter table public.workers add constraint workers_city_length check (city is null or char_length(city) <= 80) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'workers_neighborhood_length') then
    alter table public.workers add constraint workers_neighborhood_length check (neighborhood is null or char_length(neighborhood) <= 80) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'workers_image_urls_length') then
    alter table public.workers add constraint workers_image_urls_length check (coalesce(char_length(photo_url), 0) <= 300 and coalesce(char_length(cover_url), 0) <= 300) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'workers_latlon_range') then
    alter table public.workers add constraint workers_latlon_range check ((lat is null or lat between -34 and 6) and (lon is null or lon between -74 and -28)) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'companies_location_length') then
    alter table public.companies add constraint companies_location_length check (location is null or char_length(location) <= 120) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'companies_image_urls_length') then
    alter table public.companies add constraint companies_image_urls_length check (coalesce(char_length(logo_url), 0) <= 300 and coalesce(char_length(cover_url), 0) <= 300) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'worker_posts_media_url_length') then
    alter table public.worker_posts add constraint worker_posts_media_url_length check (coalesce(char_length(media_url), 0) <= 300) not valid;
  end if;
end;
$$;

do $$
declare
  r record;
begin
  for r in
    select conrelid::regclass::text as tbl, conname from pg_constraint
     where conname in ('jobs_street_length', 'jobs_number_length', 'jobs_complement_length', 'jobs_neighborhood_length', 'jobs_city_length', 'workers_city_length', 'workers_neighborhood_length', 'workers_image_urls_length', 'workers_latlon_range', 'companies_location_length', 'companies_image_urls_length', 'worker_posts_media_url_length') and not convalidated
  loop
    begin
      execute format('alter table %s validate constraint %I', r.tbl, r.conname);
    exception when check_violation then
      raise notice 'AUD-003: % tem linha antiga fora do limite; validar depois de corrigir os dados', r.conname;
    end;
  end loop;
end;
$$;

-- Fotos da vaga: além do prefixo do próprio bucket, o endereço de cada foto tem até 300 letras.
create or replace function public.check_job_photos_v2()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  u text;
begin
  if tg_op = 'UPDATE' and new.photos is not distinct from old.photos then return new; end if;
  foreach u in array coalesce(new.photos, '{}') loop
    if char_length(u) > 300 or not public.storage_url_ok(u, 'vagas', new.company_id) then
      raise exception using errcode = 'BC422', message = 'Essa foto não foi enviada pelo app. Escolha de novo.';
    end if;
  end loop;
  if cardinality(coalesce(new.photos, '{}')) > 8 then
    raise exception using errcode = 'BC422', message = 'Uma vaga tem até 8 fotos.';
  end if;
  return new;
end;
$$;

-- Portfólio: no máximo 50 itens por trabalhador.
create or replace function public.limit_worker_posts()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.worker_posts where worker_id = new.worker_id) >= 50 then
    raise exception using errcode = 'BC409', message = 'Seu portfólio já tem 50 itens. Apague algum para publicar outro.';
  end if;
  return new;
end;
$$;
revoke all on function public.limit_worker_posts() from public, anon, authenticated;
drop trigger if exists limit_worker_posts on public.worker_posts;
create trigger limit_worker_posts before insert on public.worker_posts
  for each row execute function public.limit_worker_posts();

-- job_from_draft (de 20261021000700_u52_dias_e_local.sql), com os limites do endereço
create or replace function public.job_from_draft(p jsonb, p_original_start date default null)
returns public.jobs language plpgsql stable set search_path = public as $$
declare
  j public.jobs;
  v_today date := public.bicos_today();
begin
  j.oficio_id := nullif(btrim(coalesce(p->>'oficio_id', '')), '');
  j.title := nullif(btrim(coalesce(p->>'title', '')), '');
  j.pay := (p->>'pay')::numeric;
  j.cep := p->>'cep';
  j.street := btrim(coalesce(p->>'street', ''));
  j.number := btrim(coalesce(p->>'number', ''));
  j.complement := nullif(btrim(coalesce(p->>'complement', '')), '');
  j.neighborhood := btrim(coalesce(p->>'neighborhood', ''));
  j.city := btrim(coalesce(p->>'city', ''));
  j.uf := upper(btrim(coalesce(p->>'uf', '')));
  j.lat := (p->>'lat')::double precision;
  j.lon := (p->>'lon')::double precision;
  j.date_to_arrange := coalesce((p->>'date_to_arrange')::boolean, false);
  j.start_date := case when j.date_to_arrange then null else (p->>'start_date')::date end;
  j.end_date := case when j.date_to_arrange then null else (p->>'end_date')::date end;
  j.start_time := nullif(p->>'start_time', '');
  j.end_time := nullif(p->>'end_time', '');
  j.diarias := coalesce((p->>'diarias')::integer, 1);
  j.dias := (p->>'dias')::public.dias_semana;
  -- U52: os dias da semana marcados (1 = segunda … 7 = domingo); "dias" passa a ser o resumo deles.
  if jsonb_typeof(p->'weekdays') = 'array' then
    if exists (select 1 from jsonb_array_elements_text(p->'weekdays') d where d !~ '^[1-7]$') then
      raise exception using errcode = 'BC422', message = 'Escolha em que dias da semana pode ser.';
    end if;
    j.weekdays := (select array_agg(distinct d::smallint order by d::smallint)
                     from jsonb_array_elements_text(p->'weekdays') d);
    if j.weekdays is null then
      raise exception using errcode = 'BC422', message = 'Escolha em que dias da semana pode ser.';
    end if;
    j.dias := case when j.weekdays <@ array[1, 2, 3, 4, 5]::smallint[] then 'semana'
                   when j.weekdays <@ array[6, 7]::smallint[] then 'fimdesemana'
                   else 'qualquer' end;
  end if;
  j.place_type := nullif(btrim(coalesce(p->>'place_type', '')), '');
  j.urgent := coalesce((p->>'urgent')::boolean, false);
  j.photos := case when jsonb_typeof(p->'photos') = 'array'
                   then array(select jsonb_array_elements_text(p->'photos')) end;
  j.slots := coalesce((p->>'slots')::integer, 1);
  j.description := btrim(coalesce(p->>'description', ''));
  j.requirements := coalesce(array(select jsonb_array_elements_text(coalesce(p->'requirements', '[]'::jsonb))), '{}');

  -- U01: o título é o que identifica a vaga.
  if j.title is null then
    raise exception using errcode = 'BC422', message = 'Dê um título para a vaga.';
  end if;
  if char_length(j.title) > 60 then
    raise exception using errcode = 'BC422', message = 'Use até 60 letras no título.';
  end if;
  if j.oficio_id is not null and not exists (select 1 from public.oficios where id = j.oficio_id) then
    raise exception using errcode = 'BC422', message = 'Escolha o ofício que a vaga precisa.';
  end if;
  if j.cep is null or j.cep !~ '^\d{5}-\d{3}$' then
    raise exception using errcode = 'BC422', message = 'Digite o CEP do local do serviço (8 números).';
  end if;
  -- O ponto precisa cair no Brasil (sem ele, a distância no mural sai errada). U01: o número é opcional.
  if j.street = '' or j.neighborhood = '' or j.city = '' or j.uf !~ '^[A-Z]{2}$'
     or j.lat is null or j.lon is null or j.lat not between -34 and 6 or j.lon not between -74 and -28 then
    raise exception using errcode = 'BC422', message = 'Confira o endereço do local do serviço.';
  end if;
  -- AUD-003: o endereço tem tamanho limitado (o mural leva essas colunas para cada pessoa).
  if char_length(j.street) > 120 then
    raise exception using errcode = 'BC422', message = 'Use até 120 letras na rua.';
  end if;
  if char_length(j.number) > 10 then
    raise exception using errcode = 'BC422', message = 'Use até 10 letras no número.';
  end if;
  if char_length(j.complement) > 60 then
    raise exception using errcode = 'BC422', message = 'Use até 60 letras no complemento.';
  end if;
  if char_length(j.neighborhood) > 80 then
    raise exception using errcode = 'BC422', message = 'Use até 80 letras no bairro.';
  end if;
  if char_length(j.city) > 80 then
    raise exception using errcode = 'BC422', message = 'Use até 80 letras na cidade.';
  end if;
  if not j.date_to_arrange then
    if j.start_date is null or j.end_date is null then
      raise exception using errcode = 'BC422', message = 'Escolha a data de início e a de fim.';
    end if;
    if j.start_date < v_today and j.start_date is distinct from p_original_start then
      raise exception using errcode = 'BC422', message = 'A data de início não pode ser no passado.';
    end if;
    if j.end_date < j.start_date then
      raise exception using errcode = 'BC422', message = 'A data de fim tem que ser igual ou depois do início.';
    end if;
    if j.end_date - j.start_date + 1 > 60 then
      raise exception using errcode = 'BC422', message = 'Uma vaga cobre até 60 dias. Para mais, publique de novo depois.';
    end if;
  end if;
  if j.place_type is not null
     and j.place_type not in ('casa', 'apartamento', 'condominio', 'predio', 'comercio', 'outro') then
    raise exception using errcode = 'BC422', message = 'Escolha o tipo do local na lista.';
  end if;
  -- U52: com a data marcada, o primeiro dia é um dos dias da semana escolhidos.
  if not j.date_to_arrange and j.weekdays is not null and j.start_date is not null
     and not (extract(isodow from j.start_date)::smallint = any (j.weekdays)) then
    raise exception using errcode = 'BC422', message = 'A data de início não cai num dos dias escolhidos.';
  end if;
  if j.diarias < 1 or j.diarias > 60 then
    raise exception using errcode = 'BC422', message = 'Informe quantas diárias (de 1 a 60).';
  end if;
  if (j.start_time is null) <> (j.end_time is null) then
    raise exception using errcode = 'BC422', message = 'Preencha o início e o fim, ou deixe os dois em branco.';
  end if;
  -- W08: um turno da noite (22h–6h) passa da meia-noite; só início igual ao fim é recusado.
  if j.start_time is not null and (j.start_time !~ '^([01]\d|2[0-3]):[0-5]\d$'
     or j.end_time !~ '^([01]\d|2[0-3]):[0-5]\d$') then
    raise exception using errcode = 'BC422', message = 'Horário inválido.';
  end if;
  if j.start_time is not null and j.start_time = j.end_time then
    raise exception using errcode = 'BC422', message = 'O início e o fim não podem ser iguais.';
  end if;
  if j.slots < 1 or j.slots > 50 then
    raise exception using errcode = 'BC422', message = 'Informe quantas pessoas a vaga precisa (de 1 a 50).';
  end if;
  if j.pay is not null and j.pay < 80 then
    raise exception using errcode = 'BC422', message = 'Informe um valor de R$ 80 ou mais.';
  end if;
  -- W08: acima disso é quase sempre erro de digitação.
  if j.pay is not null and j.pay > 5000 then
    raise exception using errcode = 'BC422', message = 'Confira o valor: a diária vai até R$ 5.000.';
  end if;
  if j.description = '' then
    raise exception using errcode = 'BC422', message = 'Descreva o serviço da vaga.';
  end if;
  if char_length(j.description) < 20 then
    raise exception using errcode = 'BC422',
      message = 'Conte um pouco mais (pelo menos 20 letras): o que vai ser feito, onde, materiais.';
  end if;
  if char_length(j.description) > 1000 then
    raise exception using errcode = 'BC422', message = 'Use até 1000 letras na descrição.';
  end if;
  return j;
end;
$$;
