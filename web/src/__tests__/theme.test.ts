// U21/U26: the light/dark theme belongs to an account and exists only inside the app — the login and the sign-up are
// always in the original theme, another account starts light, leaving or deleting goes back to light.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '../types/models';

let session: Session | null = null;
const listeners = new Set<() => void>();
vi.mock('../services/store', () => ({
  getSession: () => session,
  subscribe: (fn: () => void) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }
}));

const box = new Map<string, string>();
const meta = { content: '#1D4BED', setAttribute: (_: string, v: string) => void (meta.content = v) };
const root = { dataset: {} as Record<string, string>, ownerDocument: { querySelector: () => meta } };

function signIn(accountId: string, inApp = true) {
  session = {
    accountId,
    email: accountId + '@bicos.test',
    role: 'trabalhador',
    workerId: accountId,
    companyId: null,
    emailConfirmed: inApp,
    profileComplete: inApp,
    termsCurrent: true
  };
  listeners.forEach((fn) => fn());
}
function signOut() {
  session = null;
  listeners.forEach((fn) => fn());
}
const dark = () => root.dataset.theme === 'dark';

describe('tema (U21/U26)', () => {
  beforeEach(() => {
    box.clear();
    root.dataset = {};
    session = null;
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => box.get(k) ?? null,
      setItem: (k: string, v: string) => void box.set(k, v),
      removeItem: (k: string) => void box.delete(k)
    });
    vi.stubGlobal('document', { documentElement: root });
  });
  afterEach(() => {
    listeners.clear();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('is saved per account and comes back only for that account', async () => {
    const theme = await import('../services/theme');
    theme.startThemeSync();
    expect(dark()).toBe(false);

    signIn('ana');
    theme.setTheme('escuro');
    expect([dark(), theme.getTheme(), meta.content]).toEqual([true, 'escuro', '#0D121B']);

    // Leaving: the login is in the original theme.
    signOut();
    expect([dark(), meta.content]).toEqual([false, '#1D4BED']);
    // Another account on the same phone starts light.
    signIn('bruno');
    expect(dark()).toBe(false);
    signOut();
    // The same account again: dark again.
    signIn('ana');
    expect(dark()).toBe(true);
  });

  it('the sign-up screens (e-mail to confirm, profile to complete) are always light, and so is the toggle there', async () => {
    const theme = await import('../services/theme');
    theme.startThemeSync();
    signIn('ana');
    theme.setTheme('escuro');
    signIn('ana', false);
    expect(dark()).toBe(false);
    theme.setTheme('escuro');
    expect(dark()).toBe(false);
    signOut();
    theme.setTheme('escuro');
    expect(dark()).toBe(false);
  });

  it('a deleted account forgets its choice, and the old device-wide choice of U21 is dropped', async () => {
    box.set('bicos-tema', 'escuro');
    const theme = await import('../services/theme');
    theme.startThemeSync();
    expect(box.has('bicos-tema')).toBe(false);
    signIn('ana');
    expect(dark()).toBe(false);
    theme.setTheme('escuro');
    theme.forgetTheme('ana');
    signOut();
    signIn('ana');
    expect(dark()).toBe(false);
  });
});
