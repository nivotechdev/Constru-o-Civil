// U28: phone and Google sign-in through Firebase — the app sends Firebase's ID token to `entrar-com-firebase`, turns
// the answer into the Bicos session (verifyOtp with the link hash) and signs out of Firebase; a number without an
// account comes back as 'sem-conta' and is kept for the sign-up.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { authUser, fakeSupabase } from './fakeSupabase';

const holder = vi.hoisted(() => ({ client: null as unknown, signedOut: 0, popup: 0 }));

vi.mock('../services/supabase', () => ({
  isSupabaseConfigured: () => true,
  supabaseConfig: () => ({ url: 'https://x.supabase.co', anonKey: 'anon' }),
  getSupabase: async () => holder.client
}));
vi.mock('@firebase/app', () => ({ getApps: () => [], initializeApp: () => ({}) }));
vi.mock('@firebase/auth', () => ({
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
    return { user: { getIdToken: async () => 'firebase-token-google' } };
  }
}));

const box = new Map<string, string>();

function server(answer: 'ok' | 'sem-conta') {
  return fakeSupabase({
    tables: { accounts: [], workers: [], companies: [], jobs: [], applications: [], notifications: [] },
    functions: {
      'entrar-com-firebase': () =>
        answer === 'ok'
          ? { data: { token_hash: 'hash-1', novo: false }, error: null }
          : {
              data: null,
              error: { context: new Response(JSON.stringify({ erro: 'sem-conta' }), { status: 404 }) }
            }
    },
    auth: {
      verifyOtp: () => ({ data: { user: authUser('u-ana', 'ana@exemplo.com') }, error: null })
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
    expect(fake.calls.find((c) => c.kind === 'function')?.args).toEqual({ idToken: 'firebase-token-+5554991730426' });
    expect(fake.calls.find((c) => c.name === 'verifyOtp')?.args).toEqual({ token_hash: 'hash-1', type: 'magiclink' });
    expect(holder.signedOut).toBeGreaterThan(0);
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
    await firebase.signInWithFirebaseGoogle();
    expect(holder.popup).toBeGreaterThan(0);
    expect(fake.calls.find((c) => c.kind === 'function')?.args).toEqual({ idToken: 'firebase-token-google' });
  });
});
