// The services with the real backend on (services/remote/), against a fake Supabase client: what is
// sent to the server, how the answers land in the store, and how errors reach the screens.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authUser, fakeSupabase } from './fakeSupabase';

const holder = vi.hoisted(() => ({ client: null as unknown }));

vi.mock('../services/supabase', () => ({
  isSupabaseConfigured: () => true,
  supabaseConfig: () => ({ url: 'https://x.supabase.co', anonKey: 'anon' }),
  getSupabase: async () => holder.client
}));

const NOW = '2026-10-08T12:00:00.000Z';

const workerAccount = {
  id: 'u-ana',
  email: 'ana@exemplo.com',
  role: 'trabalhador',
  document: '***.456.789-**',
  whatsapp: '11988887777',
  whatsapp_verified_at: null,
  email_confirmed_at: NOW,
  profile_completed_at: NOW,
  terms_version: '1.0',
  terms_accepted_at: NOW,
  worker_id: 'u-ana',
  company_id: null,
  created_at: NOW
};
const companyAccount = {
  ...workerAccount,
  id: 'u-obra',
  email: 'obra@exemplo.com',
  role: 'recrutador',
  whatsapp: '11955554444',
  worker_id: null,
  company_id: 'u-obra'
};
const workerRow = {
  id: 'u-ana',
  name: 'Ana Souza',
  initials: 'AS',
  oficio_id: 'pintor',
  city: 'São Paulo, SP',
  neighborhood: null,
  lat: -23.55,
  lon: -46.63,
  rating: 0,
  review_count: 0,
  jobs_done: 0,
  novo: true,
  verified: false,
  specialties: [],
  facts: [],
  photo_url: null,
  cover_url: null,
  created_at: NOW
};
const companyRow = (id: string, name: string) => ({
  id,
  name,
  cnpj: null,
  tipo_obra: null,
  location: 'São Paulo, SP',
  rating: 4.5,
  review_count: 2,
  verified: false,
  verified_since: null,
  since_label: null,
  respond_time: null,
  paid_count: null,
  logo_url: null,
  cover_url: null,
  created_at: NOW
});
const jobRow = (id: string, companyId: string, slots = 1) => ({
  id,
  company_id: companyId,
  oficio_id: 'pintor',
  title: null,
  pay: 180,
  cep: '01310-100',
  street: 'Avenida Paulista',
  number: '1000',
  complement: null,
  neighborhood: 'Bela Vista',
  city: 'São Paulo',
  uf: 'SP',
  lat: -23.56,
  lon: -46.65,
  date_to_arrange: true,
  start_date: null,
  end_date: null,
  start_time: null,
  end_time: null,
  diarias: 2,
  dias: 'semana' as const,
  urgent: false,
  boost_ends_at: null,
  photos: null,
  slots,
  closed: false,
  sem_contratacao: false,
  description: 'Pintura de fachada.',
  requirements: [],
  created_at: NOW,
  updated_at: NOW,
  deleted_at: null
});

type Modules = {
  auth: typeof import('../services/auth');
  jobs: typeof import('../services/jobs');
  apps: typeof import('../services/applications');
  payments: typeof import('../services/payments');
  contacts: typeof import('../services/contacts');
  store: typeof import('../services/store');
  selectors: typeof import('../services/selectors');
  guards: typeof import('../services/guards');
  client: typeof import('../services/remote/client');
};

async function load(fake: ReturnType<typeof fakeSupabase>): Promise<Modules> {
  holder.client = fake.client;
  vi.resetModules();
  return {
    auth: await import('../services/auth'),
    jobs: await import('../services/jobs'),
    apps: await import('../services/applications'),
    payments: await import('../services/payments'),
    contacts: await import('../services/contacts'),
    store: await import('../services/store'),
    selectors: await import('../services/selectors'),
    guards: await import('../services/guards'),
    client: await import('../services/remote/client')
  };
}

/** A fake server with Ana (worker) and Obra Certa (company, two jobs), signed in as `as`. */
function server(as: 'ana' | 'obra' = 'ana', extra: Parameters<typeof fakeSupabase>[0] = {}) {
  const account = as === 'ana' ? workerAccount : companyAccount;
  return fakeSupabase({
    ...extra,
    tables: {
      accounts: [account],
      workers: [workerRow],
      companies: [companyRow('u-obra', 'Obra Certa'), companyRow('u-outra', 'Outra Construtora')],
      jobs: [jobRow('BC-5001', 'u-obra', 1), jobRow('BC-5002', 'u-outra', 2)],
      applications: [],
      application_events: [],
      saved_jobs: [],
      notifications: [],
      ...extra.tables
    },
    auth: {
      signInWithPassword: () => ({ data: { user: authUser(account.id, account.email) }, error: null }),
      getSession: () => ({ data: { session: { user: authUser(account.id, account.email) } }, error: null }),
      ...extra.auth
    }
  });
}

