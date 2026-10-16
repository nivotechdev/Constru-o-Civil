// L01 (lançamento): which variables a build needs, checked before Vite bundles anything.
//
// `npm run build` is the production build: it talks to Supabase, so a missing variable must stop it —
// before, a deploy without VITE_SUPABASE_URL quietly shipped the demo app with made-up jobs
// (services/mode.ts). The demo is now asked for by name: `npm run build:demo` (and the standalone
// preview). Pure functions only, so the unit tests run them without Vite.

/** The Vite modes that build the demo app (in-memory data, no Supabase). */
export const DEMO_MODES = ['demo', 'standalone'] as const;

export function isDemoMode(mode: string): boolean {
  return (DEMO_MODES as readonly string[]).includes(mode);
}

type Env = Record<string, string | undefined>;

interface Rule {
  name: string;
  /** What it is, in the error message. */
  what: string;
  /** Returns the problem with a present value, or null when it is fine. */
  check?: (value: string) => string | null;
}

const httpsUrl = (value: string) => (/^https:\/\/[^\s/]+/.test(value) ? null : 'precisa ser um endereço https://');
/** L03: the local E2E build talks to a Supabase on this machine (http://127.0.0.1:…). */
const localOrHttps = (value: string) =>
  /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(value) ? null : httpsUrl(value);

/**
 * L11: a Brazilian mobile with its area code — DDD + 9 digits, with or without the 55 and the punctuation.
 * The support number used to default to 5494731661 (one digit short); now it must be given and be right.
 */
export function brMobileProblem(value: string): string | null {
  const digits = value.replace(/\D/g, '');
  const local = digits.length === 13 && digits.startsWith('55') ? digits.slice(2) : digits;
  return /^[1-9][1-9]9\d{8}$/.test(local) ? null : 'precisa ser um celular com DDD (ex.: 11 98765-4321)';
}

/** The mode of the E2E build (e2e/LEIA.md): every variable required, but local addresses allowed. */
export const E2E_MODE = 'e2e';

/** The variables a production build can't do without. */
export const PRODUCTION_ENV: readonly Rule[] = [
  { name: 'VITE_SUPABASE_URL', what: 'endereço do projeto Supabase', check: httpsUrl },
  { name: 'VITE_SUPABASE_ANON_KEY', what: 'chave pública (anon) do Supabase' },
  { name: 'VITE_SITE_URL', what: 'endereço publicado do app', check: httpsUrl },
  { name: 'VITE_TURNSTILE_SITE_KEY', what: 'site key do captcha (Cloudflare Turnstile)' },
  { name: 'VITE_SENTRY_DSN', what: 'DSN do Sentry (erros de produção)', check: httpsUrl },
  { name: 'VITE_SUPORTE_WHATSAPP', what: 'WhatsApp do suporte, celular com DDD', check: brMobileProblem }
];

/** One line per missing or malformed variable; empty when the production build may go on. */
export function productionEnvProblems(env: Env, mode = 'production'): string[] {
  const problems: string[] = [];
  for (const rule of PRODUCTION_ENV) {
    const value = env[rule.name]?.trim() ?? '';
    if (!value) {
      problems.push(`${rule.name} — falta (${rule.what})`);
      continue;
    }
    const check = mode === E2E_MODE && rule.check === httpsUrl ? localOrHttps : rule.check;
    const problem = check?.(value);
    if (problem) problems.push(`${rule.name} — ${problem}`);
  }
  return problems;
}

/** The message the failed build prints. */
export function productionEnvError(problems: string[]): string {
  return [
    'Build de produção interrompido: faltam variáveis de ambiente.',
    ...problems.map((p) => `  • ${p}`),
    'Preencha em .env.production.local (ou nas variáveis do deploy) — modelo em web/.env.example.',
    'Para uma demonstração com dados falsos use: npm run build:demo'
  ].join('\n');
}
