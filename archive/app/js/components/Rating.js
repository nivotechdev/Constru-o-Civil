import { h, cx } from '../dom.js';
import { Icon } from '../utils/icons.js';

export function Rating({ value = 0, count, showValue = true, editable = false, onChange, size = 14 }) {
  const wrap = h('span', { class: 'inline-flex items-center gap-1' });
  if (!value && !editable) {
    wrap.appendChild(h('span', { class: 'text-sm text-concrete-400' }, 'Novo na plataforma'));
    return wrap;
  }
  const stars = h('span', { class: 'inline-flex items-center gap-0.5' });
  for (let i = 1; i <= 5; i++) {
    const filled = i <= Math.round(value);
    const star = Icon('star', { size: editable ? 28 : size, color: filled ? 'var(--amber-500)' : 'var(--gray-300)' });
    if (editable) {
      star.classList.add('cursor-pointer');
      star.addEventListener('click', () => onChange && onChange(i));
    }
    stars.appendChild(star);
  }
  wrap.appendChild(stars);
  if (showValue && !editable) {
    wrap.appendChild(h('span', { class: 'text-sm font-semibold text-concrete-900' }, value.toFixed(1).replace('.', ',')));
    if (count != null) wrap.appendChild(h('span', { class: 'text-sm text-concrete-500' }, `(${count})`));
  }
  return wrap;
}
