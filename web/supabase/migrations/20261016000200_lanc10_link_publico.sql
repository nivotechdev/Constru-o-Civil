-- L10 (lançamento): o link público da vaga deixa de ser enumerável.
--
-- Antes: /v/BC-1, /v/BC-2… — os IDs são sequenciais e `public_job_card` (a única RPC para visitante) abria
-- qualquer um, então dava para baixar o mural inteiro sem conta, uma vaga atrás da outra.
-- Agora:
--   * cada vaga ganha um `public_slug` aleatório (12 caracteres de um alfabeto de 31 — sem 0/o, 1/l/i —, ~59 bits) e o link
--     compartilhado é /v/<slug>. O código BC-n continua sendo o ID e aparecendo na tela;
--   * `public_job_card(p_slug)` só abre pelo slug — um BC-n devolve nada (o app manda para o login e de lá para
--     a vaga, o que serve aos links antigos);
--   * limite por IP: 60 consultas a cada 10 minutos (BC409 depois disso). O IP vem dos cabeçalhos que a API
--     repassa e é guardado só como hash do dia, apagado no dia seguinte pela limpeza das 4h17.
-- Idempotente.

create or replace function public.new_public_slug()
returns text language sql volatile set search_path = public as $$
  -- Sem 0/o, 1/l/i: dá para ditar o link por telefone sem confusão.
  select string_agg(substr('abcdefghjkmnpqrstuvwxyz23456789', (get_byte(b, i) % 31) + 1, 1), '' order by i)
    from (select extensions.gen_random_bytes(12) as b) r, generate_series(0, 11) as i
$$;
revoke all on function public.new_public_slug() from public, anon, authenticated;

alter table public.jobs add column if not exists public_slug text;
update public.jobs set public_slug = public.new_public_slug() where public_slug is null;
alter table public.jobs alter column public_slug set default public.new_public_slug();
alter table public.jobs alter column public_slug set not null;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'jobs_public_slug_format') then
    alter table public.jobs add constraint jobs_public_slug_format check (public_slug ~ '^[a-z2-9]{10,32}$');
  end if;
end $$;
create unique index if not exists jobs_public_slug_key on public.jobs (public_slug);
-- Quem vê a vaga logado pode compartilhar o link dela.
grant select (public_slug) on public.jobs to authenticated;

-- Consultas ao link público por IP (hash do IP + dia; nada que identifique a pessoa depois de 1 dia).
create table if not exists public.public_link_hits (
  ip_hash text not null,
  at timestamptz not null default now()
);
create index if not exists public_link_hits_ip_at_idx on public.public_link_hits (ip_hash, at desc);
alter table public.public_link_hits enable row level security;
revoke all on table public.public_link_hits from anon, authenticated;

-- O parâmetro mudou de nome (p_job_id → p_slug): `create or replace` não troca nome de parâmetro.
drop function if exists public.public_job_card(text);
create function public.public_job_card(p_slug text)
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
revoke all on function public.public_job_card(text) from public;
grant execute on function public.public_job_card(text) to anon, authenticated;

-- A limpeza diária (X22) também apaga as consultas de ontem.
create or replace function public.purge_auth_attempts()
returns integer language plpgsql security definer set search_path = public as $$
declare
  n integer;
begin
  with x as (delete from public.auth_attempts where at < now() - interval '1 day' returning 1)
  select count(*)::int into n from x;
  delete from public.whatsapp_verifications where verified_at < now() - interval '1 day';
  delete from public.application_attempts where created_at < now() - interval '2 days';
  delete from public.public_link_hits where at < now() - interval '1 day';
  return n;
end;
$$;
revoke all on function public.purge_auth_attempts() from public, anon, authenticated;
