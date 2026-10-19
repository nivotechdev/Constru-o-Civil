import { h, cx } from '../dom.js';

const TONES = {
  default: 'bg-white border border-concrete-200 shadow-card',
  sunken: 'bg-concrete-100 border-0',
  brand: 'bg-brand-50 border border-brand-200'
};

const PADDING = { none: '', sm: 'p-3', md: 'p-4', lg: 'p-5' };

/** The one card shape used everywhere: mural, candidates, profiles. */
export function Card({ tone = 'default', padding = 'md', onClick, className = '' }, ...children) {
  const clickable = Boolean(onClick);
  return h(clickable ? 'button' : 'div', {
    type: clickable ? 'button' : null,
    class: cx(
      'rounded-card overflow-hidden text-left w-full',
      TONES[tone] || TONES.default,
      PADDING[padding] ?? PADDING.md,
      clickable ? 'transition-transform duration-150 active:scale-[0.98] cursor-pointer' : '',
      className
    ),
    onClick
  }, ...children);
}
