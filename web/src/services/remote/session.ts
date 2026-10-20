// The session with the real backend: Supabase Auth decides who is logged in; this module mirrors it in
// the store (services/store.ts), so the route guards and the screens read it exactly as in demo mode.
//
//  - start: before the first render (main.tsx), the links sent by e-mail are handled (confirmation and
//    password reset come back with the tokens in the URL's #fragment, which is also the router's) and the
//    saved session is restored;
//  - enterSession: loads the account row (role, e-mail confirmed, profile complete) and the own profile;
//  - a sign-up waiting for the e-mail confirmation has no Auth session yet: it is kept as a "pending"
//    account, so /verificar-email can show the address and resend the link.
import type { RealtimeChannel, User } from '@supabase/supabase-js';
import type { NotificationKind, Role } from '../../types/models';
import type { TableRow } from '../../types/supabase';
import { clearQueries, refreshCandidacies, runQuery } from '../queries';
import { currentPath, navigate, replaceUrl, resetHistory, routeUrl } from '../router';
import { clearSessionData, getDb, getSession, setSessionAccount, setUI, updateAccount, upsertAccount } from '../store';
import { showToast } from '../toast';
import { db, request, SESSION_ENDED, setSessionEndedHandler } from './client';
import {
  ACCOUNT_COLUMNS,
  addNotification,
  apply,
  COMPANY_COLUMNS,
  putAccount,
  putCompanies,
  putWorkers,
  updateNotification,
  WORKER_COLUMNS
} from './merge';
import { setBootStatus, withTimeout } from '../boot';
import { clearPaging } from '../paging';
import { clearContactCache } from '../contacts';
import { isCandidacyNotice } from '../notifications';

/** Where the links sent by e-mail come back to: this page, without a route (see handleAuthRedirect). */
/** Where the e-mail links come back to: the app's root (X17: `https://site/`, no route in the hash). */
export function authRedirectUrl(): string {
  return globalThis.location ? routeUrl('/').replace(/#\/$/, '') : '';
}

let channel: RealtimeChannel | null = null;

// A password-reset link opens a short session only to set the new password (services/remote/auth.ts
// ends it right after): it must not open the app as a normal sign-in.
// X11: the flag also lives in the device's storage — a reset link opened and abandoned (tab closed) must
// not come back later as a normal sign-in.
const RECOVERY_KEY = 'bicos.recuperacao';
let recovering = false;
export function setRecovering(on: boolean): void {
  recovering = on;
  try {
    if (on) localStorage.setItem(RECOVERY_KEY, '1');
    else localStorage.removeItem(RECOVERY_KEY);
  } catch {
    /* private mode: the in-memory flag is enough while the tab is open */
  }
}
export function isRecovering(): boolean {
  return recovering;
}
function recoveryLeftBehind(): boolean {
  try {
    return localStorage.getItem(RECOVERY_KEY) === '1';
  } catch {
    return false;
  }
}

let stopReconnectWatch: (() => void) | null = null;

async function stopRealtime(): Promise<void> {
  stopReconnectWatch?.();
  stopReconnectWatch = null;
  if (!channel) return;
  const client = await db();
  await client.removeChannel(channel);
  channel = null;
}

/** X03: after a gap (no signal, phone asleep) the bell reads again what it may have missed. */
function rereadNotifications(): void {
  void import('./data').then((m) => m.loadNotifications()).catch(() => undefined);
}

/**
 * New notifications reach the bell while the app is open, and a notice read on another device stops counting
 * here (X03). RLS limits both to the session's.
 */
async function startRealtime(account: TableRow<'accounts'>): Promise<void> {
  await stopRealtime();
  const client = await db();
  const filter = account.worker_id ? `worker_id=eq.${account.worker_id}` : `company_id=eq.${account.company_id}`;
  let subscribedBefore = false;
  channel = client
    .channel('notificacoes-' + account.id)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter }, (payload) => {
      const row = payload.new as TableRow<'notifications'>;
      apply(addNotification(row));
      // Y12: the candidacy screens read the new status at once.
      if (isCandidacyNotice(row.kind as NotificationKind)) void refreshCandidacies();
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter }, (payload) => {
      apply(updateNotification(payload.new as TableRow<'notifications'>));
      void import('./data').then((m) => m.refreshUnreadCount()).catch(() => undefined);
    })
    // U30: the theme chosen on another device arrives at once.
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'account_prefs', filter: `account_id=eq.${account.id}` },
      (payload) => {
        const row = payload.new as { theme?: string } | null;
        applyTheme(account.id, row?.theme === 'escuro' ? 'escuro' : 'claro');
      }
    )
    .subscribe((status) => {
      if (status !== 'SUBSCRIBED') return;
      // The channel came back after dropping: whatever arrived meanwhile wasn't delivered.
      if (subscribedBefore) rereadNotifications();
      subscribedBefore = true;
    });
  const target = globalThis.window;
  if (typeof target?.addEventListener === 'function') {
    const onVisible = () => {
      if (globalThis.document?.visibilityState !== 'visible') return;
      rereadNotifications();
      // U30: and the theme, in case the live channel was down while the screen was hidden.
      void readMyTheme(account.id).then((theme) => applyTheme(account.id, theme));
    };
    target.addEventListener('online', rereadNotifications);
    globalThis.document?.addEventListener('visibilitychange', onVisible);
    stopReconnectWatch = () => {
      target.removeEventListener?.('online', rereadNotifications);
      globalThis.document?.removeEventListener('visibilitychange', onVisible);
    };
  }
}

