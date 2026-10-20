import { useId, type ReactNode } from 'react';
import { useModal } from '../hooks/useModal';
import { Button } from './Button';
import { FieldError } from './FieldError';
import { Icon } from './icons/Icon';

interface DialogProps {
  open: boolean;
  tone?: 'default' | 'danger';
  title: string;
  description?: string;
  confirmLabel: string;
  onConfirm: () => void;
  cancelLabel?: string;
  onCancel: () => void;
  /** The confirm action is running: its button spins and nothing can be pressed twice. */
  loading?: boolean;
  /** Why the confirm action failed (the dialog stays open to try again). */
  error?: string | null;
  /** Extra content between the text and the buttons (e.g. a list of reasons). */
  children?: ReactNode;
  /** The confirm button waits for something (e.g. a reason to be chosen). */
  confirmDisabled?: boolean;
}

/** Centered confirm/cancel dialog over a scrim. Used for destructive confirmations. */
export function Dialog({
  open,
  tone = 'default',
  title,
  description,
  confirmLabel,
  onConfirm,
  cancelLabel = 'Cancelar',
  onCancel,
  loading = false,
  error = null,
  children,
  confirmDisabled = false
}: DialogProps) {
  const ref = useModal(open, () => (loading ? undefined : onCancel()));
  const titleId = useId();
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-0 sm:p-6"
      style={{ background: 'var(--scrim)' }}
      onClick={() => (loading ? undefined : onCancel())}
    >
      <div
        ref={ref}
        tabIndex={-1}
        role={tone === 'danger' ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-labelledby={titleId}
        className="outline-none w-full sm:max-w-sm bg-concrete-0 rounded-t-sheet sm:rounded-sheet p-5 flex flex-col gap-4 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-1.5">
          <h2 id={titleId} className="text-lg font-bold text-concrete-900">
            {title}
          </h2>
          {description ? <p className="text-sm text-concrete-600">{description}</p> : null}
        </div>
        {children}
        {error ? <FieldError message={error} /> : null}
        <div className="flex gap-3 pt-1">
          <Button
            label={cancelLabel}
            variant="secondary"
            className="flex-1"
            disabled={loading}
            onClick={() => onCancel()}
          />
          <Button
            label={confirmLabel}
            variant={tone === 'danger' ? 'danger' : 'primary'}
            className="flex-1"
            loading={loading}
            disabled={confirmDisabled}
            onClick={() => onConfirm()}
          />
        </div>
      </div>
    </div>
  );
}

interface SheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children?: ReactNode;
}

/** Bottom sheet on phones, centred dialog on tablet/desktop: filters, location picker, composer. */
export function Sheet({ open, title, onClose, children }: SheetProps) {
  const ref = useModal(open, onClose);
  const titleId = useId();
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center lg:items-center lg:p-6"
      style={{ background: 'var(--scrim)' }}
      onClick={() => onClose()}
    >
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="outline-none w-full sm:max-w-app lg:max-w-[34rem] bg-concrete-0 rounded-t-sheet lg:rounded-sheet shadow-sheet p-4 lg:p-6 flex flex-col gap-4 overflow-y-auto animate-slide-up"
        style={{ maxHeight: '85vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 id={titleId} className="text-lg font-bold text-concrete-900">
            {title}
          </h2>
          <button
            type="button"
            aria-label="Fechar"
            className="inline-flex items-center justify-center w-11 h-11 rounded-full hover:bg-concrete-100"
            onClick={() => onClose()}
          >
            <Icon name="x" size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
