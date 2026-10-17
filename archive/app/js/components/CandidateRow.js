import { h, cx } from '../dom.js';
import { Icon } from '../utils/icons.js';
import { Rating } from './Rating.js';
import { IconButton } from './IconButton.js';

/** Compact clickable row for a job's candidate list — the recruiter's decision unit. */
export function CandidateRow({ worker, summary, distance, isNew, decision, onClick, onApprove, onReject }) {
  const decided = decision === 'aprovado' || decision === 'recusado';
  return h('div', {
    class: cx('flex items-center gap-3 p-4 border-b border-concrete-200 last:border-0 cursor-pointer hover:bg-concrete-50', decision === 'recusado' ? 'opacity-60' : ''),
    onClick
  },
    h('span', {
      class: 'inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent-50 text-accent-600 font-bold text-sm shrink-0'
    }, worker.initials),
    h('div', { class: 'flex-1 min-w-0 flex flex-col gap-1' },
      h('div', { class: 'flex items-center gap-2' },
        h('span', { class: 'font-semibold text-concrete-900 truncate' }, worker.name),
        isNew ? h('span', { class: 'shrink-0 px-2 py-0.5 rounded-full bg-accent-50 text-accent-600 text-[0.6875rem] font-bold' }, 'Novo') : null
      ),
      h('div', { class: 'flex items-center gap-2 text-sm text-concrete-500' },
        h('span', { class: 'truncate' }, summary),
        h('span', {}, '·'),
        h('span', { class: 'shrink-0' }, distance)
      ),
      !isNew ? Rating({ value: worker.rating, count: worker.jobsDone, size: 12 }) : null
    ),
    decided
      ? h('span', {
          class: cx('shrink-0 px-2.5 h-6 inline-flex items-center rounded-full text-xs font-bold',
            decision === 'aprovado' ? 'bg-success-50 text-success-500' : 'bg-danger-50 text-danger-500')
        }, decision === 'aprovado' ? 'Aprovado' : 'Recusado')
      : h('div', { class: 'flex items-center gap-1 shrink-0', onClick: (e) => e.stopPropagation() },
          onReject ? IconButton({ icon: 'x', label: 'Recusar candidato', variant: 'ghost', size: 'sm', onClick: onReject }) : null,
          onApprove ? IconButton({ icon: 'check', label: 'Aprovar candidato', variant: 'brand', size: 'sm', onClick: onApprove }) : null
        )
  );
}
