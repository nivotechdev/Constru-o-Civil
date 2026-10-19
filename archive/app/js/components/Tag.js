import { h, cx } from '../dom.js';
import { Icon } from '../utils/icons.js';

/** A clickable chip: filter option, specialty selector, requirement toggle. */
export function Tag({ label, icon, selected = false, onClick, onRemove, className = '' }) {
  const tag = h('button', {
    type: 'button', 'aria-pressed': onRemove ? null : (selected ? 'true' : 'false'),
    class: cx(
      'inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-sm font-semibold whitespace-nowrap shrink-0 transition-colors duration-150',
      'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
      selected ? 'bg-brand-50 border border-brand-500 text-brand-600' : 'bg-white border border-concrete-300 text-concrete-700 hover:bg-concrete-50',
      className
    ),
    onClick
  }, icon ? Icon(icon, { size: 16 }) : null, h('span', {}, label));
  if (onRemove) {
    tag.appendChild(h('span', {
      class: 'ml-0.5 -mr-1 inline-flex items-center justify-center w-4 h-4',
      onClick: (e) => { e.stopPropagation(); onRemove(e); }
    }, Icon('x', { size: 14 })));
  }
  return tag;
}
