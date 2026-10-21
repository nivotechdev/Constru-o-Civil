// U28/U29: Google and phone sign-in through Firebase Authentication. Firebase does the hard part in the browser — the
// Google window, the SMS code and the invisible reCAPTCHA against robots — and returns an ID token; the Edge Function
// `entrar-com-firebase` checks it and answers a one-time link hash that becomes the Bicos session (Supabase Auth,
// where the accounts live). Firebase keeps no session of its own: it signs out right after.
// U29: the SDK is loaded when a screen with the buttons opens (prepareFirebase), NOT on the tap: a browser only lets a
// page open a window (the Google one) right inside the tap, and loading the SDK first used to make it block the window.
import type { FirebaseApp } from '@firebase/app';
import type { Auth, ConfirmationResult, RecaptchaVerifier } from '@firebase/auth';
import { FIREBASE_CONFIG } from '../features';
import { serviceError, ServiceError } from '../errors';
import { db, invokeFunction, toServiceError } from './client';
import { enterSession, googleIdentityOf, MissingAccountError } from './session';
import type { GoogleIdentity } from '../googleSignUp';

type Sdk = typeof import('@firebase/auth');

let loading: Promise<{ auth: Auth; sdk: Sdk }> | null = null;
let ready: { auth: Auth; sdk: Sdk } | null = null;
let confirmation: ConfirmationResult | null = null;
let verifier: RecaptchaVerifier | null = null;

/** Loads and starts Firebase (once). The screens with the buttons call it as they open. */
export function prepareFirebase(): Promise<{ auth: Auth; sdk: Sdk }> {
  warmUpSignIn();
  loading ??= (async () => {
    const [{ initializeApp, getApps }, sdk] = await Promise.all([import('@firebase/app'), import('@firebase/auth')]);
    const app = getApps()[0] ?? initializeApp(FIREBASE_CONFIG);
    const auth = startAuth(sdk, app);
    sdk.useDeviceLanguage(auth); // the SMS and the Google window in Portuguese
    ready = { auth, sdk };
    preloadGoogleFrame(auth);
    return ready;
  })();
  loading.catch(() => {
    loading = null; // offline when the screen opened: try again on the tap
  });
  return loading;
}

/**
 * U46: Firebase keeps nothing on the device (it signs out right after handing the token over), so it starts in
 * memory — no IndexedDB to open and read before the first tap.
 */
function startAuth(sdk: Sdk, app: FirebaseApp): Auth {
  try {
    return sdk.initializeAuth(app, {
      persistence: sdk.inMemoryPersistence,
      popupRedirectResolver: sdk.browserPopupRedirectResolver
    });
  } catch {
    return sdk.getAuth(app); // already started (a hot reload in development)
  }
}

/**
 * U46: on a computer Firebase loads Google's helper frame only on the first tap, and the window waits for it (phones
 * and Safari load it right away): load it now, as the screen opens. Firebase's own internal step, guarded — if it
 * isn't there, the tap just waits as before.
 */
function preloadGoogleFrame(auth: Auth): void {
  type Resolver = { _initialize?: (auth: Auth) => Promise<unknown> };
  void Promise.resolve()
    .then(() => auth.authStateReady())
    .then(() => (auth as unknown as { _popupRedirectResolver?: Resolver })._popupRedirectResolver?._initialize?.(auth))
    .catch(() => undefined);
}

/** U46: when the last wake-up was sent (one every few minutes is enough to keep the function up). */
let warmedAt = 0;
const WARM_EVERY_MS = 3 * 60_000;

/**
 * U46: wakes the Edge Function up as a screen with the Google button opens (it answers at once, reads nothing), so the
 * tap doesn't wait for it to start — and the browser keeps the CORS permission for the real call.
 */
function warmUpSignIn(): void {
  const now = Date.now();
  if (now - warmedAt < WARM_EVERY_MS) return;
  warmedAt = now;
  void invokeFunction('entrar-com-firebase', { aquecer: true }).catch(() => undefined);
}

/** Firebase's errors in the person's words. */
function firebaseError(e: unknown): ServiceError {
  const code = String((e as { code?: string })?.code ?? '');
  if (code.includes('popup-closed') || code.includes('cancelled-popup') || code.includes('user-cancelled'))
    return serviceError('validacao', 'Você fechou a janela do Google antes de terminar. Tente de novo.');
  if (code.includes('popup-blocked'))
    return serviceError(
      'validacao',
      'O navegador bloqueou a janela do Google. Permita janelas deste site e tente de novo.'
    );
  if (code.includes('invalid-phone-number'))
    return serviceError('validacao', 'Número inválido. Use o celular com DDD (11 números).');
  if (code.includes('too-many-requests') || code.includes('quota-exceeded'))
    return serviceError('conflito', 'Muitas tentativas com esse número. Espere alguns minutos e tente de novo.');
  if (code.includes('invalid-verification-code') || code.includes('missing-verification-code'))
    return serviceError('validacao', 'Código incorreto. Confira o SMS e digite de novo.');
  if (code.includes('code-expired') || code.includes('session-expired'))
    return serviceError('validacao', 'O código venceu. Peça outro código.');
  if (code.includes('network-request-failed')) return serviceError('offline');
  if (code.includes('unauthorized-domain') || code.includes('operation-not-allowed') || code.includes('captcha'))
    return serviceError('falha_demo', 'Esse jeito de entrar ainda não está ligado. Entre com e-mail e senha.');
  return toServiceError(e);
}

