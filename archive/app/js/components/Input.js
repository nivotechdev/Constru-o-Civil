import { h, cx } from '../dom.js';
import { Icon } from '../utils/icons.js';

let uid = 0;

/**
 * Text field. `id` should be stable across re-renders (it doubles as the
 * data-focus-id the render loop uses to restore focus/caret after a rebuild).
 */
export function Input(props) {
  const {
    id, label, placeholder = '', icon, value = '', onInput, error, hint,
    type = 'text', inputMode, mono = false, suffix, disabled = false, autoFocus = false,
    invalid = false // red border only, for fields that share one message with a neighbour
  } = props;
  const fieldId = id || ('field-' + (uid++));

  const wrap = h('div', { class: 'flex flex-col gap-1.5 w-full' });
  if (label) wrap.appendChild(h('label', { for: fieldId, class: 'text-sm font-semibold text-concrete-900' }, label));

  const row = h('div', {
    class: cx(
      'flex items-center gap-2 min-h-12 px-3 bg-white rounded-control border transition-colors duration-150',
      error || invalid ? 'border-danger-500' : 'border-concrete-300 focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-100'
    )
  });
  if (icon) row.appendChild(Icon(icon, { size: 20, color: 'var(--text-subtle)' }));

  const inputEl = h('input', {
    id: fieldId,
    'data-focus-id': fieldId,
    type,
    placeholder,
    inputmode: inputMode || null,
    disabled,
    autofocus: autoFocus ? true : null,
    class: cx('flex-1 min-w-0 h-11 bg-transparent outline-none text-base text-concrete-900 placeholder:text-concrete-400', mono ? 'font-mono' : ''),
    value,
    oninput: onInput ? (e) => onInput(e.target.value, e) : null
  });
  row.appendChild(inputEl);
  if (suffix) row.appendChild(h('span', { class: 'text-sm text-concrete-500 font-semibold shrink-0' }, suffix));
  wrap.appendChild(row);

  if (error) {
    wrap.appendChild(h('span', { class: 'flex items-center gap-1.5 text-sm text-danger-500' }, Icon('circle-alert', { size: 14 }), error));
  } else if (hint) {
    wrap.appendChild(h('span', { class: 'text-sm text-concrete-500' }, hint));
  }
  return wrap;
}

/** Input with a show/hide eye toggle, used for every password field in the app. */
export function PasswordInput(props) {
  const { id, label = 'Senha', placeholder = 'Sua senha', value = '', onInput, error, visible, onToggleVisible } = props;
  const fieldId = id || ('field-' + (uid++));

  const wrap = h('div', { class: 'flex flex-col gap-1.5 w-full' });
  wrap.appendChild(h('label', { for: fieldId, class: 'text-sm font-semibold text-concrete-900' }, label));

  const row = h('div', {
    class: cx(
      'flex items-center gap-2 min-h-12 pl-3 pr-1.5 bg-white rounded-control border transition-colors duration-150',
      error ? 'border-danger-500' : 'border-concrete-300 focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-100'
    )
  },
    h('input', {
      id: fieldId, 'data-focus-id': fieldId, type: visible ? 'text' : 'password', placeholder, value,
      class: 'flex-1 min-w-0 h-11 bg-transparent outline-none text-base text-concrete-900 placeholder:text-concrete-400',
      oninput: onInput ? (e) => onInput(e.target.value, e) : null
    }),
    h('button', {
      type: 'button', class: 'inline-flex items-center justify-center w-9 h-9 rounded-full text-concrete-500 hover:bg-concrete-100 shrink-0',
      'aria-label': visible ? 'Ocultar senha' : 'Mostrar senha', onClick: onToggleVisible
    }, Icon(visible ? 'eye-off' : 'eye', { size: 22 }))
  );
  wrap.appendChild(row);
  if (error) wrap.appendChild(h('span', { class: 'flex items-center gap-1.5 text-sm text-danger-500' }, Icon('circle-alert', { size: 14 }), error));
  return wrap;
}