// ---- the account kept on the device (Z11) ----
// The own account and profile rows, saved after each sign-in, so a returning user sees the app at once
// while the session is checked with the server in the background. Only this device's own data; removed
// on sign-out (leaveSession).
const CACHE_KEY = 'bicos.conta';

interface CachedAccount {
  account: TableRow<'accounts'>;
  /** U30: the account's theme, so the first screen already opens in it (the server confirms right after). */
  theme?: 'claro' | 'escuro';
  worker?: Parameters<typeof putWorkers>[0][number];
  company?: Parameters<typeof putCompanies>[0][number];
}

function saveCache(data: CachedAccount): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    /* private mode / full storage: the app just waits for the server next time */
  }
}

function readCache(userId: string): CachedAccount | null {
  try {
    const data = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null') as CachedAccount | null;
    return data && data.account?.id === userId ? data : null;
  } catch {
    return null;
  }
}

export function clearAccountCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    /* nothing to clear */
  }
}

/** Puts a saved account in the store and opens the session with it (no network). */
function enterCachedSession(cached: CachedAccount): void {
  const recipes = [putAccount(cached.account, cached.theme)];
  if (cached.worker) recipes.push(putWorkers([cached.worker], undefined, cached.account.id));
  if (cached.company) recipes.push(putCompanies([cached.company], undefined, cached.account.id));
  apply(...recipes);
  setSessionAccount(cached.account.id);
}

/** The account has no row in the app (deleted, or a sign-up that never finished): Y27. */
export class MissingAccountError extends Error {
  constructor() {
    super('conta sem linha em accounts');
    this.name = 'MissingAccountError';
  }
}

// X20: the sign-in and the Auth event that follows it ask for the same account at the same time; they
// share one read (and one Realtime channel).
let entering: { userId: string; promise: Promise<Role> } | null = null;

/** Loads the logged-in user's account and own profile into the store and starts the session there. */
export function enterSession(user: User): Promise<Role> {
  if (entering && entering.userId === user.id) return entering.promise;
  const promise = loadSession(user).finally(() => {
    if (entering?.promise === promise) entering = null;
  });
  entering = { userId: user.id, promise };
  return promise;
}

/** U30: the account's theme from account_prefs; on a failure, the one already known stays. */
async function readMyTheme(accountId: string): Promise<'claro' | 'escuro' | undefined> {
  const client = await db();
  const { data, error } = await client.from('account_prefs').select('theme').eq('account_id', accountId).maybeSingle();
  if (error) return undefined;
  return data?.theme === 'escuro' ? 'escuro' : 'claro';
}

/** U30: another device changed the theme (or this one came back to the screen): the store follows. */
function applyTheme(accountId: string, theme: 'claro' | 'escuro' | undefined): void {
  if (theme && getDb().accounts[accountId]?.theme !== theme) updateAccount(accountId, { theme });
}

async function loadSession(user: User): Promise<Role> {
  const client = await db();
  const readAccount = () =>
    request(() => client.from('accounts').select(ACCOUNT_COLUMNS).eq('id', user.id).maybeSingle());
  let row = await readAccount();
  if (!row) {
    // An account of the legacy app (created there): it gets its row from the old profile.
    await request(() => client.rpc('ensure_my_account')).catch(() => undefined);
    row = await readAccount();
  }
  if (!row) throw new MissingAccountError();
  // Auth is the source of truth for the confirmation (the row follows it by a trigger).
  const account: TableRow<'accounts'> = {
    ...row,
    email_confirmed_at: user.email_confirmed_at ?? row.email_confirmed_at
  };
  // U30: the theme the account chose (no row = never chose = light).
  const theme = await readMyTheme(account.id);

  if (account.worker_id) {
    const worker = await request(() =>
      client
        .from('workers')
        .select(WORKER_COLUMNS)
        .eq('id', account.worker_id as string)
        .single()
    );
    apply(putAccount(account, theme), putWorkers([worker], undefined, account.id));
    saveCache({ account, worker, theme });
  } else {
    const company = await request(() =>
      client
        .from('companies')
        .select(COMPANY_COLUMNS)
        .eq('id', account.company_id as string)
        .single()
    );
    apply(putAccount(account, theme), putCompanies([company], undefined, account.id));
    saveCache({ account, company, theme });
  }
  if (getSession()?.accountId !== account.id) setSessionAccount(account.id);
  void startRealtime(account);
  // X03: the browser may have renewed this device's push address since last time.
  void import('../push').then((m) => m.syncPushSubscription()).catch(() => undefined);
  // The bell's badge needs the notifications from the start (the rest loads with each screen).
  void import('./data').then((m) => runQuery('notifications', m.loadNotifications));
  return account.role;
}

