import { h, cx } from '../dom.js';
import { Icon } from '../utils/icons.js';

/** Tap-to-choose photo well (cover banner, avatar, job-site photo). No backend — stores a local object URL. */
export function PhotoSlot({ shape = 'rect', value, onChange, placeholder = 'Toque para escolher uma foto', className = '', height = '9rem' }) {
  const isCircle = shape === 'circle';
  const input = h('input', {
    type: 'file', accept: 'image/*', class: 'sr-only',
    onchange: (e) => {
      const file = e.target.files && e.target.files[0];
      if (file && onChange) onChange(URL.createObjectURL(file));
    }
  });
  return h('label', {
    class: cx(
      'relative flex items-center justify-center overflow-hidden cursor-pointer bg-concrete-200 border-2 border-dashed border-concrete-300 hover:border-brand-400 transition-colors',
      isCircle ? 'rounded-full' : 'rounded-card w-full',
      className
    ),
    style: isCircle ? {} : { height }
  },
    input,
    value
      ? h('img', { src: value, alt: '', class: 'absolute inset-0 w-full h-full object-cover' })
      : h('span', { class: 'flex flex-col items-center gap-1.5 text-concrete-500 px-3 text-center' }, Icon('camera', { size: isCircle ? 20 : 24 }), h('span', { class: 'text-xs font-semibold' }, placeholder))
  );
}
