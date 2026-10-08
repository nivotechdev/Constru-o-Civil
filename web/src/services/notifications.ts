// Notifications: each one is for one worker or one company and is created by the change it tells about
// (see `withNotification`, used by the status machine). Each function says what the real backend does.
import type { AppNotification, Database, Session } from '../types/models';
import { serviceError } from './errors';
import { mockLatency } from './mockLatency';
import { getDb, getSession, transact } from './store';
import { IS_DEMO } from './mode';
import * as remote from './remote/actions';
import * as remoteData from './remote/data';

export type NotificationInput = Omit<AppNotification, 'id' | 'createdAt' | 'readAt'>;

let seq = 0;

/**
 * The snapshot with one more notification, created now. Pure, so a service adds it in the same
 * transaction as the change it is about. Backend: inserted by the same RPC/trigger that makes the change.
 */
export function withNotification(db: Database, n: NotificationInput, at: string): Database {
  const notification: AppNotification = {
    ...n,
    id: `n${Date.now().toString(36)}${++seq}`,
    createdAt: at,
    readAt: null
  };
  return { ...db, notifications: [notification, ...db.notifications] };
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
