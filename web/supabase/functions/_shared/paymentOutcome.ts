// O que fazer com o estado de um pagamento lido no Mercado Pago (usado por webhook-pagamento).
// AUD-038: se o banco não conseguir aplicar o pagamento (confirmar ou recusar), o aviso NÃO pode virar 200: a função
// responde 5xx, libera a linha de repetição e avisa o monitor — o Mercado Pago reenvia e o pagamento não se perde.

export interface PaymentRpc {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{ error: { message: string } | null }>;
}

export interface PaymentOutcome {
  /** Texto gravado em payment_webhook_events.result. */
  result: string;
  /** O banco falhou ao aplicar: responder 5xx para o Mercado Pago reenviar. */
  failed: boolean;
}

export async function applyPaymentStatus(
  admin: PaymentRpc,
  ours: string,
  status: string,
  detail: string | null
): Promise<PaymentOutcome> {
  if (status === 'approved') {
    const { error } = await admin.rpc('confirm_boost_payment', { p_payment_id: ours });
    return error ? { result: `erro:${error.message}`, failed: true } : { result: 'confirmado', failed: false };
  }
  if (status === 'rejected' || status === 'cancelled') {
    const { error } = await admin.rpc('fail_boost_payment', {
      p_payment_id: ours,
      p_status: 'recusado',
      p_detail: detail
    });
    return error ? { result: `erro:${error.message}`, failed: true } : { result: 'recusado', failed: false };
  }
  // Inclui `refunded` e `charged_back`: ficam registrados e a rotina de alertas avisa a equipe (AUD-038/039).
  return { result: status, failed: false };
}
