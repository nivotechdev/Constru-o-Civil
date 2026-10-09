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
