// The mural's UI state bag and the pure rules on top of it: which jobs pass the filters, in what
// order, what a search finds and which filter chips are active. Distances are measured (Haversine)
// from where the person is looking from: their GPS position when they used it, their home when the
// mural is on their own city, or the centre of the chosen city.
import type { IconName } from '../../../components/icons/Icon';
import { jobTitle, oficioNome, oficioSearchText } from '../../../services/catalog';
import { cityByLabel, DEFAULT_CITY } from '../../../services/cities';
import { allCompanies, allWorkers, companyOf, currentWorker, isMine } from '../../../services/selectors';
import { setUI } from '../../../services/store';
import type { Company, Database, GeoPoint, Job, Role, Worker } from '../../../types/models';
import { addDays, todayISO } from '../../../utils/dates';
import { distanceKm } from '../../../utils/geo';
import { cityLabel, isBoosted, placeText, runsOn } from '../../../utils/jobInfo';
import { fold } from '../../../utils/text';
import { workerPlace } from '../../../utils/workerInfo';

export const FEED_KEY = 'feed';

export type Sort = 'perto' | 'valor' | 'cedo';

export interface FeedUI {
  search: string;
  /** The city the mural shows ("São Paulo, SP"). */
  location: string;
  /** Exact position from "Usar minha localização" (in `location`); `null` when the city was typed. */
  origin: GeoPoint | null;
  /** X19: the profile's city when the mural was set up — a new city in the profile moves the mural too. */
  home?: string;
  filtersOpen: boolean;
  pickerOpen: boolean;
  /** Ofício filter (catalog id). */
  oficio: string | null;
  dist: string;
  quando: string | null;
  sort: Sort;
  /** The search looks in every city, not only `location` (L17). */
  allCities: boolean;
}

/** The filters that decide which jobs the mural lists, and the point distances are measured from. */
export type FeedFilters = Pick<FeedUI, 'location' | 'oficio' | 'dist' | 'quando'> & { from: GeoPoint };

export { DEFAULT_CITY };
export const ALL_CITY = 'Toda a cidade';
export const SORTS: { id: Sort; label: string }[] = [
  { id: 'perto', label: 'Mais perto' },
  { id: 'valor', label: 'Maior valor' },
  { id: 'cedo', label: 'Mais cedo' }
];

/** The city the mural opens on: the worker's own city; for companies, the demo's default city. */
export function homeCity(db: Database, role: Role): string {
  if (role === 'trabalhador') return currentWorker(db)?.city || DEFAULT_CITY;
  return DEFAULT_CITY;
}

export function feedDefaults(db: Database, role: Role): FeedUI {
  return {
    search: '',
    location: homeCity(db, role),
    home: homeCity(db, role),
    origin: null,
    filtersOpen: false,
    pickerOpen: false,
    oficio: null,
    dist: ALL_CITY,
    quando: null,
    sort: 'perto',
    allCities: false
  };
}

/** "Limpar filtros": back to the home city and no filter. */
export function noFilters(home: string): Partial<FeedUI> {
  return { oficio: null, dist: ALL_CITY, quando: null, location: home, origin: null };
}

export const setFeed = (patch: Partial<FeedUI>) => setUI<FeedUI>(FEED_KEY, patch);

const SAO_PAULO: GeoPoint = { lat: -23.5505, lon: -46.6333 };

/** Where distances are measured from (see the top of this file). */
export function feedOrigin(ui: Pick<FeedUI, 'location' | 'origin'>, db: Database, role: Role): GeoPoint {
  if (ui.origin) return ui.origin;
  if (role === 'trabalhador') {
    const w = currentWorker(db);
    if (w && w.city === ui.location) return { lat: w.lat, lon: w.lon };
  }
  return cityByLabel(ui.location) ?? SAO_PAULO;
}

export const jobDistance = (job: Job, from: GeoPoint) => distanceKm(from, job.address);

/**
 * X19: what a distance is measured from, said honestly — "de você" only for the person's own position; the
 * neighbourhood of the profile; otherwise the city's centre.
 */
export function originText(ui: Pick<FeedUI, 'location' | 'origin'>, db: Database, role: Role): string {
  if (ui.origin) return 'de você';
  if (role === 'trabalhador') {
    const w = currentWorker(db);
    if (w && w.city === ui.location && w.neighborhood) return 'do seu bairro';
  }
  return `do centro de ${ui.location.split(',')[0]}`;
}