/**
 * Right after signing up, before the e-mail is confirmed, there is no Auth session: the account is kept
 * locally so the guards send the user to /verificar-email (which shows the address and resends the link).
 */
export function enterPendingSession(pending: { id: string; email: string; role: Role }): void {
  const now = new Date().toISOString();
  upsertAccount({
    id: pending.id,
    email: pending.email,
    role: pending.role,
    document: '',
    whatsapp: '',
    whatsappVerifiedAt: null,
    emailConfirmedAt: null,
    profileCompletedAt: null,
    termsVersion: '',
    termsAcceptedAt: now,
    workerId: pending.role === 'trabalhador' ? pending.id : null,
    companyId: pending.role === 'recrutador' ? pending.id : null,
    createdAt: now,
    theme: 'claro'
  });
  setSessionAccount(pending.id);
}

/** Ends the session on this device (the store, the loaded screens and the history are forgotten). */
export async function leaveSession(): Promise<void> {
  clearAccountCache();
  await stopRealtime().catch(() => undefined);
  clearSessionData();
  clearContactCache();
  clearQueries();
  clearPaging();
  resetHistory();
}

/**
 * The links sent by e-mail (confirm the account, reset the password) come back as
 * `#access_token=…&refresh_token=…&type=…`, in the same #fragment the router uses — or `#error=…` when
 * the link is old or was already used. This takes the tokens out before the router starts and leaves a
 * normal route in their place.
 */
