// U28: phone and Google sign-in through Firebase — the app sends Firebase's ID token to `entrar-com-firebase`, turns
// the answer into the Bicos session (verifyOtp with the link hash) and signs out of Firebase; a number without an
// account comes back as 'sem-conta' and is kept for the sign-up.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { authUser, fakeSupabase } from './fakeSupabase';

const holder = vi.hoisted(() => ({
  client: null as unknown,
  signedOut: 0,
  popup: 0,
  /** U45: while set, the Google window stays open (the person is choosing the account). */
  gate: null as Promise<void> | null,
  /** U68: the window's answer is this Firebase error (e.g. closed without choosing). */
  closeWith: null as string | null,
  /** U46: how Firebase was started, and whether Google's helper frame was loaded ahead. */
  started: [] as unknown[],
  framePreloaded: 0
}));

vi.mock('../services/supabase', () => ({
  isSupabaseConfigured: () => true,
  supabaseConfig: () => ({ url: 'https://x.supabase.co', anonKey: 'anon' }),
  getSupabase: async () => holder.client
}));
vi.mock('@firebase/app', () => ({ getApps: () => [], initializeApp: () => ({}) }));
vi.mock('../services/features', async (original) => {
  const m = await original<typeof import('../services/features')>();
  return { ...m, FEATURES: { ...m.FEATURES, firebase: true, googleLogin: true } };
});
vi.mock('@firebase/auth', () => ({
  inMemoryPersistence: 'memória',
  browserPopupRedirectResolver: 'janela',
  initializeAuth: (_app: unknown, deps: unknown) => {
    holder.started.push(deps);
    return {
      authStateReady: async () => undefined,
      _popupRedirectResolver: { _initialize: async () => void holder.framePreloaded++ }
    };
  },
  getAuth: () => ({}),
  useDeviceLanguage: () => undefined,
  signOut: async () => void holder.signedOut++,
  RecaptchaVerifier: class {
    clear() {}
  },
  signInWithPhoneNumber: async (_auth: unknown, phone: string) => ({
    confirm: async (code: string) => {
      if (code !== '123456') throw Object.assign(new Error('x'), { code: 'auth/invalid-verification-code' });
      return { user: { getIdToken: async () => 'firebase-token-' + phone } };
    }
  }),
  GoogleAuthProvider: class {
    setCustomParameters() {}
  },
  signInWithPopup: async () => {
    holder.popup++;
    if (holder.gate) await holder.gate;
    if (holder.closeWith) throw Object.assign(new Error('x'), { code: holder.closeWith });
    return { user: { getIdToken: async () => 'firebase-token-google' } };
  }
}));

const box = new Map<string, string>();

/** The token exchanges sent to entrar-com-firebase (U46: the wake-up calls left out). */
const exchanges = (fake: ReturnType<typeof fakeSupabase>) =>
  fake.calls.filter((c) => c.kind === 'function' && !(c.args as { aquecer?: boolean }).aquecer).map((c) => c.args);

function server(answer: 'ok' | 'sem-conta', conta?: boolean, refuseMagicLink = false) {
  return fakeSupabase({
    tables: { accounts: [], workers: [], companies: [], jobs: [], applications: [], notifications: [] },
    functions: {
      'entrar-com-firebase': (body) =>
        (body as { aquecer?: boolean }).aquecer
          ? { data: null, error: null }
          : answer === 'ok'
            ? { data: { token_hash: 'hash-1', novo: false, ...(conta === undefined ? {} : { conta }) }, error: null }
            : {
                data: null,
                error: { context: new Response(JSON.stringify({ erro: 'sem-conta' }), { status: 404 }) }
              }
    },
    auth: {
      verifyOtp: (args: unknown) =>
        refuseMagicLink && (args as { type: string }).type === 'magiclink'
          ? { data: null, error: { message: 'Email link is invalid or has expired', status: 403 } }
          : { data: { user: authUser('u-ana', 'ana@exemplo.com') }, error: null }
    }
  });
}

