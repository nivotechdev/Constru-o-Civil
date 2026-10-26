// The services with the real backend on (services/remote/), against a fake Supabase client: what is
// sent to the server, how the answers land in the store, and how errors reach the screens.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authUser, fakeSupabase } from './fakeSupabase';
import { TERMS_VERSION } from '../services/legal';

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
  terms_version: TERMS_VERSION,
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
  payment_method: null,
  payment_note: null,
  created_at: NOW,
  updated_at: NOW,
  deleted_at: null,
  area_lat: -23.56,
  area_lon: -46.65,
  public_slug: 'slug' + id.replace(/\D/g, '').padStart(8, '2'),
  weekdays: null,
  place_type: null
});
/** A row as feed_jobs returns it (X01): the job without its exact address, plus the order keys. */
const feedRow = (id: string, companyId: string, slots: number, rank: number) => {
  const { street, number, complement, cep, lat, lon, ...rest } = jobRow(id, companyId, slots);
  void [street, number, complement, cep, lat, lon];
  return { ...rest, _rank: rank, _key: 1000 - rank, _km: 2.5 };
};

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
  mappers: typeof import('../services/supabaseMappers');
  paging: typeof import('../services/paging');
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
    client: await import('../services/remote/client'),
    mappers: await import('../services/supabaseMappers'),
    paging: await import('../services/paging')
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

  it('R08: "permission denied" without a session says the session ended, not "your account cannot"', async () => {
    const denied = { data: null, error: { code: '42501', message: 'permission denied for function finish_sign_up' } };
    // No session (the request went out as a visitor).
    const lost = await load(fakeSupabase({ rpc: { finish_sign_up: () => denied } }));
    await expect(lost.client.request(async () => denied)).rejects.toMatchObject({
      code: 'nao_autorizado',
      message: lost.client.SESSION_ENDED
    });
    // With a session it is a real refusal and keeps the generic message.
    const real = await load(server('ana'));
    await expect(real.client.request(async () => denied)).rejects.toMatchObject({
      code: 'nao_autorizado',
      message: 'Sua conta não pode fazer isso.'
    });
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
      profileComplete: true,
      termsCurrent: true
    });
    expect(m.store.getDb().workers['u-ana'].whatsapp).toBe('11988887777');
  });

  it("can't tell a wrong password from an unknown e-mail; an unconfirmed e-mail is told, with the link again (Y19)", async () => {
    let m = await load(
      server('ana', {
        auth: { signInWithPassword: () => ({ data: {}, error: { code: 'invalid_credentials', message: 'x' } }) }
      })
    );
    expect(await m.auth.signIn('ana@exemplo.com', 'errada')).toEqual({ ok: false, reason: 'credenciais' });

    const resent: unknown[] = [];
    const fake = server('ana', {
      auth: {
        signInWithPassword: () => ({ data: {}, error: { code: 'email_not_confirmed', message: 'x' } }),
        getSession: () => ({ data: { session: null }, error: null }),
        resend: (args: unknown) => {
          resent.push(args);
          return { data: {}, error: null };
        }
      }
    });
    m = await load(fake);
    expect(await m.auth.signIn('Ana@exemplo.com', 'segredo123')).toEqual({
      ok: false,
      reason: 'email-nao-confirmado',
      email: 'ana@exemplo.com'
    });
    // No made-up session (it would not know the side).
    expect(m.store.getSession()).toBeNull();
    await m.auth.resendConfirmationEmail('ana@exemplo.com');
    expect(resent).toMatchObject([{ type: 'signup', email: 'ana@exemplo.com' }]);
  });

  it('U11: the 6-number e-mail code confirms the account and opens the session; a wrong one says so', async () => {
    const fake = server('ana', {
      auth: {
        verifyOtp: (args: unknown) =>
          (args as { token: string }).token === '123456'
            ? { data: { user: authUser('u-ana', 'ana@exemplo.com'), session: {} }, error: null }
            : { data: { user: null, session: null }, error: { code: 'otp_expired', status: 403, message: 'x' } }
      }
    });
    const m = await load(fake);
    await expect(m.auth.verifyEmailCode('ana@exemplo.com', '654321')).rejects.toMatchObject({
      code: 'validacao',
      message: expect.stringContaining('Código incorreto')
    });
    await m.auth.verifyEmailCode(' Ana@Exemplo.com ', '123456');
    expect(fake.calls.filter((c) => c.name === 'verifyOtp').map((c) => c.args)).toEqual([
      { email: 'ana@exemplo.com', token: '654321', type: 'email' },
      { email: 'ana@exemplo.com', token: '123456', type: 'email' }
    ]);
    expect(m.store.getSession()).toMatchObject({ role: 'trabalhador' });
    await expect(m.auth.verifyEmailCode('ana@exemplo.com', '12345')).rejects.toMatchObject({ code: 'validacao' });
  });

  it('Z07: by CPF the server checks the password and answers only that e-mail; the sign-in is the normal one', async () => {
    const fake = server('ana', {
      functions: { 'entrar-com-documento': () => ({ data: { email: 'ana@exemplo.com' }, error: null }) }
    });
    const m = await load(fake);
    expect(await m.auth.signIn('123.456.789-09', 'segredo123', async () => 'tok-1')).toEqual({
      ok: true,
      role: 'trabalhador'
    });
    expect(fake.calls.find((c) => c.kind === 'function')?.args).toEqual({
      documento: '12345678909',
      senha: 'segredo123',
      captchaToken: 'tok-1'
    });
    expect(fake.calls.find((c) => c.name === 'signInWithPassword')?.args).toMatchObject({
      email: 'ana@exemplo.com',
      password: 'segredo123'
    });
  });

  it('Z07: no account and wrong password are the same answer; too many attempts is explained', async () => {
    const refusal = (erro: string, status: number) => () => ({
      data: null,
      error: { name: 'FunctionsHttpError', context: new Response(JSON.stringify({ erro }), { status }) }
    });
    let m = await load(server('ana', { functions: { 'entrar-com-documento': refusal('credenciais', 401) } }));
    expect(await m.auth.signIn('123.456.789-09', 'errada')).toEqual({ ok: false, reason: 'credenciais' });
    m = await load(server('ana', { functions: { 'entrar-com-documento': refusal('muitas-tentativas', 429) } }));
    await expect(m.auth.signIn('123.456.789-09', 'errada')).rejects.toMatchObject({
      code: 'conflito',
      message: expect.stringContaining('Muitas tentativas')
    });
  });

  it('U10: asks verificar-cadastro whether the e-mail, CPF/CNPJ or WhatsApp is still free', async () => {
    const answers: Record<string, boolean> = { email: false, documento: true, whatsapp: true };
    const fake = fakeSupabase({
      functions: {
        'verificar-cadastro': (body) => ({
          data: { disponivel: answers[(body as { campo: string }).campo] },
          error: null
        })
      }
    });
    const m = await load(fake);
    expect(await m.auth.isFreeForSignUp('email', 'ana@exemplo.com')).toBe(false);
    expect(await m.auth.isFreeForSignUp('documento', '123.456.789-09')).toBe(true);
    expect(fake.calls.filter((c) => c.kind === 'function').map((c) => c.args)).toEqual([
      { campo: 'email', valor: 'ana@exemplo.com' },
      { campo: 'documento', valor: '123.456.789-09' }
    ]);
    const tooMany = await load(
      fakeSupabase({
        functions: {
          'verificar-cadastro': () => ({
            data: null,
            error: {
              name: 'FunctionsHttpError',
              context: new Response(JSON.stringify({ erro: 'muitas-tentativas' }), { status: 429 })
            }
          })
        }
      })
    );
    await expect(tooMany.auth.isFreeForSignUp('whatsapp', '11988887777')).rejects.toMatchObject({
      code: 'conflito',
      message: expect.stringContaining('Muitas tentativas')
    });
  });

  it('asks the captcha only when the server asks for it (X32), and asks again with the token', async () => {
    const seen: unknown[] = [];
    // The first question is free; from the second on the server asks for the token (the limit is passed).
    const fake = fakeSupabase({
      functions: {
        'verificar-cadastro': (body) => {
          seen.push(body);
          if (seen.length > 1 && !(body as { captchaToken?: string }).captchaToken)
            return {
              data: null,
              error: {
                name: 'FunctionsHttpError',
                context: new Response(JSON.stringify({ erro: 'captcha' }), { status: 400 })
              }
            };
          return { data: { disponivel: true }, error: null };
        }
      }
    });
    const m = await load(fake);
    // Normal use: no challenge, no captcha asked.
    const quiet = m.auth.isFreeForSignUp('email', 'ana@exemplo.com', async () => 'tok-1');
    expect(await quiet).toBe(true);
    // Over the limit: the server asks; the screen gets a token and the question is asked again with it.
    const asked = m.auth.isFreeForSignUp('documento', '123.456.789-09', async () => 'tok-2');
    expect(await asked).toBe(true);
    expect(seen).toEqual([
      { campo: 'email', valor: 'ana@exemplo.com' },
      { campo: 'documento', valor: '123.456.789-09' },
      { campo: 'documento', valor: '123.456.789-09', captchaToken: 'tok-2' }
    ]);
  });

  it('says the robot check failed when the server asks for the captcha and none comes', async () => {
    const m = await load(
      fakeSupabase({
        functions: {
          'verificar-cadastro': () => ({
            data: null,
            error: {
              name: 'FunctionsHttpError',
              context: new Response(JSON.stringify({ erro: 'captcha' }), { status: 400 })
            }
          })
        }
      })
    );
    await expect(m.auth.isFreeForSignUp('whatsapp', '11988887777', async () => undefined)).rejects.toMatchObject({
      code: 'validacao',
      message: expect.stringContaining('robô')
    });
  });

  it('signs up: sends the profile data (no separate document check), waits for the e-mail confirmation', async () => {
    const fake = fakeSupabase({
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
      acceptedTermsVersion: '1.0',
      adult: true
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
      terms_version: '1.0',
      maior_de_idade: true
    });
    expect(fake.calls.some((c) => c.kind === 'rpc')).toBe(false); // Z07: no document oracle
    expect(m.guards.homeFor(m.store.getSession()!)).toBe('/verificar-email');
  });

  it('U43: "Trocar" on the code screen signs up again with the new e-mail, so the code goes there at once', async () => {
    const fake = fakeSupabase({
      auth: {
        signUp: (args) => ({
          data: { user: authUser('u-novo', (args as { email: string }).email, false), session: null },
          error: null
        })
      },
      functions: { 'verificar-cadastro': () => ({ data: { disponivel: true }, error: null }) }
    });
    const m = await load(fake);
    const data = {
      role: 'trabalhador' as const,
      name: 'Novo Silva',
      doc: '123.456.789-09',
      email: 'novo@gmial.com',
      whatsapp: '(11) 98888-7777',
      password: 'segredo123',
      acceptedTermsVersion: '1.0',
      adult: true
    };
    expect(await m.auth.signUp(data)).toEqual({ ok: true });
    await expect(m.auth.changePendingEmail('Novo@Gmial.com')).rejects.toMatchObject({ message: m.auth.SAME_EMAIL });
    expect(await m.auth.changePendingEmail(' Novo@Gmail.com ')).toEqual({ ok: true });
    const sent = fake.calls
      .filter((c) => c.name === 'signUp')
      .map((c) => c.args as { email: string; password: string });
    expect(sent.map((s) => s.email)).toEqual(['novo@gmial.com', 'novo@gmail.com']);
    expect(sent[1]?.password).toBe('segredo123'); // nothing is asked again
    expect(m.store.getSession()?.email).toBe('novo@gmail.com');
    expect(m.guards.homeFor(m.store.getSession()!)).toBe('/verificar-email');
  });

  it('a refused document comes back without the reason; an e-mail already confirmed is told', async () => {
    let m = await load(
      fakeSupabase({
        // The database refuses inside the sign-up; the Auth answers only "database error".
        auth: { signUp: () => ({ data: {}, error: { code: 'unexpected_failure', status: 500, message: 'x' } }) }
      })
    );
    const data = {
      role: 'trabalhador' as const,
      name: 'Novo',
      doc: '123.456.789-09',
      email: 'novo@exemplo.com',
      whatsapp: '11988887777',
      password: 'segredo123',
      acceptedTermsVersion: '1.0',
      adult: true
    };
    expect(await m.auth.signUp(data)).toEqual({ ok: false, reason: 'recusado' });

    m = await load(
      fakeSupabase({
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
          feed_jobs: () => ({
            data: [feedRow('BC-5001', 'u-obra', 1, 0), feedRow('BC-5002', 'u-outra', 2, 1)],
            error: null
          }),
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
    // L10/L13: the mural brings the public link's slug, for the share button.
    expect(db.jobs['BC-5001'].publicSlug).toBe('slug22225001');
  });

  it('the mural comes in pages from the server; a job gone meanwhile leaves the screen (X01, Y10)', async () => {
    const page = Array.from({ length: 30 }, (_, i) => feedRow(`BC-6${String(i).padStart(3, '0')}`, 'u-outra', 1, i));
    const fake = server('ana', {
      rpc: {
        feed_jobs: (args) => ({ data: args.p_cursor ? [feedRow('BC-7000', 'u-outra', 1, 30)] : page, error: null })
      }
    });
    const m = await load(fake);
    await m.auth.signIn('ana@exemplo.com', 'segredo123');
    // BC-5001 is on the device from before; the server stopped listing it and it was deleted.
    m.store.createJob(m.mappers.jobFromRow(jobRow('BC-5001', 'u-obra')));
    fake.tables.jobs = fake.tables.jobs.filter((j) => j.id !== 'BC-5001');
    const q = {
      location: 'São Paulo, SP',
      from: { lat: -23.56, lon: -46.65 },
      radiusKm: 10,
      oficio: 'pintor',
      quando: null,
      minPay: null,
      sort: 'perto' as const,
      search: '',
      allCities: false
    };
    await m.jobs.loadFeed(q);
    const first = fake.calls.filter((c) => c.name === 'feed_jobs')[0].args;
    expect(first).toMatchObject({
      p_city: 'São Paulo',
      p_uf: 'SP',
      p_radius_km: 10,
      p_oficio: 'pintor',
      p_search: null,
      p_all_cities: false,
      p_limit: 30,
      p_cursor: null
    });
    let db = m.store.getDb();
    expect(db.jobs['BC-5001']).toBeUndefined();
    expect(Object.keys(db.jobs)).toHaveLength(30);
    expect(m.paging.getPaging(m.jobs.feedKey(q))).toMatchObject({ hasMore: true });

    await m.jobs.loadMoreFeed(q);
    expect((fake.calls.filter((c) => c.name === 'feed_jobs')[1].args as Record<string, unknown>).p_cursor).toEqual({
      r: 29,
      k: 971,
      id: 'BC-6029'
    });
    db = m.store.getDb();
    expect(db.jobs['BC-7000']).toBeDefined();
    expect(m.paging.getPaging(m.jobs.feedKey(q)).hasMore).toBe(false);
  });

  it('deleting the account goes through the Edge Function, which also removes the files (Y15)', async () => {
    const fake = server('ana', {
      functions: {
        'excluir-conta': (body) =>
          (body as { confirmCommitments: boolean }).confirmCommitments
            ? { data: { ok: true, arquivos: 3 }, error: null }
            : {
                data: null,
                error: {
                  context: new Response(
                    JSON.stringify({ erro: 'BC409', mensagem: 'Confirme o que acontece com os bicos em andamento.' }),
                    { status: 409 }
                  )
                }
              }
      }
    });
    const m = await load(fake);
    const account = await import('../services/account');
    await m.auth.signIn('ana@exemplo.com', 'segredo123');
    await expect(account.deleteAccount({ password: 'segredo123' }, false)).rejects.toMatchObject({ code: 'conflito' });
    expect(m.store.getSession()).not.toBeNull();
    await account.deleteAccount({ password: 'segredo123' }, true, async () => 'tok-excluir');
    expect(fake.calls.filter((c) => c.name === 'signInWithPassword').at(-1)?.args).toMatchObject({
      options: { captchaToken: 'tok-excluir' }
    });
    expect(fake.calls.filter((c) => c.kind === 'function').map((c) => c.args)).toEqual([
      { confirmCommitments: false },
      { confirmCommitments: true }
    ]);
    expect(fake.calls.some((c) => c.name === 'delete_my_account')).toBe(false);
    expect(m.store.getSession()).toBeNull();
  });

  it('U37: Google from the sign-up keeps the chosen side until the account exists and brings the name', async () => {
    const box = new Map<string, string>();
    vi.stubGlobal('sessionStorage', {
      getItem: (k: string) => box.get(k) ?? null,
      setItem: (k: string, v: string) => void box.set(k, v),
      removeItem: (k: string) => void box.delete(k)
    });
    const google = {
      ...authUser('u-novo', 'novo@gmail.com'),
      app_metadata: { provider: 'google', providers: ['google'] },
      user_metadata: { full_name: 'Marcos Pereira da Silva' }
    };
    const fake = server('ana', {
      auth: {
        signInWithOAuth: () => ({ data: {}, error: null }),
        getSession: () => ({ data: { session: { user: google } }, error: null })
      }
    });
    const m = await load(fake);
    const busy = await import('../services/busy');
    await m.auth.signInWithGoogle('recrutador');
    expect(fake.calls.find((c) => c.name === 'signInWithOAuth')?.args).toMatchObject({ provider: 'google' });
    // U45: the app stays locked ("Abrindo o Google…") while the page leaves for Google's own page.
    expect(busy.getBusy()?.message).toBe('Abrindo o Google…');
    busy.resetBusy(); // the page left and came back
    const signUp = await import('../services/googleSignUp');
    // Kept (not read once): a reload in the middle of the sign-up stays on the same side.
    expect([signUp.googleRole(), signUp.googleRole()]).toEqual(['recrutador', 'recrutador']);
    expect(signUp.googleSignUpPath()).toBe('/cadastro/recrutador');
    // From the login, no side yet: it is chosen first.
    await m.auth.signInWithGoogle();
    busy.resetBusy();
    expect(signUp.googleSignUpPath()).toBe('/escolha-perfil');
    // The e-mail (already confirmed by Google) and the name, for the steps.
    expect(await m.auth.loadGoogleSignUp()).toEqual({ email: 'novo@gmail.com', name: 'Marcos Pereira da Silva' });
    expect(signUp.googleIdentity()?.email).toBe('novo@gmail.com');
    // U40: leaving in the middle (back to the login) ends the pending Google login — nothing stays stuck.
    await m.auth.signInWithGoogle('trabalhador');
    busy.resetBusy();
    await m.auth.leaveGoogleSignUp();
    expect([signUp.googleRole(), signUp.googleIdentity()]).toEqual([null, null]);
    expect(fake.calls.some((c) => c.name === 'signOut')).toBe(true);
    vi.unstubAllGlobals();
  });

  it('U30: signing in reads the theme the account chose (the same on every device)', async () => {
    const fake = server('ana', {
      tables: { account_prefs: [{ account_id: 'u-ana', theme: 'escuro', updated_at: NOW }] }
    });
    const m = await load(fake);
    await m.auth.signIn('ana@exemplo.com', 'segredo123');
    expect(m.store.getDb().accounts['u-ana'].theme).toBe('escuro');
  });

  it('U51: the account reads its own address with the session, and saves a new one by set_my_address', async () => {
    const saved = {
      account_id: 'u-ana',
      cep: '95020-000',
      street: 'Rua Sinimbu',
      neighborhood: 'Centro',
      city: 'Caxias do Sul',
      uf: 'RS',
      lat: -29.168796,
      lon: -51.178701,
      precision: 'rua',
      updated_at: NOW
    };
    const fake = server('ana', {
      tables: { addresses: [saved] },
      rpc: { set_my_address: () => ({ data: null, error: null }) }
    });
    const m = await load(fake);
    await m.auth.signIn('ana@exemplo.com', 'segredo123');
    expect(m.selectors.myAddress(m.store.getDb())).toEqual({
      cep: '95020-000',
      street: 'Rua Sinimbu',
      neighborhood: 'Centro',
      city: 'Caxias do Sul',
      uf: 'RS',
      lat: -29.168796,
      lon: -51.178701,
      precision: 'rua'
    });
    // Distances are measured from the address (not from the profile's rounded point).
    expect(m.selectors.workerHome(m.store.getDb())).toEqual({ lat: -29.168796, lon: -51.178701 });

    const profiles = await import('../services/profiles');
    const next = {
      cep: '95084-470',
      street: 'Rua Os 18 do Forte',
      neighborhood: 'São Pelegrino',
      city: 'Caxias do Sul',
      uf: 'RS',
      cityLabel: 'Caxias do Sul, RS',
      lat: -29.1622,
      lon: -51.1866,
      precision: 'rua' as const
    };
    await profiles.saveMyAddress(next);
    expect(fake.calls.find((c) => c.name === 'set_my_address')?.args).toEqual({
      p: {
        cep: '95084-470',
        street: 'Rua Os 18 do Forte',
        neighborhood: 'São Pelegrino',
        city: 'Caxias do Sul',
        uf: 'RS',
        lat: -29.1622,
        lon: -51.1866,
        precision: 'rua'
      }
    });
    expect(m.selectors.myAddress(m.store.getDb())?.street).toBe('Rua Os 18 do Forte');
  });

  it('U51: completing the profile sends the address (and the city and rounded point an older server takes)', async () => {
    const fake = server('ana', { rpc: { finish_sign_up: () => ({ data: null, error: null }) } });
    const m = await load(fake);
    await m.auth.signIn('ana@exemplo.com', 'segredo123');
    await m.auth.finishSignUp({
      cep: '95020-000',
      street: 'Rua Sinimbu',
      neighborhood: 'Centro',
      city: 'Caxias do Sul',
      uf: 'RS',
      cityLabel: 'Caxias do Sul, RS',
      lat: -29.168796,
      lon: -51.178701,
      precision: 'rua'
    });
    expect(fake.calls.find((c) => c.name === 'finish_sign_up')?.args).toEqual({
      p: {
        address: {
          cep: '95020-000',
          street: 'Rua Sinimbu',
          neighborhood: 'Centro',
          city: 'Caxias do Sul',
          uf: 'RS',
          lat: -29.168796,
          lon: -51.178701,
          precision: 'rua'
        },
        city: 'Caxias do Sul, RS',
        lat: -29.17,
        lon: -51.18
      }
    });
  });

  it('U16: an account made with Google (no password) deletes itself with the code from its e-mail', async () => {
    let codeOk = false;
    const google = { ...authUser(workerAccount.id, workerAccount.email), app_metadata: { providers: ['google'] } };
    const fake = server('ana', {
      auth: {
        getSession: () => ({ data: { session: { user: google } }, error: null }),
        signInWithOtp: () => ({ data: {}, error: null }),
        verifyOtp: (args: unknown) =>
          (args as { token: string }).token === '123456'
            ? ((codeOk = true), { data: { user: google, session: { user: google } }, error: null })
            : { data: {}, error: { code: 'otp_expired', status: 403, message: 'x' } }
      },
      functions: { 'excluir-conta': () => ({ data: { ok: true, arquivos: 0 }, error: null }) }
    });
    const m = await load(fake);
    const account = await import('../services/account');
    await m.auth.signIn('ana@exemplo.com', 'segredo123');
    expect(await account.accountHasPassword()).toBe(false);
    await account.sendSecurityCode(async () => 'tok-codigo');
    expect(fake.calls.find((c) => c.name === 'signInWithOtp')?.args).toEqual({
      email: 'ana@exemplo.com',
      options: { shouldCreateUser: false, captchaToken: 'tok-codigo' }
    });
    await expect(account.deleteAccount({ code: '000000' }, true)).rejects.toMatchObject({ code: 'validacao' });
    expect(fake.calls.some((c) => c.kind === 'function')).toBe(false);
    await account.deleteAccount({ code: '123456' }, true);
    expect(codeOk).toBe(true);
    expect(fake.calls.filter((c) => c.kind === 'function').map((c) => c.args)).toEqual([{ confirmCommitments: true }]);
    expect(m.store.getSession()).toBeNull();
  });

  it('changing the WhatsApp is one RPC; the code goes through the Edge Function (Y25)', async () => {
    const fake = server('obra', {
      functions: {
        'codigo-whatsapp': (body) => ({ data: { ok: (body as { codigo?: string }).codigo === '123456' }, error: null })
      },
      rpc: { change_whatsapp: () => ({ data: { whatsapp: '21988881111', verified_at: NOW }, error: null }) }
    });
    const m = await load(fake);
    await m.auth.signIn('obra@exemplo.com', 'segredo123');
    const profiles = await import('../services/profiles');
    await m.auth.sendWhatsAppCode('(21) 98888-1111');
    expect(await m.auth.verifyWhatsAppCode('(21) 98888-1111', '000000')).toBe(false);
    expect(await m.auth.verifyWhatsAppCode('(21) 98888-1111', '123456')).toBe(true);
    expect(fake.calls.filter((c) => c.kind === 'function').map((c) => c.args)).toEqual([
      { acao: 'enviar', telefone: '21988881111', captchaToken: undefined },
      { acao: 'conferir', telefone: '21988881111', codigo: '000000' },
      { acao: 'conferir', telefone: '21988881111', codigo: '123456' }
    ]);
    await profiles.changeWhatsApp('(21) 98888-1111');
    expect(fake.calls.find((c) => c.name === 'change_whatsapp')?.args).toEqual({ p_whatsapp: '21988881111' });
    const account = m.store.getDb().accounts['u-obra'];
    expect(account).toMatchObject({ whatsapp: '21988881111', whatsappVerifiedAt: NOW });
    expect(m.store.getDb().companies['u-obra'].whatsapp).toBe('21988881111');
  });

  it('the new-job alert is saved and read on the server (Y28)', async () => {
    const fake = server('ana', {
      tables: {
        job_alerts: [
          { worker_id: 'u-ana', city: 'São Paulo', uf: 'SP', lat: -23.5, lon: -46.6, radius_km: null, oficio_id: null }
        ]
      }
    });
    const m = await load(fake);
    await m.auth.signIn('ana@exemplo.com', 'segredo123');
    const alerts = await import('../services/alerts');
    await alerts.loadMyJobAlert();
    expect(alerts.myJobAlert(m.store.getDb(), m.store.getSession())).toMatchObject({
      city: 'São Paulo, SP',
      radiusKm: null
    });
    await alerts.saveJobAlert({ city: 'Campinas, SP', lat: -22.9, lon: -47.06, radiusKm: 10, oficioId: 'pintor' });
    expect(fake.calls.find((c) => c.name === 'save_job_alert')?.args).toEqual({
      p_city: 'Campinas',
      p_uf: 'SP',
      p_lat: -22.9,
      p_lon: -47.06,
      p_radius_km: 10,
      p_oficio: 'pintor'
    });
    await alerts.deleteJobAlert();
    expect(fake.calls.some((c) => c.name === 'delete_job_alert')).toBe(true);
    expect(alerts.myJobAlert(m.store.getDb(), m.store.getSession())).toBeNull();
  });

  it('password and e-mail change re-check the password, then go to the Auth (L15, F08)', async () => {
    const updates: unknown[] = [];
    const fake = server('ana', {
      auth: {
        updateUser: (attrs: unknown) => {
          updates.push(attrs);
          return { data: {}, error: null };
        }
      }
    });
    const m = await load(fake);
    await m.auth.signIn('ana@exemplo.com', 'segredo123');
    await m.auth.changePassword('segredo123', 'novasenha1', async () => 'tok-senha');
    await m.auth.changeEmail('Ana.Nova@exemplo.com', 'segredo123', async () => 'tok-email');
    expect(updates).toEqual([{ password: 'novasenha1' }, { email: 'ana.nova@exemplo.com' }]);
    // R08: the re-check is a sign-in, so with the captcha on the Auth refuses it without a token.
    expect(
      fake.calls
        .filter((c) => c.name === 'signInWithPassword')
        .map((c) => (c.args as { options?: { captchaToken?: string } }).options?.captchaToken)
    ).toEqual([undefined, 'tok-senha', 'tok-email']);
  });

  it('"Sobre você" and the experiences are saved; the company sees no-shows and give-ups (U32/U34)', async () => {
    let fake = server('ana');
    let m = await load(fake);
    await m.auth.signIn('ana@exemplo.com', 'segredo123');
    const profiles = await import('../services/profiles');
    await profiles.updateMyWorkerProfile({
      bio: ' Oi ',
      experiences: [' Reboco  de fachada', '', 'Contrapiso']
    });
    const update = fake.calls.find((c) => c.name === 'workers' && c.ops?.some((o) => o[0] === 'update'));
    expect(update?.ops?.find((o) => o[0] === 'update')?.[1]).toEqual({
      bio: 'Oi',
      experiences: ['Reboco de fachada', 'Contrapiso']
    });
    // U13: the place from "Usar minha localização atual" goes with its own point (not the city centre).
    await profiles.updateMyWorkerProfile({ city: 'Caxias do Sul, RS', point: { lat: -29.17, lon: -51.18 } });
    const updates = fake.calls.filter((c) => c.name === 'workers' && c.ops?.some((o) => o[0] === 'update'));
    expect(updates[updates.length - 1]?.ops?.find((o) => o[0] === 'update')?.[1]).toEqual({
      city: 'Caxias do Sul, RS',
      neighborhood: null,
      lat: -29.17,
      lon: -51.18
    });

    fake = server('obra', {
      rpc: { worker_track_record: () => ({ data: [{ worker_id: 'u-ana', faltas: 2, desistencias: 1 }], error: null }) }
    });
    m = await load(fake);
    await m.auth.signIn('obra@exemplo.com', 'segredo123');
    await (await import('../services/profiles')).loadWorkerProfile('u-ana');
    expect(m.selectors.trackRecord(m.store.getDb(), 'u-ana')).toEqual({ faltas: 2, desistencias: 1 });
  });

  it('report and block go to the server; the blocked list comes with names (F04)', async () => {
    const fake = server('ana', { tables: { blocks: [{ blocker_id: 'u-ana', blocked_id: 'u-outra' }] } });
    const m = await load(fake);
    await m.auth.signIn('ana@exemplo.com', 'segredo123');
    const safety = await import('../services/safety');
    await safety.reportContent('vaga', 'BC-5001', 'golpe', ' pediu pix ');
    await safety.blockAccount('u-obra');
    expect(fake.calls.find((c) => c.name === 'report_content')?.args).toEqual({
      p_target_type: 'vaga',
      p_target_id: 'BC-5001',
      p_reason: 'golpe',
      p_details: 'pediu pix'
    });
    expect(fake.calls.find((c) => c.name === 'block_account')?.args).toEqual({ p_account: 'u-obra' });
    await safety.loadMyBlocks();
    expect(safety.blockedIds(m.store.getDb())).toEqual(['u-outra']);
    expect(m.store.getDb().companies['u-outra'].name).toBe('Outra Construtora');
  });

  it('F07: the two photos go to the private bucket and the paths to submit_identity; the status comes back', async () => {
    const fake = server('ana', {
      rpc: { my_identity: () => ({ data: [{ status: 'recusado', reason: 'Foto borrada' }], error: null }) }
    });
    const m = await load(fake);
    await m.auth.signIn('ana@exemplo.com', 'segredo123');
    const identity = await import('../services/identity');
    vi.stubGlobal('fetch', async () => new Response(new Blob(['x'], { type: 'image/jpeg' })));
    await identity.submitIdentity('blob:local/selfie', 'blob:local/doc', '1.0');
    vi.unstubAllGlobals();
    const uploads = fake.calls.filter((c) => c.kind === 'storage');
    expect(uploads.map((u) => u.name)).toEqual(['identidade', 'identidade']);
    uploads.forEach((u) => expect(String(u.args)).toMatch(/^u-ana\//));
    const args = fake.calls.find((c) => c.name === 'submit_identity')?.args as Record<string, unknown>;
    expect(args.p_selfie_path).toBe(uploads[0].args);
    expect(args.p_document_path).toBe(uploads[1].args);
    expect(args.p_consent_version).toBe('1.0'); // L07: the consent ticked on the screen goes with it
    expect(m.store.getDb().workers['u-ana'].identity).toBe('em_analise');
    await identity.loadMyIdentity();
    expect(m.store.getDb().workers['u-ana']).toMatchObject({ identity: 'recusado', identityReason: 'Foto borrada' });
  });

  it('X03: the bell counts on the server; read elsewhere, new notices and a reconnect keep it right', async () => {
    const notice = (id: string, read: string | null) => ({
      id,
      worker_id: 'u-ana',
      company_id: null,
      kind: 'vaga_editada',
      title: 'Vaga editada',
      body: 'Mudou o horário.',
      target: '/vaga/BC-5001',
      created_at: '2026-10-09T12:00:00Z',
      read_at: read
    });
    let serverCount = 140;
    const fake = server('ana', {
      tables: { notifications: [notice('n1', null), notice('n2', '2026-10-09T13:00:00Z')] },
      rpc: { my_unread_count: () => ({ data: serverCount, error: null }) }
    });
    const m = await load(fake);
    await m.auth.signIn('ana@exemplo.com', 'segredo123');
    const notifications = await import('../services/notifications');
    const count = () => notifications.unreadCount(m.store.getDb(), m.store.getSession());
    await notifications.loadNotifications();
    expect(count()).toBe(140);
    await notifications.markNotificationRead('n1');
    expect(count()).toBe(139);
    fake.emit('INSERT', notice('n3', null));
    expect(count()).toBe(140);
    // Read on another device: the notice changes here and the number comes from the server again.
    serverCount = 7;
    fake.emit('UPDATE', notice('n3', '2026-10-09T14:00:00Z'));
    await new Promise((r) => setTimeout(r, 0));
    expect(m.store.getDb().notifications.find((n) => n.id === 'n3')?.readAt).toBeTruthy();
    await vi.waitFor(() => expect(count()).toBe(7));
    // The channel dropped and came back: the list and the number are read again.
    const before = fake.calls.filter((c) => c.name === 'my_unread_count').length;
    fake.resubscribe();
    await vi.waitFor(() =>
      expect(fake.calls.filter((c) => c.name === 'my_unread_count').length).toBeGreaterThan(before)
    );
    await notifications.markAllNotificationsRead();
    expect(count()).toBe(0);
  });

  it('X03: turning push on asks the browser, subscribes with the VAPID key and saves the device', async () => {
    vi.stubEnv(
      'VITE_VAPID_PUBLIC_KEY',
      'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U'
    );
    const fake = server('ana');
    const m = await load(fake);
    await m.auth.signIn('ana@exemplo.com', 'segredo123');
    let subscribed: PushSubscriptionOptionsInit | null = null;
    const sub = {
      endpoint: 'https://push.example/xyz',
      toJSON: () => ({ keys: { p256dh: 'p'.repeat(40), auth: 'a'.repeat(16) } }),
      unsubscribe: async () => true
    };
    let current: typeof sub | null = null;
    const reg = {
      pushManager: {
        getSubscription: async () => current,
        subscribe: async (opts: PushSubscriptionOptionsInit) => {
          subscribed = opts;
          current = sub;
          return sub;
        }
      }
    };
    vi.stubGlobal('navigator', { serviceWorker: { getRegistration: async () => reg }, userAgent: 'Teste' });
    vi.stubGlobal('Notification', { permission: 'default', requestPermission: async () => 'granted' });
    vi.stubGlobal('PushManager', function PushManager() {});
    const push = await import('../services/push');
    expect(await push.pushState()).toBe('desligado');
    await push.enablePush();
    expect(subscribed).toMatchObject({ userVisibleOnly: true });
    expect(fake.calls.find((c) => c.name === 'save_push_subscription')?.args).toEqual({
      p_endpoint: 'https://push.example/xyz',
      p_p256dh: 'p'.repeat(40),
      p_auth: 'a'.repeat(16),
      p_user_agent: 'Teste'
    });
    await push.disablePush();
    expect(fake.calls.find((c) => c.name === 'delete_push_subscription')?.args).toEqual({
      p_endpoint: 'https://push.example/xyz'
    });
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('X01: notifications come in pages of 30 with "Carregar mais"', async () => {
    const rows = Array.from({ length: 35 }, (_, i) => ({
      id: 'n' + String(i).padStart(2, '0'),
      worker_id: 'u-ana',
      company_id: null,
      kind: 'vaga_editada',
      title: 'Aviso ' + i,
      body: '',
      target: null,
      created_at: `2026-10-${String(1 + Math.floor(i / 3)).padStart(2, '0')}T12:00:0${i % 3}Z`,
      read_at: null
    }));
    const fake = server('ana', {
      tables: { notifications: rows },
      rpc: { my_unread_count: () => ({ data: 35, error: null }) }
    });
    const m = await load(fake);
    await m.auth.signIn('ana@exemplo.com', 'segredo123');
    const notifications = await import('../services/notifications');
    const paging = await import('../services/paging');
    await notifications.loadNotifications();
    expect(m.store.getDb().notifications).toHaveLength(30);
    expect(paging.getPaging(paging.NOTIFICATIONS_PAGE).hasMore).toBe(true);
    await notifications.loadMoreNotifications();
    expect(new Set(m.store.getDb().notifications.map((n) => n.id)).size).toBe(35);
    expect(paging.getPaging(paging.NOTIFICATIONS_PAGE).hasMore).toBe(false);
  });

  it('X20: signing in and the Auth event that follows read the account once and open one channel', async () => {
    const fake = server('ana', {
      slow: { accounts: 20 },
      auth: { getSession: () => ({ data: { session: null }, error: null }) }
    });
    const m = await load(fake);
    // The app started signed out: the Auth listener is on.
    await (await import('../services/remote/session')).startRemoteSession();
    const channels = vi.spyOn(fake.client, 'channel');
    const signing = m.auth.signIn('ana@exemplo.com', 'segredo123');
    fake.authEvent('SIGNED_IN', { user: authUser('u-ana', 'ana@exemplo.com') });
    await signing;
    await new Promise((r) => setTimeout(r, 40));
    const accountReads = fake.calls.filter((c) => c.name === 'accounts' && c.ops?.some((o) => o[0] === 'select'));
    expect(accountReads).toHaveLength(1);
    expect(channels).toHaveBeenCalledTimes(1);
  });

  it('a candidacy notice makes the candidacy screens read again (Y12)', async () => {
    await load(server('ana'));
    const queries = await import('../services/queries');
    const notifications = await import('../services/notifications');
    const mine = vi.fn(() => Promise.resolve());
    const feed = vi.fn(() => Promise.resolve());
    await queries.runQuery('my-applications', mine);
    await queries.runQuery('feed', feed);
    notifications.noticeOpened({
      id: 'n1',
      kind: 'pre_selecionado',
      title: 'Você avançou',
      text: '',
      workerId: 'u-ana',
      companyId: null,
      target: '/selecionado/BC-5001',
      createdAt: NOW,
      readAt: null
    });
    // Opening it reads with the loading state, so the screen never shows the old status.
    expect(queries.getQuery('my-applications').status).toBe('loading');
    await new Promise((r) => setTimeout(r, 0));
    // A notice arriving by Realtime reads in the background.
    await queries.refreshCandidacies();
    expect(mine).toHaveBeenCalledTimes(3);
    expect(feed).toHaveBeenCalledTimes(1);
    expect(queries.getQuery('my-applications').status).toBe('ready');
  });

  it('U49: a search goes to feed_jobs only — no company or person is searched', async () => {
    const q = (search: string) => ({
      location: 'São Paulo, SP',
      from: { lat: -23.56, lon: -46.65 },
      radiusKm: null,
      oficio: null,
      quando: null,
      minPay: null,
      sort: 'perto' as const,
      search,
      allCities: false
    });
    for (const who of ['ana', 'obra'] as const) {
      const fake = server(who, { rpc: { feed_jobs: () => ({ data: [], error: null }) } });
      const m = await load(fake);
      await m.auth.signIn(who + '@exemplo.com', 'segredo123');
      const before = fake.calls.length;
      await m.jobs.loadFeed(q('garçom centro'));
      const calls = fake.calls.slice(before);
      expect((calls.find((c) => c.name === 'feed_jobs')?.args as Record<string, unknown>).p_search).toBe(
        'garçom centro'
      );
      const searched = calls.some(
        (c) => c.kind === 'from' && ['companies', 'workers'].includes(c.name) && c.ops?.some((o) => o[0] === 'ilike')
      );
      expect(searched).toBe(false);
    }
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

  it('U53: everyone signed in reads the full address with the job (no approval needed)', async () => {
    const app = {
      id: 'app-1',
      job_id: 'BC-5001',
      worker_id: 'u-ana',
      status: 'enviada',
      created_at: NOW,
      status_changed_at: NOW,
      auto_rejected: false,
      worker_reviewed: false,
      company_reviewed: false
    };
    const fake = server('ana', { tables: { applications: [app] } });
    const m = await load(fake);
    await m.auth.signIn('ana@exemplo.com', 'segredo123');
    await m.jobs.loadJob('BC-5001');
    const selects = fake.calls.filter((c) => c.name === 'jobs').map((c) => String(c.ops?.[0]?.[1]));
    expect(selects.every((cols) => cols.includes('street') && cols.includes('lat') && cols !== '*')).toBe(true);
    // Only a candidate, not picked: the address is there all the same, read with the job.
    expect(fake.calls.some((c) => c.name === 'get_job_addresses')).toBe(false);
    const job = m.store.getDb().jobs['BC-5001'];
    expect(job.address).toMatchObject({ street: 'Avenida Paulista', number: '1000', exact: true, lat: -23.56 });
    expect(m.selectors.canSeeExactAddress(m.store.getDb(), job)).toBe(true);
    // A row without the street (read before U53) keeps the area only, as before.
    const { putJobs } = await import('../services/remote/merge');
    const areaOnly: Record<string, unknown> = { ...jobRow('BC-5001', 'u-obra', 1) };
    for (const k of ['street', 'number', 'cep', 'complement', 'lat', 'lon']) delete areaOnly[k];
    const moved = putJobs([{ ...areaOnly, area_lat: -23.5619 } as unknown as ReturnType<typeof jobRow>])(
      m.store.getDb()
    );
    expect(moved.jobs['BC-5001'].address).toMatchObject({ street: '', exact: false, lat: -23.5619 });
  });

  it('Z12: profile pictures go to Storage (own folder) and are saved on the profile; the old file is removed', async () => {
    const fake = server('ana');
    const m = await load(fake);
    await m.auth.signIn('ana@exemplo.com', 'segredo123');
    const profiles = await import('../services/profiles');
    // A local picture (as picked on the phone); fetch() reads it back as a blob before the upload.
    vi.stubGlobal('fetch', async () => new Response(new Blob(['x'], { type: 'image/gif' })));
    await profiles.saveMyProfileImages({ foto: 'blob:local/1', capa: null });
    vi.unstubAllGlobals();
    const upload = fake.calls.find((c) => c.kind === 'storage');
    expect(upload?.name).toBe('avatars');
    expect(String(upload?.args)).toMatch(/^u-ana\//);
    const update = fake.calls.find((c) => c.name === 'workers' && c.ops?.some((o) => o[0] === 'update'));
    const patch = update?.ops?.find((o) => o[0] === 'update')?.[1] as Record<string, unknown>;
    expect(patch.photo_url).toMatch(/\/storage\/v1\/object\/public\/avatars\/u-ana\//);
    expect(patch.cover_url).toBeNull();
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

describe('Z11: opening the app with the real backend', () => {
  const storage = new Map<string, string>();
  beforeEach(() => {
    storage.clear();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => void storage.set(k, v),
      removeItem: (k: string) => void storage.delete(k),
      key: (i: number) => [...storage.keys()][i] ?? null,
      get length() {
        return storage.size;
      }
    });
    // Object.keys(localStorage) must list the keys, as in a browser.
    vi.stubGlobal(
      'localStorage',
      new Proxy(globalThis.localStorage, {
        ownKeys: () => [...storage.keys()],
        getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true })
      })
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  async function boot(fake: ReturnType<typeof fakeSupabase>) {
    const m = await load(fake);
    const session = await import('../services/remote/session');
    const bootState = await import('../services/boot');
    return { m, session, bootState };
  }

  it('a returning user with the account saved on the device opens at once; the server is checked after', async () => {
    // First visit: signs in, the account is saved on the device.
    const first = await boot(server('ana'));
    await first.m.auth.signIn('ana@exemplo.com', 'segredo123');
    expect(storage.get('bicos.conta')).toContain('u-ana');
    // Next visit: the server is slow; the saved account opens the app without waiting for it.
    const fake = server('ana');
    let release: () => void = () => undefined;
    const slow = new Promise<void>((r) => (release = r));
    const original = fake.client.from;
    fake.client.from = ((table: string) => {
      const b = original(table);
      if (table !== 'accounts') return b;
      const then = (b as { then: (...a: unknown[]) => unknown }).then;
      (b as { then: unknown }).then = (...a: unknown[]) => slow.then(() => then(...a));
      return b;
    }) as typeof fake.client.from;
    const { m, session, bootState } = await boot(fake);
    await session.startRemoteSession();
    expect(bootState.getBootStatus()).toBe('ready');
    expect(m.store.getSession()?.accountId).toBe('u-ana');
    release();
  });

  it('a session on the device but no server: "offline", not the login', async () => {
    storage.set('sb-x-auth-token', '{}');
    const fake = server('ana', {
      auth: {
        getSession: () => {
          throw new TypeError('Failed to fetch');
        }
      }
    });
    const { session, bootState, m } = await boot(fake);
    await session.startRemoteSession();
    expect(bootState.getBootStatus()).toBe('offline');
    expect(m.store.getSession()).toBeNull();
  });

  it('Y27: a request that finds the session expired says so and goes to the login', async () => {
    const hashes: string[] = [];
    vi.stubGlobal('window', { location: { pathname: '/', search: '', hash: '' }, addEventListener: () => undefined });
    vi.stubGlobal('history', { replaceState: (_s: unknown, _t: string, url: string) => hashes.push(url) });
    const fake = server('ana', {
      rpc: { submit_application: () => ({ data: null, error: { code: 'PGRST303', message: 'JWT expired' } }) }
    });
    const { m, session } = await boot(fake);
    await session.startRemoteSession();
    await m.auth.signIn('ana@exemplo.com', 'segredo123');
    await expect(m.apps.submitApplication('BC-5002')).rejects.toMatchObject({
      code: 'nao_autorizado',
      message: 'Sua sessão terminou. Entre de novo para continuar.'
    });
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    expect(m.store.getSession()).toBeNull();
    expect(hashes.at(-1)).toContain('#/login');
    expect(m.store.getUI('login', {})).toMatchObject({ identifier: 'ana@exemplo.com' });
  });

  it('U37: a Google login without its account continues in the sign-up (no e-mail step) and keeps the session', async () => {
    const hashes: string[] = [];
    vi.stubGlobal('window', { location: { pathname: '/', search: '', hash: '' }, addEventListener: () => undefined });
    vi.stubGlobal('history', { replaceState: (_s: unknown, _t: string, url: string) => hashes.push(url) });
    const google = { ...authUser('u-google', 'g@y.z'), app_metadata: { provider: 'email', via: 'firebase' } };
    const fake = fakeSupabase({
      tables: { accounts: [] },
      auth: {
        getSession: () => ({ data: { session: { user: google } }, error: null }),
        updateUser: () => ({ data: { user: google }, error: null })
      },
      rpc: { create_my_account: () => ({ data: null, error: null }) }
    });
    const { session, m } = await boot(fake);
    await session.startRemoteSession();
    // No side chosen yet: choosing it is the first step; the session (the Google login) stays.
    expect(hashes.at(-1)).toContain('#/escolha-perfil');
    expect(fake.calls.some((c) => c.name === 'signOut')).toBe(false);
    await m.auth
      .completeGoogleSignUp({
        role: 'trabalhador',
        name: 'Pelo Google',
        doc: '390.533.447-05',
        whatsapp: '(11) 98888-7777',
        password: 'segredo123',
        acceptedTermsVersion: '1.0',
        adult: true
      })
      .catch(() => undefined);
    // The password first (the account also enters by CPF and password), then the account with the sign-up's rules.
    expect(fake.calls.find((c) => c.name === 'updateUser')?.args).toEqual({ password: 'segredo123' });
    expect(fake.calls.find((c) => c.name === 'create_my_account')?.args).toEqual({
      p_role: 'trabalhador',
      p_name: 'Pelo Google',
      p_document: '39053344705',
      p_whatsapp: '11988887777',
      p_terms_version: '1.0',
      p_adult: true
    });
  });

  it('X11: a reset link opened and left unfinished is not a sign-in the next time the app opens', async () => {
    const memory = new Map<string, string>([['bicos.recuperacao', '1']]);
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => memory.get(k) ?? null,
      setItem: (k: string, v: string) => memory.set(k, v),
      removeItem: (k: string) => memory.delete(k),
      key: () => null,
      length: 0
    });
    vi.stubGlobal('window', {
      location: { pathname: '/', search: '', hash: '#/mural' },
      addEventListener: () => undefined
    });
    const fake = fakeSupabase({
      tables: { accounts: [workerAccount], workers: [workerRow] },
      auth: { getSession: () => ({ data: { session: { user: authUser('u-ana', 'ana@exemplo.com') } }, error: null }) }
    });
    const { session, m } = await boot(fake);
    await session.startRemoteSession();
    expect(fake.calls.some((c) => c.name === 'signOut')).toBe(true);
    expect(m.store.getSession()).toBeNull();
    expect(memory.has('bicos.recuperacao')).toBe(false);
    vi.unstubAllGlobals();
  });

  it('Y27: a session whose account has no row is signed out with the reason', async () => {
    const fake = fakeSupabase({
      tables: { accounts: [] },
      auth: { getSession: () => ({ data: { session: { user: authUser('u-sumiu', 'x@y.z') } }, error: null }) }
    });
    const { session, bootState, m } = await boot(fake);
    await session.startRemoteSession();
    expect(bootState.getBootStatus()).toBe('ready');
    expect(m.store.getSession()).toBeNull();
    expect(fake.calls.some((c) => c.name === 'signOut')).toBe(true);
  });
});
