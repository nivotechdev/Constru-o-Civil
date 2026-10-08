import { BackBar } from '../../components/BackBar';
import { EmptyState } from '../../components/EmptyState';
import { Icon } from '../../components/icons/Icon';
import { NOTIFICATION_LOOK } from '../../components/notificationLook';
import { useNotifications } from '../../hooks/useNotifications';
import { useRole } from '../../hooks/useStore';
import { goBack } from '../../services/router';

export default function Notifications() {
  const { list } = useNotifications(useRole());
  return (
    <div className="min-h-screen flex flex-col bg-concrete-50 lg:bg-transparent lg:min-h-0">
      <BackBar title="Notificações" onBack={() => goBack('/mural')} />
      {list.length === 0 ? (
        <EmptyState
          icon="bell"
          title="Nenhuma notificação"
          description="Avisamos aqui quando algo importante acontecer."
        />
      ) : (
        <div className="flex flex-col px-4 py-2 gap-2">
          {list.map((n) => (
            <div key={n.title} className="flex gap-3 p-4 bg-white border border-concrete-200 rounded-card">
              <span
                className={`shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-full ${NOTIFICATION_LOOK[n.kind].bg}`}
              >
                <Icon name={NOTIFICATION_LOOK[n.kind].icon} size={18} color={NOTIFICATION_LOOK[n.kind].fg} />
              </span>
              <div className="flex flex-col gap-1 min-w-0">
                <span className="font-semibold text-concrete-900">{n.title}</span>
                <span className="text-sm text-concrete-600">{n.text}</span>
                <span className="text-xs text-concrete-400">{n.time}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
