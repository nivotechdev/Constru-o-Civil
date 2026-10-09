// B08 — boost payment: PIX waiting → confirmed (or expired), card approved or declined; only a confirmed
// payment boosts the job, until the plan's end.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { luhnOk, maskCardNumber, maskExpiry, validateCard } from '../utils/card';

describe('card fields', () => {
  it('mask as typed and check the card', () => {
    expect(maskCardNumber('4111111111111111')).toBe('4111 1111 1111 1111');
    expect(maskExpiry('1228')).toBe('12/28');
    expect(luhnOk('4111 1111 1111 1111')).toBe(true);
    expect(luhnOk('4111 1111 1111 1112')).toBe(false);
    const now = new Date(2026, 9, 8);
    const ok = { number: '4111 1111 1111 1111', name: 'ANA SOUZA', expiry: '12/28', cvv: '123' };
    expect(validateCard(ok, now)).toEqual({});
    expect(validateCard({ ...ok, expiry: '09/26' }, now).expiry).toMatch(/venceu/);
    expect(validateCard({ ...ok, number: '4111 1111 1111 1112' }, now).number).toMatch(/inválido/);
    expect(validateCard({ ...ok, name: 'ANA' }, now).name).toBeTruthy();
    // A number ending in 0000 passes the form: the bank is the one that declines it (demo).
    expect(validateCard({ ...ok, number: '4111 1111 1111 0000' }, now)).toEqual({});
  });
});

type M = {
  pay: typeof import('../services/payments');
  auth: typeof import('../services/auth');
  store: typeof import('../services/store');
};

describe('boost payments', () => {
  let m: M;
  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 8, 10, 0));
    vi.resetModules();
    m = {
      pay: await import('../services/payments'),
      auth: await import('../services/auth'),
      store: await import('../services/store')
    };
  });
  afterEach(() => vi.useRealTimers());

  const settle = async <T>(p: Promise<T>) => {
    const r = p.then(
      (v) => ({ ok: true as const, v }),
      (e: unknown) => ({ ok: false as const, e: e as Error })
    );
    await vi.runAllTimersAsync();
    return r;
  };
  const signIn = () => settle(m.auth.signIn('construtora@bicos.demo', 'bicos123'));

  it('PIX: waiting does not boost; confirmed boosts until the end of the plan', async () => {
    await signIn();
    const started = await settle(m.pay.startPixPayment('BC-4998', '3d'));
    if (!started.ok) throw started.e;
    expect(started.v.status).toBe('aguardando');
    expect(started.v.pixCode).toContain('BR.GOV.BCB.PIX');
    expect(m.pay.isBoosted(m.store.getDb().jobs['BC-4998'])).toBe(false);
    const done = await settle(m.pay.simulatePixPaid(started.v.id));
    if (!done.ok) throw done.e;
    expect(done.v.status).toBe('confirmado');
    const job = m.store.getDb().jobs['BC-4998'];
    expect(m.pay.isBoosted(job)).toBe(true);
    // 3 days from the confirmation.
    expect(new Date(job.boostEndsAt as string).getTime() - Date.now()).toBeGreaterThan(71 * 3600000);
    expect(m.store.getDb().notifications[0].kind).toBe('impulsionamento');
    // Already boosted: can't buy again until it ends.
    expect((await settle(m.pay.startPixPayment('BC-4998', '24h'))).ok).toBe(false);
  });

  it('PIX: an unpaid code expires and can no longer be confirmed', async () => {
    await signIn();
    const started = await settle(m.pay.startPixPayment('BC-4998', '24h'));
    if (!started.ok) throw started.e;
    vi.setSystemTime(Date.now() + (m.pay.PIX_MINUTES + 1) * 60000);
    const got = await settle(m.pay.getPayment(started.v.id));
    expect(got.ok && got.v.status).toBe('expirado');
    const late = await settle(m.pay.simulatePixPaid(started.v.id));
    expect(!late.ok && late.e.message).toMatch(/venceu/);
    expect(m.pay.isBoosted(m.store.getDb().jobs['BC-4998'])).toBe(false);
  });

  it('card: approved boosts at once; a number ending in 0000 is declined with a clear error', async () => {
    await signIn();
    const card = { number: '4111 1111 1111 0000', name: 'ANA SOUZA', expiry: '12/28', cvv: '123' };
    const declined = await settle(m.pay.payWithCard('BC-4998', '24h', card));
    expect(!declined.ok && declined.e.message).toMatch(/recusou/);
    expect(m.store.getDb().boostPayments[0].status).toBe('recusado');
    expect(m.pay.isBoosted(m.store.getDb().jobs['BC-4998'])).toBe(false);
    const ok = await settle(m.pay.payWithCard('BC-4998', '24h', { ...card, number: '4111 1111 1111 1111' }));
    expect(ok.ok && ok.v.status).toBe('confirmado');
    expect(ok.ok && ok.v.cardLast4).toBe('1111');
    expect(m.pay.isBoosted(m.store.getDb().jobs['BC-4998'])).toBe(true);
  });

  it("can't boost a closed job or another company's", async () => {
    await signIn();
    expect((await settle(m.pay.startPixPayment('BC-4712', '24h'))).ok).toBe(false); // closed
    expect((await settle(m.pay.startPixPayment('BC-4822', '24h'))).ok).toBe(false); // Alvorada's
  });
});