/**
 * Exchanges the Firebase ID token for the Bicos session. `sem-conta` (a phone number without an account) is answered
 * as such; a Google login without its account answers its e-mail and name, for the sign-up (U37).
 */
async function bridge(auth: Auth, sdk: Sdk, idToken: string): Promise<'ok' | 'sem-conta' | GoogleIdentity> {
  try {
    const answer = await invokeFunction<{ token_hash: string; conta?: boolean }>('entrar-com-firebase', { idToken });
    const client = await db();
    const { data, error } = await client.auth.verifyOtp({ token_hash: answer.token_hash, type: 'magiclink' });
    if (error) throw toServiceError(error);
    const user = data.user ?? data.session?.user;
    if (!user) throw serviceError('falha_demo');
    // U46: the function already knows there is no account: straight to the sign-up, without the reads that would
    // only answer "no account" (the session's own check still runs on its side, as always).
    if (answer.conta === false) return googleIdentityOf(user);
    try {
      await enterSession(user);
    } catch (e) {
      if (e instanceof MissingAccountError) return googleIdentityOf(user);
      throw e;
    }
    return 'ok';
  } catch (e) {
    if (e instanceof ServiceError && e.reason === 'sem-conta') return 'sem-conta';
    throw e;
  } finally {
    // U46: not waited for — Firebase's session is only in memory and nothing depends on it.
    void sdk.signOut(auth).catch(() => undefined);
  }
}

/** U45: what the Google sign-in tells the screen on the way (see signInWithGoogle in services/auth.ts). */
export interface GoogleSignInHooks {
  /** The Google window answered with an account: now the Bicos account is being opened. */
  onAccountChosen?: () => void;
  /** Read right after the window answers: false (the person tapped "Cancelar") stops there, signed out. */
  stillWanted?: () => boolean;
}

/**
 * The Google window. When Firebase is already loaded (the usual case: it loads as the screen opens), the window opens
 * right inside the tap — nothing is awaited before it. `cancelado`: the person gave up while the window was open.
 */
export async function signInWithFirebaseGoogle(
  hooks: GoogleSignInHooks = {}
): Promise<'ok' | 'cancelado' | GoogleIdentity> {
  const loaded = ready;
  let popup;
  if (loaded) {
    const provider = new loaded.sdk.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    popup = loaded.sdk.signInWithPopup(loaded.auth, provider);
  }
  const { auth, sdk } = loaded ?? (await prepareFirebase());
  let idToken: string;
  try {
    if (!popup) {
      const provider = new sdk.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      popup = sdk.signInWithPopup(auth, provider);
    }
    const result = await popup;
    if (hooks.stillWanted && !hooks.stillWanted()) {
      void sdk.signOut(auth).catch(() => undefined);
      return 'cancelado';
    }
    hooks.onAccountChosen?.();
    idToken = await result.user.getIdToken();
  } catch (e) {
    throw firebaseError(e);
  }
  const result = await bridge(auth, sdk, idToken);
  // Only a phone number can lack an account at the Edge Function; a Google one always gets its login.
  if (result === 'sem-conta') throw serviceError('falha_demo');
  return result;
}

/** Sends the SMS code to "+55<DDD><number>". `container` holds the invisible reCAPTCHA. */
export async function sendPhoneCode(phone: string, container: HTMLElement): Promise<void> {
  const { auth, sdk } = await prepareFirebase();
  try {
    verifier?.clear();
    verifier = new sdk.RecaptchaVerifier(auth, container, { size: 'invisible' });
    confirmation = await sdk.signInWithPhoneNumber(auth, '+55' + phone.replace(/\D/g, ''), verifier);
  } catch (e) {
    verifier?.clear();
    verifier = null;
    throw firebaseError(e);
  }
}

export async function confirmPhoneCode(code: string): Promise<'ok' | 'sem-conta'> {
  if (!confirmation) throw serviceError('validacao', 'Peça o código por SMS primeiro.');
  const { auth, sdk } = await prepareFirebase();
  let idToken: string;
  try {
    const result = await confirmation.confirm(code);
    idToken = await result.user.getIdToken();
  } catch (e) {
    throw firebaseError(e);
  }
  confirmation = null;
  const result = await bridge(auth, sdk, idToken);
  // The number's account exists (the Edge Function finds it by the WhatsApp), so the session always opens.
  return typeof result === 'string' ? result : 'ok';
}
