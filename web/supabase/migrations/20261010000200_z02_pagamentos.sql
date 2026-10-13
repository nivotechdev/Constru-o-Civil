-- Z02 (+ Y13) — Impulsionar só com pagamento de verdade.
--
-- Antes: qualquer conta logada chamava simulate_pix_paid (confirmava o PIX) e pay_with_card (aprovava
-- qualquer cartão sem cobrar); o código PIX gerado no banco não era pagável. Agora:
--   * as funções de simulação deixam de existir no banco (a simulação fica só no modo de demonstração);
--   * a cobrança nasce na Edge Function `criar-cobranca`, que fala com o provedor (Mercado Pago) e
--     grava o pagamento pelas funções abaixo, como service_role;
--   * só a Edge Function `webhook-pagamento` (service_role) confirma, depois de conferir a assinatura e
--     o status do pagamento direto no provedor; a confirmação é idempotente (payment_webhook_events);
--   * Y13: um só pagamento aguardando por vaga (gerar outro cancela o anterior); o prazo soma a partir
--     de max(boost_ends_at, agora); a confirmação revalida a vaga e, se ela não puder mais ser
--     impulsionada, o pagamento fica "reembolso_pendente" (e a construtora é avisada).
-- Idempotente.

alter type public.payment_status add value if not exists 'cancelado';
alter type public.payment_status add value if not exists 'reembolso_pendente';

alter table public.boost_payments
  add column if not exists provider text,
  add column if not exists provider_payment_id text,
  add column if not exists pix_qr_base64 text,
  add column if not exists status_detail text,
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists boost_payments_provider_id_key
  on public.boost_payments (provider, provider_payment_id) where provider_payment_id is not null;
create unique index if not exists boost_payments_one_pending_per_job
  on public.boost_payments (job_id) where status = 'aguardando';
create index if not exists boost_payments_job_idx on public.boost_payments (job_id);

-- Cada aviso do provedor, uma vez só (o provedor reenvia até receber 200).
create table if not exists public.payment_webhook_events (
  id bigint generated always as identity primary key,
  provider text not null,
  event_id text not null,
  provider_payment_id text,
  received_at timestamptz not null default now(),
  result text,
  unique (provider, event_id)
);
alter table public.payment_webhook_events enable row level security;
revoke all on table public.payment_webhook_events from anon, authenticated;

-- ---------------------------------------------------------------------------------------------------
-- Fora: a simulação e o PIX de mentira
-- ---------------------------------------------------------------------------------------------------

drop function if exists public.simulate_pix_paid(uuid);
drop function if exists public.pay_with_card(text, public.boost_plan, text);
drop function if exists public.start_pix_payment(text, public.boost_plan);

-- ---------------------------------------------------------------------------------------------------
-- Planos: o "24h + aviso por WhatsApp" sai até o envio existir (Z03)
-- ---------------------------------------------------------------------------------------------------

create or replace function public.boost_plan_cents(p_plan public.boost_plan)
returns integer language sql immutable set search_path = public as $$
  select case p_plan when '24h' then 1200 when '3d' then 2800 end
$$;

create or replace function public.boost_plan_hours(p_plan public.boost_plan)
returns integer language sql immutable set search_path = public as $$
  select case p_plan when '24h' then 24 when '3d' then 72 end
$$;

-- ---------------------------------------------------------------------------------------------------
-- A Edge Function criar-cobranca: abre o pagamento (em nome da conta, conferida pelo token) e, depois
-- de falar com o provedor, grava o que ele devolveu.
-- ---------------------------------------------------------------------------------------------------

create or replace function public.begin_boost_payment(
  p_account uuid, p_job_id text, p_plan public.boost_plan, p_method public.payment_method
) returns public.boost_payments language plpgsql security definer set search_path = public as $$
declare
  v_company uuid := (select company_id from public.accounts where id = p_account);
  v_job public.jobs;
  v_pay public.boost_payments;
  v_blocker text;
begin
  if v_company is null then
    raise exception using errcode = 'BC401', message = 'Só a conta de construtora pode impulsionar.';
  end if;
  if public.boost_plan_cents(p_plan) is null then
    raise exception using errcode = 'BC422', message = 'Escolha um dos planos.';
  end if;
  select * into v_job from public.jobs where id = p_job_id for update;
  if not found then
    raise exception using errcode = 'BC404', message = 'Essa vaga não existe mais.';
  end if;
  v_blocker := case
    when v_job.company_id is distinct from v_company then 'Só a construtora da vaga pode impulsionar.'
    when not public.job_is_open(v_job) or public.job_holding(v_job.id) >= v_job.slots
      then 'Só dá para impulsionar uma vaga aberta.'
    when v_job.boost_ends_at > now() then 'Essa vaga já está impulsionada.'
  end;
  if v_blocker is not null then
    raise exception using errcode = 'BC409', message = v_blocker;
  end if;
  -- Um pagamento aguardando por vaga: o anterior (código PIX que ficou para trás) é cancelado.
  update public.boost_payments set status = 'cancelado', updated_at = now()
   where job_id = p_job_id and status = 'aguardando';
  insert into public.boost_payments (job_id, company_id, plan, method, amount_cents, provider, expires_at)
  values (p_job_id, v_company, p_plan, p_method, public.boost_plan_cents(p_plan), 'mercadopago',
          case when p_method = 'pix' then now() + interval '30 minutes' end)
  returning * into v_pay;
  return v_pay;
end;
$$;

create or replace function public.attach_boost_charge(
  p_payment_id uuid, p_provider_payment_id text, p_pix_code text, p_pix_qr_base64 text,
  p_expires_at timestamptz, p_card_last4 text
) returns public.boost_payments language plpgsql security definer set search_path = public as $$
declare
  v_pay public.boost_payments;
