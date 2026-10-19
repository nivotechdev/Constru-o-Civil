import { h, cx } from '../dom.js';
import { Icon } from '../utils/icons.js';

let uid = 0;

export function Select({ id, label, placeholder = 'Selecione', options = [], value = '', onChange, error }) {
  const fieldId = id || ('select-' + (uid++));
  const wrap = h('div', { class: 'flex flex-col gap-1.5 w-full' });
  if (label) wrap.appendChild(h('label', { for: fieldId, class: 'text-sm font-semibold text-concrete-900' }, label));

  const row = h('div', {
    class: cx(
      'relative flex items-center min-h-12 px-3 bg-white rounded-control border',
      error ? 'border-danger-500' : 'border-concrete-300 focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-100'
    )
  });
  const select = h('select', {
    id: fieldId, 'data-focus-id': fieldId,
    class: 'flex-1 min-w-0 h-11 bg-transparent outline-none text-base appearance-none pr-6 cursor-pointer',
    onchange: onChange ? (e) => onChange(e.target.value, e) : null
  },
    h('option', { value: '', disabled: true, selected: !value }, placeholder),
    ...options.map((opt) => h('option', { value: opt, selected: opt === value }, opt))
  );
  select.className = cx('flex-1 min-w-0 h-11 bg-transparent outline-none text-base appearance-none pr-6 cursor-pointer', value ? 'text-concrete-900' : 'text-concrete-400');
  row.appendChild(select);
  row.appendChild(h('span', { class: 'pointer-events-none absolute right-3 text-concrete-500' }, Icon('chevron-down', { size: 18 })));
  wrap.appendChild(row);

  if (error) wrap.appendChild(h('span', { class: 'flex items-center gap-1.5 text-sm text-danger-500' }, Icon('circle-alert', { size: 14 }), error));
  return wrap;
}
