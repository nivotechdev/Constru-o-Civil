import { h, cx } from '../dom.js';
import { Icon } from '../utils/icons.js';

const VARIANTS = {
  primary: 'bg-brand-500 text-white hover:bg-brand-600 active:bg-brand-700 border border-transparent',
  secondary: 'bg-white text-concrete-900 border border-concrete-300 hover:bg-concrete-50',
  ghost: 'bg-transparent text-brand-600 border border-transparent hover:bg-brand-50',
  accent: 'bg-accent-500 text-white border border-transparent hover:bg-accent-600',
  danger: 'bg-white text-danger-500 border border-danger-100 hover:bg-danger-50',
  inverse: 'bg-transparent text-white border border-white/40 hover:bg-white/10'
};

const SIZES = {
  sm: 'h-11 px-3 text-sm gap-1.5',
  md: 'h-12 px-4 text-base gap-2',
  lg: 'h-14 px-5 text-base gap-2'
};

/**
 * @param {{
 *  label: string, variant?: keyof VARIANTS, size?: keyof SIZES, fullWidth?: boolean,
 *  iconLeft?: string, iconRight?: string, disabled?: boolean, loading?: boolean,
 *  onClick?: (e:Event)=>void, type?: string, className?: string
 * }} props
 */
export function Button(props) {
  const {
    label, variant = 'primary', size = 'md', fullWidth = false, iconLeft, iconRight, iconLeftEl,
    disabled = false, loading = false, onClick, type = 'button', className = ''
  } = props;

  const btn = h('button', {
    type,
    disabled: disabled || loading,
    'aria-busy': loading ? 'true' : null,
    class: cx(
      'inline-flex items-center justify-center rounded-control font-body font-bold whitespace-nowrap select-none',
      'transition-colors duration-150 ease-out active:scale-[0.98]',
      'disabled:bg-concrete-100 disabled:text-concrete-400 disabled:border-concrete-200 disabled:cursor-not-allowed disabled:active:scale-100',
      'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
      VARIANTS[variant] || VARIANTS.primary,
      SIZES[size] || SIZES.md,
      fullWidth ? 'w-full' : '',
      className
    ),
    onClick: disabled || loading ? null : onClick
  });

  if (loading) {
    btn.appendChild(h('span.animate-spin-token', {
      style: { width: '1.1rem', height: '1.1rem', border: '2px solid currentColor', borderRightColor: 'transparent', borderRadius: '9999px' }
    }));
  } else {
    if (iconLeftEl) btn.appendChild(iconLeftEl);
    else if (iconLeft) btn.appendChild(Icon(iconLeft, { size: 20 }));
    btn.appendChild(h('span', {}, label));
    if (iconRight) btn.appendChild(Icon(iconRight, { size: 20 }));
  }
  return btn;
}
