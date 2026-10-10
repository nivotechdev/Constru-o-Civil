import type { MouseEvent, ReactNode } from 'react';
import type { Worker } from '../types/models';
import type { StatusBadge } from '../types/ui';
import { cx } from '../utils/cx';
import { Badge } from './Badge';
import { Icon } from './icons/Icon';
import { IconButton } from './IconButton';
import { Rating } from './Rating';
import { WorkerAvatar } from './Avatar';

interface CandidateRowProps {
  worker: Worker;
  summary: string;
  distance: string;
  isNew?: boolean;
  /** Where the candidate stands; `null` while the company still has to decide (approve/reject show). */
  badge: StatusBadge | null;
  /** Greyed out (turned down, gave up…). */
  muted?: boolean;
  onClick: () => void;
  onApprove?: ((e: MouseEvent) => void) | null;
  onReject?: ((e: MouseEvent) => void) | null;
  /** W06: the decision on this candidate is being sent (no second tap). */
  busy?: boolean;
  /** A next step for this candidate (e.g. "Confirmar contratação"), under the badge. */
  action?: { label: string; onClick: () => void } | null;
  /** The WhatsApp button, once the candidate is picked or hired. */
  contact?: ReactNode;
}

/** Compact clickable row for a job's candidate list — the recruiter's decision unit. */
export function CandidateRow({
  worker,
  summary,
  distance,
  isNew,
  badge,
  muted = false,
  onClick,
  onApprove,
  onReject,
  busy = false,
  action = null,
  contact = null
}: CandidateRowProps) {
  return (
    <div
      className={cx(
        'flex items-center gap-3 p-4 border-b border-concrete-200 last:border-0 cursor-pointer hover:bg-concrete-50',
        muted ? 'opacity-60' : ''
      )}
      onClick={() => onClick()}
    >
      <WorkerAvatar worker={worker} />
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-concrete-900 truncate">{worker.name}</span>
          {worker.verified ? (
            <span className="shrink-0 inline-flex" title="Identidade verificada">
              <Icon name="shield-check" size={15} color="var(--text-brand)" />
              <span className="sr-only">Verificado</span>
            </span>
          ) : null}
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
        {!isNew ? <Rating value={worker.rating} count={worker.reviewCount} size={12} /> : null}
        {contact || action ? (
          <div className="flex flex-wrap items-center gap-2 pt-1.5" onClick={(e) => e.stopPropagation()}>
            {contact}
            {action ? (
              <button
                type="button"
                className="h-9 px-3.5 rounded-full text-sm font-semibold whitespace-nowrap text-brand-600 bg-brand-50 hover:bg-brand-100"
                onClick={action.onClick}
              >
                {action.label}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      {badge ? (
        <span className="shrink-0 self-start pt-0.5">
          <Badge label={badge.label} tone={badge.tone} icon={badge.icon} />
        </span>
      ) : (
        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          {busy && (onReject || onApprove) ? (
            <span role="status" aria-label="Enviando" className="inline-flex items-center justify-center w-10 h-10">
              <span
                className="animate-spin-token"
                style={{
                  width: '1.1rem',
                  height: '1.1rem',
                  border: '2px solid var(--brand)',
                  borderRightColor: 'transparent',
                  borderRadius: '9999px'
                }}
              />
            </span>
          ) : null}
          {onReject && !busy ? (
            <IconButton icon="x" label="Recusar candidato" variant="ghost" size="sm" onClick={onReject} />
          ) : null}
          {onApprove && !busy ? (
            <IconButton icon="check" label="Aprovar candidato" variant="brand" size="sm" onClick={onApprove} />
          ) : null}
        </div>
      )}
    </div>
  );
}
