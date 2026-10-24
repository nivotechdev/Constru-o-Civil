// The mural's UI state bag and the pure rules on top of it: which jobs pass the filters, in what
// order, what a search finds and which filter chips are active. Distances are measured (Haversine)
// from where the person is looking from: their GPS position when they used it, their home when the
// mural is on their own city, or the centre of the chosen city.
import type { IconName } from '../../../components/icons/Icon';
import { jobTitle, oficioNome, oficioSearchText } from '../../../services/catalog';
import { cityByLabel, DEFAULT_CITY, knownCity } from '../../../services/cities';
import { currentCompany, currentWorker, isMine, myAddress } from '../../../services/selectors';
import { setUI } from '../../../services/store';
import type { Database, GeoPoint, Job, Role } from '../../../types/models';
import { addDays, todayISO } from '../../../utils/dates';
import { distanceKm } from '../../../utils/geo';
import { cityLabel, isBoosted, runsOn } from '../../../utils/jobInfo';
import { fold } from '../../../utils/text';

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
  /** U65: the lowest daily pay, in reais (`null`: any). */
  minPay: number | null;
  sort: Sort;
  /** The search looks in every city, not only `location` (L17). */
  allCities: boolean;
}

/** The filters that decide which jobs the mural lists, and the point distances are measured from. */
export type FeedFilters = Pick<FeedUI, 'location' | 'oficio' | 'dist' | 'quando'> & {
  minPay?: number | null;
  from: GeoPoint;
};

export { DEFAULT_CITY };
export const ALL_CITY = 'Toda a cidade';
export const SORTS: { id: Sort; label: string }[] = [
  { id: 'perto', label: 'Mais perto' },
  { id: 'valor', label: 'Maior valor' },
  { id: 'cedo', label: 'Mais cedo' }
];

/**
 * U13: the city the mural opens on — the place saved in the profile ("Usar minha localização atual"), for
 * workers and companies alike. The filters change it only while the app is open: every sign-in and every
 * time the app opens, the mural is back here.
 */
export function homeCity(db: Database, role: Role): string {
  const saved = role === 'trabalhador' ? currentWorker(db)?.city : currentCompany(db)?.location;
  return knownCity(saved) ?? DEFAULT_CITY;
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
    minPay: null,
    sort: 'perto',
    allCities: false
  };
}

/** "Limpar filtros": back to the home city and no filter. */
export function noFilters(home: string): Partial<FeedUI> {
  return { oficio: null, dist: ALL_CITY, quando: null, minPay: null, location: home, origin: null };
}

export const setFeed = (patch: Partial<FeedUI>) => setUI<FeedUI>(FEED_KEY, patch);

const SAO_PAULO: GeoPoint = { lat: -23.5505, lon: -46.6333 };

/** Where distances are measured from (see the top of this file). */
export function feedOrigin(ui: Pick<FeedUI, 'location' | 'origin'>, db: Database, role: Role): GeoPoint {
  if (ui.origin) return ui.origin;
  // U51: the account's own address, when the mural is on its city.
  const home = myAddress(db);
  if (home && `${home.city}, ${home.uf}` === ui.location) return { lat: home.lat, lon: home.lon };
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
  const home = myAddress(db);
  if (home && `${home.city}, ${home.uf}` === ui.location) return role === 'trabalhador' ? 'da sua casa' : 'da empresa';
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
    matchesQuando(j, filters.quando, now) &&
    // U65: a job whose pay is "a combinar" has no value to compare, so it leaves when a minimum is set.
    (!filters.minPay || (j.pay != null && j.pay >= filters.minPay))
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
      ? { label: oficioNome(filters.oficio), icon: 'briefcase', remove: () => setFeed({ oficio: null }) }
      : null,
    filters.dist !== ALL_CITY
      ? { label: filters.dist, icon: 'map-pin', remove: () => setFeed({ dist: ALL_CITY }) }
      : null,
    filters.quando ? { label: filters.quando, icon: 'calendar', remove: () => setFeed({ quando: null }) } : null,
    filters.minPay
      ? { label: `A partir de R$ ${filters.minPay}`, icon: 'wallet', remove: () => setFeed({ minPay: null }) }
      : null
  ].filter((f): f is ActiveFilter => Boolean(f));
}

export interface SearchMatches {
  /** U49: only jobs (the search never finds companies or people), in the mural's default order. */
  jobs: Job[];
}

/** U49: words that don't narrow a search ("garçom em caxias" = "garçom caxias"). The same list as feed_jobs. */
const STOPWORDS = new Set(
  ['a', 'o', 'as', 'os', 'de', 'da', 'do', 'das', 'dos', 'e', 'em', 'no', 'na', 'nos', 'nas'].concat([
    'para',
    'pra',
    'por',
    'com',
    'um',
    'uma'
  ])
);

/** U49: the words of a search, each of which a job must have; only linking words → the whole search as one word. */
export function searchWords(query: string): string[] {
  const needle = fold(query.trim());
  const words = needle.split(/[^a-z0-9]+/).filter((w) => w && !STOPWORDS.has(w));
  return words.length ? words : needle ? [needle] : [];
}

/** U49: the search names the job's city (or starts its name, from 4 letters): found even outside the mural's city. */
export function namesCity(job: Job, query: string): boolean {
  const needle = fold(query.trim());
  const city = fold(job.address.city);
  return needle.includes(city) || (needle.length >= 4 && city.startsWith(needle));
}

/** U49: every word of the search is in the job's service (title or trade), neighborhood or city. */
export function matchesSearch(job: Job, query: string): boolean {
  const text = [
    fold([jobTitle(job), job.address.neighborhood, job.address.city, job.address.uf].join(' ')),
    oficioSearchText(job.oficioId)
  ].join(' ');
  const words = searchWords(query);
  return words.length > 0 && words.every((w) => text.includes(w));
}

/**
 * U49: what a search finds — only open jobs, by service, neighborhood or city (never by the company's or a person's
 * name). Accents, case and linking words don't matter, and a trade is found by its name or any synonym ("hidráulica"
 * finds the encanador jobs). The search stays in the chosen city (L17), unless the person asks for every city or
 * names another one. The same rule as the server (migration u49 › feed_jobs).
 */
export function searchMatches(
  open: Job[],
  query: string,
  role: Role,
  from: GeoPoint,
  where: { location: string; allCities: boolean } = { location: '', allCities: true }
): SearchMatches {
  const inScope = (j: Job) => where.allCities || cityLabel(j) === where.location || namesCity(j, query);
  return {
    jobs: orderJobs(
      open.filter((j) => inScope(j) && matchesSearch(j, query)),
      role,
      'perto',
      from
    )
  };
}

/** The radius of "Até X km" in km, or `null` for the whole city. */
export function radiusOf(dist: string): number | null {
  return dist === ALL_CITY ? null : parseInt(dist.replace(/\D/g, ''), 10) || null;
}
