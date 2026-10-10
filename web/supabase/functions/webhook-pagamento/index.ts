// Aviso do Mercado Pago sobre um pagamento (configurado como notification_url em criar-cobranca e no
// painel do Mercado Pago → Webhooks, evento "Pagamentos", com a mesma chave secreta de MP_WEBHOOK_SECRET).
//
// 1. Confere a assinatura (x-signature); sem ela, 401.
// 2. Registra o aviso (payment_webhook_events): um aviso repetido não é processado de novo.
// 3. Lê o pagamento direto na API do Mercado Pago (o corpo do aviso não é confiável) e acha o nosso
//    pelo external_reference.
// 4. approved → confirm_boost_payment (revalida a vaga; idempotente); rejected/cancelled → recusado.
// Responde 200 para o Mercado Pago parar de reenviar.
import { adminClient, json } from '../_shared/http.ts';
import { getPayment, mercadoPagoConfigured, validSignature } from '../_shared/mercadopago.ts';
import { monitored } from '../_shared/monitoring.ts';

Deno.serve(
  monitored('webhook-pagamento', async (req) => {
    if (req.method !== 'POST') return json({ erro: 'metodo' }, 405);
    if (!mercadoPagoConfigured()) return json({ erro: 'pagamento-desligado' }, 503);

    const url = new URL(req.url);
    let body: { type?: string; action?: string; data?: { id?: string | number } } = {};
    try {
      body = await req.json();
    } catch {
      /* alguns avisos chegam só com a query */
    }
    const type = url.searchParams.get('type') ?? body.type ?? '';
    const dataId = String(url.searchParams.get('data.id') ?? body.data?.id ?? '');
    if (type !== 'payment' || !dataId) return json({ ok: true, ignorado: true });
    if (!(await validSignature(req, dataId))) return json({ erro: 'assinatura' }, 401);

    const admin = adminClient();
    const eventId = req.headers.get('x-request-id') ?? `${dataId}:${body.action ?? ''}`;
    const { error: dup } = await admin
      .from('payment_webhook_events')
      .insert({ provider: 'mercadopago', event_id: eventId, provider_payment_id: dataId });
    if (dup?.code === '23505') return json({ ok: true, repetido: true });

    let result = 'ignorado';
    try {
      const mp = await getPayment(dataId);
      const ours = mp.external_reference;
      if (ours) {
        if (mp.status === 'approved') {
          const { error } = await admin.rpc('confirm_boost_payment', { p_payment_id: ours });
          result = error ? `erro:${error.message}` : 'confirmado';
        } else if (mp.status === 'rejected' || mp.status === 'cancelled') {
          await admin.rpc('fail_boost_payment', {
            p_payment_id: ours,
            p_status: 'recusado',
            p_detail: mp.status_detail ?? null
          });
          result = 'recusado';
        } else result = mp.status;
      }
    } catch (e) {
      console.error('webhook-pagamento', String(e));
      // Falha ao ler o Mercado Pago: libera o aviso para o reenvio ser processado.
      await admin.from('payment_webhook_events').delete().eq('provider', 'mercadopago').eq('event_id', eventId);
      return json({ erro: 'provedor' }, 502);
    }
    await admin.from('payment_webhook_events').update({ result }).eq('provider', 'mercadopago').eq('event_id', eventId);
    return json({ ok: true, result });
  })
);
