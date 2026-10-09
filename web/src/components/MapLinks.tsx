// "Abrir no mapa": the job's exact address in Google Maps or Waze (Z06 / L04). Only rendered where the
// person may see the address (selectors.canSeeExactAddress).
import type { Job } from '../types/models';
import { mapLinks } from '../utils/jobInfo';
import { Icon } from './icons/Icon';

export function MapLinks({ job }: { job: Pick<Job, 'address'> }) {
  const links = mapLinks(job);
  const cls =
    'inline-flex items-center justify-center gap-1.5 h-11 px-3 rounded-control border border-concrete-300 bg-white text-sm font-bold text-concrete-900 hover:bg-concrete-50';
  return (
    <div className="flex gap-2">
      <a className={cls + ' flex-1'} href={links.google} target="_blank" rel="noopener noreferrer">
        <Icon name="map" size={18} />
        Abrir no Google Maps
      </a>
      <a className={cls} href={links.waze} target="_blank" rel="noopener noreferrer">
        <Icon name="navigation" size={18} />
        Waze
      </a>
    </div>
  );
}
