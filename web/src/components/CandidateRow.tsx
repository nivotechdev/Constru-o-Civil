import type { MouseEvent } from 'react';
import type { Worker } from '../types/models';
import { cx } from '../utils/cx';
import { IconButton } from './IconButton';
import { Rating } from './Rating';

interface CandidateRowProps {
  worker: Worker;
  summary: string;
  distance: string;
  isNew?: boolean;
  decision: 'aprovado' | 'recusado' | null;
  onClick: () => void;
  onApprove?: ((e: MouseEvent) => void) | null;
  onReject?: ((e: MouseEvent) => void) | null;
}

/** Compact clickable row for a job's candidate list — the recruiter's decision unit. */
export function CandidateRow({
  worker,
  summary,
  distance,
  isNew,
  decision,
  onClick,
  onApprove,
  onReject
}: CandidateRowProps) {
  const decided = decision === 'aprovado' || decision === 'recusado';
  return (
    <div
      className={cx(
        'flex items-center gap-3 p-4 border-b border-concrete-200 last:border-0 cursor-pointer hover:bg-concrete-50',
        decision === 'recusado' ? 'opacity-60' : ''
      )}
      onClick={() => onClick()}
    >
      <span className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent-50 text-accent-600 font-bold text-sm shrink-0">
        {worker.initials}
      </span>
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-concrete-900 truncate">{worker.name}</span>
          {isNew ? (
            <span className="shrink-0 px-2 py-0.5 rounded-full bg-accent-50 text-accent-600 text-[0.6875rem] font-bold">
              Novo
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2 text-sm text-concrete-500">
          <span className="truncate">{summary}</span>
          <span>·</span>
          <span className="shrink-0">{distance}</span>
        </div>
        {!isNew ? <Rating value={worker.rating} count={worker.jobsDone} size={12} /> : null}
      </div>
      {decided ? (
        <span
          className={cx(
            'shrink-0 px-2.5 h-6 inline-flex items-center rounded-full text-xs font-bold',
            decision === 'aprovado' ? 'bg-success-50 text-success-500' : 'bg-danger-50 text-danger-500'
          )}
        >
          {decision === 'aprovado' ? 'Aprovado' : 'Recusado'}
        </span>
      ) : (
        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          {onReject ? (
            <IconButton icon="x" label="Recusar candidato" variant="ghost" size="sm" onClick={onReject} />
          ) : null}
          {onApprove ? (
            <IconButton icon="check" label="Aprovar candidato" variant="brand" size="sm" onClick={onApprove} />
          ) : null}
        </div>
      )}
    </div>
  );
}
