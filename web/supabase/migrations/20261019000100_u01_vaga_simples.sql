-- U01 (teste com os amigos, 19/10): cadastro de vaga mais simples.
--
-- O que a construtora deixa de preencher, e o que o banco passa a aceitar:
--   * ofício: a vaga é identificada pelo TÍTULO, agora obrigatório. `jobs.oficio_id` aceita null (vagas antigas
--     continuam com o delas); se vier, ainda tem de existir no catálogo;
--   * número e complemento do endereço: número pode vir vazio (o ponto do mapa sai do CEP);
--   * forma de pagamento: sem escolha, fica null ("Pagamento combinado direto" na tela), não mais 'pix_dia'.
-- Datas (só "a combinar"), urgente e requisitos saíram só da tela: o banco continua aceitando como antes.
-- Alerta de bico novo: sem ofício na vaga, todo alerta da região recebe (o filtro de ofício saiu do mural).
-- Idempotente.

alter table public.jobs alter column oficio_id drop not null;

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
    raise exception using errcode = 'BC422', message = 'Digite o CEP da obra (8 números).';
  end if;
  -- O ponto precisa cair no Brasil (sem ele, a distância no mural sai errada). U01: o número é opcional.
  if j.street = '' or j.neighborhood = '' or j.city = '' or j.uf !~ '^[A-Z]{2}$'
     or j.lat is null or j.lon is null or j.lat not between -34 and 6 or j.lon not between -74 and -28 then
    raise exception using errcode = 'BC422', message = 'Confira o endereço da obra.';
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
revoke all on function public.job_from_draft(jsonb, date) from public, anon, authenticated;

-- U01: sem forma de pagamento no rascunho, fica sem (null), em vez de prometer PIX no dia.
create or replace function public.job_extras_from_draft(p jsonb, out method text, out note text)
language plpgsql immutable set search_path = public as $$
declare
  v_req text[] := coalesce(array(select jsonb_array_elements_text(coalesce(p->'requirements', '[]'::jsonb))), '{}');
begin
  method := nullif(p->>'payment_method', '');
  note := nullif(btrim(coalesce(p->>'payment_note', '')), '');
  if method is not null and method not in ('pix_dia', 'pix_fim', 'dinheiro', 'outro') then
    raise exception using errcode = 'BC422', message = 'Escolha como a diária vai ser paga.';
  end if;
  if method = 'outro' and note is null then
    raise exception using errcode = 'BC422', message = 'Conte como a diária vai ser paga.';
  end if;
  if method is distinct from 'outro' then note := null; end if;
  if char_length(coalesce(note, '')) > 80 then
    raise exception using errcode = 'BC422', message = 'Use até 80 caracteres para explicar o pagamento.';
  end if;
  if cardinality(v_req) > 12 or exists (select 1 from unnest(v_req) r where char_length(r) > 60 or btrim(r) = '') then
    raise exception using errcode = 'BC422', message = 'Até 12 itens, cada um com até 60 caracteres.';
  end if;
end;
$$;

-- U01: vaga sem ofício avisa todo alerta da região (o alerta com ofício era do filtro que saiu do mural).
-- X13: o PostGIS mora em `extensions` (por isso o search_path com os dois).
create or replace function public.notify_job_alerts()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  r record;
  v_today date := public.bicos_today();
  v_text text := public.job_title(new) || ' em ' || coalesce(nullif(new.neighborhood, ''), new.city) ||
                 case when new.pay > 0 then ' · R$ ' || to_char(new.pay, 'FM999G999') || ' por diária' else '' end;
begin
  for r in
    select a.worker_id
      from public.job_alerts a
      join public.workers w on w.id = a.worker_id and w.name <> 'Conta excluída'
     where (a.oficio_id is null or new.oficio_id is null or a.oficio_id = new.oficio_id)
       and (a.notified_on is distinct from v_today or a.notified_count < 5)
       and case
             when a.radius_km is null then public.fold_text(a.city) = public.fold_text(new.city) and a.uf = new.uf
             else st_dwithin(new.area_geog, st_setsrid(st_makepoint(a.lon, a.lat), 4326)::geography, a.radius_km * 1000)
           end
  loop
    perform public.notify(r.worker_id, null, 'bico_novo', 'Bico novo perto de você', v_text, '/vaga/' || new.id);
    update public.job_alerts
       set notified_count = case when notified_on = v_today then notified_count + 1 else 1 end,
           notified_on = v_today
     where worker_id = r.worker_id;
  end loop;
  return null;
end;
$$;
revoke all on function public.notify_job_alerts() from public, anon, authenticated;

-- U01: a denúncia de uma vaga sem ofício também aparece na fila da equipe (o join com o catálogo era interno).
create or replace function public.report_target_info(p_type public.report_target, p_id text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v jsonb;
begin
  if p_type = 'vaga' then
    select jsonb_build_object(
      'title', public.job_title(j), 'text', left(j.description, 600), 'job_id', j.id,
      'hidden', j.hidden_at is not null, 'deleted', j.deleted_at is not null,
      'account_id', a.id, 'account_name', c.name)
      into v
      from public.jobs j join public.companies c on c.id = j.company_id
      left join public.accounts a on a.company_id = j.company_id
     where j.id = p_id;
  elsif p_type = 'perfil' then
    select jsonb_build_object(
      'title', coalesce(w.name, c.name), 'text', null, 'account_id', a.id,
      'account_name', coalesce(w.name, c.name))
      into v
      from public.accounts a
      left join public.workers w on w.id = a.worker_id
      left join public.companies c on c.id = a.company_id
     where a.id::text = p_id;
  elsif p_type = 'avaliacao' then
    select jsonb_build_object(
      'title', 'Avaliação ' || r.value || '★', 'text', r.comment,
      'account_id', a.id, 'account_name', coalesce(w.name, c.name))
      into v
      from public.reviews r
      left join public.applications ap on ap.id = r.application_id
      left join public.jobs j on j.id = ap.job_id
      left join public.accounts a on a.id = (
        case when r.direction = 'para_construtora'
             then (select x.id from public.accounts x where x.worker_id = ap.worker_id)
             else (select x.id from public.accounts x where x.company_id = j.company_id) end)
      left join public.workers w on w.id = a.worker_id
      left join public.companies c on c.id = a.company_id
     where r.id::text = p_id;
  elsif p_type = 'post' then
    select jsonb_build_object(
      'title', 'Publicação no portfólio', 'text', p.caption, 'media_url', p.media_url,
      'account_id', a.id, 'account_name', w.name)
      into v
      from public.worker_posts p join public.workers w on w.id = p.worker_id
      left join public.accounts a on a.worker_id = p.worker_id
     where p.id::text = p_id;
  end if;
  return coalesce(v, jsonb_build_object('title', 'Conteúdo que não existe mais', 'text', null, 'account_id', null));
end;
$$;
