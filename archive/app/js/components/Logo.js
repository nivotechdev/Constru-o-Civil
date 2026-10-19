import { h, cx } from '../dom.js';
import { Icon } from '../utils/icons.js';

/** The Bicos mark + wordmark, as in the desktop top bar. `compact` is the phone size. */
export function Logo({ compact = false } = {}) {
  return h('span', { class: cx('inline-flex items-center', compact ? 'gap-2' : 'gap-2.5') },
    h('span', { class: cx('inline-flex items-center justify-center bg-brand-500 shadow-raised', compact ? 'w-9 h-9 rounded-[0.625rem]' : 'w-10 h-10 rounded-xl') },
      Icon('hammer', { size: compact ? 19 : 21, color: '#fff' })),
    h('span', { class: cx('font-display font-bold leading-none tracking-tight text-brand-500', compact ? 'text-[1.5rem]' : 'text-[1.625rem]') }, 'Bicos')
  );
}
