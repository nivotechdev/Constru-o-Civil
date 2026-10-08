import type { ReactNode } from 'react';
import { Button } from './Button';
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
  onCancel
}: DialogProps) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-0 sm:p-6"
      style={{ background: 'var(--scrim)' }}
      onClick={() => onCancel()}
    >
      <div
        className="w-full sm:max-w-sm bg-white rounded-t-sheet sm:rounded-sheet p-5 flex flex-col gap-4 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-1.5">
          <h3 className="text-lg font-bold text-concrete-900">{title}</h3>
          {description ? <p className="text-sm text-concrete-600">{description}</p> : null}
        </div>
        <div className="flex gap-3 pt-1">
          <Button label={cancelLabel} variant="secondary" className="flex-1" onClick={() => onCancel()} />
          <Button
            label={confirmLabel}
            variant={tone === 'danger' ? 'danger' : 'primary'}
            className="flex-1"
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
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center lg:items-center lg:p-6"
      style={{ background: 'var(--scrim)' }}
      onClick={() => onClose()}
    >
      <div
        className="w-full sm:max-w-app lg:max-w-[34rem] bg-white rounded-t-sheet lg:rounded-sheet shadow-sheet p-4 lg:p-6 flex flex-col gap-4 overflow-y-auto animate-slide-up"
        style={{ maxHeight: '85vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <span className="text-lg font-bold text-concrete-900">{title}</span>
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
