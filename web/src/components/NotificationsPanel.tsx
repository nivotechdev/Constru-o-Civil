// The bell's floating panel: the latest notifications, what is unread, "mark all as read" and the way
// to the full list. Opened from the desktop navigation bar and from the phone mural's header.
import type { AppNotification } from '../types/models';
import { cx } from '../utils/cx';
import { Icon } from './icons/Icon';
import { NOTIFICATION_LOOK } from './notificationLook';

interface NotificationsPanelProps {
  list: AppNotification[];
  unread: number;
  onMarkAllRead: () => void;
  onSeeAll: () => void;
  onClose: () => void;
  /** Where the panel sits: under the bell (desktop) or across the top of the screen (phone). */
  className: string;
}

export function NotificationsPanel({
  list,
  unread,
  onMarkAllRead,
  onSeeAll,
  onClose,
  className
}: NotificationsPanelProps) {
  return (
    <>
      {/* Clicking anywhere outside closes the panel. */}
      <div className="fixed inset-0 z-40" aria-hidden="true" onClick={onClose} />
      <section
        role="dialog"
        aria-label="Notificações"
        className={cx(
          'z-50 flex flex-col bg-white rounded-2xl border border-concrete-200 shadow-float overflow-hidden animate-fade-in',
          className
        )}
      >
        <header className="flex items-center justify-between gap-3 px-4 pt-4 pb-3 border-b border-concrete-100">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="font-display font-semibold text-lg text-concrete-900 whitespace-nowrap">Notificações</h2>
            {unread ? (
              <span className="inline-flex items-center h-5 px-2 rounded-full bg-brand-50 text-brand-600 text-xs font-bold whitespace-nowrap shrink-0">
                {unread === 1 ? '1 nova' : `${unread} novas`}
              </span>
            ) : null}
          </div>
          {unread ? (
            <button
              type="button"
              className="inline-flex items-center gap-1 h-8 px-2.5 -mr-1.5 rounded-full text-sm font-semibold text-brand-600 hover:bg-brand-50 shrink-0 whitespace-nowrap"
              onClick={onMarkAllRead}
            >
              <Icon name="check" size={15} />
              Marcar como lidas
            </button>
          ) : (
            <button
              type="button"
              aria-label="Fechar"
              className="inline-flex items-center justify-center w-8 h-8 -mr-1.5 rounded-full text-concrete-500 hover:bg-concrete-100"
              onClick={onClose}
            >
              <Icon name="x" size={16} />
            </button>
          )}
        </header>

        {list.length ? (
          <ul className="max-h-[min(26rem,60vh)] overflow-auto divide-y divide-concrete-100">
            {list.map((n) => {
              const look = NOTIFICATION_LOOK[n.kind];
              return (
                <li key={n.title}>
                  <button
                    type="button"
                    className={cx(
                      'relative w-full flex gap-3 px-4 py-3.5 text-left transition-colors hover:bg-concrete-50',
                      n.read ? '' : 'bg-brand-50/40'
                    )}
                    onClick={onSeeAll}
                  >
                    <span
                      className={cx('shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-full', look.bg)}
                    >
                      <Icon name={look.icon} size={18} color={look.fg} />
                    </span>
                    <span className="flex-1 min-w-0 flex flex-col gap-0.5 pr-3">
                      <span className={cx('text-sm text-concrete-900', n.read ? 'font-medium' : 'font-semibold')}>
                        {n.title}
                      </span>
                      <span className="text-sm text-concrete-600 line-clamp-2">{n.text}</span>
                      <span className="text-xs text-concrete-400">{n.time}</span>
                    </span>
                    {n.read ? null : (
                      <span
                        className="absolute right-4 top-4 w-2 h-2 rounded-full bg-brand-500"
                        aria-label="Não lida"
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
            <span className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-concrete-100">
              <Icon name="bell" size={22} color="var(--text-subtle)" />
            </span>
            <span className="font-semibold text-concrete-900">Tudo em dia</span>
            <span className="text-sm text-concrete-500">Avisamos aqui quando algo importante acontecer.</span>
          </div>
        )}

        <footer className="border-t border-concrete-100">
          <button
            type="button"
            className="w-full inline-flex items-center justify-center gap-1 h-12 text-sm font-semibold text-brand-600 hover:bg-concrete-50"
            onClick={onSeeAll}
          >
            Ver todas as notificações
            <Icon name="chevron-right" size={16} color="var(--text-brand)" />
          </button>
        </footer>
      </section>
    </>
  );
}
