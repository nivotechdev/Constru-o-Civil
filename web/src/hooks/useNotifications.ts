import { errorMessage } from '../services/errors';
import {
  markAllNotificationsRead,
  markNotificationRead,
  noticeOpened,
  notificationsFor
} from '../services/notifications';
import { navigate } from '../services/router';
import { showToast } from '../services/toast';
import type { AppNotification } from '../types/models';
import { useDb, useSession } from './useStore';

const fail = (e: unknown) => showToast(errorMessage(e), { tone: 'error' });

/** The logged-in account's notifications, how many are unread, and the actions on them. */
export function useNotifications() {
  const db = useDb();
  const session = useSession();
  const list = notificationsFor(db, session);
  return {
    list,
    unread: list.filter((n) => !n.readAt).length,
    markAllRead: () => {
      markAllNotificationsRead().catch(fail);
    },
    /** Opens what the notification is about (and marks it as read). */
    open: (n: AppNotification) => {
      if (!n.readAt) markNotificationRead(n.id).catch(fail);
      noticeOpened(n);
      navigate(n.target ?? '/notificacoes');
    }
  };
}
