import { h, cx } from '../dom.js';
import { Icon } from '../utils/icons.js';
import { Button } from './Button.js';

const TONES = {
  default: { iconBg: 'bg-concrete-100', iconColor: 'var(--text-subtle)' },
  danger: { iconBg: 'bg-danger-50', iconColor: 'var(--red-500)' },
  offline: { iconBg: 'bg-warning-50', iconColor: 'var(--amber-500)' }
};

export function EmptyState({ icon, title, description, actionLabel, onAction, tone = 'default', className = '' }) {
  const t = TONES[tone] || TONES.default;
  return h('div', { class: cx('flex flex-col items-center text-center gap-4 px-6 py-12', className) },
    h('span', { class: cx('inline-flex items-center justify-center w-16 h-16 rounded-full', t.iconBg) }, Icon(icon, { size: 30, color: t.iconColor })),
    h('div', { class: 'flex flex-col gap-1.5 max-w-xs' },
      h('h3', { class: 'text-base font-bold text-concrete-900' }, title),
      description ? h('p', { class: 'text-sm text-concrete-500' }, description) : null
    ),
    actionLabel ? Button({ label: actionLabel, variant: 'secondary', size: 'sm', onClick: onAction }) : null
  );
}