describe('remote: errors', () => {
  it('translates the server and the network into the app codes', async () => {
    const m = await load(fakeSupabase());
    const conflict = m.client.toServiceError({ code: 'BC409', message: 'As vagas desse bico já foram preenchidas.' });
    expect([conflict.code, conflict.message]).toEqual(['conflito', 'As vagas desse bico já foram preenchidas.']);
    expect(m.client.toServiceError({ code: '42501', message: 'permission denied' }).code).toBe('nao_autorizado');
    expect(m.client.toServiceError(new TypeError('Failed to fetch')).code).toBe('offline');
    expect(m.client.toServiceError({ code: 'XX000', message: 'boom' }).code).toBe('falha_demo');
    // The raw server text never reaches the screen for unexpected errors.
    expect(m.client.toServiceError({ code: 'XX000', message: 'boom' }).message).not.toContain('boom');
  });
});

describe('remote: sign-in and sign-up', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['Date'] }));
  afterEach(() => vi.useRealTimers());

  it('signs in by e-mail and loads the account and own profile (with its private number)', async () => {
    const m = await load(server('ana'));
    expect(await m.auth.signIn('Ana@Exemplo.com ', 'segredo123')).toEqual({ ok: true, role: 'trabalhador' });
    const session = m.store.getSession();
    expect(session).toMatchObject({
      accountId: 'u-ana',
      role: 'trabalhador',
      workerId: 'u-ana',
      profileComplete: true
    });
    expect(m.store.getDb().workers['u-ana'].whatsapp).toBe('11988887777');
  });

  it("can't tell a wrong password from an unknown e-mail; an unconfirmed e-mail goes to /verificar-email", async () => {
    let m = await load(
      server('ana', {
        auth: { signInWithPassword: () => ({ data: {}, error: { code: 'invalid_credentials', message: 'x' } }) }
      })
    );
    expect(await m.auth.signIn('ana@exemplo.com', 'errada')).toEqual({ ok: false, reason: 'credenciais' });

    m = await load(
      server('ana', {
        auth: { signInWithPassword: () => ({ data: {}, error: { code: 'email_not_confirmed', message: 'x' } }) }
      })
    );
    expect((await m.auth.signIn('ana@exemplo.com', 'segredo123')).ok).toBe(true);
    const session = m.store.getSession();
    expect(session?.email).toBe('ana@exemplo.com');
    expect(m.guards.homeFor(session!)).toBe('/verificar-email');
  });

  it('signs in by CPF through the server function (the e-mail never reaches the browser)', async () => {
    const fake = server('ana', {
      functions: {
        'entrar-com-documento': () => ({ data: { access_token: 'a', refresh_token: 'r' }, error: null })
      },
      auth: { setSession: () => ({ data: { user: authUser('u-ana', 'ana@exemplo.com') }, error: null }) }
    });
    const m = await load(fake);
    expect(await m.auth.signIn('123.456.789-09', 'segredo123')).toEqual({ ok: true, role: 'trabalhador' });
    expect(fake.calls.find((c) => c.kind === 'function')?.args).toEqual({
      documento: '12345678909',
      senha: 'segredo123'
    });
  });

  it('signs up: checks the document, sends the profile data, waits for the e-mail confirmation', async () => {
    const fake = fakeSupabase({
      rpc: { document_available: () => ({ data: true, error: null }) },
      auth: {
        signUp: () => ({ data: { user: authUser('u-novo', 'novo@exemplo.com', false), session: null }, error: null })
      }
    });
    const m = await load(fake);
    const result = await m.auth.signUp({
      role: 'trabalhador',
      name: ' Novo Silva ',
      doc: '123.456.789-09',
      email: 'Novo@Exemplo.com',
      whatsapp: '(11) 98888-7777',
      password: 'segredo123',
      acceptedTermsVersion: '1.0'
    });
    expect(result).toEqual({ ok: true });
    const sent = fake.calls.find((c) => c.name === 'signUp')?.args as { email: string; options: { data: object } };
    expect(sent.email).toBe('novo@exemplo.com');
    expect(sent.options.data).toEqual({
      nome: 'Novo Silva',
      role: 'trabalhador',
      tipo: 'pedreiro',
      documento: '12345678909',
      whatsapp: '11988887777',
      terms_version: '1.0'
    });
    expect(m.guards.homeFor(m.store.getSession()!)).toBe('/verificar-email');
  });

  it('refuses a document already in use and an e-mail already confirmed', async () => {
    let m = await load(fakeSupabase({ rpc: { document_available: () => ({ data: false, error: null }) } }));
    const data = {
      role: 'trabalhador' as const,
      name: 'Novo',
      doc: '123.456.789-09',
      email: 'novo@exemplo.com',
      whatsapp: '11988887777',
      password: 'segredo123',
      acceptedTermsVersion: '1.0'
    };
    expect(await m.auth.signUp(data)).toEqual({ ok: false, reason: 'doc-taken' });

    m = await load(
      fakeSupabase({
        rpc: { document_available: () => ({ data: true, error: null }) },
        // Supabase hides an existing confirmed e-mail: a user without identities and no error.
        auth: {
          signUp: () => ({ data: { user: { ...authUser('x', 'novo@exemplo.com'), identities: [] } }, error: null })
        }
      })
    );
    expect(await m.auth.signUp(data)).toEqual({ ok: false, reason: 'email-taken' });
  });
});

