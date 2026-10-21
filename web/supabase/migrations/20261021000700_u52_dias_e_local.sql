-- U52 (21/10): publicar vaga — os dias da semana, um a um, e o tipo do local.
--   * jobs.weekdays: os dias marcados (1 = segunda … 7 = domingo). jobs.dias continua, como o resumo deles ("semana"
--     se só de segunda a sexta, "fimdesemana" se só sábado e domingo, "qualquer" no resto) — os filtros do mural e as
--     vagas antigas seguem iguais;
--   * jobs.place_type: o tipo do local, opcional (casa, apartamento, condomínio, prédio, comércio, outro) — todos veem;
--     o número da casa continua escondido como o resto do endereço (Z06);
--   * job_from_draft / publish_job / update_job gravam os dois (e a data de início, quando marcada, tem que cair num dos
--     dias escolhidos); update_job avisa os candidatos se os dias ou o tipo do local mudarem;
--   * job_runs_on (Hoje, Amanhã, lembrete de presença) olha os dias marcados; o gatilho que zera a presença também;
--   * feed_jobs e public_job_card mandam os dois para o app.
-- Idempotente.

alter table public.jobs add column if not exists weekdays smallint[];
alter table public.jobs add column if not exists place_type text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'jobs_weekdays_check') then
    alter table public.jobs add constraint jobs_weekdays_check
      check (weekdays is null or (cardinality(weekdays) between 1 and 7
                                  and weekdays <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'jobs_place_type_check') then
    alter table public.jobs add constraint jobs_place_type_check
      check (place_type is null or place_type in ('casa', 'apartamento', 'condominio', 'predio', 'comercio', 'outro'));
  end if;
end;
$$;
grant select (weekdays, place_type) on public.jobs to authenticated;

-- job_from_draft (de 20261021000500_u48_publico_geral.sql)
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

-- publish_job (de 20261021000500_u48_publico_geral.sql)
create or replace function public.publish_job(p jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_company uuid := public.my_company_id();
  j public.jobs;
  x record;
  v_id text;
begin
  if v_company is null then
    raise exception using errcode = 'BC401', message = 'Só a conta de empresa pode publicar vagas.';
  end if;
  if not exists (select 1 from public.accounts where id = auth.uid() and profile_completed_at is not null) then
    raise exception using errcode = 'BC409', message = 'Complete o perfil da empresa antes de publicar.';
  end if;
  if exists (select 1 from public.companies where id = v_company and verification_status = 'reprovada') then
    raise exception using errcode = 'BC409',
      message = 'Não conseguimos verificar sua empresa. Fale com a gente pela Ajuda para voltar a publicar.';
  end if;
  j := public.job_from_draft(p);
  x := public.job_extras_from_draft(p);
  insert into public.jobs (
    company_id, oficio_id, title, pay, cep, street, number, complement, neighborhood, city, uf, lat, lon,
    date_to_arrange, start_date, end_date, start_time, end_time, diarias, dias, urgent, photos, slots,
    description, requirements, payment_method, payment_note, weekdays, place_type
  ) values (
    v_company, j.oficio_id, j.title, j.pay, j.cep, j.street, j.number, j.complement, j.neighborhood, j.city,
    j.uf, j.lat, j.lon, j.date_to_arrange, j.start_date, j.end_date, j.start_time, j.end_time, j.diarias,
    j.dias, j.urgent, j.photos, j.slots, j.description, j.requirements, x.method, x.note, j.weekdays, j.place_type
  ) returning id into v_id;
  return v_id;
end;
$$;

-- update_job (de 20261012000100_l18_pagamento.sql)
create or replace function public.update_job(p_job_id text, p jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_old public.jobs := public.own_job_for_update(p_job_id);
  j public.jobs;
  x record;
  v_holding integer;
  v_changes text[] := '{}';
  v_company text;
  r record;
begin
  if v_old.closed or v_old.deleted_at is not null then
    raise exception using errcode = 'BC409', message = 'Essa vaga já foi encerrada e não pode mais ser editada.';
  end if;
  j := public.job_from_draft(p, v_old.start_date);
  x := public.job_extras_from_draft(p);
  v_holding := public.job_holding(p_job_id);
  if j.slots < v_holding then
    raise exception using errcode = 'BC422',
      message = 'Você já aprovou ' || v_holding || ' pessoas. Não dá para pedir menos que isso.';
  end if;

  if v_old.pay is distinct from j.pay then v_changes := array_append(v_changes, 'valor'); end if;
  if v_old.payment_method is distinct from x.method or v_old.payment_note is distinct from x.note then
    v_changes := array_append(v_changes, 'pagamento');
  end if;
  if v_old.date_to_arrange is distinct from j.date_to_arrange or v_old.start_date is distinct from j.start_date
     or v_old.end_date is distinct from j.end_date or v_old.start_time is distinct from j.start_time
     or v_old.end_time is distinct from j.end_time or v_old.weekdays is distinct from j.weekdays then
    v_changes := array_append(v_changes, 'data');
  end if;
  if v_old.cep is distinct from j.cep or v_old.street is distinct from j.street
     or v_old.number is distinct from j.number or v_old.city is distinct from j.city
     or v_old.uf is distinct from j.uf or v_old.place_type is distinct from j.place_type then
    v_changes := array_append(v_changes, 'endereço');
  end if;

  update public.jobs set
    oficio_id = j.oficio_id, title = j.title, pay = j.pay, cep = j.cep, street = j.street, number = j.number,
    complement = j.complement, neighborhood = j.neighborhood, city = j.city, uf = j.uf, lat = j.lat,
    lon = j.lon, date_to_arrange = j.date_to_arrange, start_date = j.start_date, end_date = j.end_date,
    start_time = j.start_time, end_time = j.end_time, diarias = j.diarias, dias = j.dias, urgent = j.urgent,
    photos = coalesce(j.photos, photos), slots = j.slots, description = j.description,
    requirements = j.requirements, payment_method = x.method, payment_note = x.note, weekdays = j.weekdays,
    place_type = j.place_type
  where id = p_job_id
  returning * into j;

  -- Mais posições numa vaga que lotou: quem foi recusado automaticamente volta para análise (Y03).
  if j.slots > v_old.slots then
    perform public.job_reopen_auto_rejected(p_job_id, 'vaga_reaberta');
  end if;

  if cardinality(v_changes) > 0 then
    select name into v_company from public.companies where id = j.company_id;
    for r in
      select worker_id from public.applications
       where job_id = p_job_id and status in ('enviada', 'em_analise', 'pre_selecionado', 'contratado')
    loop
      perform public.notify(r.worker_id, null, 'vaga_editada', 'A vaga mudou',
        v_company || ' mudou ' || array_to_string(v_changes, ', ') || ' de ' || public.job_title(j) ||
        '. Confira antes de ir.', '/vaga/' || p_job_id);
    end loop;
  end if;
end;
$$;

-- job_runs_on (de 20261011000200_x01_mural.sql): os dias marcados, quando a vaga tem.
create or replace function public.job_runs_on(p_job public.jobs, p_day date)
returns boolean language sql stable set search_path = public as $$
  select not p_job.date_to_arrange and p_job.start_date <= p_day and p_day <= coalesce(p_job.end_date, p_job.start_date)
     and case
           when p_job.weekdays is not null then extract(isodow from p_day)::smallint = any (p_job.weekdays)
           else case coalesce(p_job.dias::text, 'qualquer')
                  when 'semana' then extract(isodow from p_day) between 1 and 5
                  when 'fimdesemana' then extract(isodow from p_day) in (6, 7)
                  else true end
         end
$$;

-- reset_presence_on_new_dates (de 20261012000500_f12_presenca.sql): também quando os dias marcados mudam.
create or replace function public.reset_presence_on_new_dates()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.start_date is distinct from old.start_date or new.end_date is distinct from old.end_date
     or new.date_to_arrange is distinct from old.date_to_arrange or new.dias is distinct from old.dias
     or new.weekdays is distinct from old.weekdays then
    update public.applications set presence_confirmed_at = null
     where job_id = new.id and presence_confirmed_at is not null;
  end if;
  return null;
end;
$$;
drop trigger if exists jobs_reset_presence on public.jobs;
create trigger jobs_reset_presence after update of start_date, end_date, date_to_arrange, dias, weekdays on public.jobs
  for each row execute function public.reset_presence_on_new_dates();

-- feed_jobs (de 20261021000400_u49_busca_vagas.sql): mais os dias marcados e o tipo do local.
create or replace function public.feed_jobs(p_city text, p_uf text, p_lat double precision, p_lon double precision,
  p_radius_km integer default null, p_oficio text default null, p_quando text default null,
  p_search text default null, p_all_cities boolean default false, p_sort text default 'perto',
  p_limit integer default 30, p_cursor jsonb default null)
returns setof jsonb
language sql
stable security definer
set search_path = public, extensions
as $$
  with origin as (
    select st_setsrid(st_makepoint(p_lon, p_lat), 4326)::geography as g, public.bicos_today() as today,
           nullif(public.fold_text(btrim(coalesce(p_search, ''))), '') as needle
  ),
  terms as (
    -- As palavras da busca, sem as de ligação; só palavras de ligação ("de") → a busca inteira como uma palavra.
    select o.*,
           coalesce(
             nullif(array(
               select w from regexp_split_to_table(coalesce(o.needle, ''), '[^a-z0-9]+') w
                where w <> '' and w <> all (array['a', 'o', 'as', 'os', 'de', 'da', 'do', 'das', 'dos', 'e', 'em',
                                                  'no', 'na', 'nos', 'nas', 'para', 'pra', 'por', 'com', 'um', 'uma'])
             ), '{}'),
             array[o.needle]
           ) as words
      from origin o
  ),
  open_jobs as (
    select j.*, o.g as o_g, o.today
      from public.jobs j, terms o
     -- O mesmo que job_is_open(j), sem a chamada por linha (L13).
     where not j.closed and j.deleted_at is null and j.hidden_at is null and j.last_day >= o.today
       and public.job_holding(j.id) < j.slots
       and (o.needle is not null or p_oficio is null or j.oficio_id = p_oficio)
       and (
         case
           when o.needle is not null then
             p_all_cities
             or (j.city = p_city and j.uf = p_uf)
             -- U49: a busca nomeia a cidade da vaga (ou começa o nome dela).
             or position(public.fold_text(j.city) in o.needle) > 0
             or (length(o.needle) >= 4 and left(public.fold_text(j.city), length(o.needle)) = o.needle)
           when p_radius_km is not null then st_dwithin(j.area_geog, o.g, p_radius_km * 1000)
           else j.city = p_city and j.uf = p_uf
         end
       )
       and (
         o.needle is not null
         or p_quando is null
         or (p_quando = 'Hoje' and public.job_runs_on(j, o.today))
         or (p_quando = 'Amanhã' and public.job_runs_on(j, o.today + 1))
         or (p_quando = 'Durante a semana' and coalesce(j.dias::text, 'qualquer') in ('semana', 'qualquer'))
         or (p_quando = 'Fim de semana' and coalesce(j.dias::text, 'qualquer') in ('fimdesemana', 'qualquer'))
       )
       and (
         o.needle is null
         or not exists (
           select 1 from unnest(o.words) w
            where position(w in public.fold_text(concat_ws(' ', j.title, j.neighborhood, j.city, j.uf,
                    (select f.nome || ' ' || array_to_string(f.sinonimos, ' ') from public.oficios f
                      where f.id = j.oficio_id)))) = 0
         )
       )
  ),
  ranked as (
    select oj.*,
           case when oj.boost_ends_at > now() then 0 when oj.urgent then 1 else 2 end as rank,
           case p_sort
             when 'valor' then coalesce(-oj.pay::double precision, 1e12)
             when 'cedo' then coalesce(extract(epoch from oj.start_date::timestamp), 1e12)
             else st_distance(oj.area_geog, oj.o_g)
           end as sort_key,
           st_distance(oj.area_geog, oj.o_g) / 1000.0 as km
      from open_jobs oj
  )
  select jsonb_build_object(
           'id', r.id, 'company_id', r.company_id, 'oficio_id', r.oficio_id, 'title', r.title, 'pay', r.pay,
           'neighborhood', r.neighborhood, 'city', r.city, 'uf', r.uf, 'area_lat', r.area_lat, 'area_lon', r.area_lon,
           'date_to_arrange', r.date_to_arrange, 'start_date', r.start_date, 'end_date', r.end_date,
           'start_time', r.start_time, 'end_time', r.end_time, 'diarias', r.diarias, 'dias', r.dias,
           'urgent', r.urgent, 'boost_ends_at', r.boost_ends_at, 'photos', r.photos, 'slots', r.slots,
           'closed', r.closed, 'sem_contratacao', r.sem_contratacao, 'description', r.description,
           'requirements', r.requirements, 'created_at', r.created_at, 'updated_at', r.updated_at,
           'deleted_at', r.deleted_at, 'public_slug', r.public_slug, 'weekdays', r.weekdays, 'place_type', r.place_type,
           '_rank', r.rank, '_key', r.sort_key, '_km', round(r.km::numeric, 1))
    from ranked r
   where p_cursor is null
      or (r.rank, r.sort_key, r.id) > ((p_cursor->>'r')::int, (p_cursor->>'k')::double precision, p_cursor->>'id')
   order by r.rank, r.sort_key, r.id
   limit least(greatest(coalesce(p_limit, 30), 1), 60)
$$;

-- public_job_card (de 20261016000200_lanc10_link_publico.sql): mais os dias marcados e o tipo do local.
create or replace function public.public_job_card(p_slug text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_headers jsonb := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb;
  v_ip text;
  v_hash text;
  v_card jsonb;
begin
  -- cf-connecting-ip é posto pela Cloudflare na frente do Supabase (o cliente não consegue forjar); os outros
  -- ficam de reserva. Sem cabeçalho (SQL Editor, cron) não há limite.
  v_ip := coalesce(nullif(v_headers ->> 'cf-connecting-ip', ''), nullif(v_headers ->> 'x-real-ip', ''),
                   nullif(trim(split_part(v_headers ->> 'x-forwarded-for', ',', 1)), ''));
  if v_ip is not null then
    v_hash := encode(extensions.digest(v_ip || '|' || current_date::text, 'sha256'), 'hex');
    if (select count(*) from public.public_link_hits
         where ip_hash = v_hash and at > now() - interval '10 minutes') >= 60 then
      raise exception using errcode = 'BC409',
        message = 'Muitas vagas abertas em pouco tempo. Espere alguns minutos e tente de novo.';
    end if;
    insert into public.public_link_hits (ip_hash) values (v_hash);
  end if;

  if p_slug is null or p_slug !~ '^[a-z2-9]{10,32}$' then
    return null;
  end if;
  select jsonb_build_object(
    'id', j.id, 'oficio_id', j.oficio_id, 'title', j.title, 'pay', j.pay,
    'neighborhood', j.neighborhood, 'city', j.city, 'uf', j.uf,
    'date_to_arrange', j.date_to_arrange, 'start_date', j.start_date, 'end_date', j.end_date,
    'start_time', j.start_time, 'end_time', j.end_time, 'diarias', j.diarias, 'dias', j.dias,
    'weekdays', j.weekdays, 'place_type', j.place_type,
    'slots', j.slots, 'urgent', j.urgent, 'photos', j.photos, 'description', j.description,
    'requirements', j.requirements, 'payment_method', j.payment_method, 'payment_note', j.payment_note,
    'created_at', j.created_at, 'public_slug', j.public_slug,
    'aberta', public.job_is_open(j) and public.job_holding(j.id) < j.slots,
    'company', jsonb_build_object('name', c.name, 'logo_url', c.logo_url, 'rating', c.rating,
                                  'review_count', c.review_count, 'verified', c.verified)
  ) into v_card
  from public.jobs j join public.companies c on c.id = j.company_id
  where j.public_slug = p_slug and j.deleted_at is null and j.hidden_at is null;
  return v_card;
end;
$$;