begin
  update public.boost_payments
     set provider_payment_id = p_provider_payment_id,
         pix_code = coalesce(p_pix_code, pix_code),
         pix_qr_base64 = coalesce(p_pix_qr_base64, pix_qr_base64),
         expires_at = coalesce(p_expires_at, expires_at),
         card_last4 = coalesce(p_card_last4, card_last4),
         updated_at = now()
   where id = p_payment_id
  returning * into v_pay;
  if not found then
    raise exception using errcode = 'BC404', message = 'Esse pagamento não existe.';
  end if;
  return v_pay;
end;
$$;

-- O provedor recusou, cancelou ou o PIX venceu.
create or replace function public.fail_boost_payment(
  p_payment_id uuid, p_status public.payment_status, p_detail text default null
) returns public.boost_payments language plpgsql security definer set search_path = public as $$
declare
  v_pay public.boost_payments;
begin
  select * into v_pay from public.boost_payments where id = p_payment_id for update;
  if not found then
    raise exception using errcode = 'BC404', message = 'Esse pagamento não existe.';
  end if;
  if v_pay.status <> 'aguardando' or p_status not in ('recusado', 'expirado', 'cancelado') then
    return v_pay;
  end if;
  update public.boost_payments set status = p_status, status_detail = p_detail, updated_at = now()
   where id = p_payment_id returning * into v_pay;
  return v_pay;
end;
$$;

-- Pagamento aprovado pelo provedor. Idempotente: confirmar de novo não muda nada.
create or replace function public.confirm_boost_payment(p_payment_id uuid)
returns public.boost_payments language plpgsql security definer set search_path = public as $$
declare
  v_pay public.boost_payments;
  v_job public.jobs;
  v_ends timestamptz;
begin
  select * into v_pay from public.boost_payments where id = p_payment_id for update;
  if not found then
    raise exception using errcode = 'BC404', message = 'Esse pagamento não existe.';
  end if;
  -- Já confirmado ou já marcado para devolver: nada a fazer. Um PIX pago depois de vencido ou de
  -- cancelado (o dinheiro entrou) é tratado como os outros: confirma se a vaga ainda puder.
  if v_pay.status in ('confirmado', 'reembolso_pendente') then return v_pay; end if;
  select * into v_job from public.jobs where id = v_pay.job_id for update;
  if v_job.id is null or not public.job_is_open(v_job) or public.job_holding(v_job.id) >= v_job.slots then
    update public.boost_payments
       set status = 'reembolso_pendente', confirmed_at = now(), updated_at = now(),
           status_detail = 'vaga_indisponivel'
     where id = p_payment_id returning * into v_pay;
    if v_job.id is not null then
      perform public.notify(null, v_job.company_id, 'impulsionamento', 'Pagamento será devolvido',
        'Recebemos o pagamento, mas ' || public.job_title(v_job) ||
        ' não está mais aberta. Vamos devolver o valor pela mesma forma de pagamento.',
        '/vaga-gerenciar/' || v_job.id);
    end if;
    return v_pay;
  end if;
  v_ends := greatest(coalesce(v_job.boost_ends_at, now()), now())
            + make_interval(hours => public.boost_plan_hours(v_pay.plan));
  update public.jobs set boost_ends_at = v_ends where id = v_job.id;
  update public.boost_payments
     set status = 'confirmado', confirmed_at = now(), boost_ends_at = v_ends, updated_at = now()
   where id = p_payment_id returning * into v_pay;
  perform public.notify(null, v_job.company_id, 'impulsionamento', 'Vaga impulsionada',
    public.job_title(v_job) || ' está no topo do mural até ' || public.short_datetime_br(v_ends) || '.',
    '/vaga-gerenciar/' || v_job.id);
  return v_pay;
end;
$$;

-- O app lê o pagamento (a tela do PIX atualiza sozinha). Um PIX vencido aparece como vencido.
create or replace function public.get_payment(p_payment_id uuid)
returns public.boost_payments language plpgsql security definer set search_path = public as $$
declare
  v_pay public.boost_payments;
begin
  update public.boost_payments set status = 'expirado', updated_at = now()
   where id = p_payment_id and status = 'aguardando' and expires_at <= now()
     and company_id = public.my_company_id();
  select * into v_pay from public.boost_payments
   where id = p_payment_id and company_id = public.my_company_id();
  if not found then
    raise exception using errcode = 'BC404', message = 'Esse pagamento não existe.';
  end if;
  return v_pay;
end;
$$;

-- ---------------------------------------------------------------------------------------------------
-- Quem pode chamar o quê: o app só lê o próprio pagamento; o resto é das Edge Functions.
-- ---------------------------------------------------------------------------------------------------

revoke all on function
  public.begin_boost_payment(uuid, text, public.boost_plan, public.payment_method),
  public.attach_boost_charge(uuid, text, text, text, timestamptz, text),
  public.fail_boost_payment(uuid, public.payment_status, text),
  public.confirm_boost_payment(uuid), public.get_payment(uuid),
  public.boost_plan_cents(public.boost_plan), public.boost_plan_hours(public.boost_plan)
from public, anon, authenticated;

grant execute on function
  public.begin_boost_payment(uuid, text, public.boost_plan, public.payment_method),
  public.attach_boost_charge(uuid, text, text, text, timestamptz, text),
  public.fail_boost_payment(uuid, public.payment_status, text),
  public.confirm_boost_payment(uuid)
to service_role;
grant execute on function public.get_payment(uuid) to authenticated;