describe('remote: data and actions', () => {
  it('the mural brings the jobs, their companies and candidate counts (who they are stays private)', async () => {
    const m = await load(
      server('ana', {
        rpc: {
          job_stats: () => ({ data: [{ job_id: 'BC-5001', holding: 1, pending: 0, total: 3 }], error: null })
        }
      })
    );
    await m.auth.signIn('ana@exemplo.com', 'segredo123');
    await m.jobs.loadFeed();
    const db = m.store.getDb();
    expect(Object.keys(db.jobs).sort()).toEqual(['BC-5001', 'BC-5002']);
    expect(db.companies['u-outra'].name).toBe('Outra Construtora');
    // BC-5001 has its only slot taken: the mural reads it as full without seeing the candidacy.
    expect(m.selectors.isJobFull(db, db.jobs['BC-5001'])).toBe(true);
    expect(m.selectors.isJobFull(db, db.jobs['BC-5002'])).toBe(false);
  });

  it('a decision is one RPC; a refusal comes back with the server message', async () => {
    const fake = server('obra', {
      rpc: {
        transition_application: (args) =>
          args.p_action === 'aprovar'
            ? { data: null, error: { code: 'BC409', message: 'As vagas desse bico já foram preenchidas.' } }
            : { data: null, error: null }
      }
    });
    const m = await load(fake);
    await m.auth.signIn('obra@exemplo.com', 'segredo123');
    await expect(m.apps.approve('BC-5001', 'u-ana')).rejects.toMatchObject({
      code: 'conflito',
      message: 'As vagas desse bico já foram preenchidas.'
    });
    await m.apps.reject('BC-5001', 'u-ana');
    expect(fake.calls.filter((c) => c.name === 'transition_application').map((c) => c.args)).toEqual([
      { p_job_id: 'BC-5001', p_worker_id: 'u-ana', p_action: 'aprovar', p_reason: null },
      { p_job_id: 'BC-5001', p_worker_id: 'u-ana', p_action: 'recusar', p_reason: null }
    ]);
  });

  it('saving a job is optimistic and goes back when the server refuses', async () => {
    const fake = server('ana');
    const m = await load(fake);
    await m.auth.signIn('ana@exemplo.com', 'segredo123');
    expect(await m.jobs.toggleSavedJob('BC-5002')).toBe(true);
    expect(fake.tables.saved_jobs).toEqual([{ worker_id: 'u-ana', job_id: 'BC-5002' }]);
    // The next request fails: the flag returns to "saved".
    fake.client.from = () => {
      throw new TypeError('Failed to fetch');
    };
    await expect(m.jobs.toggleSavedJob('BC-5002')).rejects.toMatchObject({ code: 'offline' });
    expect(m.store.getDb().savedJobIds).toEqual(['BC-5002']);
  });

  it('saving uses insert (no UPDATE privilege on saved_jobs); an already saved job counts as saved (Z04)', async () => {
    const fake = server('ana');
    const m = await load(fake);
    await m.auth.signIn('ana@exemplo.com', 'segredo123');
    // Same rules as the database: unique (worker_id, job_id) and no UPDATE grant (so no upsert).
    fake.client.from = fakeSupabase({
      tables: fake.tables,
      unique: { saved_jobs: ['worker_id', 'job_id'] },
      noUpdate: ['saved_jobs']
    }).client.from;
    expect(await m.jobs.toggleSavedJob('BC-5002')).toBe(true);
    expect(fake.tables.saved_jobs).toEqual([{ worker_id: 'u-ana', job_id: 'BC-5002' }]);
    // Saved on another device meanwhile: this device still thinks it isn't saved, and saving again is fine.
    m.store.toggleSavedJob('BC-5002');
    expect(await m.jobs.toggleSavedJob('BC-5002')).toBe(true);
    expect(m.store.getDb().savedJobIds).toEqual(['BC-5002']);
    expect(fake.tables.saved_jobs).toHaveLength(1);
  });

  it('Z02: the card is charged by the Edge Function with the provider token only; declined is an error', async () => {
    vi.stubEnv('VITE_PAGAMENTOS', 'mercadopago');
    vi.stubEnv('VITE_MP_PUBLIC_KEY', 'TEST-public');
    const declined = {
      id: 'pg1',
      job_id: 'BC-5001',
      company_id: 'u-obra',
      plan: '24h',
      method: 'cartao',
      amount_cents: 1200,
      status: 'recusado',
      pix_code: null,
      card_last4: '0000',
      created_at: NOW,
      expires_at: null,
      confirmed_at: null,
      boost_ends_at: null
    };
    const fake = server('obra', {
      functions: { 'criar-cobranca': () => ({ data: { pagamento: declined }, error: null }) }
    });
    const m = await load(fake);
    await m.auth.signIn('obra@exemplo.com', 'segredo123');
    // A typed card is never accepted in real mode: only the provider's token.
    const typed = { card: { number: '4111 1111 1111 0000', name: 'ANA SOUZA', expiry: '12/30', cvv: '123' } };
    await expect(m.payments.payWithCard('BC-5001', '24h', typed)).rejects.toMatchObject({ code: 'validacao' });
    const token = { token: 'tok_123', paymentMethodId: 'visa', issuerId: '25' };
    await expect(m.payments.payWithCard('BC-5001', '24h', { token })).rejects.toMatchObject({ code: 'conflito' });
    expect(fake.calls.find((c) => c.name === 'criar-cobranca')?.args).toEqual({
      jobId: 'BC-5001',
      plan: '24h',
      method: 'cartao',
      card: token
    });
    expect(JSON.stringify(fake.calls)).not.toContain('4111');
    expect(m.store.getDb().boostPayments[0].status).toBe('recusado');
    // The demo simulation doesn't exist in real mode.
    await expect(m.payments.simulatePixPaid('pg1')).rejects.toMatchObject({ code: 'nao_autorizado' });
    vi.unstubAllEnvs();
  });

  it('Z02: without the payment provider configured, boosting is off in real mode', async () => {
    vi.stubEnv('VITE_PAGAMENTOS', '');
    const fake = server('obra');
    const m = await load(fake);
    await m.auth.signIn('obra@exemplo.com', 'segredo123');
    const features = await import('../services/features');
    expect(features.FEATURES.payments).toBe(false);
    await expect(m.payments.startPixPayment('BC-5001', '24h')).rejects.toMatchObject({ code: 'conflito' });
    expect(fake.calls.some((c) => c.name === 'criar-cobranca')).toBe(false);
    vi.unstubAllEnvs();
  });

  it('the WhatsApp number comes only from the server, with the ready-made message', async () => {
    const app = {
      id: 'app-1',
      job_id: 'BC-5001',
      worker_id: 'u-ana',
      status: 'pre_selecionado',
      created_at: NOW,
      status_changed_at: NOW,
      auto_rejected: false,
      worker_reviewed: false,
      company_reviewed: false
    };
    const fake = server('ana', {
      tables: { applications: [app] },
      rpc: { get_contact: () => ({ data: [{ name: 'Obra Certa', phone: '11955554444' }], error: null }) }
    });
    const m = await load(fake);
    await m.auth.signIn('ana@exemplo.com', 'segredo123');
    await m.apps.loadMyApplications();
    const contact = await m.contacts.getContact('app-1');
    expect(contact.phone).toBe('11955554444');
    expect(contact.url).toMatch(/^https:\/\/wa\.me\/5511955554444\?text=/);
    expect(decodeURIComponent(contact.url)).toContain('(BC-5001)');
  });

  it('publishing sends the job without the columns the server owns', async () => {
    const m = await load(fakeSupabase());
    const { draftRow } = await import('../services/remote/jobs');
    const { jobFromRow } = await import('../services/supabaseMappers');
    const job = jobFromRow(jobRow('BC-1', 'u-obra'));
    const row = draftRow(job) as Record<string, unknown>;
    expect(row).not.toHaveProperty('id');
    expect(row).not.toHaveProperty('company_id');
    expect(row).not.toHaveProperty('boost_ends_at');
    expect(row).toMatchObject({ oficio_id: 'pintor', cep: '01310-100', pay: 180, slots: 1 });
    expect(m.store.getDb().jobs).toEqual({});
  });
});
