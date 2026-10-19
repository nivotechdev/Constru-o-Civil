import { h, cx } from '../dom.js';
import { Icon } from '../utils/icons.js';

let uid = 0;

export function Checkbox({ id, label, checked = false, error = false, onChange }) {
  const fieldId = id || ('chk-' + (uid++));
  return h('label', { for: fieldId, class: 'flex items-center gap-3 min-h-12 py-2 cursor-pointer select-none' },
    h('input', {
      id: fieldId, type: 'checkbox', checked, class: 'sr-only peer',
      onchange: onChange ? (e) => onChange(e.target.checked, e) : null
    }),
    h('span', {
      class: cx(
        'inline-flex items-center justify-center w-6 h-6 rounded shrink-0 border-2 transition-colors',
        checked ? 'bg-brand-500 border-brand-500' : error ? 'border-danger-500' : 'border-concrete-400 bg-white'
      )
    }, checked ? Icon('check', { size: 16, color: '#fff' }) : null),
    h('span', { class: 'text-sm text-concrete-900' }, label)
  );
}
