import type { MouseEventHandler, ReactNode } from 'react';
import { cx } from '../utils/cx';
import { Icon, type IconName } from './icons/Icon';

const VARIANTS = {
  primary: 'bg-brand-500 text-white hover:bg-brand-hover active:bg-brand-press border border-transparent',
  secondary: 'bg-concrete-0 text-concrete-900 border border-concrete-300 hover:bg-concrete-50',
  ghost: 'bg-transparent text-brand-600 border border-transparent hover:bg-brand-50',
  accent: 'bg-accent-500 text-white border border-transparent hover:bg-accent-hover',
  danger: 'bg-concrete-0 text-danger-500 border border-danger-100 hover:bg-danger-50',
  inverse: 'bg-transparent text-white border border-white/40 hover:bg-white/10'
};

const SIZES = {
  sm: 'h-11 px-3 text-sm gap-1.5',
  md: 'h-12 px-4 text-base gap-2',
  lg: 'h-14 px-5 text-base gap-2'
};

type ButtonVariant = keyof typeof VARIANTS;
type ButtonSize = keyof typeof SIZES;

interface ButtonProps {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  iconLeft?: IconName;
  /** A ready-made node in place of `iconLeft` (e.g. the Google mark). */
  iconLeftNode?: ReactNode;
  iconRight?: IconName;
  disabled?: boolean;
  loading?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  className?: string;
  /** "submit" inside a <form> (Enter sends it); "button" everywhere else. */
  type?: 'button' | 'submit';
}

export function Button({
  label,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  iconLeft,
  iconLeftNode,
  iconRight,
  disabled = false,
  loading = false,
  onClick,
  className = '',
  type = 'button'
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading ? 'true' : undefined}
      className={cx(
        'relative tap-target inline-flex items-center justify-center rounded-control font-body font-bold whitespace-nowrap select-none',
        'transition-colors duration-150 ease-out active:scale-[0.98]',
        'disabled:bg-concrete-100 disabled:text-concrete-400 disabled:border-concrete-200 disabled:cursor-not-allowed disabled:active:scale-100',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
        VARIANTS[variant] || VARIANTS.primary,
        SIZES[size] || SIZES.md,
        fullWidth ? 'w-full' : '',
        className
      )}
      onClick={disabled || loading ? undefined : onClick}
    >
      {loading ? (
        <span
          className="animate-spin-token"
          style={{
            width: '1.1rem',
            height: '1.1rem',
            border: '2px solid currentColor',
            borderRightColor: 'transparent',
            borderRadius: '9999px'
          }}
        />
      ) : (
        <>
          {iconLeftNode ? iconLeftNode : iconLeft ? <Icon name={iconLeft} size={20} /> : null}
          <span>{label}</span>
          {iconRight ? <Icon name={iconRight} size={20} /> : null}
        </>
      )}
    </button>
  );
}
