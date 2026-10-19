import { h, cx } from '../dom.js';
import { Icon } from '../utils/icons.js';

const TONES = {
  brand: 'bg-brand-50 text-brand-600',
  success: 'bg-success-50 text-success-500',
  warning: 'bg-warning-50 text-warning-500',
  danger: 'bg-danger-50 text-danger-500',
  accent: 'bg-accent-50 text-accent-600',
  neutral: 'bg-concrete-100 text-concrete-500',
  inverse: 'bg-white/15 text-white'
};

export function Badge({ label, tone = 'neutral', icon, className = '' }) {
  return h('span', {
    class: cx('inline-flex items-center gap-1.5 rounded-full px-2.5 h-6 text-xs font-bold whitespace-nowrap', TONES[tone] || TONES.neutral, className)
  }, icon ? Icon(icon, { size: 14 }) : null, label);
}
