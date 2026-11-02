-- AUD-012: nenhum limite de vagas por empresa e "urgente" grátis pelo pedido. Decisão dos sócios (02/11/2026):
--   * sem verificação: até 10 vagas abertas ao mesmo tempo e 3 novas por dia; verificada: 30 abertas e 10 por dia
--     (app_config: jobs_open_max_unverified / jobs_open_max_verified / jobs_per_day_unverified / jobs_per_day_verified);
--   * o campo `urgent` do pedido é ignorado (publish_job e update_job); só o impulso pago destaca a vaga.
-- Idempotente.

-- job_from_draft (de 20261102000300_aud003_limites_de_texto.sql)
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
  -- AUD-012: "urgente" não vem mais do pedido (só o impulso pago destaca a vaga).
  j.urgent := false;
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

-- publish_job (de 20261021000700_u52_dias_e_local.sql)
create or replace function public.publish_job(p jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_company uuid := public.my_company_id();
  j public.jobs;
  x record;
  v_id text;
  v_verified boolean;
  v_max_open integer;
  v_max_day integer;
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
  -- AUD-012: tetos por empresa (os números ficam em app_config e valem até o ajuste depois do piloto).
  select (verification_status = 'verificada') into v_verified from public.companies where id = v_company;
  v_max_open := coalesce(nullif((select value from public.app_config
    where key = case when v_verified then 'jobs_open_max_verified' else 'jobs_open_max_unverified' end), '')::integer,
    case when v_verified then 30 else 10 end);
  v_max_day := coalesce(nullif((select value from public.app_config
    where key = case when v_verified then 'jobs_per_day_verified' else 'jobs_per_day_unverified' end), '')::integer,
    case when v_verified then 10 else 3 end);
  if (select count(*) from public.jobs
       where company_id = v_company and not closed and deleted_at is null and last_day >= public.bicos_today()) >= v_max_open then
    raise exception using errcode = 'BC409',
      message = 'Você já tem ' || v_max_open || ' vagas abertas. Encerre alguma para publicar outra.';
  end if;
  if (select count(*) from public.jobs
       where company_id = v_company and (created_at at time zone 'America/Sao_Paulo')::date = public.bicos_today()) >= v_max_day then
    raise exception using errcode = 'BC409',
      message = 'Você já publicou ' || v_max_day || ' vagas hoje. Publique as próximas amanhã.';
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

-- update_job (de 20261021000700_u52_dias_e_local.sql)
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
    start_time = j.start_time, end_time = j.end_time, diarias = j.diarias, dias = j.dias,
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
