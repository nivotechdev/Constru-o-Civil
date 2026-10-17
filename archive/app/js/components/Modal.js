import { h, cx } from '../dom.js';
import { Icon } from '../utils/icons.js';
import { Button } from './Button.js';

/** Centered confirm/cancel dialog over a scrim. Used for destructive confirmations. */
export function Dialog({ open, tone = 'default', title, description, confirmLabel, onConfirm, cancelLabel = 'Cancelar', onCancel }) {
  if (!open) return null;
  return h('div', {
    class: 'fixed inset-0 z-40 flex items-end sm:items-center justify-center p-0 sm:p-6',
    style: { background: 'var(--scrim)' },
    onClick: onCancel
  },
    h('div', {
      class: 'w-full sm:max-w-sm bg-white rounded-t-sheet sm:rounded-sheet p-5 flex flex-col gap-4 animate-slide-up',
      onClick: (e) => e.stopPropagation()
    },
      h('div', { class: 'flex flex-col gap-1.5' },
        h('h3', { class: 'text-lg font-bold text-concrete-900' }, title),
        description ? h('p', { class: 'text-sm text-concrete-600' }, description) : null
      ),
      h('div', { class: 'flex gap-3 pt-1' },
        Button({ label: cancelLabel, variant: 'secondary', className: 'flex-1', onClick: onCancel }),
        Button({ label: confirmLabel, variant: tone === 'danger' ? 'danger' : 'primary', className: 'flex-1', onClick: onConfirm })
      )
    )
  );
}

/** Bottom sheet: filters, location picker, and other mobile-pattern overlays. */
export function Sheet({ open, title, onClose, maxHeight = '85vh' }, ...children) {
  if (!open) return null;
  return h('div', {
    class: 'fixed inset-0 z-40 flex items-end justify-center lg:items-center lg:p-6',
    style: { background: 'var(--scrim)' },
    onClick: onClose
  },
    h('div', {
      // A bottom sheet on phones; a centred dialog on tablet/desktop.
      class: 'w-full sm:max-w-app lg:max-w-[34rem] bg-white rounded-t-sheet lg:rounded-sheet shadow-sheet p-4 lg:p-6 flex flex-col gap-4 overflow-y-auto animate-slide-up',
      style: { maxHeight },
      onClick: (e) => e.stopPropagation()
    },
      h('div', { class: 'flex items-center justify-between' },
        h('span', { class: 'text-lg font-bold text-concrete-900' }, title),
        h('button', { type: 'button', 'aria-label': 'Fechar', class: 'inline-flex items-center justify-center w-11 h-11 rounded-full hover:bg-concrete-100', onClick: onClose }, Icon('x', { size: 20 }))
      ),
      ...children
    )
  );
}
