// The mural's UI state bag and the pure rules on top of it: which jobs pass the filters, in what
// order, what a search finds and which filter chips are active.
import type { IconName } from '../../../components/icons/Icon';
import { allCompanies, allWorkers, companyOf, isMine } from '../../../services/selectors';
import { DEFAULT_CITY } from '../../../services/cities';
import { setUI } from '../../../services/store';
import type { Company, Database, Job, Role, Worker } from '../../../types/models';

export const FEED_KEY = 'feed';

export type Sort = 'perto' | 'valor' | 'cedo';

export interface FeedUI {
  search: string;
  location: string;
  filtersOpen: boolean;
  pickerOpen: boolean;
  tipo: string | null;
  dist: string;
  quando: string | null;
  sort: Sort;
  notifyUrgent: boolean;
}

/** The filters that decide which jobs the mural lists. */
export type FeedFilters = Pick<FeedUI, 'location' | 'tipo' | 'dist' | 'quando'>;

// Every seed job is in the city of São Paulo; a job may name another city in `city`.
export { DEFAULT_CITY };
const jobCity = (job: Job) => job.city || DEFAULT_CITY;
export const NO_FILTERS: Partial<FeedUI> = { tipo: null, dist: 'Toda a cidade', quando: null, location: DEFAULT_CITY };
export const SORTS: { id: Sort; label: string }[] = [
  { id: 'perto', label: 'Mais perto' },
  { id: 'valor', label: 'Maior valor' },
  { id: 'cedo', label: 'Mais cedo' }
];
export const FEED_DEFAULTS: FeedUI = {
  search: '',
  location: DEFAULT_CITY,
  filtersOpen: false,
  pickerOpen: false,
  tipo: null,
  dist: 'Toda a cidade',
  quando: null,
  sort: 'perto',
  notifyUrgent: true
};

export const setFeed = (patch: Partial<FeedUI>) => setUI<FeedUI>(FEED_KEY, patch);

function km(distance: string | undefined) {
  return parseFloat(String(distance || '0').replace(',', '.')) || 0;
}
function payNum(job: Job) {
  return job.pay == null ? -1 : job.pay;
}
// Earliest first: today, tomorrow, any other date, then jobs whose date is still open.
function soon(job: Job) {
  return job.date === 'Hoje' ? 0 : job.date === 'Amanhã' ? 1 : job.date ? 2 : 3;
}

// The "Quando" filter: a specific day matches the date; a part of the week matches the days the job
// can happen on.
function matchesQuando(job: Job, quando: string | null) {
  if (!quando) return true;
  if (quando === 'Durante a semana') return job.dias === 'semana' || job.dias === 'qualquer';
  if (quando === 'Fim de semana') return job.dias === 'fimdesemana' || job.dias === 'qualquer';
  return job.date === quando;
}

// Recruiters see their own jobs first, then boosted jobs, then the rest in the chosen order.
export function orderJobs(jobs: Job[], role: Role, sort: Sort = 'perto') {
  const rank = (j: Job) => (role === 'recrutador' && isMine(j) ? 0 : j.urgent ? 1 : 2);
  const by =
    sort === 'valor'
      ? (a: Job, b: Job) => payNum(b) - payNum(a)
      : sort === 'cedo'
        ? (a: Job, b: Job) => soon(a) - soon(b) || km(a.distance) - km(b.distance)
        : (a: Job, b: Job) => km(a.distance) - km(b.distance);
  return jobs.slice().sort((a, b) => rank(a) - rank(b) || by(a, b));
}

export function passesFilters(j: Job, filters: FeedFilters) {
  return (
    jobCity(j) === filters.location &&
    (!filters.tipo || j.role === filters.tipo) &&
    (filters.dist === 'Toda a cidade' || km(j.distance) <= parseInt(filters.dist.replace(/\D/g, ''), 10)) &&
    matchesQuando(j, filters.quando)
  );
}

export interface ActiveFilter {
  label: string;
  icon: IconName;
  remove: () => void;
}

export function activeFilters(filters: FeedFilters): ActiveFilter[] {
  return [
    filters.location !== DEFAULT_CITY
      ? { label: filters.location, icon: 'map-pin', remove: () => setFeed({ location: DEFAULT_CITY }) }
      : null,
    filters.tipo ? { label: filters.tipo, icon: 'hard-hat', remove: () => setFeed({ tipo: null }) } : null,
    filters.dist !== 'Toda a cidade'
      ? { label: filters.dist, icon: 'map-pin', remove: () => setFeed({ dist: 'Toda a cidade' }) }
      : null,
    filters.quando ? { label: filters.quando, icon: 'calendar', remove: () => setFeed({ quando: null }) } : null
  ].filter((f): f is ActiveFilter => Boolean(f));
}

export interface SearchMatches {
  /** Already in the mural's default order. */
  jobs: Job[];
  companies: Company[];
  workers: Worker[];
}

/** What a search (`q`, lowercased) finds among the open jobs, the companies and the workers. */
export function searchMatches(db: Database, open: Job[], q: string, role: Role): SearchMatches {
  return {
    jobs: orderJobs(
      open.filter((j) => (j.role + ' ' + companyOf(db, j).name + ' ' + j.location).toLowerCase().includes(q)),
      role
    ),
    companies: allCompanies(db).filter((c) => (c.name + ' ' + c.location).toLowerCase().includes(q)),
    workers: allWorkers(db).filter((w) => (w.name + ' ' + w.role + ' ' + w.region).toLowerCase().includes(q))
  };
}
