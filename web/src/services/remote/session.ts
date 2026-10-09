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
import type { Role } from '../../types/models';
import type { TableRow } from '../../types/supabase';
import { clearQueries, runQuery } from '../queries';
import { navigate, resetHistory } from '../router';
import { clearSessionData, getSession, setSessionAccount, upsertAccount } from '../store';
import { showToast } from '../toast';
import { db, request } from './client';
import {
  ACCOUNT_COLUMNS,
  addNotification,
  apply,
  COMPANY_COLUMNS,
  putAccount,
  putCompanies,
  putWorkers,
  WORKER_COLUMNS
} from './merge';

/** Where the links sent by e-mail come back to: this page, without a route (see handleAuthRedirect). */
export function authRedirectUrl(): string {
  return globalThis.location ? globalThis.location.origin + globalThis.location.pathname : '';
}

let channel: RealtimeChannel | null = null;

// A password-reset link opens a short session only to set the new password (services/remote/auth.ts
// ends it right after): it must not open the app as a normal sign-in.
let recovering = false;
export function setRecovering(on: boolean): void {
  recovering = on;
}

async function stopRealtime(): Promise<void> {
  if (!channel) return;
  const client = await db();
  await client.removeChannel(channel);
  channel = null;
}

/** New notifications reach the bell while the app is open (RLS limits them to the session's). */
async function startRealtime(account: TableRow<'accounts'>): Promise<void> {
  await stopRealtime();
  const client = await db();
  const filter = account.worker_id ? `worker_id=eq.${account.worker_id}` : `company_id=eq.${account.company_id}`;
  channel = client
    .channel('notificacoes-' + account.id)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter }, (payload) =>
      apply(addNotification(payload.new as TableRow<'notifications'>))
    )
    .subscribe();
}

/** Loads the logged-in user's account and own profile into the store and starts the session there. */
export async function enterSession(user: User): Promise<Role> {
  const client = await db();
  const readAccount = () =>
    request(() => client.from('accounts').select(ACCOUNT_COLUMNS).eq('id', user.id).maybeSingle());
  let row = await readAccount();
  if (!row) {
    // An account of the legacy app (created there): it gets its row from the old profile.
    await request(() => client.rpc('ensure_my_account'));
    row = await readAccount();
  }
  if (!row) throw new Error('conta sem linha em accounts');
  // Auth is the source of truth for the confirmation (the row follows it by a trigger).
  const account: TableRow<'accounts'> = {
    ...row,
    email_confirmed_at: user.email_confirmed_at ?? row.email_confirmed_at
  };

  if (account.worker_id) {
    const worker = await request(() =>
      client
        .from('workers')
        .select(WORKER_COLUMNS)
        .eq('id', account.worker_id as string)
        .single()
    );
    apply(putAccount(account), putWorkers([worker], undefined, account.id));
  } else {
    const company = await request(() =>
      client
        .from('companies')
        .select(COMPANY_COLUMNS)
        .eq('id', account.company_id as string)
        .single()
    );
    apply(putAccount(account), putCompanies([company], undefined, account.id));
  }
  if (getSession()?.accountId !== account.id) setSessionAccount(account.id);
  void startRealtime(account);
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
    createdAt: now
  });
  setSessionAccount(pending.id);
}

/** Ends the session on this device (the store, the loaded screens and the history are forgotten). */
export async function leaveSession(): Promise<void> {
  await stopRealtime().catch(() => undefined);
  clearSessionData();
  clearQueries();
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
  const base = loc.pathname + loc.search;
  if (params.get('error') || params.get('error_code')) {
    globalThis.history.replaceState(null, '', base + '#/login');
    notice = 'Esse link não vale mais (ele vence depois de um tempo ou de usado). Entre ou peça um novo.';
    return;
  }
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (!accessToken || !refreshToken) return;
  const recovery = params.get('type') === 'recovery';
  recovering = recovery;
  const client = await db();
  const { error } = await client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
  globalThis.history.replaceState(null, '', base + (recovery ? '#/redefinir-senha' : '#/'));
  if (error) notice = 'Esse link não vale mais. Entre ou peça um novo.';
  else if (!recovery) notice = 'E-mail confirmado. Bem-vindo à Bicos!';
}

let notice: string | null = null;
let started = false;

/**
 * Restores the session before the app's first render (main.tsx). It never rejects: without a
 * connection the app opens signed out and the login screen says what is wrong when it is used.
 */
export async function startRemoteSession(): Promise<void> {
  if (started) return;
  started = true;
  const client = await db();
  try {
    await handleAuthRedirect();
    const { data } = await client.auth.getSession();
    if (data.session && !recovering) await enterSession(data.session.user);
  } catch {
    notice = notice ?? 'Não deu para abrir sua conta agora. Confira sua internet e entre de novo.';
  }

  client.auth.onAuthStateChange((event, session) => {
    // Supabase asks not to call it back from inside this callback: the work runs right after.
    setTimeout(() => {
      const current = getSession();
      if (event === 'PASSWORD_RECOVERY') {
        recovering = true;
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
          enterSession(session.user).catch(() => undefined);
      }
    });
  });

  if (notice) {
    const text = notice;
    setTimeout(() => showToast(text, { tone: text.startsWith('E-mail confirmado') ? 'default' : 'error' }), 300);
  }
}
