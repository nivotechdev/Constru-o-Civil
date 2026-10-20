// U21/U26: light or dark theme, chosen in Configurações › Aparência — a preference of each ACCOUNT on this device.
//   * It is saved under the account (`bicos-tema:<account id>`), so it comes back every time that account signs in,
//     and another account on the same phone starts in the original (light) theme.
//   * The dark theme exists only inside the app: logged in, e-mail confirmed and profile complete. The login, the
//     sign-up, "Confirme seu e-mail", "Completar perfil" and every screen after leaving or deleting the account are
//     always in the original theme.
// The theme is the `data-theme` attribute of <html>; the colours live in styles/tokens.css. The store's session drives
// it (startThemeSync), so signing in, out, switching accounts and deleting all land on the right theme on their own.
import { getSession, subscribe } from './store';
import type { Session } from '../types/models';

export type Theme = 'claro' | 'escuro';

const PREFIX = 'bicos-tema:';
/** U21 kept one choice for the whole device; it is dropped (the choice now belongs to an account). */
const OLD_KEY = 'bicos-tema';
/** The phone's status bar: the brand blue in the light theme, the page colour in the dark one. */
const BAR = { claro: '#1D4BED', escuro: '#0D121B' } as const;

const listeners = new Set<() => void>();
let applied: Theme = 'claro';
/** This visit's choices, for a phone that won't keep the storage (private window). */
const memory = new Map<string, Theme>();

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** The account whose preference counts now: only inside the app (signed in, e-mail confirmed, profile complete). */
function insideApp(session: Session | null): string | null {
  return session && session.emailConfirmed && session.profileComplete ? session.accountId : null;
}

function saved(accountId: string): Theme {
  const kept = memory.get(accountId);
  if (kept) return kept;
  try {
    return storage()?.getItem(PREFIX + accountId) === 'escuro' ? 'escuro' : 'claro';
  } catch {
    return 'claro';
  }
}

function apply(theme: Theme): void {
  const root = globalThis.document?.documentElement;
  if (!root) return;
  if (theme === 'escuro') root.dataset.theme = 'dark';
  else delete root.dataset.theme;
  root.ownerDocument.querySelector('meta[name="theme-color"]')?.setAttribute('content', BAR[theme]);
}

/** Puts the page in the theme the session should have, and tells the toggle if it changed. */
function sync(): void {
  const account = insideApp(getSession());
  const next = account ? saved(account) : 'claro';
  if (next === applied) return;
  applied = next;
  apply(next);
  listeners.forEach((fn) => fn());
}

/** Starts following the session (called once, before the first screen). */
export function startThemeSync(): () => void {
  try {
    storage()?.removeItem(OLD_KEY);
  } catch {
    // Nothing to clean.
  }
  apply('claro');
  applied = 'claro';
  sync();
  return subscribe(sync);
}

/** The theme on screen now. */
export function getTheme(): Theme {
  return applied;
}

/** Changes the theme of the account in the app now; outside the app there is nothing to change. */
export function setTheme(theme: Theme): void {
  const account = insideApp(getSession());
  if (!account) return;
  memory.set(account, theme);
  try {
    if (theme === 'escuro') storage()?.setItem(PREFIX + account, 'escuro');
    else storage()?.removeItem(PREFIX + account);
  } catch {
    // Without storage the theme lasts until the app is closed.
  }
  if (theme === applied) return;
  applied = theme;
  apply(theme);
  listeners.forEach((fn) => fn());
}

/** The deleted account's choice goes with it. */
export function forgetTheme(accountId: string): void {
  memory.delete(accountId);
  try {
    storage()?.removeItem(PREFIX + accountId);
  } catch {
    // Nothing kept.
  }
}

export function subscribeTheme(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
