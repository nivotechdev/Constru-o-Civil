import {
  markAllNotificationsRead,
  NOTIFICATIONS_READ_DEFAULTS,
  NOTIFICATIONS_READ_KEY,
  notificationsFor,
  unreadCount,
  type NotificationsReadUI
} from '../services/notifications';
import type { Role } from '../types/models';
import { useUI } from './useStore';

/** The side's notifications, how many are unread, and the "mark all as read" action. */
export function useNotifications(role: Role) {
  const [read] = useUI<NotificationsReadUI>(NOTIFICATIONS_READ_KEY, NOTIFICATIONS_READ_DEFAULTS);
  const allRead = read[role];
  return {
    list: notificationsFor(role, allRead),
    unread: unreadCount(role, allRead),
    markAllRead: () => markAllNotificationsRead(role)
  };
}
