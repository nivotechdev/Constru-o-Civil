import { useSyncExternalStore } from 'react';
import { dismissToast, getToast, subscribeToast } from '../services/toast';
import { cx } from '../utils/cx';
import { Icon } from './icons/Icon';

/** Where toasts appear (above the mobile tab pill), announced to screen readers. */
export function ToastHost() {
  const toast = useSyncExternalStore(subscribeToast, getToast, () => null);
  return (
    <div
      aria-live="polite"
      role="status"
      className="fixed inset-x-0 bottom-28 lg:bottom-8 z-50 flex justify-center px-4 pointer-events-none"
    >
      {toast ? (
        <div
          key={toast.id}
          className={cx(
            'pointer-events-auto flex items-center gap-3 max-w-md w-full sm:w-auto min-h-12 pl-4 pr-2 py-2 rounded-2xl shadow-float animate-slide-up text-white',
            toast.tone === 'error' ? 'bg-danger-solid' : 'bg-ink'
          )}
        >
          <Icon name={toast.tone === 'error' ? 'circle-alert' : 'circle-check'} size={18} />
          <span className="flex-1 text-sm font-semibold">{toast.message}</span>
          {toast.action ? (
            <button
              type="button"
              className="h-9 px-3 rounded-full text-sm font-bold text-white hover:bg-white/15"
              onClick={() => {
                toast.action?.onClick();
                dismissToast();
              }}
            >
              {toast.action.label}
            </button>
          ) : (
            <button
              type="button"
              aria-label="Fechar aviso"
              className="inline-flex items-center justify-center w-9 h-9 rounded-full hover:bg-white/15"
              onClick={dismissToast}
            >
              <Icon name="x" size={16} />
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
