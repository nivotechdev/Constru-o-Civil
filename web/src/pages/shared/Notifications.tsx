import { BackBar } from '../../components/BackBar';
import { NOTIFICATIONS_PAGE } from '../../services/paging';
import { usePaging } from '../../hooks/usePaging';
import { LoadMore } from '../../components/LoadMore';
import { EmptyState } from '../../components/EmptyState';
import { Icon } from '../../components/icons/Icon';
import { NOTIFICATION_LOOK } from '../../components/notificationLook';
import { QueryView } from '../../components/QueryView';
import { ListSkeleton } from '../../components/Skeleton';
import { useQuery } from '../../hooks/useQuery';
import { loadMoreNotifications, loadNotifications } from '../../services/notifications';
import { useNotifications } from '../../hooks/useNotifications';
import { goBack } from '../../services/router';
import { cx } from '../../utils/cx';
import { relativeTime } from '../../utils/dates';

export default function Notifications() {
  const { list, unread, markAllRead, open } = useNotifications();
  const query = useQuery('notifications', loadNotifications);
  const paging = usePaging(NOTIFICATIONS_PAGE, loadMoreNotifications);
  return (
    <div className="min-h-screen flex flex-col bg-concrete-50 lg:bg-transparent lg:min-h-0">
      <BackBar title="Notificações" onBack={() => goBack('/mural')} />
      <QueryView
        query={query}
        skeleton={
          <div className="px-4 py-2">
            <ListSkeleton />
          </div>
        }
      >
        {() =>
          list.length === 0 ? (
            <EmptyState
              icon="bell"
              title="Nenhuma notificação"
              description="Avisamos aqui quando algo importante acontecer."
            />
          ) : (
            <div className="flex flex-col px-4 py-2 gap-2">
              {unread ? (
                <div className="flex justify-end">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 h-9 px-3 rounded-full text-sm font-semibold text-brand-600 hover:bg-brand-50"
                    onClick={markAllRead}
                  >
                    <Icon name="check" size={15} />
                    Marcar todas como lidas
                  </button>
                </div>
              ) : null}
              {list.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  className={cx(
                    'relative flex gap-3 p-4 border rounded-card text-left transition-colors hover:bg-concrete-50',
                    n.readAt ? 'bg-white border-concrete-200' : 'bg-brand-50/40 border-brand-100'
                  )}
                  onClick={() => open(n)}
                >
                  <span
                    className={`shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-full ${NOTIFICATION_LOOK[n.kind].bg}`}
                  >
                    <Icon name={NOTIFICATION_LOOK[n.kind].icon} size={18} color={NOTIFICATION_LOOK[n.kind].fg} />
                  </span>
                  <div className="flex flex-col gap-1 min-w-0">
                    <span className={cx('text-concrete-900 pr-3', n.readAt ? 'font-medium' : 'font-semibold')}>
                      {n.title}
                    </span>
                    <span className="text-sm text-concrete-600">{n.text}</span>
                    <span className="text-xs text-concrete-500">{relativeTime(n.createdAt)}</span>
                  </div>
                  {n.readAt ? null : (
                    <span className="absolute right-4 top-4 w-2 h-2 rounded-full bg-brand-500" aria-label="Não lida" />
                  )}
                </button>
              ))}
              <LoadMore paging={paging} />
            </div>
          )
        }
      </QueryView>
    </div>
  );
}
