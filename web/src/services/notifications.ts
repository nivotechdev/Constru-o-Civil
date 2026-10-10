// Notifications: each one is for one worker or one company and is created by the change it tells about
// (see `withNotification`, used by the status machine). Each function says what the real backend does.
import type {
  AppNotification,
  Database,
  NotificationGroup,
  NotificationKind,
  NotificationPrefs,
  Session
} from '../types/models';
import { serviceError } from './errors';
import { mockLatency } from './mockLatency';
import { getDb, getSession, transact } from './store';
import { IS_DEMO } from './mode';
import * as remote from './remote/actions';
import * as remoteData from './remote/data';
import { refreshCandidacies } from './queries';

export type NotificationInput = Omit<AppNotification, 'id' | 'createdAt' | 'readAt'>;

let seq = 0;

/**
 * The snapshot with one more notification, created now. Pure, so a service adds it in the same
 * transaction as the change it is about. Backend: inserted by the same RPC/trigger that makes the change.
 */
/** F06: the group a kind of notice belongs to (same as notification_group in the database). */
export function notificationGroup(kind: NotificationKind): NotificationGroup {
  if (kind === 'bico_novo' || kind === 'bico_urgente' || kind === 'convite') return 'bicos_novos';
  if (kind === 'confirmar_presenca' || kind === 'avaliar_diaria' || kind === 'avaliar_trabalhador') return 'lembretes';
  if (kind === 'verificacao' || kind === 'impulsionamento') return 'conta';
  return 'candidaturas';
}

export const DEFAULT_PREFS: NotificationPrefs = {
  muted: [],
  push: ['candidaturas', 'lembretes', 'bicos_novos', 'conta']
};

export function withNotification(db: Database, n: NotificationInput, at: string): Database {
  // F06: a muted group doesn't reach the bell (like notify() in the database).
  const owner = n.workerId ?? n.companyId;
  if (owner && db.notificationPrefs?.[owner]?.muted.includes(notificationGroup(n.kind))) return db;
  const notification: AppNotification = {
    ...n,
    id: `n${Date.now().toString(36)}${++seq}`,
    createdAt: at,
    readAt: null
  };
  return { ...db, notifications: [notification, ...db.notifications] };
}

/** Notices about a candidacy (everything but boosts and new-job alerts). */
export function isCandidacyNotice(kind: NotificationKind): boolean {
  return kind !== 'impulsionamento' && kind !== 'bico_urgente';
}

/**
 * Opening a notice (Y12). Backend: the candidacy screens read again before showing, so the screen the
 * notice opens has the new status. The demo store already has it.
 */
export function noticeOpened(n: AppNotification): void {
  if (!IS_DEMO && isCandidacyNotice(n.kind)) void refreshCandidacies(true);
}

/** The logged-in account's notifications, newest first. */
export function notificationsFor(db: Database, session: Session | null): AppNotification[] {
  if (!session) return [];
  return db.notifications
    .filter((n) =>
      session.role === 'trabalhador' ? n.workerId === session.workerId : n.companyId === session.companyId
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** The bell's badge. */
export function unreadCount(db: Database, session: Session | null): number {
  return notificationsFor(db, session).filter((n) => !n.readAt).length;
}

/** The logged-in account's notifications. Backend: select notifications for me, newest first. */
export async function loadNotifications(): Promise<void> {
  if (!IS_DEMO) return remoteData.loadNotifications();
  await mockLatency(350);
}

/** Marks every notification as read. Backend: update notifications set read_at = now() for me. */
export async function markAllNotificationsRead(): Promise<void> {
  if (!IS_DEMO) return remote.markAllNotificationsRead();
  await mockLatency(300);
  const session = getSession();
  const mine = new Set(notificationsFor(getDb(), session).map((n) => n.id));
  const now = new Date().toISOString();
  transact((db) => ({
    ...db,
    notifications: db.notifications.map((n) => (mine.has(n.id) && !n.readAt ? { ...n, readAt: now } : n))
  }));
}

/** Marks one notification as read (opening it). Backend: update read_at of that one (if it is mine). */
export async function markNotificationRead(id: string): Promise<void> {
  if (!IS_DEMO) return remote.markNotificationRead(id);
  await mockLatency(150);
  const mine = notificationsFor(getDb(), getSession()).find((n) => n.id === id);
  if (!mine) throw serviceError('nao_encontrado', 'Essa notificação não existe mais.');
  if (mine.readAt) return;
  const now = new Date().toISOString();
  transact((db) => ({ ...db, notifications: db.notifications.map((n) => (n.id === id ? { ...n, readAt: now } : n)) }));
}

// ---- F06: preferences ----

function prefsOwner(): string {
  const s = getSession();
  const id = s?.workerId ?? s?.companyId;
  if (!id) throw serviceError('nao_autorizado');
  return id;
}

/** The session's preferences (defaults until saved). */
export function myPrefs(db: Database, session: Session | null): NotificationPrefs {
  const id = session?.workerId ?? session?.companyId;
  return (id && db.notificationPrefs?.[id]) || DEFAULT_PREFS;
}

/** Backend: select notification_prefs (own). */
export async function loadNotificationPrefs(): Promise<void> {
  if (IS_DEMO) return mockLatency(150);
  const id = prefsOwner();
  const { db: client, request } = await import('./remote/client');
  const c = await client();
  const row = await request(() => c.from('notification_prefs').select('*').maybeSingle());
  if (row)
    transact((d) => ({
      ...d,
      notificationPrefs: {
        ...(d.notificationPrefs ?? {}),
        [id]: { muted: row.muted_groups as NotificationGroup[], push: row.push_groups as NotificationGroup[] }
      }
    }));
}

/** Backend: RPC save_notification_prefs. */
export async function saveNotificationPrefs(prefs: NotificationPrefs): Promise<void> {
  const id = prefsOwner();
  if (prefs.muted.some((g) => g !== 'bicos_novos'))
    throw serviceError('validacao', 'Esse aviso é sobre o andamento do seu bico e sempre chega.');
  if (!IS_DEMO) {
    const { db: client, request } = await import('./remote/client');
    const c = await client();
    await request(() => c.rpc('save_notification_prefs', { p_muted: prefs.muted, p_push: prefs.push }));
  } else await mockLatency(300);
  transact((d) => ({ ...d, notificationPrefs: { ...(d.notificationPrefs ?? {}), [id]: prefs } }));
}
