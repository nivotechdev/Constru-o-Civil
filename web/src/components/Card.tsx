import type { MouseEventHandler, ReactNode } from 'react';
import { cx } from '../utils/cx';

const TONES = {
  default: 'bg-white border border-concrete-200 shadow-card',
  sunken: 'bg-concrete-100 border-0',
  brand: 'bg-brand-50 border border-brand-200'
};

const PADDING = { none: '', sm: 'p-3', md: 'p-4', lg: 'p-5' };

interface CardProps {
  tone?: keyof typeof TONES;
  padding?: keyof typeof PADDING;
  onClick?: MouseEventHandler<HTMLElement>;
  className?: string;
  children?: ReactNode;
}

/** The one card shape used everywhere: mural, candidates, profiles. Clickable cards are buttons. */
export function Card({ tone = 'default', padding = 'md', onClick, className = '', children }: CardProps) {
  const clickable = Boolean(onClick);
  const classes = cx(
    'rounded-card overflow-hidden text-left w-full',
    TONES[tone] || TONES.default,
    PADDING[padding] ?? PADDING.md,
    clickable ? 'transition-transform duration-150 active:scale-[0.98] cursor-pointer' : '',
    className
  );
  return clickable ? (
    <button type="button" className={classes} onClick={onClick}>
      {children}
    </button>
  ) : (
    <div className={classes}>{children}</div>
  );
}