describe('entrar com o celular e com o Google pelo Firebase (U28)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    box.clear();
  });

  it('the SMS code opens the account of that number; the Bicos session comes from the link hash', async () => {
    const fake = server('ok');
    holder.client = fake.client;
    const firebase = await import('../services/remote/firebase');
    await firebase.sendPhoneCode('(54) 99173-0426', {} as HTMLElement);
    await expect(firebase.confirmPhoneCode('000000')).rejects.toMatchObject({ code: 'validacao' });
    await firebase.sendPhoneCode('(54) 99173-0426', {} as HTMLElement);
    expect(await firebase.confirmPhoneCode('123456')).toBe('ok');
    expect(exchanges(fake)).toEqual([{ idToken: 'firebase-token-+5554991730426' }]);
    expect(fake.calls.find((c) => c.name === 'verifyOtp')?.args).toEqual({ token_hash: 'hash-1', type: 'magiclink' });
    expect(holder.signedOut).toBeGreaterThan(0);
  });

  it('U64: a link of the sign-up kind (e-mail never confirmed) still opens the account', async () => {
    const fake = server('ok', true, true);
    holder.client = fake.client;
    const firebase = await import('../services/remote/firebase');
    await firebase.sendPhoneCode('(54) 99173-0426', {} as HTMLElement);
    expect(await firebase.confirmPhoneCode('123456')).toBe('ok');
    expect(fake.calls.filter((c) => c.name === 'verifyOtp').map((c) => (c.args as { type: string }).type)).toEqual([
      'magiclink',
      'signup'
    ]);
  });

  it('a number without an account answers sem-conta and the sign-up starts with it', async () => {
    vi.stubGlobal('sessionStorage', {
      getItem: (k: string) => box.get(k) ?? null,
      setItem: (k: string, v: string) => void box.set(k, v),
      removeItem: (k: string) => void box.delete(k)
    });
    const fake = server('sem-conta');
    holder.client = fake.client;
    const firebase = await import('../services/remote/firebase');
    const auth = await import('../services/auth');
    await firebase.sendPhoneCode('54991730426', {} as HTMLElement);
    expect(await auth.confirmPhoneSignInCode('(54) 99173-0426', '123456')).toBe('sem-conta');
    expect(fake.calls.some((c) => c.name === 'verifyOtp')).toBe(false);
    expect(auth.takeSignUpPhone()).toBe('54991730426');
    expect(auth.takeSignUpPhone()).toBeNull();
  });

  it('U29: with Firebase prepared as the screen opens, the Google window opens inside the tap (nothing awaited)', async () => {
    const fake = server('ok');
    holder.client = fake.client;
    const firebase = await import('../services/remote/firebase');
    await firebase.prepareFirebase();
    const before = holder.popup;
    const done = firebase.signInWithFirebaseGoogle();
    // Synchronously, still "inside the tap": the browser allows the window only here.
    expect(holder.popup).toBe(before + 1);
    await done;
  });

  it('Google: the Firebase window, then the same exchange for the Bicos session', async () => {
    const fake = server('ok');
    holder.client = fake.client;
    const firebase = await import('../services/remote/firebase');
    // U37: a Google login without a Bicos account answers its e-mail and name — the sign-up continues with them.
    expect(await firebase.signInWithFirebaseGoogle()).toEqual({ email: 'ana@exemplo.com', name: '' });
    expect(holder.popup).toBeGreaterThan(0);
    expect(exchanges(fake)).toEqual([{ idToken: 'firebase-token-google' }]);
  });

  it('U68: nothing covers the screen while the Google window is open; once an account is chosen it opens, locked', async () => {
    const loc = { protocol: 'https:', origin: 'https://bicos.app', pathname: '/escolha-perfil', search: '', hash: '' };
    const go = (_: unknown, __: string, url?: string) => url && Object.assign(loc, { pathname: url });
    vi.stubGlobal('window', { location: loc, addEventListener: () => undefined });
    vi.stubGlobal('location', loc);
    vi.stubGlobal('history', { state: null, pushState: go, replaceState: go });
    vi.stubGlobal('requestAnimationFrame', (fn: () => void) => setTimeout(fn));
    vi.stubGlobal('sessionStorage', {
      getItem: (k: string) => box.get(k) ?? null,
      setItem: (k: string, v: string) => void box.set(k, v),
      removeItem: (k: string) => void box.delete(k)
    });
    const fake = server('ok');
    holder.client = fake.client;
    const firebase = await import('../services/remote/firebase');
    const auth = await import('../services/auth');
    const busy = await import('../services/busy');
    await firebase.prepareFirebase();
    let choose = () => undefined as void;
    holder.gate = new Promise<void>((done) => (choose = done));
    const shown: (string | undefined)[] = [];
    busy.subscribeBusy(() => shown.push(busy.getBusy()?.message));

    // The tap: only Google's window shows — no "waiting" screen over the app.
    const done = auth.signInWithGoogle('trabalhador');
    expect(busy.getBusy()).toBeNull();
    // The account was chosen: now the Bicos account opens (locked); then the next screen, then unlocked.
    choose();
    await done;
    expect(loc.pathname).toBe('/cadastro/trabalhador'); // no account yet: the same sign-up, without the e-mail
    expect(busy.isBusy()).toBe(true); // until the next screen is drawn
    await vi.waitFor(() => expect(busy.isBusy()).toBe(false));
    expect(shown).toEqual(['Entrando na sua conta…', undefined]);
    // The phone's back button all the way to the login ends that Google login (nothing stays half-done).
    const pending = await import('../services/googleSignUp');
    expect(pending.googleIdentity()?.email).toBe('ana@exemplo.com');
    (await import('../services/router')).navigate('/login');
    await vi.waitFor(() => expect(pending.googleIdentity()).toBeNull());
    await vi.waitFor(() => expect(fake.calls.some((c) => c.name === 'signOut')).toBe(true));

    // The window closed without an account chosen: the attempt just ends — no error, nothing shown, no session.
    holder.closeWith = 'auth/popup-closed-by-user';
    loc.pathname = '/login';
    shown.length = 0;
    const calls = fake.calls.filter((c) => c.kind === 'function').length;
    await expect(auth.signInWithGoogle()).resolves.toBeUndefined();
    expect(shown).toEqual([]);
    expect(fake.calls.filter((c) => c.kind === 'function').length).toBe(calls); // no exchange for a session
    expect(loc.pathname).toBe('/login');
    // A newer tap replaced the older window: the same, silently.
    holder.closeWith = 'auth/cancelled-popup-request';
    await expect(auth.signInWithGoogle()).resolves.toBeUndefined();
    holder.closeWith = null;
    holder.gate = null;
  });

  it('U46: faster — the function is woken as the screen opens, Firebase starts in memory with the frame loaded', async () => {
    const fake = server('ok', false);
    holder.client = fake.client;
    holder.started = [];
    holder.framePreloaded = 0;
    const firebase = await import('../services/remote/firebase');
    await firebase.prepareFirebase();
    await firebase.prepareFirebase(); // another screen opening soon after: no second wake-up
    await vi.waitFor(() => expect(holder.framePreloaded).toBe(1));
    expect(holder.started).toEqual([{ persistence: 'memória', popupRedirectResolver: 'janela' }]);
    const wakeUps = fake.calls.filter((c) => c.kind === 'function' && (c.args as { aquecer?: boolean }).aquecer);
    expect(wakeUps).toHaveLength(1);
    // No account (the function says so): straight to the sign-up, without reading the account that isn't there.
    const before = fake.calls.length;
    expect(await firebase.signInWithFirebaseGoogle()).toEqual({ email: 'ana@exemplo.com', name: '' });
    const after = fake.calls.slice(before);
    expect(after.some((c) => c.name === 'ensure_my_account')).toBe(false);
    expect(after.some((c) => c.kind === 'from' && c.name === 'accounts')).toBe(false);
  });
});
