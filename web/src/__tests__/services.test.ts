// The services the screens call instead of simulating things themselves: same delays (the legacy app's
// setTimeout values), same outcomes, same data.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as seed from '../data/seed';

type Services = {
  store: typeof import('../services/store');
  sel: typeof import('../services/selectors');
  auth: typeof import('../services/auth');
  account: typeof import('../services/account');
  marketplace: typeof import('../services/marketplace');
};

async function fresh(): Promise<Services> {
  vi.resetModules();
  return {
    store: await import('../services/store'),
    sel: await import('../services/selectors'),
    auth: await import('../services/auth'),
    account: await import('../services/account'),
    marketplace: await import('../services/marketplace')
  };
}

/** Resolves `promise` by advancing the fake clock; checks it is still pending 1 ms before `ms`. */
async function settlesAfter<T>(promise: Promise<T>, ms: number): Promise<T> {
  let done = false;
  void promise.then(() => (done = true));
  await vi.advanceTimersByTimeAsync(ms - 1);
  expect(done).toBe(false);
  await vi.advanceTimersByTimeAsync(1);
  expect(done).toBe(true);
  return promise;
}

describe('simulated backend calls keep the legacy delays', () => {
  let s: Services;
  beforeEach(async () => {
    vi.useFakeTimers();
    s = await fresh();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('signs in after 500 ms, into the chosen side', async () => {
    expect(s.store.getRole()).toBe('trabalhador');
    await settlesAfter(s.auth.signIn({ role: 'recrutador' }), 500);
    expect(s.store.getRole()).toBe('recrutador');
  });

  it('signs up after 700 ms, refusing the two "already registered" documents', async () => {
    const data = {
      role: 'trabalhador' as const,
      name: 'Ana',
      email: 'ana@x.com',
      whatsapp: '(11) 98842-3310',
      password: 'abcdefgh1'
    };
    expect(await settlesAfter(s.auth.signUp({ ...data, doc: '123.456.789-01' }), 700)).toEqual({ ok: true });
    expect(await settlesAfter(s.auth.signUp({ ...data, doc: '111.111.111-11' }), 700)).toMatchObject({
      ok: false,
      reason: 'doc-taken'
    });
    const company = { ...data, role: 'recrutador' as const, doc: '11.111.111/1111-11' };
    expect(await settlesAfter(s.auth.signUp(company), 700)).toMatchObject({ ok: false, reason: 'doc-taken' });
  });

  it('finishes sign-up on the spot and keeps the other flows at 600/900 ms', async () => {
    s.auth.finishSignUp('recrutador');
    expect(s.store.getRole()).toBe('recrutador');
    await settlesAfter(s.auth.requestPasswordReset('ana@x.com'), 600);
    await settlesAfter(s.auth.resetPassword('abcdefgh1'), 600);
    await settlesAfter(s.account.exportMyData(), 900);
  });

  it('sends and checks the WhatsApp code after 600 ms (demo: any 6 digits but 000000)', async () => {
    await settlesAfter(s.auth.sendWhatsAppCode('(11) 98842-3310'), 600);
    expect(await settlesAfter(s.auth.verifyWhatsAppCode('(11) 98842-3310', '123456'), 600)).toBe(true);
    expect(await settlesAfter(s.auth.verifyWhatsAppCode('(11) 98842-3310', '000000'), 600)).toBe(false);
    expect(await settlesAfter(s.auth.verifyWhatsAppCode('(11) 98842-3310', '12345'), 600)).toBe(false);
    expect(s.auth.WHATSAPP_RESEND_SECONDS).toBe(15);
  });

  it('sends an application after 600 ms', async () => {
    const { store, sel, marketplace } = s;
    expect(sel.applicationFor(store.getDb(), 'BC-4855', 'jorge')).toBeNull();
    const sent = marketplace.submitApplication('BC-4855', 'jorge');
    expect(sel.applicationFor(store.getDb(), 'BC-4855', 'jorge')).toBeNull();
    await settlesAfter(sent, 600);
    expect(sel.applicationFor(store.getDb(), 'BC-4855', 'jorge')?.status).toBe('enviada');
  });

  it('publishes a job after 700 ms with the demo id, company and place', async () => {
    const { store, sel, marketplace } = s;
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const draft = {
      role: 'Pintor',
      pay: 180,
      address: 'Rua A, 10',
      date: 'Amanhã',
      hours: '7h–17h',
      dias: 'semana' as const,
      duration: '2 diárias',
      slots: 2,
      requirements: ['EPI'],
      description: 'Pintura interna.',
      photos: []
    };
    const id = await settlesAfter(marketplace.publishJob(draft), 700);
    expect(id).toBe('BC-5500');
    expect(sel.getJob(store.getDb(), id)).toEqual({
      ...draft,
      id: 'BC-5500',
      companyId: seed.CURRENT_COMPANY_ID,
      location: 'Tatuapé, SP',
      distance: '0 km'
    });
  });
});

describe('reference data served by services', () => {
  it('counts the unread notifications the navigation always showed (worker 2, recruiter 3)', async () => {
    const { notificationsFor, unreadCount } = await import('../services/notifications');
    expect(unreadCount('trabalhador')).toBe(2);
    expect(unreadCount('recrutador')).toBe(3);
    expect(notificationsFor('trabalhador').map((n) => n.title)).toEqual([
      'Você foi pré-selecionado',
      'Bico urgente perto de você',
      'Avalie sua última diária',
      'Candidatura em análise'
    ]);
    expect(notificationsFor('recrutador')).toHaveLength(3);
  });

  it('offers the seed option lists and the three boost plans', async () => {
    const catalog = await import('../services/catalog');
    expect(catalog.TIPOS_SERVICO).toEqual(seed.TIPOS_SERVICO);
    expect(catalog.REQUISITOS_OPCOES).toEqual(seed.REQUISITOS_OPCOES);
    expect(catalog.BOOST_PLANS.map((p) => `${p.id} ${p.price}`)).toEqual(['24h R$ 12', '3d R$ 28', 'whats R$ 39']);
  });

  it('shows picked media from a local URL (nothing is uploaded)', async () => {
    const { mediaUrl } = await import('../services/media');
    const spy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:foto');
    const file = new File(['x'], 'foto.jpg', { type: 'image/jpeg' });
    expect(mediaUrl(file)).toBe('blob:foto');
    expect(spy).toHaveBeenCalledWith(file);
  });
});

describe('phone mask', () => {
  it('formats mobile and landline numbers as they are typed', async () => {
    const { maskPhone } = await import('../utils/format');
    expect(maskPhone('')).toBe('');
    expect(maskPhone('1')).toBe('(1');
    expect(maskPhone('119')).toBe('(11) 9');
    expect(maskPhone('119884')).toBe('(11) 9884');
    expect(maskPhone('1138423310')).toBe('(11) 3842-3310');
    expect(maskPhone('11988423310')).toBe('(11) 98842-3310');
    expect(maskPhone('(11) 98842-33109')).toBe('(11) 98842-3310');
  });
});