function payNum(job: Job) {
  return job.pay == null ? -1 : job.pay;
}

/**
 * Z03: boosted jobs (paid, still running) first, then urgent ones (free), then the rest in the chosen
 * order. A recruiter sees their own jobs before all of that. With the real backend the server applies
 * the same order (X01).
 */
export function orderJobs(jobs: Job[], role: Role, sort: Sort, from: GeoPoint, now: Date = new Date()) {
  const rank = (j: Job) => (role === 'recrutador' && isMine(j) ? 0 : isBoosted(j, now) ? 1 : j.urgent ? 2 : 3);
  const near = (a: Job, b: Job) => jobDistance(a, from) - jobDistance(b, from);
  // Earliest first; jobs whose date is still to be arranged go last.
  const start = (j: Job) => (j.dateToArrange || !j.startDate ? '9999-12-31' : j.startDate);
  const by =
    sort === 'valor'
      ? (a: Job, b: Job) => payNum(b) - payNum(a)
      : sort === 'cedo'
        ? (a: Job, b: Job) => start(a).localeCompare(start(b)) || near(a, b)
        : near;
  return jobs.slice().sort((a, b) => rank(a) - rank(b) || by(a, b));
}

// The "Quando" filter: a specific day matches the job's real dates; a part of the week matches the
// days the job can happen on.
function matchesQuando(job: Job, quando: string | null, now: Date) {
  if (!quando) return true;
  if (quando === 'Durante a semana') return job.dias === 'semana' || job.dias === 'qualquer';
  if (quando === 'Fim de semana') return job.dias === 'fimdesemana' || job.dias === 'qualquer';
  const today = todayISO(now);
  if (quando === 'Hoje') return runsOn(job, today);
  if (quando === 'Amanhã') return runsOn(job, addDays(today, 1));
  return true;
}

export function passesFilters(j: Job, filters: FeedFilters, now: Date = new Date()) {
  return (
    cityLabel(j) === filters.location &&
    (!filters.oficio || j.oficioId === filters.oficio) &&
    (filters.dist === ALL_CITY || jobDistance(j, filters.from) <= parseInt(filters.dist.replace(/\D/g, ''), 10)) &&
    matchesQuando(j, filters.quando, now)
  );
}

export interface ActiveFilter {
  label: string;
  icon: IconName;
  remove: () => void;
}

export function activeFilters(filters: Omit<FeedFilters, 'from'>, home: string): ActiveFilter[] {
  return [
    filters.location !== home
      ? { label: filters.location, icon: 'map-pin', remove: () => setFeed({ location: home, origin: null }) }
      : null,
    filters.oficio
      ? { label: oficioNome(filters.oficio), icon: 'hard-hat', remove: () => setFeed({ oficio: null }) }
      : null,
    filters.dist !== ALL_CITY
      ? { label: filters.dist, icon: 'map-pin', remove: () => setFeed({ dist: ALL_CITY }) }
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

/**
 * What a search finds among the open jobs, the companies and the workers. Accents and case are ignored,
 * and a trade is found by its name or any synonym ("hidráulica" finds the encanador jobs).
 */
export function searchMatches(
  db: Database,
  open: Job[],
  query: string,
  role: Role,
  from: GeoPoint,
  where: { location: string; allCities: boolean } = { location: '', allCities: true }
): SearchMatches {
  const q = fold(query.trim());
  const has = (...parts: string[]) => fold(parts.join(' ')).includes(q);
  // L17: the search stays in the chosen city, unless the person asks for every city.
  const inCity = (j: Job) => where.allCities || cityLabel(j) === where.location;
  return {
    jobs: orderJobs(
      open.filter(
        (j) =>
          inCity(j) &&
          (has(jobTitle(j), companyOf(db, j).name, placeText(j)) || oficioSearchText(j.oficioId).includes(q))
      ),
      role,
      'perto',
      from
    ),
    companies: allCompanies(db).filter((c) => c.name !== 'Construtora (conta excluída)' && has(c.name, c.location)),
    // L17: workers show up only for companies.
    workers:
      role === 'recrutador'
        ? allWorkers(db).filter((w) => w.name !== 'Conta excluída' && has(w.name, workerPlace(w)))
        : []
  };
}

/** The radius of "Até X km" in km, or `null` for the whole city. */
export function radiusOf(dist: string): number | null {
  return dist === ALL_CITY ? null : parseInt(dist.replace(/\D/g, ''), 10) || null;
}
