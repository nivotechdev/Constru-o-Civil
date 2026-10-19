// The people in the app: a worker's photo (or initials) and a company's logo (or the building icon).
// Saved photos are shown to everyone (Z12): profiles, candidate lists, the mural, the job pages, the menu.
import type { Company, Worker } from '../types/models';
import { cx } from '../utils/cx';
import { Icon } from './icons/Icon';

const SIZES = {
  xs: { box: 'w-8 h-8 text-xs', icon: 16 },
  sm: { box: 'w-10 h-10 text-sm', icon: 20 },
  md: { box: 'w-12 h-12 text-sm', icon: 22 },
  lg: { box: 'w-24 h-24 text-2xl', icon: 26 }
};

type Size = keyof typeof SIZES;

/**
 * The one white border around a profile photo, wherever it sits on top of something (stacked photos,
 * the photo over a cover): thin and the same everywhere. Drawn on the photo itself, so it hugs it.
 */
export const AVATAR_BORDER = 'ring-[1.5px] ring-white';
/** The same border for a photo placed inside a frame (the profile headers, the logo over a job's cover). */
export const AVATAR_FRAME = 'rounded-full bg-white p-[1.5px]';

export function WorkerAvatar({
  worker,
  size = 'md',
  ring = false,
  className
}: {
  worker: Pick<Worker, 'initials' | 'photoUrl'>;
  size?: Size;
  /** The white border, for a photo over other photos or over a cover. */
  ring?: boolean;
  className?: string;
}) {
  const s = SIZES[size];
  return (
    <span
      className={cx(
        'inline-flex items-center justify-center rounded-full overflow-hidden shrink-0 bg-accent-50 text-accent-600 font-bold',
        s.box,
        ring && AVATAR_BORDER,
        className
      )}
    >
      {worker.photoUrl ? (
        <img src={worker.photoUrl} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
      ) : (
        worker.initials
      )}
    </span>
  );
}

export function CompanyAvatar({
  company,
  size = 'md',
  ring = false,
  className
}: {
  company: Pick<Company, 'logoUrl'>;
  size?: Size;
  /** The white border, for a photo over other photos or over a cover. */
  ring?: boolean;
  className?: string;
}) {
  const s = SIZES[size];
  return (
    <span
      className={cx(
        'inline-flex items-center justify-center rounded-full overflow-hidden shrink-0 bg-brand-50',
        s.box,
        ring && AVATAR_BORDER,
        className
      )}
    >
      {company.logoUrl ? (
        <img src={company.logoUrl} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
      ) : (
        <Icon name="building-2" size={s.icon} color="var(--brand)" />
      )}
    </span>
  );
}
