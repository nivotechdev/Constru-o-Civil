// U21/U26/U30: light or dark theme, chosen in Configurações › Aparência — a choice of the ACCOUNT, kept in the database
// (account_prefs), so it is the same in every browser and phone where the account is signed in:
//   * signing in reads it with the account (and the account cache on the device opens the first screen in it);
//   * changing it saves it on the server (set_my_theme) and the other open devices get it at once (Realtime), or when
//     they come back to the screen;
//   * the dark theme exists only inside the app: signed in, e-mail confirmed and profile complete. Login, sign-up and
//     every screen after leaving or deleting the account are in the original (light) theme.
// The theme is the `data-theme` attribute of <html>; the colours live in styles/tokens.css. It follows the store, so
// signing in, out, switching accounts and deleting all land on the right theme on their own.
import { serviceError } from './errors';
import { IS_DEMO } from './mode';
import { showToast } from './toast';
import { getDb, getSession, subscribe, updateAccount } from './store';
import type { Session } from '../types/models';

export type Theme = 'claro' | 'escuro';

/** The phone's status bar: the brand blue in the light theme, the page colour in the dark one. */
const BAR = { claro: '#1D4BED', escuro: '#0D121B' } as const;

const listeners = new Set<() => void>();
let applied: Theme = 'claro';

/** The account whose choice counts now: only inside the app (signed in, e-mail confirmed, profile complete). */
function insideApp(session: Session | null): string | null {
  return session && session.emailConfirmed && session.profileComplete ? session.accountId : null;
}

/** The theme the screen should be in now. */
function wanted(): Theme {
  const account = insideApp(getSession());
  return account ? (getDb().accounts[account]?.theme ?? 'claro') : 'claro';
}

function apply(theme: Theme): void {
  const root = globalThis.document?.documentElement;
  if (!root) return;
  if (theme === 'escuro') root.dataset.theme = 'dark';
  else delete root.dataset.theme;
  root.ownerDocument.querySelector('meta[name="theme-color"]')?.setAttribute('content', BAR[theme]);
}

function sync(): void {
  const next = wanted();
  if (next === applied) return;
  applied = next;
  apply(next);
  listeners.forEach((fn) => fn());
}

/** U21/U26 kept the choice in each device's storage; the database has it now. */
function forgetDeviceChoices(): void {
  try {
    const storage = globalThis.localStorage;
    if (!storage) return;
    for (let i = storage.length - 1; i >= 0; i--) {
      const key = storage.key(i);
      if (key === 'bicos-tema' || key?.startsWith('bicos-tema:')) storage.removeItem(key);
    }
  } catch {
    // Nothing to clean.
  }
}

/** Starts following the session and the account (called once, before the first screen). */
export function startThemeSync(): () => void {
  forgetDeviceChoices();
  apply('claro');
  applied = 'claro';
  sync();
  return subscribe(sync);
}

/** The theme on screen now. */
export function getTheme(): Theme {
  return applied;
}

/** Saves the account's choice on the server (the database is the one place it lives). */
async function saveMyTheme(theme: Theme): Promise<void> {
  if (IS_DEMO) return;
  const { db, request } = await import('./remote/client');
  const client = await db();
  await request(() => client.rpc('set_my_theme', { p_theme: theme }));
}

/**
 * Changes the theme of the account in the app: on screen at once, saved for every device. If saving fails, it goes
 * back and says so — never one theme here and another in the database.
 */
export function setTheme(theme: Theme): void {
  const account = insideApp(getSession());
  if (!account) return;
  const before = getDb().accounts[account]?.theme ?? 'claro';
  if (before === theme) return;
  updateAccount(account, { theme });
  saveMyTheme(theme).catch(() => {
    if (getSession()?.accountId === account) updateAccount(account, { theme: before });
    showToast(serviceError('offline').message + ' O tema não foi salvo.', { tone: 'error' });
  });
}

export function subscribeTheme(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