async function handleAuthRedirect(): Promise<void> {
  const loc = globalThis.location;
  if (!loc) return;
  const fragment = loc.hash.replace(/^#/, '');
  if (!fragment || fragment.startsWith('/')) return;
  const params = new URLSearchParams(fragment);
  if (params.get('error') || params.get('error_code')) {
    replaceUrl('/login');
    notice = 'Esse link não vale mais (ele vence depois de um tempo ou de usado). Entre ou peça um novo.';
    return;
  }
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (!accessToken || !refreshToken) return;
  const recovery = params.get('type') === 'recovery';
  const emailChange = params.get('type') === 'email_change';
  if (recovery) setRecovering(true);
  const client = await db();
  const { error } = await client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
  replaceUrl(recovery ? '/redefinir-senha' : '/');
  if (error) notice = 'Esse link não vale mais. Entre ou peça um novo.';
  else if (emailChange) notice = 'E-mail trocado. Use o novo para entrar.';
  else if (!recovery) notice = 'E-mail confirmado. Bem-vindo à Bicos!';
}

let notice: string | null = null;
let started = false;
let listening = false;

/** Whether this device still holds a Supabase session (even one that can't be refreshed offline). */
function hasStoredSession(): boolean {
  try {
    return Object.keys(localStorage).some((k) => k.startsWith('sb-') && k.endsWith('-auth-token'));
  } catch {
    return false;
  }
}

function flushNotice(): void {
  if (!notice) return;
  const text = notice;
  notice = null;
  setTimeout(() => showToast(text, { tone: text.startsWith('E-mail confirmado') ? 'default' : 'error' }), 300);
}

/** Y27: the session points to an account the app doesn't have — sign out and say why. */
/** L13: signed in with Google (or another provider) — the account may still have to be completed. */
function isOAuthUser(user: User | null | undefined): boolean {
  const meta = user?.app_metadata as { provider?: string; via?: string } | undefined;
  // U28: a login born from "Google" via Firebase is marked by the Edge Function (its sessions are opened by link).
  return Boolean((meta?.provider && meta.provider !== 'email') || meta?.via === 'firebase');
}

/**
 * A session without its account row. A Google account that never chose its side goes to "Completar
 * cadastro" (L13), keeping the session; anything else is a broken session (Y27).
 */
async function missingAccount(user: User | null): Promise<void> {
  if (isOAuthUser(user)) {
    navigate('/completar-cadastro', { replace: true });
    return;
  }
  await dropBrokenSession();
}

async function dropBrokenSession(): Promise<void> {
  const client = await db();
  await client.auth.signOut({ scope: 'local' }).catch(() => undefined);
  await leaveSession();
  notice = 'Não achamos o cadastro dessa conta. Entre de novo ou crie uma conta nova.';
}

/**
 * Restores the session (Z11). Resolves quickly — the app renders right away (main.tsx) and shows the
 * splash while this runs:
 *   - no saved session → ready (signed out);
 *   - saved session and the account saved on this device → ready at once with it; the server is
 *     checked in the background;
 *   - saved session, nothing on the device → waits for the server, at most a few seconds;
 *   - the server can't be reached → "offline" (not the login); tries again when the connection returns.
 */
/**
 * Y27: a request found the session over (expired, revoked elsewhere). Once: leave it on this device and
 * go to the login with the e-mail filled and the reason.
 */
let ending = false;
function sessionEnded(): void {
  const session = getSession();
  if (ending || !session) return;
  ending = true;
  const email = session.email;
  void (async () => {
    const client = await db();
    await client.auth.signOut({ scope: 'local' }).catch(() => undefined);
    await leaveSession();
    setUI<{ identifier: string; notice: string }>('login', { identifier: email, notice: SESSION_ENDED });
    navigate('/login', { replace: true });
  })().finally(() => {
    ending = false;
  });
}

export async function startRemoteSession(): Promise<void> {
  if (started) return;
  started = true;
  setSessionEndedHandler(sessionEnded);
  const client = await db();
  listenToAuth(client);
  await restore();
}

let lastUser: User | null = null;

async function restore(): Promise<void> {
  const client = await db();
  setBootStatus('starting');
  try {
    await withTimeout(handleAuthRedirect(), 8000).catch(() => {
      notice = notice ?? 'Não deu para abrir o link agora. Confira sua internet e tente de novo.';
    });
    let user: User | null = null;
    try {
      const { data } = await withTimeout(client.auth.getSession(), 5000);
      user = data.session?.user ?? null;
      lastUser = user;
    } catch {
      if (hasStoredSession()) return goOffline();
    }
    if (!user) {
      if (hasStoredSession() && globalThis.navigator?.onLine === false) return goOffline();
      setBootStatus('ready');
      return;
    }
    if (recovering) {
      setBootStatus('ready');
      return;
    }
    if (recoveryLeftBehind() && currentPath() === '/redefinir-senha') {
      // The reset screen was reloaded: still the same link's session.
      recovering = true;
      setBootStatus('ready');
      return;
    }
    if (recoveryLeftBehind()) {
      // A reset link opened earlier and never finished: that session is not a sign-in.
      setRecovering(false);
      await client.auth.signOut({ scope: 'local' }).catch(() => undefined);
      setBootStatus('ready');
      return;
    }
    const cached = readCache(user.id);
    if (cached) {
      enterCachedSession(cached);
      setBootStatus('ready');
      const fresh = user;
      enterSession(fresh).catch((e: unknown) => {
        if (e instanceof MissingAccountError) void missingAccount(fresh).then(flushNotice);
      });
      return;
    }
    await withTimeout(enterSession(user), 10000);
    setBootStatus('ready');
  } catch (e) {
    if (e instanceof MissingAccountError) {
      await missingAccount(lastUser);
      setBootStatus('ready');
    } else return goOffline();
  } finally {
    flushNotice();
  }
}

/** The server can't be reached with a session on the device: wait for the connection, then retry. */
function goOffline(): void {
  setBootStatus('offline');
  const target = globalThis.window;
  if (!target) return;
  const again = () => {
    target.removeEventListener('online', again);
    void retryStart();
  };
  target.addEventListener('online', again);
}

/** "Tentar de novo" on the offline start screen (and the automatic retry when the connection returns). */
export function retryStart(): Promise<void> {
  return restore();
}

function listenToAuth(client: Awaited<ReturnType<typeof db>>): void {
  if (listening) return;
  listening = true;
  client.auth.onAuthStateChange((event, session) => {
    // Supabase asks not to call it back from inside this callback: the work runs right after.
    setTimeout(() => {
      const current = getSession();
      if (event === 'PASSWORD_RECOVERY') {
        setRecovering(true);
        navigate('/redefinir-senha', { replace: true });
        return;
      }
      if (event === 'SIGNED_OUT') {
        if (current) void leaveSession();
        return;
      }
      if (session && (event === 'SIGNED_IN' || event === 'USER_UPDATED') && !recovering) {
        const confirmedNow = Boolean(session.user.email_confirmed_at) && current && !current.emailConfirmed;
        if (!current || current.accountId !== session.user.id || confirmedNow)
          enterSession(session.user).catch((e: unknown) => {
            if (e instanceof MissingAccountError && isOAuthUser(session.user))
              navigate('/completar-cadastro', { replace: true });
          });
      }
    });
  });
}
