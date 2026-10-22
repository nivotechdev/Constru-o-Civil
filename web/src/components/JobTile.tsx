import type { ReactNode } from 'react';
import type { Company, Job } from '../types/models';
import type { StatusBadge, Tone } from '../types/ui';
import { Icon } from './icons/Icon';
import { cx } from '../utils/cx';
import { formatBRL } from '../utils/format';
import { tileWhenText } from '../utils/jobInfo';
import { PhotoCarousel } from './PhotoCarousel';
import { jobTitle } from '../services/catalog';
import { SaveFlag } from './SaveFlag';
import { useDb } from '../hooks/useStore';
import { homeDistanceKm } from '../services/selectors';
import { formatKm } from '../utils/geo';

// U35: the icon colour of the status badge on the photo, by tone (theme-aware tokens).
const TONE_COLOR: Record<Tone, string> = {
  brand: 'var(--text-brand)',
  success: 'var(--green-500)',
  warning: 'var(--amber-500)',
  danger: 'var(--red-500)',
  accent: 'var(--text-brand)',
  neutral: 'var(--gray-500)',
  inverse: 'var(--gray-500)'
};

/** The fields a tile reads (the publish form's preview passes a partial job). */
type TileJob = Pick<
  Job,
  'id' | 'oficioId' | 'title' | 'pay' | 'photos' | 'dateToArrange' | 'startDate' | 'endDate' | 'startTime' | 'endTime'
> & { address: Pick<Job['address'], 'neighborhood'> & Partial<Pick<Job['address'], 'lat' | 'lon'>> } & Partial<
    Pick<Job, 'dias' | 'weekdays'>
  >;

interface JobTileProps {
  job: TileJob;
  company?: Company;
  /** Opens the job; without it the tile is only a picture (e.g. the publish form's preview). */
  onClick?: () => void;
  /** Greys out the picture. */
  muted?: boolean;
  saved?: boolean;
  onToggleSave?: (() => void) | null;
  /** A button in the photo's top corner (delete, republish, WhatsApp). */
  corner?: ReactNode;
  /** U35: where the candidacy stands, on the photo's top-left corner ("Minhas candidaturas"). */
  badge?: StatusBadge | null;
  /** Replaces the details under the title (where, when, pay) — e.g. the candidates on "Minhas vagas". */
  footer?: ReactNode;
}

/**
 * Mural tile, listing-style: a rounded photo with the save flag (or a corner button) on top, and compact
 * single-line rows underneath (role; pin + neighbourhood · distance from home; clock + the hours; pay) — no
 * card chrome; on the photo only the candidacy status (U35, "Minhas candidaturas"). Every row truncates, so all tiles in a grid are exactly the
 * same size whatever their content.
 */
export function JobTile({
  job,
  company,
  onClick,
  muted = false,
  saved = false,
  onToggleSave = null,
  corner = null,
  footer = null,
  badge = null
}: JobTileProps) {
  // U51/U56: how far it is from the worker's home, highlighted in the description ("1,2 km").
  const km = homeDistanceKm(useDb(), job);
  const bairro = job.address.neighborhood;
  const when = tileWhenText(job);
  const distance = km === null ? null : formatKm(km);
  const label = [
    jobTitle(job),
    badge && badge.label,
    company && company.name,
    distance ? `a ${distance} da sua casa` : bairro,
    when
  ]
    .filter(Boolean)
    .join(', ');

  return (
    // X05: the whole card opens the job with the mouse or a tap; for keyboard and screen readers the title is
    // the button (the save flag is its own button, not nested inside another control).
    <div className={cx('group min-w-0 rounded-xl', onClick ? 'cursor-pointer' : '')} onClick={onClick}>
      <div className="relative aspect-[20/19] rounded-xl sm:rounded-2xl overflow-hidden bg-concrete-200">
        {/* Only the picture is greyed out when muted; the save flag keeps its colour.
            The photos swipe right here on the tile, without opening the job. */}
        <div className={cx('absolute inset-0', muted ? 'grayscale opacity-60' : '')}>
          <PhotoCarousel job={job} compact className="h-full" />
        </div>
        {badge ? (
          // Outside the greyed picture: the status keeps its colour on a closed candidacy too.
          <span
            className={cx(
              'absolute top-2 left-2 z-10 inline-flex items-center gap-1 h-6 sm:h-7 px-2 sm:px-2.5 rounded-full bg-concrete-0 text-[0.6875rem] sm:text-xs font-semibold text-concrete-900 shadow-[0_1px_3px_rgba(16,20,24,0.18)] whitespace-nowrap',
              corner ? 'max-w-[calc(100%-3.5rem)]' : 'max-w-[calc(100%-1rem)]'
            )}
          >
            <Icon name={badge.icon} size={12} color={TONE_COLOR[badge.tone]} />
            <span className="truncate min-w-0">{badge.label}</span>
          </span>
        ) : null}
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
        {footer ? (
          <div className="pt-1.5">{footer}</div>
        ) : (
          <>
            {/* U61: two quiet detail rows, each led by a small grey line icon — how far (from the worker's home; the
                neighbourhood's name only when the distance is not known yet) and when — then the pay. */}
            <span className="mt-1 flex items-center gap-1.5 min-w-0 text-concrete-500">
              <Icon name="map-pin" size={14} color="var(--text-subtle)" />
              <span className="truncate min-w-0">{distance ? `A ${distance} da sua casa` : bairro}</span>
            </span>
            <span className="mt-0.5 flex items-center gap-1.5 min-w-0 text-concrete-500">
              <Icon name="clock" size={14} color="var(--text-subtle)" />
              <span className="truncate min-w-0">{when}</span>
            </span>
            <span className={cx('truncate mt-1.5', muted ? 'text-concrete-500' : 'text-concrete-900')}>
              {job.pay == null ? (
                <span className="font-semibold">A combinar</span>
              ) : (
                <>
                  <span className="font-semibold">{formatBRL(job.pay)}</span>
                  <span className="text-concrete-500"> por diária</span>
                </>
              )}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

/** The one grid for job tiles (see .tile-grid in styles/base.css): same tile size on every screen. */
export function TileGrid({ children }: { children: ReactNode }) {
  return <div className="tile-grid">{children}</div>;
}
