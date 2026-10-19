/// <reference types="vite/client" />

// Environment variables the app reads. Vite exposes only the VITE_* ones to the browser, and replaces
// them at build time. Both are optional: without them the app runs on its in-memory mock data.
interface ImportMetaEnv {
  /** Supabase project URL, e.g. https://abcdefgh.supabase.co */
  readonly VITE_SUPABASE_URL?: string;
  /** The project's public "anon" key — made for the browser; Row Level Security is what protects the data. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** Payment provider for "Impulsionar" ("mercadopago"); without it the boost is hidden (real mode). */
  readonly VITE_PAGAMENTOS?: string;
  /** Mercado Pago public key (the card form runs in the browser with it). */
  readonly VITE_MP_PUBLIC_KEY?: string;
  /** Cloudflare Turnstile site key (captcha on sign-up and document login). */
  readonly VITE_TURNSTILE_SITE_KEY?: string;
  /** "1" when the Auth has the Google provider configured. */
  readonly VITE_LOGIN_GOOGLE?: string;
  /** "1" when the WhatsApp/SMS code (Edge Function codigo-whatsapp) has a provider configured. */
  readonly VITE_CODIGO_WHATSAPP?: string;
  /** Web Push public VAPID key; without it, push notifications are hidden. */
  readonly VITE_VAPID_PUBLIC_KEY?: string;
  /** Sentry DSN for error reports (optional). */
  readonly VITE_SENTRY_DSN?: string;
  /** Support WhatsApp number (digits), for "Falar com o suporte". */
  readonly VITE_SUPORTE_WHATSAPP?: string;
  /** The version name in error reports: the commit, set by vite.config.ts (L05). */
  readonly VITE_RELEASE?: string;
  /** Sentry environment ("production" by default; "staging" on the staging build). */
  readonly VITE_SENTRY_ENVIRONMENT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
