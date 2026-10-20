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

const SESSION = { accountId: 'x', email: 'x@x', emailConfirmed: true, profileComplete: true, termsCurrent: true };

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
      whatsapp: '(11) 98111-0001',
      password: 'abcdefgh1',
      acceptedTermsVersion: '1.0',
      adult: true
    };
    const refused = { ok: false, reason: 'recusado' };
    expect(await settlesAfter(s.auth.signUp({ ...data, doc: '123.456.789-01' }), 700)).toEqual(refused);
    expect(await settlesAfter(s.auth.signUp({ ...data, doc: '111.111.111-11' }), 700)).toEqual(refused);
    expect(await settlesAfter(s.auth.signUp({ ...data, doc: '111.444.777-35' }), 700)).toEqual(refused);
    expect(await settlesAfter(s.auth.signUp({ ...data, doc: '390.533.447-05' }), 700)).toEqual({ ok: true });
    // U10: one WhatsApp per account.
    const samePhone = s.auth.signUp({ ...data, email: 'outra@x.com', doc: '246.813.579-28' }).catch((e: unknown) => e);
    expect(await settlesAfter(samePhone, 700)).toMatchObject({ code: 'conflito' });
    const company = { ...data, role: 'recrutador' as const, email: 'obra@x.com', whatsapp: '(11) 98111-0002' };
    expect(await settlesAfter(s.auth.signUp({ ...company, doc: '11.222.333/0001-81' }), 700)).toEqual(refused);
    expect(await settlesAfter(s.auth.signUp({ ...company, doc: '11.222.333/0001-80' }), 700)).toEqual(refused);
    // A recruiter on their own signs up with a CPF.
    expect(await settlesAfter(s.auth.signUp({ ...company, doc: '123.456.789-09' }), 700)).toEqual({ ok: true });
  });

  it('U10: tells on the step whether the e-mail, CPF/CNPJ or WhatsApp is free', async () => {
    expect(await settlesAfter(s.auth.isFreeForSignUp('email', ' Trabalhador@Bicos.demo '), 300)).toBe(false);
    expect(await settlesAfter(s.auth.isFreeForSignUp('email', 'ninguem@x.com'), 300)).toBe(true);
    expect(await settlesAfter(s.auth.isFreeForSignUp('documento', '111.444.777-35'), 300)).toBe(false);
    expect(await settlesAfter(s.auth.isFreeForSignUp('documento', '390.533.447-05'), 300)).toBe(true);
    expect(await settlesAfter(s.auth.isFreeForSignUp('whatsapp', '11974125580'), 300)).toBe(false);
    expect(await settlesAfter(s.auth.isFreeForSignUp('whatsapp', '(11) 98111-0009'), 300)).toBe(true);
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
    expect(s.auth.WHATSAPP_RESEND_SECONDS).toBe(60);
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
    // Y28: a worker with an alert for painters near Tatuapé, another for electricians.
    const alerts = await import('../services/alerts');
    store.transact((d) => ({
      ...d,
      jobAlerts: {
        'w-alerta': {
          workerId: 'w-alerta',
          city: 'São Paulo, SP',
          lat: -23.54,
          lon: -46.57,
          radiusKm: 5,
          oficioId: 'pintor'
        },
        outro: {
          workerId: 'outro',
          city: 'São Paulo, SP',
          lat: -23.54,
          lon: -46.57,
          radiusKm: null,
          oficioId: 'eletricista'
        }
      }
    }));
    expect(alerts.alertSummary(store.getDb().jobAlerts!['w-alerta'])).toBe('Pintor · São Paulo, SP · até 5 km');
    // W09: the next code after the highest one used (existing or deleted).
    const used = [...Object.keys(store.getDb().jobs), ...store.getDb().deletedJobIds].map(
      (k) => Number(k.slice(3)) || 0
    );
    const next = 'BC-' + Math.max(5100, ...used.map((n) => n + 1));
    const id = await settlesAfter(jobs.publishJob(draft), 700);
    expect(id).toBe(next);
    expect(sel.getJob(store.getDb(), id)).toEqual({ ...draft, id: next, companyId: seed.CURRENT_COMPANY_ID });
    const notices = store.getDb().notifications.filter((n) => n.kind === 'bico_novo');
    expect(notices).toMatchObject([
      { workerId: 'w-alerta', target: '/vaga/' + next, title: 'Bico novo perto de você' }
    ]);
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

describe('Y25: changing the WhatsApp (demo)', () => {
  afterEach(() => vi.useRealTimers());

  it('only a mobile with DDD; confirmed only right after the code; profile and account together', async () => {
    vi.useFakeTimers();
    vi.resetModules();
    const auth = await import('../services/auth');
    const profiles = await import('../services/profiles');
    const store = await import('../services/store');
    const run = async <T>(p: Promise<T>) => {
      const r = p.then(
        (v) => ({ ok: true as const, v }),
        (e: unknown) => ({ ok: false as const, e: e as Error })
      );
      await vi.runAllTimersAsync();
      return r;
    };
    await run(auth.signIn('construtora@bicos.demo', 'bicos123'));
    const session = store.getSession()!;
    expect((await run(profiles.changeWhatsApp('1188887777'))).ok).toBe(false);

    // Without the code: the new number is saved unconfirmed.
    expect((await run(profiles.changeWhatsApp('(21) 99999-0000'))).ok).toBe(true);
    let db = store.getDb();
    expect(db.accounts[session.accountId]).toMatchObject({ whatsapp: '(21) 99999-0000', whatsappVerifiedAt: null });
    expect(db.companies[session.companyId!].whatsapp).toBe('(21) 99999-0000');

    // With the code: confirmed.
    expect((await run(auth.verifyWhatsAppCode('(21) 98888-1111', '123456'))).ok).toBe(true);
    await run(profiles.changeWhatsApp('(21) 98888-1111'));
    db = store.getDb();
    expect(db.accounts[session.accountId].whatsappVerifiedAt).not.toBeNull();
  });
});

describe('L15/F08: password and e-mail from Configurações (demo)', () => {
  afterEach(() => vi.useRealTimers());

  it('the current password is checked; the e-mail must be new and free', async () => {
    vi.useFakeTimers();
    vi.resetModules();
    const auth = await import('../services/auth');
    const store = await import('../services/store');
    const run = async <T>(p: Promise<T>) => {
      const r = p.then(
        (v) => ({ ok: true as const, v }),
        (e: unknown) => ({ ok: false as const, e: e as Error })
      );
      await vi.runAllTimersAsync();
      return r;
    };
    await run(auth.signIn('trabalhador@bicos.demo', 'bicos123'));
    expect(await run(auth.changePassword('errada', 'novasenha1'))).toMatchObject({ ok: false });
    expect(await run(auth.changePassword('bicos123', 'curta'))).toMatchObject({ ok: false });
    expect((await run(auth.changePassword('bicos123', 'novasenha1'))).ok).toBe(true);
    expect(await run(auth.checkPassword('novasenha1'))).toEqual({ ok: true, v: true });

    expect(await run(auth.changeEmail('construtora@bicos.demo', 'novasenha1'))).toMatchObject({ ok: false });
    expect(await run(auth.changeEmail('jorge.novo@x.com', 'errada'))).toMatchObject({ ok: false });
    expect((await run(auth.changeEmail('Jorge.Novo@x.com', 'novasenha1'))).ok).toBe(true);
    expect(store.getSession()?.email).toBe('jorge.novo@x.com');
  });
});

describe('L10: automatic company check (demo)', () => {
  afterEach(() => vi.useRealTimers());

  it('a valid CNPJ is verified; a recruiter with CPF stays pending', async () => {
    vi.useFakeTimers();
    vi.resetModules();
    const auth = await import('../services/auth');
    const profiles = await import('../services/profiles');
    const store = await import('../services/store');
    const run = async <T>(p: Promise<T>) => {
      const r = p.then((v) => v);
      await vi.runAllTimersAsync();
      return r;
    };
    const signUp = (doc: string, email: string) =>
      run(
        auth.signUp({
          role: 'recrutador',
          name: 'Obra Teste',
          doc,
          email,
          whatsapp: email === 'cnpj@x.com' ? '(11) 98111-0101' : '(11) 98111-0102',
          password: 'abcdefgh1',
          acceptedTermsVersion: '1.0',
          adult: true
        })
      );
    await signUp('11.444.777/0001-61', 'cnpj@x.com');
    expect(await run(profiles.checkMyCompany())).toBe('verificada');
    expect(store.getDb().companies[store.getSession()!.companyId!].verified).toBe(true);
    await run(auth.signOut());
    await signUp('123.456.789-09', 'cpf@x.com');
    expect(await run(profiles.checkMyCompany())).toBe('pendente');
  });
});

describe('F09: the public job page (demo)', () => {
  afterEach(() => vi.useRealTimers());
  it('shows the area, never the exact address; a deleted job does not open', async () => {
    vi.useFakeTimers();
    vi.resetModules();
    const jobs = await import('../services/jobs');
    const store = await import('../services/store');
    const run = async <T>(p: Promise<T>) => {
      const r = p.then((v) => v);
      await vi.runAllTimersAsync();
      return r;
    };
    const card = await run(jobs.loadPublicJob('BC-4821'));
    expect(card?.job.address).toMatchObject({ street: '', number: '', cep: '', exact: false });
    expect(card?.company.name).toBe('Construtora Meridiano');
    store.deleteJobPost('BC-4821');
    expect(await run(jobs.loadPublicJob('BC-4821'))).toBeNull();
  });
});

describe('F16: editing a post caption (demo)', () => {
  afterEach(() => vi.useRealTimers());
  it('only the owner, up to 280 characters', async () => {
    vi.useFakeTimers();
    vi.resetModules();
    const auth = await import('../services/auth');
    const profiles = await import('../services/profiles');
    const store = await import('../services/store');
    const run = async <T>(p: Promise<T>) => {
      const r = p.then(
        (v) => ({ ok: true as const, v }),
        (e: unknown) => ({ ok: false as const, e: e as Error })
      );
      await vi.runAllTimersAsync();
      return r;
    };
    await run(auth.signIn('trabalhador@bicos.demo', 'bicos123'));
    const mine = store.getDb().workerPosts.find((p) => p.workerId === store.getSession()?.workerId)!;
    const other = store.getDb().workerPosts.find((p) => p.workerId !== store.getSession()?.workerId);
    expect((await run(profiles.updatePostCaption(mine.id, ' Reboco novo '))).ok).toBe(true);
    expect(store.getDb().workerPosts.find((p) => p.id === mine.id)?.caption).toBe('Reboco novo');
    expect((await run(profiles.updatePostCaption(mine.id, 'x'.repeat(281)))).ok).toBe(false);
    if (other) expect((await run(profiles.updatePostCaption(other.id, 'oi'))).ok).toBe(false);
  });
});

describe('F07: identity check (demo)', () => {
  afterEach(() => vi.useRealTimers());
  it('não enviado → em análise → verificado (the badge follows)', async () => {
    vi.useFakeTimers();
    vi.resetModules();
    const auth = await import('../services/auth');
    const identity = await import('../services/identity');
    const store = await import('../services/store');
    const run = async <T>(p: Promise<T>) => {
      const r = p.then(
        (v) => ({ ok: true as const, v }),
        (e: unknown) => ({ ok: false as const, e: e as Error })
      );
      await vi.runAllTimersAsync();
      return r;
    };
    await run(auth.signIn('trabalhador@bicos.demo', 'bicos123'));
    const id = store.getSession()!.workerId!;
    store.updateWorker(id, { identity: undefined, verified: false });
    expect(identity.identityOf(store.getDb().workers[id])).toBe('nao_enviado');
    expect((await run(identity.submitIdentity('', 'blob:doc', '1.0'))).ok).toBe(false);
    // L07: without the specific consent nothing is sent.
    expect((await run(identity.submitIdentity('blob:selfie', 'blob:doc', null))).ok).toBe(false);
    expect((await run(identity.submitIdentity('blob:selfie', 'blob:doc', '1.0'))).ok).toBe(true);
    expect(identity.identityOf(store.getDb().workers[id])).toBe('em_analise');
    expect(store.getDb().workers[id].verified).toBe(false);
    await run(identity.demoApproveIdentity());
    expect(identity.identityOf(store.getDb().workers[id])).toBe('verificado');
    expect(store.getDb().workers[id].verified).toBe(true);
  });
});

describe('X11: one password rule', () => {
  it('sign-up, reset and change use the same check', async () => {
    const { passwordProblem } = await import('../utils/password');
    expect(passwordProblem('curta1')).toMatch(/curta/);
    expect(passwordProblem('somenteletras')).toMatch(/letras e números/);
    expect(passwordProblem('12345678')).toMatch(/letras e números/);
    expect(passwordProblem('obra2026')).toBeNull();
    vi.resetModules();
    const auth = await import('../services/auth');
    await expect(auth.resetPassword('somenteletras')).rejects.toMatchObject({ code: 'validacao' });
  });
});

describe('X18: WhatsApp is a mobile', () => {
  it('a landline (10 digits) or a number without the 9 is refused before anything is created', async () => {
    vi.resetModules();
    const auth = await import('../services/auth');
    const { isValidMobile } = await import('../utils/format');
    expect(isValidMobile('(11) 3333-4444')).toBe(false);
    expect(isValidMobile('(11) 83333-4444')).toBe(false);
    expect(isValidMobile('(11) 93333-4444')).toBe(true);
    const base = {
      role: 'trabalhador' as const,
      name: 'Ana Teste',
      email: 'ana.teste@exemplo.com',
      password: 'obra2026',
      doc: '390.533.447-05',
      acceptedTermsVersion: '1.0',
      adult: true
    };
    await expect(auth.signUp({ ...base, whatsapp: '(11) 3333-4444' } as never)).rejects.toMatchObject({
      code: 'validacao'
    });
  });
});
