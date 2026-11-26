// AUD-038: o banco que não consegue aplicar um pagamento aprovado faz o aviso do Mercado Pago falhar (5xx, para reenviar),
// e não virar "ok" sem ninguém saber.
import { describe, expect, it, vi } from 'vitest';
import { applyPaymentStatus } from '../../supabase/functions/_shared/paymentOutcome.ts';

const admin = (error: { message: string } | null) => ({ rpc: vi.fn().mockResolvedValue({ error }) });

describe('webhook-pagamento: aplicar o estado do pagamento', () => {
  it('aprovado e aplicado: confirmado', async () => {
    const a = admin(null);
    expect(await applyPaymentStatus(a, 'p1', 'approved', null)).toEqual({ result: 'confirmado', failed: false });
    expect(a.rpc).toHaveBeenCalledWith('confirm_boost_payment', { p_payment_id: 'p1' });
  });
  it('aprovado e o banco falhou: marca falha, para o aviso ser reenviado', async () => {
    const r = await applyPaymentStatus(admin({ message: 'deadlock detected' }), 'p1', 'approved', null);
    expect(r.failed).toBe(true);
    expect(r.result).toBe('erro:deadlock detected');
  });
  it('recusado e o banco falhou também é falha (antes o erro era ignorado)', async () => {
    const r = await applyPaymentStatus(admin({ message: 'x' }), 'p1', 'rejected', 'cc_rejected');
    expect(r.failed).toBe(true);
  });
  it('recusado e aplicado: recusado', async () => {
    const a = admin(null);
    expect(await applyPaymentStatus(a, 'p1', 'cancelled', null)).toEqual({ result: 'recusado', failed: false });
  });
  it('estorno e contestação ficam registrados para o alerta, sem falha', async () => {
    for (const s of ['refunded', 'charged_back', 'pending']) {
      expect(await applyPaymentStatus(admin(null), 'p1', s, null)).toEqual({ result: s, failed: false });
    }
  });
});
