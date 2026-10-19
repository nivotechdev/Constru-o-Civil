import { Fragment, type ReactNode } from 'react';
import type { Company, Job } from '../types/models';
import type { StatusBadge, Tone } from '../types/ui';
import { cx } from '../utils/cx';
import { formatBRL } from '../utils/format';
import { diasInfo, isBoosted, whenText } from '../utils/jobInfo';
import { Icon } from './icons/Icon';
import { PhotoCarousel } from './PhotoCarousel';
import { jobTitle } from '../services/catalog';
import { SaveFlag } from './SaveFlag';

// Icon colour for a status badge on the photo, by tone (the rest fall back to neutral's).
const TONE_COLOR: Partial<Record<Tone, string>> = {
  brand: 'var(--text-brand)',
  success: 'var(--green-500)',
  warning: 'var(--amber-500)',
  danger: 'var(--red-500)',
  accent: 'var(--text-brand)',
  neutral: 'var(--gray-500)'
};

/** The fields a tile reads (the publish form's preview passes a partial job). */
type TileJob = Pick<
  Job,
  'id' | 'oficioId' | 'title' | 'pay' | 'photos' | 'dateToArrange' | 'startDate' | 'endDate' | 'startTime' | 'endTime'
> & { address: Pick<Job['address'], 'neighborhood'> } & Partial<Pick<Job, 'dias' | 'urgent' | 'boostEndsAt'>>;

interface JobTileProps {
  job: TileJob;
  company?: Company;
  /** Opens the job; without it the tile is only a picture (e.g. the publish form's preview). */
  onClick?: () => void;
  /** Status shown on the photo (used on "Minhas candidaturas"). */
  badge?: StatusBadge | null;
  /** Further pills on the photo, after the status (e.g. what is left to do on "Minhas vagas"). */
  extraBadges?: StatusBadge[];
  /** Small people (the workers' photos) on the price row. */
  people?: ReactNode;
  mine?: boolean;
  /** Greys out a closed one. */
  muted?: boolean;
  saved?: boolean;
  onToggleSave?: (() => void) | null;
  /** Replaces the save flag with another action (delete on own posts, WhatsApp on a picked application). */
  corner?: ReactNode;
}

/**
 * Mural tile, listing-style: a rounded photo with the badges and save flag on top, and compact
 * single-line rows underneath (role; neighbourhood and days of the week; date and hours; pay) — no
 * card chrome. Every row truncates, so all tiles in a grid are exactly the same size whatever their
 * content. Nothing is ever added below the text, so every tile keeps the same size.
 */
export function JobTile({
  job,
  company,
  onClick,
  badge = null,
  extraBadges = [],
  people = null,
  mine = false,
  muted = false,
  saved = false,
  onToggleSave = null,
  corner = null
}: JobTileProps) {
  const bairro = job.address.neighborhood;
  const dias = diasInfo(job);
  const where = [bairro, dias && dias.short].filter(Boolean).join(' · ');
  const when = whenText(job);
  const label = [jobTitle(job), badge && badge.label, company && company.name, where, when].filter(Boolean).join(', ');

  const statusPill = (b: StatusBadge) =>
    pill(
      <>
        {b.icon ? <Icon name={b.icon} size={12} color={TONE_COLOR[b.tone] || TONE_COLOR.neutral} /> : null}
        <span className="truncate min-w-0">{b.label}</span>
      </>
    );

  const pill = (children: ReactNode, className = '') => (
    <span
      className={cx(
        'inline-flex items-center gap-1 max-w-full h-6 sm:h-7 px-2 sm:px-2.5 rounded-full bg-white text-[0.6875rem] sm:text-xs font-semibold shadow-[0_1px_3px_rgba(16,20,24,0.18)] whitespace-nowrap',
        className || 'text-concrete-900'
      )}
    >
      {children}
    </span>
  );

  return (
    // X05: the whole card opens the job with the mouse or a tap; for keyboard and screen readers the title is
    // the button (the save flag is its own button, not nested inside another control).
    <div className={cx('group min-w-0 rounded-xl', onClick ? 'cursor-pointer' : '')} onClick={onClick}>
      <div className="relative aspect-[20/19] rounded-xl sm:rounded-2xl overflow-hidden bg-concrete-200">
        {/* Only the picture is greyed out when muted; badges and the save flag keep their colour.
            The photos swipe right here on the tile, without opening the job. */}
        <div className={cx('absolute inset-0', muted ? 'grayscale opacity-60' : '')}>
          <PhotoCarousel job={job} compact className="h-full" />
        </div>
        <div
          className={cx(
            'absolute top-2 left-2 sm:top-3 sm:left-3 flex flex-wrap gap-1.5 pointer-events-none',
            // Room for the corner button (delete, republish) only when there is one.
            corner ? 'right-16' : 'right-2 sm:right-3'
          )}
        >
          {badge ? statusPill(badge) : null}
          {extraBadges.map((b) => (
            <Fragment key={b.label}>{statusPill(b)}</Fragment>
          ))}
          {mine ? pill('Sua vaga', 'text-brand-600') : null}
          {/* Z03: the paid boost and the free "urgent" are visible on the card. */}
          {!badge && isBoosted(job)
            ? pill(
                <>
                  <Icon name="rocket" size={12} color="var(--text-brand)" />
                  Impulsionada
                </>,
                'text-brand-600'
              )
            : null}
          {!badge && job.urgent
            ? pill(
                <>
                  <Icon name="zap" size={12} color="var(--red-500)" />
                  Urgente
                </>,
                'text-danger-500'
              )
            : null}
        </div>
        {corner ? (
          <div className="absolute top-2 right-2 z-10" onClick={(e) => e.stopPropagation()}>
            {corner}
          </div>
        ) : onToggleSave ? (
          <SaveFlag saved={saved} onToggle={onToggleSave} />
        ) : null}
      </div>
      <div className="flex flex-col pt-2.5 sm:pt-3 text-[0.8125rem] sm:text-[0.9375rem] leading-[1.35]">
        {onClick ? (
          <button
            type="button"
            aria-label={label}
            className={cx(
              'truncate text-left font-semibold sm:text-base rounded outline-none focus-visible:ring-4 focus-visible:ring-brand-100',
              muted ? 'text-concrete-500' : 'text-concrete-900'
            )}
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
          >
            {jobTitle(job)}
          </button>
        ) : (
          <span
            className={cx('truncate font-semibold sm:text-base', muted ? 'text-concrete-500' : 'text-concrete-900')}
          >
            {jobTitle(job)}
          </span>
        )}
        <span className="truncate text-concrete-500">{where}</span>
        <span className="truncate text-concrete-500">{when}</span>
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <span className={cx('truncate min-w-0', muted ? 'text-concrete-500' : 'text-concrete-900')}>
            {job.pay == null ? (
              <span className="font-semibold">A combinar</span>
            ) : (
              <>
                <span className="font-semibold">{formatBRL(job.pay)}</span>
                <span className="text-concrete-500"> por diária</span>
              </>
            )}
          </span>
          {people ? <div className="flex items-center shrink-0">{people}</div> : null}
        </div>
      </div>
    </div>
  );
}

/** The one grid for job tiles (see .tile-grid in styles/base.css): same tile size on every screen. */
export function TileGrid({ children }: { children: ReactNode }) {
  return <div className="tile-grid">{children}</div>;
}
