-- U51 (21/10): o endereço de cada conta (CEP, rua, bairro e cidade) e a distância de verdade até cada bico.
--   * addresses: uma linha por conta, PRIVADA — só a própria conta lê (RLS), ninguém escreve direto; o ponto é o do
--     endereço (rua/CEP), para a distância "da sua casa" sair precisa. O que os outros veem continua igual: a cidade
--     do trabalhador e um ponto arredondado a 2 casas (~1 km) em workers; a cidade da empresa em companies.location;
--   * set_my_address(p): a única forma de gravar/trocar o endereço (Editar perfil);
--   * finish_sign_up(p): o cadastro passa a mandar o endereço (p.address); o formato antigo (cidade e ponto) segue
--     aceito, para um app aberto antes desta versão;
--   * jobs.area_lat/area_lon (o ponto que todos veem da vaga, Z06): antes o ponto exato arredondado a 2 casas (erro de
--     até ~800 m); agora o ponto exato deslocado de 100 a 200 m numa direção sorteada uma vez (quando o endereço muda)
--     — a distância sai com erro de no máximo 200 m e o endereço continua escondido. area_geog passa a vir deles;
--   * export_my_data leva o endereço.
-- A exclusão da conta leva o endereço junto (cascade de accounts). Idempotente.

create table if not exists public.addresses (
  account_id uuid primary key references public.accounts (id) on delete cascade,
  cep text not null check (cep ~ '^\d{5}-\d{3}$'),
  street text not null check (char_length(street) between 2 and 120),
  neighborhood text not null check (char_length(neighborhood) between 2 and 80),
  city text not null check (char_length(city) between 2 and 80),
  uf text not null check (uf ~ '^[A-Z]{2}$'),
  lat double precision not null check (lat between -34 and 6),
  lon double precision not null check (lon between -74 and -34),
  -- Até onde o ponto chega: o número da casa, a rua, o CEP, o bairro ou só a cidade (o centro).
  precision text not null default 'rua' check (precision in ('numero', 'rua', 'cep', 'bairro', 'cidade')),
  updated_at timestamptz not null default now()
);
alter table public.addresses enable row level security;
revoke all on public.addresses from public, anon, authenticated;
grant select (account_id, cep, street, neighborhood, city, uf, lat, lon, precision, updated_at)
  on public.addresses to authenticated;

drop policy if exists addresses_own on public.addresses;
create policy addresses_own on public.addresses
  for select to authenticated using (account_id = (select auth.uid()));

