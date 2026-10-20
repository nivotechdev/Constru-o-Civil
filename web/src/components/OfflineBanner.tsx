import { useOnline } from '../hooks/useOnline';
import { Icon } from './icons/Icon';

/** A strip at the top while the device has no connection (common on the building site). */
export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-[60] flex items-center justify-center gap-2 px-4 py-2 bg-ink text-white text-sm font-semibold"
    >
      <Icon name="wifi-off" size={16} />
      Sem internet. Algumas ações só funcionam quando o sinal voltar.
    </div>
  );
}
