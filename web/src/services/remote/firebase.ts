// U28/U29: Google and phone sign-in through Firebase Authentication. Firebase does the hard part in the browser — the
// Google window, the SMS code and the invisible reCAPTCHA against robots — and returns an ID token; the Edge Function
// `entrar-com-firebase` checks it and answers a one-time link hash that becomes the Bicos session (Supabase Auth,
// where the accounts live). Firebase keeps no session of its own: it signs out right after.
// U29: the SDK is loaded when a screen with the buttons opens (prepareFirebase), NOT on the tap: a browser only lets a
// page open a window (the Google one) right inside the tap, and loading the SDK first used to make it block the window.
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
  loading ??= (async () => {
    const [{ initializeApp, getApps }, sdk] = await Promise.all([import('@firebase/app'), import('@firebase/auth')]);
    const app = getApps()[0] ?? initializeApp(FIREBASE_CONFIG);
    const auth = sdk.getAuth(app);
    sdk.useDeviceLanguage(auth); // the SMS and the Google window in Portuguese
    ready = { auth, sdk };
    return ready;
  })();
  loading.catch(() => {
    loading = null; // offline when the screen opened: try again on the tap
  });
  return loading;
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
    const answer = await invokeFunction<{ token_hash: string }>('entrar-com-firebase', { idToken });
    const client = await db();
    const { data, error } = await client.auth.verifyOtp({ token_hash: answer.token_hash, type: 'magiclink' });
    if (error) throw toServiceError(error);
    const user = data.user ?? data.session?.user;
    if (!user) throw serviceError('falha_demo');
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
    await sdk.signOut(auth).catch(() => undefined);
  }
}

/**
 * The Google window. When Firebase is already loaded (the usual case: it loads as the screen opens), the window opens
 * right inside the tap — nothing is awaited before it.
 */
export async function signInWithFirebaseGoogle(): Promise<'ok' | GoogleIdentity> {
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
