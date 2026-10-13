-- X21: o funil do produto, dia a dia, contado a partir do que o banco já guarda (sem rastrear pessoas, sem
-- ferramenta de terceiros e sem guardar nada novo sobre ninguém — por isso não depende de consentimento):
-- cadastro iniciado (conta criada no Auth), e-mail confirmado, cadastro concluído (perfil completo), vaga
-- publicada, candidatura, aprovação, contratação, diária concluída e impulsionamento pago (com o valor).
-- Só para service_role (painel / SQL Editor):  select * from public.funnel_daily('2026-10-01', '2026-10-31');
-- Idempotente.

create or replace function public.funnel_daily(p_from date, p_to date)
returns table (
  dia date,
  cadastros_iniciados integer,
  emails_confirmados integer,
  cadastros_concluidos integer,
  vagas_publicadas integer,
  candidaturas integer,
  aprovacoes integer,
  contratacoes integer,
  diarias_concluidas integer,
  impulsionamentos_pagos integer,
  receita_centavos bigint
)
language sql stable security definer set search_path = public as $$
  with days as (
    select d::date as dia from generate_series(p_from, least(p_to, p_from + 366), interval '1 day') d
  )
  select
    days.dia,
    (select count(*)::int from auth.users u where (u.created_at at time zone 'America/Sao_Paulo')::date = days.dia),
    (select count(*)::int from auth.users u where (u.email_confirmed_at at time zone 'America/Sao_Paulo')::date = days.dia),
    (select count(*)::int from public.accounts a where (a.profile_completed_at at time zone 'America/Sao_Paulo')::date = days.dia),
    (select count(*)::int from public.jobs j where (j.created_at at time zone 'America/Sao_Paulo')::date = days.dia),
    (select count(*)::int from public.application_events e where e.status = 'enviada'
        and (e.at at time zone 'America/Sao_Paulo')::date = days.dia),
    (select count(*)::int from public.application_events e where e.status = 'pre_selecionado'
        and (e.at at time zone 'America/Sao_Paulo')::date = days.dia),
    (select count(*)::int from public.application_events e where e.status = 'contratado'
        and (e.at at time zone 'America/Sao_Paulo')::date = days.dia),
    (select count(*)::int from public.application_events e where e.status = 'concluida'
        and (e.at at time zone 'America/Sao_Paulo')::date = days.dia),
    (select count(*)::int from public.boost_payments p where p.status = 'confirmado'
        and (p.confirmed_at at time zone 'America/Sao_Paulo')::date = days.dia),
    (select coalesce(sum(p.amount_cents), 0)::bigint from public.boost_payments p where p.status = 'confirmado'
        and (p.confirmed_at at time zone 'America/Sao_Paulo')::date = days.dia)
  from days
  order by days.dia
$$;
revoke all on function public.funnel_daily(date, date) from public, anon, authenticated;
grant execute on function public.funnel_daily(date, date) to service_role;
