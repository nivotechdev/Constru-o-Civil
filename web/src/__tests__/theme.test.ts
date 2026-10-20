// U21/U26/U30: the theme is the ACCOUNT's choice, kept in the database — the same on every device, changed live — and
// exists only inside the app: login and sign-up are always light, leaving or another account goes back to light.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Account, Session } from '../types/models';

const h = vi.hoisted(() => ({
  session: null as Session | null,
  accounts: {} as Record<string, Partial<Account>>,
  listeners: new Set<() => void>(),
  rpc: [] as unknown[],
  failSave: false
}));
const notify = () => h.listeners.forEach((fn) => fn());

vi.mock('../services/mode', () => ({ IS_DEMO: false }));
vi.mock('../services/toast', () => ({ showToast: () => undefined }));
vi.mock('../services/store', () => ({
  getSession: () => h.session,
  getDb: () => ({ accounts: h.accounts }),
  updateAccount: (id: string, patch: Partial<Account>) => {
    h.accounts[id] = { ...h.accounts[id], ...patch };
    notify();
  },
  subscribe: (fn: () => void) => {
    h.listeners.add(fn);
    return () => h.listeners.delete(fn);
  }
}));
vi.mock('../services/remote/client', () => ({
  db: async () => ({
    rpc: async (name: string, args: unknown) => {
      h.rpc.push({ name, args });
      return h.failSave ? { data: null, error: { message: 'offline' } } : { data: null, error: null };
    }
  }),
  request: async (fn: () => Promise<{ error: unknown }>) => {
    const r = await fn();
    if (r.error) throw new Error('falhou');
  }
}));

const meta = { content: '#1D4BED', setAttribute: (_: string, v: string) => void (meta.content = v) };
const root = { dataset: {} as Record<string, string>, ownerDocument: { querySelector: () => meta } };
const dark = () => root.dataset.theme === 'dark';
const flush = () => new Promise((r) => setTimeout(r, 0));

/** An account signed in on this device, with the theme the server has for it. */
function signIn(id: string, theme: 'claro' | 'escuro' = 'claro', inApp = true) {
  h.accounts[id] = { id, theme };
  h.session = {
    accountId: id,
    email: id + '@bicos.test',
    role: 'trabalhador',
    workerId: id,
    companyId: null,
    emailConfirmed: inApp,
    profileComplete: inApp,
    termsCurrent: true
  };
  notify();
}
function signOut() {
  h.session = null;
  notify();
}

describe('tema da conta (U30)', () => {
  beforeEach(() => {
    h.session = null;
    h.accounts = {};
    h.rpc = [];
    h.failSave = false;
    root.dataset = {};
    vi.stubGlobal('document', { documentElement: root });
    vi.stubGlobal('localStorage', { length: 0, key: () => null, getItem: () => null, removeItem: () => undefined });
  });
  afterEach(() => {
    h.listeners.clear();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('opens in the theme the account has in the database — on any device', async () => {
    const theme = await import('../services/theme');
    theme.startThemeSync();
    expect(dark()).toBe(false);
    signIn('ana', 'escuro');
    expect([dark(), theme.getTheme(), meta.content]).toEqual([true, 'escuro', '#0D121B']);
  });

  it('changing it saves on the server; another device gets it live; leaving goes back to light', async () => {
    const theme = await import('../services/theme');
    theme.startThemeSync();
    signIn('ana');
    theme.setTheme('escuro');
    expect(dark()).toBe(true);
    await flush();
    expect(h.rpc).toEqual([{ name: 'set_my_theme', args: { p_theme: 'escuro' } }]);
    // What the live channel does when the other device changes it back:
    h.accounts.ana = { ...h.accounts.ana, theme: 'claro' };
    notify();
    expect(dark()).toBe(false);
    signOut();
    expect(dark()).toBe(false);
    signIn('bruno');
    expect(dark()).toBe(false);
  });

  it('if saving fails, the screen goes back — never one theme here and another in the database', async () => {
    const theme = await import('../services/theme');
    theme.startThemeSync();
    signIn('ana');
    h.failSave = true;
    theme.setTheme('escuro');
    expect(dark()).toBe(true);
    await flush();
    await flush();
    expect(dark()).toBe(false);
  });

  it('login and sign-up screens are always light, even for an account that chose dark', async () => {
    const theme = await import('../services/theme');
    theme.startThemeSync();
    signIn('ana', 'escuro', false);
    expect(dark()).toBe(false);
    theme.setTheme('escuro');
    expect(h.rpc).toEqual([]);
  });
});
