import { h, cx } from '../dom.js';
import { Icon } from '../utils/icons.js';

const VARIANTS = {
  ghost: 'bg-transparent text-concrete-700 hover:bg-concrete-100',
  solid: 'bg-white text-concrete-700 shadow-card hover:bg-concrete-50',
  brand: 'bg-brand-50 text-brand-600 hover:bg-brand-100'
};

// Touch-target sizes as Tailwind classes (rem-based), not inline px.
const SIZES = { sm: 'w-10 h-10', md: 'w-11 h-11', lg: 'w-12 h-12' };

export function IconButton({ icon, label, variant = 'ghost', size = 'md', onClick, className = '', badge }) {
  const sizeClass = SIZES[size] || SIZES.md;
  const btn = h('button', {
    type: 'button',
    'aria-label': label,
    title: label,
    class: cx(
      'relative inline-flex items-center justify-center rounded-full shrink-0 transition-colors duration-150',
      'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
      VARIANTS[variant] || VARIANTS.ghost, sizeClass, className
    ),
    onClick
  }, Icon(icon, { size: 20 }));
  if (badge) {
    btn.appendChild(h('span', {
      class: 'absolute -top-0.5 -right-0.5 min-w-[1rem] h-4 px-1 rounded-full bg-danger-500 text-white text-[0.625rem] font-bold leading-4 text-center pointer-events-none'
    }, String(badge)));
  }
  return btn;
}
