// U28: Google and phone sign-in through Firebase Authentication. Firebase does the hard part in the browser — the
// Google window, the SMS code and the invisible reCAPTCHA against robots — and returns an ID token; the Edge Function
// `entrar-com-firebase` checks it and answers a one-time link hash that becomes the Bicos session (Supabase Auth,
// where the accounts live). The Firebase SDK is loaded only here, when someone taps "Google" or "Celular", so the
// rest of the app doesn't carry it. Firebase keeps no session of its own: it signs out right after.
import type { Auth, ConfirmationResult, RecaptchaVerifier } from '@firebase/auth';
import { FIREBASE_CONFIG } from '../features';
import { serviceError, ServiceError } from '../errors';
import { db, invokeFunction, toServiceError } from './client';
import { enterSession } from './session';

let authPromise: Promise<Auth> | null = null;
let confirmation: ConfirmationResult | null = null;
let verifier: RecaptchaVerifier | null = null;

async function firebaseAuth(): Promise<Auth> {
  authPromise ??= (async () => {
    const [{ initializeApp, getApps }, { getAuth, useDeviceLanguage }] = await Promise.all([
      import('@firebase/app'),
      import('@firebase/auth')
    ]);
    const app = getApps()[0] ?? initializeApp(FIREBASE_CONFIG);
    const auth = getAuth(app);
    useDeviceLanguage(auth); // the SMS and the Google window in Portuguese
    return auth;
  })();
  return authPromise;
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

/** Exchanges the Firebase ID token for the Bicos session. `sem-conta` (phone without an account) is answered as such. */
async function bridge(auth: Auth, idToken: string): Promise<'ok' | 'sem-conta'> {
  const { signOut } = await import('@firebase/auth');
  try {
    const answer = await invokeFunction<{ token_hash: string }>('entrar-com-firebase', { idToken });
    const client = await db();
    const { data, error } = await client.auth.verifyOtp({ token_hash: answer.token_hash, type: 'magiclink' });
    if (error) throw toServiceError(error);
    const user = data.user ?? data.session?.user;
    if (!user) throw serviceError('falha_demo');
    await enterSession(user).catch(() => undefined); // a new Google login without its account goes to "Completar cadastro"
    return 'ok';
  } catch (e) {
    if (e instanceof ServiceError && e.reason === 'sem-conta') return 'sem-conta';
    throw e;
  } finally {
    await signOut(auth).catch(() => undefined);
  }
}

export async function signInWithFirebaseGoogle(): Promise<void> {
  const auth = await firebaseAuth();
  const { GoogleAuthProvider, signInWithPopup } = await import('@firebase/auth');
  let idToken: string;
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const result = await signInWithPopup(auth, provider);
    idToken = await result.user.getIdToken();
  } catch (e) {
    throw firebaseError(e);
  }
  await bridge(auth, idToken);
}

/** Sends the SMS code to "+55<DDD><number>". `container` holds the invisible reCAPTCHA. */
export async function sendPhoneCode(phone: string, container: HTMLElement): Promise<void> {
  const auth = await firebaseAuth();
  const { RecaptchaVerifier, signInWithPhoneNumber } = await import('@firebase/auth');
  try {
    verifier?.clear();
    verifier = new RecaptchaVerifier(auth, container, { size: 'invisible' });
    confirmation = await signInWithPhoneNumber(auth, '+55' + phone.replace(/\D/g, ''), verifier);
  } catch (e) {
    verifier?.clear();
    verifier = null;
    throw firebaseError(e);
  }
}

export async function confirmPhoneCode(code: string): Promise<'ok' | 'sem-conta'> {
  if (!confirmation) throw serviceError('validacao', 'Peça o código por SMS primeiro.');
  const auth = await firebaseAuth();
  let idToken: string;
  try {
    const result = await confirmation.confirm(code);
    idToken = await result.user.getIdToken();
  } catch (e) {
    throw firebaseError(e);
  }
  confirmation = null;
  return bridge(auth, idToken);
}
