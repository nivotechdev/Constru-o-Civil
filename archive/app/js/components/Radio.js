import { h, cx } from '../dom.js';
import { Icon } from '../utils/icons.js';

let uid = 0;

/** Card-style radio: used for the "Trabalhador vs Recrutador" account-type choice. */
export function RadioCard({ id, name, icon, label, description, checked = false, onChange }) {
  const fieldId = id || ('radio-' + (uid++));
  return h('label', {
    for: fieldId,
    class: cx(
      'flex items-center gap-3.5 min-h-[5.5rem] p-4 rounded-card border cursor-pointer transition-colors',
      checked ? 'bg-brand-50 border-brand-500' : 'bg-white border-concrete-300 hover:bg-concrete-50'
    )
  },
    h('input', { id: fieldId, type: 'radio', name, checked, class: 'sr-only', onchange: onChange ? () => onChange() : null }),
    h('span', {
      class: cx('inline-flex items-center justify-center w-11 h-11 rounded-full shrink-0', checked ? 'bg-brand-500 text-white' : 'bg-concrete-100 text-concrete-600')
    }, Icon(icon, { size: 22 })),
    h('span', { class: 'flex flex-col gap-0.5 min-w-0' },
      h('span', { class: cx('text-base font-bold', checked ? 'text-brand-600' : 'text-concrete-900') }, label),
      h('span', { class: 'text-sm text-concrete-500' }, description)
    )
  );
}

export function Switch({ id, label, description, checked = false, onChange }) {
  const fieldId = id || ('switch-' + (uid++));
  return h('label', { for: fieldId, class: 'flex items-center gap-3 min-h-12 py-2 cursor-pointer select-none' },
    h('span', { class: 'flex-1 min-w-0 flex flex-col gap-0.5' },
      h('span', { class: 'text-sm font-semibold text-concrete-900' }, label),
      description ? h('span', { class: 'text-sm text-concrete-500' }, description) : null
    ),
    h('input', { id: fieldId, type: 'checkbox', checked, class: 'sr-only', onchange: onChange ? (e) => onChange(e.target.checked) : null }),
    h('span', {
      class: cx('relative inline-flex items-center w-11 h-6 rounded-full shrink-0 transition-colors', checked ? 'bg-brand-500' : 'bg-concrete-300')
    },
      h('span', {
        class: cx('absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-card transition-transform', checked ? 'translate-x-[1.375rem]' : 'translate-x-0.5')
      })
    )
  );
}
