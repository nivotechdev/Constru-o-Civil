// Who may open which route. Pure rules over the session, so they are tested on their own
// (src/__tests__/guards.test.ts) and App.tsx only applies the answer.
import type { Role, Session } from '../types/models';

/**
 * - `public`: anyone, logged in or not (password reset, terms, privacy policy).
 * - `guest`: only without a session (splash, login, sign-up); a logged-in user goes to their start.
 * - `onboarding`: logged in, before the app opens (confirm e-mail, complete profile).
 * - `app`: logged in, onboarding done, either side.
 * - a Role: logged in, onboarding done, that side only.
 */
export type Access = 'public' | 'guest' | 'onboarding' | 'app' | Role;

export type GuardResult = { kind: 'ok' } | { kind: 'redirect'; to: string } | { kind: 'forbidden'; area: Role };

/** Where a session belongs right now: the next onboarding step, or the mural. */
export function homeFor(session: Session): string {
  if (!session.emailConfirmed) return '/verificar-email';
  if (!session.profileComplete) return '/completar-perfil/' + session.role;
  // L07: a new version of the terms is accepted before anything else.
  if (!session.termsCurrent) return '/aceitar-termos';
  return '/mural';
}

export function guardRoute(access: Access, path: string, session: Session | null): GuardResult {
  if (access === 'public') return { kind: 'ok' };
  if (!session) return access === 'guest' ? { kind: 'ok' } : { kind: 'redirect', to: '/login' };

  const home = homeFor(session);
  if (access === 'guest') return { kind: 'redirect', to: home };
  // Onboarding first: until it is done, the only screen that opens is the current step.
  if (home !== '/mural') return path === home ? { kind: 'ok' } : { kind: 'redirect', to: home };
  if (access === 'onboarding') return { kind: 'redirect', to: home };
  if (access !== 'app' && access !== session.role) return { kind: 'forbidden', area: access };
  return { kind: 'ok' };
}

/** After signing in, a deep link the user was sent away from (kept only if it is an in-app route). */
export const RETURN_TO_KEY = 'return-to';
export interface ReturnToUI {
  path: string | null;
}
export const RETURN_TO_DEFAULTS: ReturnToUI = { path: null };

// AUD-033: where to go after signing in or finishing the profile. Kept in this tab's sessionStorage as well as the
// store, because the store is cleared when the account changes (the Google, SMS and new sign-ups lost it).
const RETURN_STORAGE_KEY = 'bicos.voltar';

/** A path inside the app, and nothing that leads elsewhere (no scheme, no protocol-relative address). */
export function isAppPath(path: string | null | undefined): path is string {
  return typeof path === 'string' && path.startsWith('/') && !path.startsWith('//') && !path.includes('://');
}

export function rememberReturnTo(path: string): void {
  if (!isAppPath(path)) return;
  try {
    sessionStorage.setItem(RETURN_STORAGE_KEY, path);
  } catch {
    // no storage: the store copy is still there
  }
}

/** Where the person was trying to go, if they were sent to sign in from a deep link. Read it; `forgetReturnTo` ends it. */
export function peekReturnTo(): string | null {
  try {
    const path = sessionStorage.getItem(RETURN_STORAGE_KEY);
    return isAppPath(path) ? path : null;
  } catch {
    return null;
  }
}

export function forgetReturnTo(): void {
  try {
    sessionStorage.removeItem(RETURN_STORAGE_KEY);
  } catch {
    // nothing to forget
  }
}
