import type { ReactNode } from 'react';
import type { Company, Job } from '../types/models';
import type { StatusBadge, Tone } from '../types/ui';
import { cx } from '../utils/cx';
import { formatBRL } from '../utils/format';
import { diasInfo, whenText } from '../utils/jobInfo';
import { Icon } from './icons/Icon';
import { PhotoCarousel } from './PhotoCarousel';
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
type TileJob = Pick<Job, 'id' | 'role' | 'location' | 'date' | 'hours' | 'pay' | 'photos'> & Partial<Pick<Job, 'dias'>>;

interface JobTileProps {
  job: TileJob;
  company?: Company;
  onClick: () => void;
  /** Status shown on the photo (used on "Minhas candidaturas"). */
  badge?: StatusBadge | null;
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
  mine = false,
  muted = false,
  saved = false,
  onToggleSave = null,
  corner = null
}: JobTileProps) {
  const bairro = String(job.location || '').split(',')[0];
  const dias = diasInfo(job);
  const where = [bairro, dias && dias.short].filter(Boolean).join(' · ');
  const when = whenText(job);

  const pill = (children: ReactNode, className = '') => (
    <span
      className={cx(
        'inline-flex items-center gap-1 h-6 sm:h-7 px-2 sm:px-2.5 rounded-full bg-white text-[0.6875rem] sm:text-xs font-semibold shadow-[0_1px_3px_rgba(16,20,24,0.18)] whitespace-nowrap',
        className || 'text-concrete-900'
      )}
    >
      {children}
    </span>
  );

  return (
    <div
      role="link"
      tabIndex={0}
      aria-label={[job.role, badge && badge.label, company && company.name, where, when].filter(Boolean).join(', ')}
      className="group min-w-0 cursor-pointer rounded-xl outline-none focus-visible:ring-4 focus-visible:ring-brand-100"
      onClick={() => onClick()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div className="relative aspect-[20/19] rounded-xl sm:rounded-2xl overflow-hidden bg-concrete-200">
        {/* Only the picture is greyed out when muted; badges and the save flag keep their colour.
            The photos swipe right here on the tile, without opening the job. */}
        <div className={cx('absolute inset-0', muted ? 'grayscale opacity-60' : '')}>
          <PhotoCarousel job={job} compact className="h-full" />
        </div>
        <div className="absolute top-2 left-2 sm:top-3 sm:left-3 right-12 flex flex-wrap gap-1.5 pointer-events-none">
          {badge
            ? pill(
                <>
                  {badge.icon ? (
                    <Icon name={badge.icon} size={12} color={TONE_COLOR[badge.tone] || TONE_COLOR.neutral} />
                  ) : null}
                  {badge.label}
                </>
              )
            : null}
          {mine ? pill('Sua vaga', 'text-brand-600') : null}
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
        <span className={cx('truncate font-semibold sm:text-base', muted ? 'text-concrete-500' : 'text-concrete-900')}>
          {job.role}
        </span>
        <span className="truncate text-concrete-500">{where}</span>
        <span className="truncate text-concrete-500">{when}</span>
        <span className={cx('truncate pt-0.5', muted ? 'text-concrete-500' : 'text-concrete-900')}>
          {job.pay == null ? (
            <span className="font-semibold">A combinar</span>
          ) : (
            <>
              <span className="font-semibold">{formatBRL(job.pay)}</span>
              <span className="text-concrete-500"> por diária</span>
            </>
          )}
        </span>
      </div>
    </div>
  );
}

/** The one grid for job tiles (see .tile-grid in styles/base.css): same tile size on every screen. */
export function TileGrid({ children }: { children: ReactNode }) {
  return <div className="tile-grid">{children}</div>;
}
