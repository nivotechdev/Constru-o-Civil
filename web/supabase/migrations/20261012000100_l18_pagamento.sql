-- L18 (+ P06): forma e prazo de pagamento da diária como campo da vaga, e limite dos requisitos.
--
-- payment_method: 'pix_dia' (PIX no fim de cada diária), 'pix_fim' (PIX no fim do bico), 'dinheiro', 'outro'
-- (com payment_note obrigatória). Vagas antigas ficam sem (ficam com 'pix_dia', o texto fixo que o app mostrava).
-- publish_job / update_job leem os dois campos do rascunho; mudar a forma de pagamento avisa os candidatos
-- como mudar o valor. Requisitos: até 12, cada um com até 60 caracteres.

alter table public.jobs
  add column if not exists payment_method text,
  add column if not exists payment_note text;
do $$ begin
  alter table public.jobs add constraint jobs_payment_method_check
    check (payment_method is null or payment_method in ('pix_dia', 'pix_fim', 'dinheiro', 'outro'));
exception when duplicate_object then null;
end $$;
do $$ begin
  alter table public.jobs add constraint jobs_payment_note_check
    check (payment_note is null or char_length(payment_note) <= 80);
exception when duplicate_object then null;
end $$;

-- Até aqui o app mostrava "Pagamento em PIX no fim da diária" em toda vaga: é o que as vagas antigas
-- prometeram.
update public.jobs set payment_method = 'pix_dia' where payment_method is null;

grant select (payment_method, payment_note) on public.jobs to authenticated;

-- Confere os campos novos do rascunho (as mesmas regras de pages/recruiter/jobForm.ts).
create or replace function public.job_extras_from_draft(p jsonb, out method text, out note text)
language plpgsql immutable set search_path = public as $$
declare
  v_req text[] := coalesce(array(select jsonb_array_elements_text(coalesce(p->'requirements', '[]'::jsonb))), '{}');
begin
  method := coalesce(nullif(p->>'payment_method', ''), 'pix_dia');
  note := nullif(btrim(coalesce(p->>'payment_note', '')), '');
  if method not in ('pix_dia', 'pix_fim', 'dinheiro', 'outro') then
    raise exception using errcode = 'BC422', message = 'Escolha como a diária vai ser paga.';
  end if;
  if method = 'outro' and note is null then
    raise exception using errcode = 'BC422', message = 'Conte como a diária vai ser paga.';
  end if;
  if method <> 'outro' then note := null; end if;
  if char_length(coalesce(note, '')) > 80 then
    raise exception using errcode = 'BC422', message = 'Use até 80 caracteres para explicar o pagamento.';
  end if;
  if cardinality(v_req) > 12 or exists (select 1 from unnest(v_req) r where char_length(r) > 60 or btrim(r) = '') then
    raise exception using errcode = 'BC422', message = 'Até 12 itens, cada um com até 60 caracteres.';
  end if;
end;
$$;

create or replace function public.publish_job(p jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_company uuid := public.my_company_id();
  j public.jobs;
  x record;
  v_id text;
begin
  if v_company is null then
    raise exception using errcode = 'BC401', message = 'Só a conta de construtora pode publicar vagas.';
  end if;
  if not exists (select 1 from public.accounts where id = auth.uid() and profile_completed_at is not null) then
    raise exception using errcode = 'BC409', message = 'Complete o perfil da empresa antes de publicar.';
  end if;
  j := public.job_from_draft(p);
  x := public.job_extras_from_draft(p);
  insert into public.jobs (
    company_id, oficio_id, title, pay, cep, street, number, complement, neighborhood, city, uf, lat, lon,
    date_to_arrange, start_date, end_date, start_time, end_time, diarias, dias, urgent, photos, slots,
    description, requirements, payment_method, payment_note
  ) values (
    v_company, j.oficio_id, j.title, j.pay, j.cep, j.street, j.number, j.complement, j.neighborhood, j.city,
    j.uf, j.lat, j.lon, j.date_to_arrange, j.start_date, j.end_date, j.start_time, j.end_time, j.diarias,
    j.dias, j.urgent, j.photos, j.slots, j.description, j.requirements, x.method, x.note
  ) returning id into v_id;
  return v_id;
end;
$$;

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
     or v_old.end_time is distinct from j.end_time then
    v_changes := array_append(v_changes, 'data');
  end if;
  if v_old.cep is distinct from j.cep or v_old.street is distinct from j.street
     or v_old.number is distinct from j.number or v_old.city is distinct from j.city
     or v_old.uf is distinct from j.uf then
    v_changes := array_append(v_changes, 'endereço');
  end if;

  update public.jobs set
    oficio_id = j.oficio_id, title = j.title, pay = j.pay, cep = j.cep, street = j.street, number = j.number,
    complement = j.complement, neighborhood = j.neighborhood, city = j.city, uf = j.uf, lat = j.lat,
    lon = j.lon, date_to_arrange = j.date_to_arrange, start_date = j.start_date, end_date = j.end_date,
    start_time = j.start_time, end_time = j.end_time, diarias = j.diarias, dias = j.dias, urgent = j.urgent,
    photos = coalesce(j.photos, photos), slots = j.slots, description = j.description,
    requirements = j.requirements, payment_method = x.method, payment_note = x.note
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

revoke all on function public.job_extras_from_draft(jsonb) from public, anon, authenticated;
revoke all on function public.publish_job(jsonb), public.update_job(text, jsonb) from public, anon;
grant execute on function public.publish_job(jsonb), public.update_job(text, jsonb) to authenticated;
