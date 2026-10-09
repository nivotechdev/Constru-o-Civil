// The people in the app: a worker's photo (or initials) and a company's logo (or the building icon).
// Saved photos are shown to everyone (Z12): profiles, candidate lists, the mural, the job pages, the menu.
import type { Company, Worker } from '../types/models';
import { cx } from '../utils/cx';
import { Icon } from './icons/Icon';

const SIZES = {
  sm: { box: 'w-10 h-10 text-sm', icon: 20 },
  md: { box: 'w-12 h-12 text-sm', icon: 22 },
  lg: { box: 'w-24 h-24 text-2xl', icon: 26 }
};

type Size = keyof typeof SIZES;

export function WorkerAvatar({
  worker,
  size = 'md',
  className
}: {
  worker: Pick<Worker, 'initials' | 'photoUrl'>;
  size?: Size;
  className?: string;
}) {
  const s = SIZES[size];
  return (
    <span
      className={cx(
        'inline-flex items-center justify-center rounded-full overflow-hidden shrink-0 bg-accent-50 text-accent-600 font-bold',
        s.box,
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
  className
}: {
  company: Pick<Company, 'logoUrl'>;
  size?: Size;
  className?: string;
}) {
  const s = SIZES[size];
  return (
    <span
      className={cx(
        'inline-flex items-center justify-center rounded-full overflow-hidden shrink-0 bg-brand-50',
        s.box,
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
