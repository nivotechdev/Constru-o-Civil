import { h } from '../dom.js';
import { IconButton } from './IconButton.js';

/** Contextual header for "compromise" screens (job detail, confirm, candidate, …). */
export function BackBar({ title, onBack, actions = [] }) {
  return h('header', {
    class: 'sticky top-0 z-20 flex items-center gap-1.5 min-h-14 px-2 bg-white border-b border-concrete-200 lg:static lg:bg-transparent lg:border-0 lg:-ml-3 lg:px-0 lg:pb-4 lg:mb-2'
  },
    onBack ? IconButton({ icon: 'arrow-left', label: 'Voltar', onClick: onBack }) : null,
    h('h1', { class: 'flex-1 min-w-0 font-display font-semibold text-xl text-concrete-900 truncate' }, title),
    ...actions.map((a) => IconButton(a))
  );
}

export function NotificationBell({ count = 0, onClick }) {
  return IconButton({ icon: 'bell', label: 'Notificações', onClick, badge: count > 0 ? count : null });
}
