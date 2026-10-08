import type { MouseEventHandler } from 'react';
import { cx } from '../utils/cx';
import { Icon, type IconName } from './icons/Icon';

const VARIANTS = {
  ghost: 'bg-transparent text-concrete-700 hover:bg-concrete-100',
  solid: 'bg-white text-concrete-700 shadow-card hover:bg-concrete-50',
  brand: 'bg-brand-50 text-brand-600 hover:bg-brand-100'
};

// Touch-target sizes as Tailwind classes (rem-based), not inline px.
const SIZES = { sm: 'w-10 h-10', md: 'w-11 h-11', lg: 'w-12 h-12' };

interface IconButtonProps {
  icon: IconName;
  label: string;
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  badge?: number | string | null;
}

export function IconButton({ icon, label, variant = 'ghost', size = 'md', onClick, badge }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        'relative inline-flex items-center justify-center rounded-full shrink-0 transition-colors duration-150',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
        VARIANTS[variant] || VARIANTS.ghost,
        SIZES[size] || SIZES.md
      )}
      onClick={onClick}
    >
      <Icon name={icon} size={20} />
      {badge ? (
        <span className="absolute -top-0.5 -right-0.5 min-w-[1rem] h-4 px-1 rounded-full bg-danger-500 text-white text-[0.625rem] font-bold leading-4 text-center pointer-events-none">
          {String(badge)}
        </span>
      ) : null}
    </button>
  );
}
