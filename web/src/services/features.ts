// What the app can offer, decided at build time. A function that depends on an outside service
// (payment, captcha, SMS/WhatsApp code, social login, push) exists in full in the code, but in real mode
// it stays hidden until its provider is configured — no button promises what can't happen (see
// docs/SUPABASE.md › "O que ainda depende de serviço externo"). The demo simulates all of them.
import { IS_DEMO } from './mode';

const env: ImportMetaEnv = import.meta.env;
const on = (v: string | undefined) => v === '1' || v === 'true';

/**
 * U28: Firebase Authentication — the web app's public identifiers (they go in every Firebase web page; the safety is
 * in the Edge Function that checks Firebase's signature and in the authorized domains of the Firebase console).
 */
export const FIREBASE_CONFIG = {
  apiKey: env.VITE_FIREBASE_API_KEY ?? '',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: env.VITE_FIREBASE_PROJECT_ID ?? '',
  appId: env.VITE_FIREBASE_APP_ID ?? ''
};
const firebase = !IS_DEMO && Object.values(FIREBASE_CONFIG).every(Boolean);

export const FEATURES = {
  /** "Impulsionar vaga" (paid): Mercado Pago with its public key. */
  payments: IS_DEMO || (env.VITE_PAGAMENTOS === 'mercadopago' && Boolean(env.VITE_MP_PUBLIC_KEY)),
  /** Captcha (Cloudflare Turnstile) on sign-up and on the document login. Not in the demo. */
  captcha: !IS_DEMO && Boolean(env.VITE_TURNSTILE_SITE_KEY),
  /** "Continuar com o Google": through Firebase (U28) or the Google provider of Supabase Auth (L13). Not in the demo. */
  googleLogin: firebase || (!IS_DEMO && on(env.VITE_LOGIN_GOOGLE)),
  /** U28: Google through Firebase (instead of Supabase's own Google). */
  firebase,
  /** U28: "Entrar com o celular" — the SMS code by Firebase. Not in the demo. */
  phoneLogin: firebase,
  /** The WhatsApp number confirmed by a code. */
  whatsappCode: IS_DEMO || on(env.VITE_CODIGO_WHATSAPP),
  /** Notifications on the phone (Web Push). */
  push: !IS_DEMO && Boolean(env.VITE_VAPID_PUBLIC_KEY)
} as const;

export const MP_PUBLIC_KEY = env.VITE_MP_PUBLIC_KEY ?? '';
export const TURNSTILE_SITE_KEY = env.VITE_TURNSTILE_SITE_KEY ?? '';
export const VAPID_PUBLIC_KEY = env.VITE_VAPID_PUBLIC_KEY ?? '';
/**
 * Support WhatsApp (digits, with area code). L11: no default — the production build refuses to run without a
 * valid mobile (build/env.ts); the demo has none and the Help screen offers only the e-mail.
 */
export const SUPPORT_WHATSAPP = (env.VITE_SUPORTE_WHATSAPP ?? '').replace(/\D/g, '');
export const SUPPORT_EMAIL = 'nivotech.dev@gmail.com';
