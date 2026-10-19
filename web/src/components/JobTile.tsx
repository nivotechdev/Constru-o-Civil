import type { ReactNode } from 'react';
import type { Company, Job } from '../types/models';
import { cx } from '../utils/cx';
import { formatBRL } from '../utils/format';
import { diasInfo, whenText } from '../utils/jobInfo';
import { PhotoCarousel } from './PhotoCarousel';
import { jobTitle } from '../services/catalog';
import { SaveFlag } from './SaveFlag';

/** The fields a tile reads (the publish form's preview passes a partial job). */
type TileJob = Pick<
  Job,
  'id' | 'oficioId' | 'title' | 'pay' | 'photos' | 'dateToArrange' | 'startDate' | 'endDate' | 'startTime' | 'endTime'
> & { address: Pick<Job['address'], 'neighborhood'> } & Partial<Pick<Job, 'dias'>>;

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
  /** Replaces the details under the title (where, when, pay) — e.g. the candidates on "Minhas vagas". */
  footer?: ReactNode;
}

/**
 * Mural tile, listing-style: a rounded photo with the save flag (or a corner button) on top, and compact
 * single-line rows underneath (role; neighbourhood and days of the week; date and hours; pay) — no
 * card chrome, and no labels on the photo. Every row truncates, so all tiles in a grid are exactly the
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
  footer = null
}: JobTileProps) {
  const bairro = job.address.neighborhood;
  const dias = diasInfo(job);
  const where = [bairro, dias && dias.short].filter(Boolean).join(' · ');
  const when = whenText(job);
  const label = [jobTitle(job), company && company.name, where, when].filter(Boolean).join(', ');

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