-- Confere e grava o endereço da conta, e o que os outros veem (cidade; ponto de ~1 km do trabalhador). Interna: as
-- RPCs abaixo dizem de quem é o endereço.
create or replace function public.save_address(p_account uuid, p jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_account public.accounts;
  v_cep text := regexp_replace(coalesce(p->>'cep', ''), '\D', '', 'g');
  v_street text := btrim(regexp_replace(coalesce(p->>'street', ''), '\s+', ' ', 'g'));
  v_neighborhood text := btrim(regexp_replace(coalesce(p->>'neighborhood', ''), '\s+', ' ', 'g'));
  v_city text := btrim(regexp_replace(coalesce(p->>'city', ''), '\s+', ' ', 'g'));
  v_uf text := upper(btrim(coalesce(p->>'uf', '')));
  v_precision text := coalesce(p->>'precision', 'rua');
  v_lat double precision;
  v_lon double precision;
begin
  select * into v_account from public.accounts where id = p_account;
  if not found then
    raise exception using errcode = 'BC401', message = 'Entre na sua conta de novo para continuar.';
  end if;
  if char_length(v_cep) <> 8 then
    raise exception using errcode = 'BC422', message = 'Confira o CEP (8 números).';
  end if;
  if char_length(v_street) not between 2 and 120 then
    raise exception using errcode = 'BC422', message = 'Informe a rua.';
  end if;
  if char_length(v_neighborhood) not between 2 and 80 then
    raise exception using errcode = 'BC422', message = 'Informe o bairro.';
  end if;
  if char_length(v_city) not between 2 and 80 or v_uf not in ('AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
     'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO') then
    raise exception using errcode = 'BC422', message = 'Escolha a cidade na lista.';
  end if;
  begin
    v_lat := round((p->>'lat')::numeric, 6);
    v_lon := round((p->>'lon')::numeric, 6);
  exception when others then
    v_lat := null;
  end;
  if v_lat is null or v_lon is null or v_lat not between -34 and 6 or v_lon not between -74 and -34 then
    raise exception using errcode = 'BC422', message = 'Não achamos esse endereço no mapa. Confira a rua e o bairro.';
  end if;
  if v_precision not in ('numero', 'rua', 'cep', 'bairro', 'cidade') then
    v_precision := 'rua';
  end if;

  insert into public.addresses (account_id, cep, street, neighborhood, city, uf, lat, lon, precision, updated_at)
  values (v_account.id, substr(v_cep, 1, 5) || '-' || substr(v_cep, 6), v_street, v_neighborhood, v_city, v_uf,
          v_lat, v_lon, v_precision, now())
  on conflict (account_id) do update
    set cep = excluded.cep, street = excluded.street, neighborhood = excluded.neighborhood, city = excluded.city,
        uf = excluded.uf, lat = excluded.lat, lon = excluded.lon, precision = excluded.precision,
        updated_at = excluded.updated_at;

  if v_account.role = 'trabalhador' then
    update public.workers
       set city = v_city || ', ' || v_uf, neighborhood = null,
           lat = round(v_lat::numeric, 2)::double precision, lon = round(v_lon::numeric, 2)::double precision
     where id = v_account.worker_id;
  else
    update public.companies set location = v_city || ', ' || v_uf where id = v_account.company_id;
  end if;
end;
$$;
revoke all on function public.save_address(uuid, jsonb) from public, anon, authenticated;

create or replace function public.set_my_address(p jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception using errcode = 'BC401', message = 'Entre na sua conta de novo para continuar.';
  end if;
  perform public.save_address(auth.uid(), p);
end;
$$;
revoke all on function public.set_my_address(jsonb) from public, anon;
grant execute on function public.set_my_address(jsonb) to authenticated;

-- finish_sign_up (de 20261020000200_u12_perfil_simples.sql): com p.address, o endereço; sem ele, como antes.
create or replace function public.finish_sign_up(p jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_account public.accounts;
  v_city text := btrim(coalesce(p->>'city', ''));
  v_lat double precision;
  v_lon double precision;
begin
  select * into v_account from public.accounts where id = auth.uid();
  if not found then
    raise exception using errcode = 'BC401', message = 'Entre na sua conta de novo para continuar.';
  end if;
  if jsonb_typeof(p->'address') = 'object' then
    perform public.save_address(v_account.id, p->'address');
  else
    begin
      v_lat := round((p->>'lat')::numeric, 2);
      v_lon := round((p->>'lon')::numeric, 2);
    exception when others then
      v_lat := null;
    end;
    if v_city = '' or char_length(v_city) > 80 or v_lat is null or v_lon is null
       or v_lat not between -34 and 6 or v_lon not between -74 and -34 then
      raise exception using errcode = 'BC422', message = 'Informe seu endereço para continuar.';
    end if;
    if v_account.role = 'trabalhador' then
      update public.workers set city = v_city, neighborhood = null, lat = v_lat, lon = v_lon
       where id = v_account.worker_id;
    else
      update public.companies set location = v_city where id = v_account.company_id;
    end if;
  end if;
  update public.accounts set profile_completed_at = coalesce(profile_completed_at, now()) where id = v_account.id;
end;
$$;

-- O ponto que todos veem da vaga: o exato deslocado de 100 a 200 m, sorteado quando o ponto exato muda (num update
-- que não mexe no endereço ele fica como estava — e ninguém o escolhe à mão).
create or replace function public.jobs_set_area_point()
returns trigger language plpgsql set search_path = public as $$
declare
  v_m double precision;
  v_dir double precision;
begin
  if tg_op = 'UPDATE' and new.lat is not distinct from old.lat and new.lon is not distinct from old.lon
     and old.area_lat is not null and old.area_lon is not null then
    new.area_lat := old.area_lat;
    new.area_lon := old.area_lon;
    return new;
  end if;
  v_m := 100 + random() * 100;
  v_dir := random() * 2 * pi();
  new.area_lat := round((new.lat + v_m * cos(v_dir) / 111320.0)::numeric, 5)::double precision;
  new.area_lon := round((new.lon + v_m * sin(v_dir) / (111320.0 * cos(radians(new.lat))))::numeric, 5)::double precision;
  return new;
end;
$$;
revoke all on function public.jobs_set_area_point() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_attribute where attrelid = 'public.jobs'::regclass and attname = 'area_lat'
                                         and attgenerated = 's') then
    alter table public.jobs alter column area_lat drop expression;
    alter table public.jobs alter column area_lon drop expression;
    -- As vagas que já existem ganham o ponto novo (sem mexer em updated_at).
    alter table public.jobs disable trigger touch_job_v2;
    with r as (select id, 100 + random() * 100 as m, random() * 2 * pi() as dir from public.jobs)
    update public.jobs j
       set area_lat = round((j.lat + r.m * cos(r.dir) / 111320.0)::numeric, 5)::double precision,
           area_lon = round((j.lon + r.m * sin(r.dir) / (111320.0 * cos(radians(j.lat))))::numeric, 5)::double precision
      from r where r.id = j.id;
    alter table public.jobs enable trigger touch_job_v2;
  end if;
  -- area_geog (do X13) era calculada do ponto exato arredondado; passa a ser o ponto acima (trocar só a fórmula, do
  -- Postgres 17: apagar a coluna e criar de novo trava o painel do Supabase).
  if exists (select 1 from pg_attrdef d join pg_attribute a on a.attrelid = d.adrelid and a.attnum = d.adnum
              where d.adrelid = 'public.jobs'::regclass and a.attname = 'area_geog'
                and pg_get_expr(d.adbin, d.adrelid) like '%round%') then
    alter table public.jobs alter column area_geog set expression as (
      extensions.st_setsrid(extensions.st_makepoint(area_lon, area_lat), 4326)::extensions.geography
    );
  end if;
end;
$$;

drop trigger if exists jobs_area_point on public.jobs;
create trigger jobs_area_point before insert or update on public.jobs
  for each row execute function public.jobs_set_area_point();

-- export_my_data (de 20261015000200_lanc07_aceites.sql): mais o endereço.
create or replace function public.export_my_data()
returns jsonb language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_account public.accounts;
  v_key text;
  v_doc text;
begin
  select * into v_account from public.accounts where id = auth.uid();
  if not found then
    raise exception using errcode = 'BC401', message = 'Entre na sua conta de novo para continuar.';
  end if;
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'nivotech_documento_key';
  if v_key is not null and v_account.document_cipher is not null then
    v_doc := extensions.pgp_sym_decrypt(v_account.document_cipher, v_key);
  end if;
  return jsonb_build_object(
    'gerado_em', now(),
    'conta', jsonb_build_object(
      'email', v_account.email, 'lado', v_account.role, 'documento', v_doc, 'whatsapp', v_account.whatsapp,
      'email_confirmado_em', v_account.email_confirmed_at, 'perfil_completo_em', v_account.profile_completed_at,
      'termos_versao', v_account.terms_version, 'termos_aceitos_em', v_account.terms_accepted_at,
      'criada_em', v_account.created_at),
    'endereco', (select to_jsonb(a) - 'account_id' from public.addresses a where a.account_id = v_account.id),
    'perfil', coalesce(
      (select to_jsonb(w) from public.workers w where w.id = v_account.worker_id),
      (select to_jsonb(c) from public.companies c where c.id = v_account.company_id)),
    'vagas', coalesce((select jsonb_agg(to_jsonb(j)) from public.jobs j where j.company_id = v_account.company_id), '[]'),
    'candidaturas', coalesce((
      select jsonb_agg(to_jsonb(a) || jsonb_build_object('historico', (
        select jsonb_agg(to_jsonb(e) order by e.at) from public.application_events e where e.application_id = a.id)))
        from public.applications a
       where a.worker_id = v_account.worker_id
          or a.job_id in (select id from public.jobs where company_id = v_account.company_id)), '[]'),
    'avaliacoes_recebidas', coalesce((
      select jsonb_agg(to_jsonb(r)) from public.reviews r
       where r.worker_id = v_account.worker_id or r.company_id = v_account.company_id), '[]'),
    'vagas_salvas', coalesce((select jsonb_agg(to_jsonb(s)) from public.saved_jobs s where s.worker_id = v_account.worker_id), '[]'),
    'portfolio', coalesce((select jsonb_agg(to_jsonb(p)) from public.worker_posts p where p.worker_id = v_account.worker_id), '[]'),
    'notificacoes', coalesce((
      select jsonb_agg(to_jsonb(n)) from public.notifications n
       where n.worker_id = v_account.worker_id or n.company_id = v_account.company_id), '[]'),
    'pagamentos', coalesce((select jsonb_agg(to_jsonb(b) - 'pix_code') from public.boost_payments b where b.company_id = v_account.company_id), '[]'),
    'aceites', coalesce((
      select jsonb_agg(jsonb_build_object('documento', t.document, 'versao', t.version, 'aceito_em', t.accepted_at)
                       order by t.accepted_at)
        from public.terms_acceptances t where t.account_id = v_account.id), '[]'),
    'verificacao_identidade', coalesce((
      select jsonb_agg(jsonb_build_object('enviada_em', s.created_at, 'consentimento_versao', s.consent_version,
                                          'consentimento_em', s.consent_at, 'decidida_em', s.decided_at)
                       order by s.created_at)
        from public.identity_submissions s where s.worker_id = v_account.worker_id), '[]')
  );
end;
$$;
