// Impulsionar vaga: cria a cobrança no Mercado Pago (PIX ou cartão) para a construtora logada.
//
// O app chama com o token da sessão: { jobId, plan: '24h'|'3d', method: 'pix'|'cartao', card? }.
// No cartão, `card` traz só o que o SDK do Mercado Pago gerou no navegador (token, bandeira, emissor,
// parcelas): o número do cartão nunca passa por aqui. A vaga é conferida no banco (begin_boost_payment)
// antes de cobrar; a confirmação chega pelo webhook-pagamento (ou na hora, se o cartão já for aprovado).
//
// Respostas: 200 { pagamento } · 401/404/409/422 { erro, mensagem } · 503 { erro: 'pagamento-desligado' }.
// Sem MP_ACCESS_TOKEN configurado, responde 503 e o app esconde o Impulsionar (VITE_PAGAMENTOS).
import { adminClient, CORS, json, requestUser, rpcError } from '../_shared/http.ts';
import { createPayment, mercadoPagoConfigured, type MpPayment } from '../_shared/mercadopago.ts';

interface CardData {
  token?: string;
  paymentMethodId?: string;
  issuerId?: string | number;
  installments?: number;
  identification?: { type?: string; number?: string };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ erro: 'metodo' }, 405);
  if (!mercadoPagoConfigured())
    return json({ erro: 'pagamento-desligado', mensagem: 'O pagamento ainda não está disponível.' }, 503);

  const user = await requestUser(req);
  if (!user) return json({ erro: 'BC401', mensagem: 'Entre na sua conta de novo para continuar.' }, 401);

  let body: { jobId?: string; plan?: string; method?: string; card?: CardData };
  try {
    body = await req.json();
  } catch {
    return json({ erro: 'BC422', mensagem: 'Pedido inválido.' }, 422);
  }
  const method = body.method === 'cartao' ? 'cartao' : 'pix';
  if (method === 'cartao' && (!body.card?.token || !body.card.paymentMethodId))
    return json({ erro: 'BC422', mensagem: 'Confira os dados do cartão.' }, 422);

  const admin = adminClient();
  const begun = await admin.rpc('begin_boost_payment', {
    p_account: user.id,
    p_job_id: String(body.jobId ?? ''),
    p_plan: String(body.plan ?? ''),
    p_method: method
  });
  if (begun.error) return rpcError(begun.error);
  const payment = begun.data as { id: string; job_id: string; amount_cents: number; expires_at: string | null };

  const base = {
    transaction_amount: payment.amount_cents / 100,
    description: `Bicos — destaque da vaga ${payment.job_id}`,
    external_reference: payment.id,
    notification_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/webhook-pagamento`,
    statement_descriptor: 'BICOS'
  };
  let mp: MpPayment;
  try {
    mp = await createPayment(
      method === 'pix'
        ? { ...base, payment_method_id: 'pix', date_of_expiration: payment.expires_at, payer: { email: user.email } }
        : {
            ...base,
            token: body.card!.token,
            payment_method_id: body.card!.paymentMethodId,
            issuer_id: body.card!.issuerId,
            installments: 1,
            payer: { email: user.email, identification: body.card!.identification }
          },
      payment.id
    );
  } catch (e) {
    console.error('criar-cobranca', String(e));
    await admin.rpc('fail_boost_payment', {
      p_payment_id: payment.id,
      p_status: 'cancelado',
      p_detail: 'erro_provedor'
    });
    return json(
      { erro: 'provedor', mensagem: 'Não deu para gerar a cobrança agora. Tente de novo em instantes.' },
      502
    );
  }

  const tx = mp.point_of_interaction?.transaction_data;
  await admin.rpc('attach_boost_charge', {
    p_payment_id: payment.id,
    p_provider_payment_id: String(mp.id),
    p_pix_code: tx?.qr_code ?? null,
    p_pix_qr_base64: tx?.qr_code_base64 ?? null,
    p_expires_at: mp.date_of_expiration ?? null,
    p_card_last4: mp.card?.last_four_digits ?? null
  });
  if (mp.status === 'approved') await admin.rpc('confirm_boost_payment', { p_payment_id: payment.id });
  else if (mp.status === 'rejected' || mp.status === 'cancelled')
    await admin.rpc('fail_boost_payment', {
      p_payment_id: payment.id,
      p_status: 'recusado',
      p_detail: mp.status_detail ?? null
    });

  const { data } = await admin.from('boost_payments').select('*').eq('id', payment.id).single();
  return json({ pagamento: data });
});
