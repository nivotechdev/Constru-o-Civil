// The services the screens call instead of simulating things themselves: same delays (the legacy app's
// setTimeout values), same outcomes, same data.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as seed from '../data/seed';

type Services = {
  store: typeof import('../services/store');
  sel: typeof import('../services/selectors');
  auth: typeof import('../services/auth');
  account: typeof import('../services/account');
  jobs: typeof import('../services/jobs');
  applications: typeof import('../services/applications');
};

const SESSION = { accountId: 'x', email: 'x@x', emailConfirmed: true, profileComplete: true };

async function fresh(): Promise<Services> {
  vi.resetModules();
  return {
    store: await import('../services/store'),
    sel: await import('../services/selectors'),
    auth: await import('../services/auth'),
    account: await import('../services/account'),
    jobs: await import('../services/jobs'),
    applications: await import('../services/applications')
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

  it('signs in after 500 ms, into the side of the account', async () => {
    expect(s.store.getSession()).toBeNull();
    const result = await settlesAfter(s.auth.signIn('construtora@bicos.demo', 'bicos123'), 500);
    expect(result).toEqual({ ok: true, role: 'recrutador' });
    expect(s.store.getRole()).toBe('recrutador');
    expect(s.sel.currentCompanyId()).toBe(seed.CURRENT_COMPANY_ID);
  });

  it('signs up after 700 ms, refusing invalid and "already registered" documents (Y17)', async () => {
    const data = {
      role: 'trabalhador' as const,
      name: 'Ana',
      email: 'ana@x.com',
      whatsapp: '(11) 98842-3310',
      password: 'abcdefgh1',
      acceptedTermsVersion: '1.0'
    };
    const refused = { ok: false, reason: 'recusado' };
    expect(await settlesAfter(s.auth.signUp({ ...data, doc: '123.456.789-01' }), 700)).toEqual(refused);
    expect(await settlesAfter(s.auth.signUp({ ...data, doc: '111.111.111-11' }), 700)).toEqual(refused);
    expect(await settlesAfter(s.auth.signUp({ ...data, doc: '111.444.777-35' }), 700)).toEqual(refused);
    expect(await settlesAfter(s.auth.signUp({ ...data, doc: '390.533.447-05' }), 700)).toEqual({ ok: true });
    const company = { ...data, role: 'recrutador' as const, email: 'obra@x.com' };
    expect(await settlesAfter(s.auth.signUp({ ...company, doc: '11.222.333/0001-81' }), 700)).toEqual(refused);
    expect(await settlesAfter(s.auth.signUp({ ...company, doc: '11.222.333/0001-80' }), 700)).toEqual(refused);
    // A recruiter on their own signs up with a CPF.
    expect(await settlesAfter(s.auth.signUp({ ...company, doc: '123.456.789-09' }), 700)).toEqual({ ok: true });
  });

  it('keeps the password flows at 600 ms and the data export at 900 ms', async () => {
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
    const { store, sel, applications } = s;
    expect(sel.applicationFor(store.getDb(), 'BC-4855', 'jorge')).toBeNull();
    const sent = applications.submitApplication('BC-4855');
    expect(sel.applicationFor(store.getDb(), 'BC-4855', 'jorge')).toBeNull();
    await settlesAfter(sent, 600);
    expect(sel.applicationFor(store.getDb(), 'BC-4855', 'jorge')?.status).toBe('enviada');
  });

  it('publishes a job after 700 ms with the demo id and the company', async () => {
    const { store, sel, jobs } = s;
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const draft = {
      oficioId: 'pintor',
      title: null,
      pay: 180,
      address: {
        cep: '03307-000',
        street: 'Rua A',
        number: '10',
        complement: null,
        neighborhood: 'Tatuapé',
        city: 'São Paulo',
        uf: 'SP',
        lat: -23.54,
        lon: -46.57
      },
      dateToArrange: false,
      startDate: '2026-10-09',
      endDate: '2026-10-12',
      startTime: '07:00',
      endTime: '17:00',
      diarias: 2,
      dias: 'semana' as const,
      slots: 2,
      requirements: ['EPI'],
      description: 'Pintura interna.',
      photos: []
    };
    const id = await settlesAfter(jobs.publishJob(draft), 700);
    expect(id).toBe('BC-5500');
    expect(sel.getJob(store.getDb(), id)).toEqual({ ...draft, id: 'BC-5500', companyId: seed.CURRENT_COMPANY_ID });
  });
});

describe('reference data served by services', () => {
  it('lists each account its own notifications, newest first, with the unread count', async () => {
    const { notificationsFor, unreadCount } = await import('../services/notifications');
    const store = await import('../services/store');
    const db = store.getDb();
    const worker = { ...SESSION, role: 'trabalhador' as const, workerId: 'jorge', companyId: null };
    const company = { ...SESSION, role: 'recrutador' as const, workerId: null, companyId: 'meridiano' };
    expect(unreadCount(db, worker)).toBe(2);
    expect(unreadCount(db, company)).toBe(3);
    expect(notificationsFor(db, worker).map((n) => n.title)).toEqual([
      'Você foi pré-selecionado',
      'Bico urgente perto de você',
      'Avalie sua diária',
      'Candidatura em análise'
    ]);
    expect(notificationsFor(db, null)).toEqual([]);
  });

  it('offers the seed option lists and the two boost plans (no WhatsApp plan until it exists: Z03)', async () => {
    const catalog = await import('../services/catalog');
    expect(catalog.OFICIOS).toEqual(seed.OFICIOS);
    expect(catalog.REQUISITOS_OPCOES).toEqual(seed.REQUISITOS_OPCOES);
    expect(catalog.BOOST_PLANS.map((p) => `${p.id} ${p.price}`)).toEqual(['24h R$ 12', '3d R$ 28']);
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

describe('Z12: profile pictures (demo)', () => {
  afterEach(() => vi.useRealTimers());

  it('are saved on the profile (so every screen shows them); null removes one', async () => {
    vi.useFakeTimers();
    vi.resetModules();
    const auth = await import('../services/auth');
    const profiles = await import('../services/profiles');
    const store = await import('../services/store');
    const run = async <T>(p: Promise<T>) => {
      await vi.runAllTimersAsync();
      return p;
    };
    await run(auth.signIn('trabalhador@bicos.demo', 'bicos123'));
    const id = store.getSession()?.workerId as string;
    let progress = 0;
    await run(profiles.saveMyProfileImages({ foto: 'blob:foto', capa: 'blob:capa' }, (f) => (progress = f)));
    expect(store.getDb().workers[id]).toMatchObject({ photoUrl: 'blob:foto', coverUrl: 'blob:capa' });
    expect(progress).toBe(1);
    await run(profiles.saveMyProfileImages({ capa: null }));
    expect(store.getDb().workers[id]).toMatchObject({ photoUrl: 'blob:foto', coverUrl: null });
  });

  it('pictures are resized to at most 1600 px on the long side', async () => {
    const { fitWithin } = await import('../utils/image');
    expect(fitWithin(4000, 3000)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });
});
