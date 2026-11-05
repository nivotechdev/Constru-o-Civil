// U54/U76/U80: how far the job is from the worker's home — ON FOOT, the way Google Maps measures walking — and how long
// it takes by car.
//   * The distance on foot is ONE number per home and job: computed once, kept on the phone, and read by the mural's
//     card and by the job's page alike, so both always say the same ("A 1,2 km da sua casa").
//   * With Google configured (FEATURES.googleMaps): Google's own numbers (Routes API, through the Edge Function
//     calcular-rota, which keeps the key). The two ADDRESSES go as text, so Google places them exactly where Google
//     Maps does — the same distance as asking Google Maps for the route on foot.
//   * Otherwise, free and with no key: Valhalla (FOSSGIS, the router of the OpenStreetMap site) on foot and by car,
//     OSRM (FOSSGIS) when it doesn't answer. The mural's cards are asked together, in one request ("matrix").
// The free servers get only coordinates (no name, no account). Any failure resolves to null and the screen falls back
// to the straight line, saying so. docs/DECISOES.md › U76, U80.
import type { GeoPoint } from '../types/models';
import { FEATURES } from './features';
import { IS_DEMO } from './mode';
import { googleRoute, googleWalkDistances } from './remote/route';

export type RouteProvider = 'google' | 'valhalla' | 'osrm';

/** The distance on foot from the home to the job — the one number the card and the job's page show. */
export interface WalkDistance {
  meters: number;
  provider: RouteProvider;
  /** Google's own words for it ("1,2 km"), when Google answered. */
  text?: string;
}

/** What the job's page shows: the distance on foot (and its path on the map) and the time by car. */
export interface JobRoute {
  walk: WalkDistance;
  /** The way on foot, as [lat, lon] points (empty when only the distance is known). */
  path: [number, number][];
  /** Where Google placed the two addresses (the route's ends). */
  from?: GeoPoint;
  to?: GeoPoint;
  /** By car: seconds, and Google's words for it ("9 min"). */
  driveSeconds: number | null;
  driveText?: string;
}

/** A route of one of the free servers. */
interface FreeRoute {
  meters: number;
  seconds: number;
  path: [number, number][];
  provider: RouteProvider;
}

type Mode = 'walk' | 'drive';
type Target = { id: string } & GeoPoint;

const TIMEOUT_MS = 8000;
const VALHALLA = 'https://valhalla1.openstreetmap.de';
const OSRM = {
  walk: ['https://routing.openstreetmap.de/routed-foot/route/v1/driving/'],
  drive: [
    'https://routing.openstreetmap.de/routed-car/route/v1/driving/',
    'https://router.project-osrm.org/route/v1/driving/'
  ]
};
const OSRM_WALK_TABLE = 'https://routing.openstreetmap.de/routed-foot/table/v1/driving/';
/** Targets per matrix request (the free servers' and Google's limits are above it). */
const BATCH = 25;

/** GET a JSON with a time limit (a slow server must not hold the screen). */
async function getJson<T>(url: string): Promise<T | null> {
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: timeout.signal });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Google's and Valhalla's way of writing a line: "encoded polyline", 5 (Google) or 6 (Valhalla) decimals. */
export function decodePolyline(encoded: string, precision = 6): [number, number][] {
  const factor = 10 ** precision;
  const out: [number, number][] = [];
  let i = 0;
  let lat = 0;
  let lon = 0;
  const next = () => {
    let result = 0;
    let shift = 0;
    let b: number;
    do {
      b = encoded.charCodeAt(i++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (i < encoded.length) {
    lat += next();
    lon += next();
    out.push([lat / factor, lon / factor]);
  }
  return out;
}

const finite = (...n: unknown[]) => n.every((x) => typeof x === 'number' && Number.isFinite(x));
const loc = (p: GeoPoint) => ({ lat: +p.lat.toFixed(6), lon: +p.lon.toFixed(6) });
const valhallaUrl = (action: string, req: unknown) =>
  `${VALHALLA}/${action}?json=${encodeURIComponent(JSON.stringify(req))}`;

/** Valhalla: on foot ("pedestrian") or by car ("auto"). GET with ?json= (no preflight), as the OpenStreetMap site does. */
async function valhallaRoute(from: GeoPoint, to: GeoPoint, mode: Mode): Promise<FreeRoute | null> {
  const data = await getJson<{
    trip?: { status?: number; summary?: { length?: number; time?: number }; legs?: { shape?: string }[] };
  }>(
    valhallaUrl('route', {
      locations: [
        { ...loc(from), type: 'break' },
        { ...loc(to), type: 'break' }
      ],
      costing: mode === 'walk' ? 'pedestrian' : 'auto',
      units: 'kilometers',
      directions_type: 'none'
    })
  );
  const trip = data?.trip;
  const km = trip?.summary?.length;
  const seconds = trip?.summary?.time;
  if (!trip || (trip.status ?? 0) !== 0 || !finite(km, seconds)) return null;
  const path = (trip.legs ?? []).flatMap((l) => (l.shape ? decodePolyline(l.shape, 6) : []));
  return { meters: (km as number) * 1000, seconds: seconds as number, path, provider: 'valhalla' };
}

async function osrmRoute(base: string, from: GeoPoint, to: GeoPoint): Promise<FreeRoute | null> {
  const coords = `${from.lon.toFixed(6)},${from.lat.toFixed(6)};${to.lon.toFixed(6)},${to.lat.toFixed(6)}`;
  const data = await getJson<{
    code?: string;
    routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[];
  }>(`${base}${coords}?overview=full&geometries=geojson&alternatives=false&steps=false`);
  const r = data?.code === 'Ok' ? data.routes?.[0] : undefined;
  if (!r || !finite(r.distance, r.duration)) return null;
  return {
    meters: r.distance,
    seconds: r.duration,
    path: (r.geometry?.coordinates ?? []).map(([lon, lat]) => [lat, lon] as [number, number]),
    provider: 'osrm'
  };
}

/** The free route on foot or by car: Valhalla, then OSRM. */
async function freeRoute(from: GeoPoint, to: GeoPoint, mode: Mode): Promise<FreeRoute | null> {
  const first = await valhallaRoute(from, to, mode);
  if (first) return first;
  for (const base of OSRM[mode]) {
    const other = await osrmRoute(base, from, to);
    if (other) return other;
  }
  return null;
}

/** On foot from the home to many jobs in one request: Valhalla's matrix, then OSRM's table. Metres, null if unknown. */
async function freeWalkMatrix(home: GeoPoint, targets: GeoPoint[]): Promise<(number | null)[] | null> {
  type Cell = { distance?: number | null; to_index?: number } | null;
  const data = await getJson<{ sources_to_targets?: (Cell | Cell[])[] }>(
    valhallaUrl('sources_to_targets', {
      sources: [loc(home)],
      targets: targets.map(loc),
      costing: 'pedestrian',
      units: 'kilometers'
    })
  );
  const rows = data?.sources_to_targets;
  if (Array.isArray(rows) && rows.length) {
    // One row per source (older answers), or the cells of all sources in a single list (newer ones).
    const cells = (Array.isArray(rows[0]) ? rows[0] : rows) as Cell[];
    const out: (number | null)[] = targets.map(() => null);
    cells.forEach((c, i) => {
      const at = typeof c?.to_index === 'number' ? c.to_index : i;
      if (c && finite(c.distance) && at >= 0 && at < out.length) out[at] = (c.distance as number) * 1000;
    });
    if (out.some((m) => m !== null)) return out;
  }
  const coords = [home, ...targets].map((p) => `${p.lon.toFixed(6)},${p.lat.toFixed(6)}`).join(';');
  const table = await getJson<{ code?: string; distances?: (number | null)[][] }>(
    `${OSRM_WALK_TABLE}${coords}?sources=0&annotations=distance`
  );
  const row = table?.code === 'Ok' ? table.distances?.[0] : undefined;
  if (!row) return null;
  return targets.map((_, i) => (finite(row[i + 1]) ? (row[i + 1] as number) : null));
}

// ---- the distance on foot: one number per home and job, kept on the phone ----

const STORE_KEY = 'valorjob:distancia-a-pe-v1';
const KEEP_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_KEPT = 400;
const FAILED_MS = 60 * 1000;

interface Kept {
  m: number;
  p: RouteProvider;
  t?: string;
  at: number;
}

const pointKey = (p: GeoPoint) => `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`;
/** Google's and the free servers' numbers are never mixed: switching Google on asks again. */
const walkKey = (google: boolean, home: GeoPoint, job: GeoPoint) =>
  `${google ? 'g' : 'f'}|${pointKey(home)}>${pointKey(job)}`;

let kept: Map<string, Kept> | null = null;
const failed = new Map<string, number>();

function keptMap(): Map<string, Kept> {
  if (kept) return kept;
  kept = new Map();
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}') as Record<string, Kept>;
    const now = Date.now();
    for (const [k, v] of Object.entries(raw)) if (v && finite(v.m, v.at) && now - v.at < KEEP_MS) kept.set(k, v);
  } catch {
    // private window or no storage: kept for the session only
  }
  return kept;
}

function keep(key: string, d: WalkDistance): void {
  const map = keptMap();
  map.set(key, { m: Math.round(d.meters), p: d.provider, ...(d.text ? { t: d.text } : {}), at: Date.now() });
  if (map.size > MAX_KEPT) {
    const oldest = [...map.entries()].sort((a, b) => a[1].at - b[1].at).slice(0, map.size - MAX_KEPT);
    for (const [k] of oldest) map.delete(k);
  }
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(Object.fromEntries(map)));
  } catch {
    // full or blocked: kept in memory
  }
}

function known(key: string): WalkDistance | null {
  const k = keptMap().get(key);
  return k ? { meters: k.m, provider: k.p, ...(k.t ? { text: k.t } : {}) } : null;
}

/** The distance on foot already known for this home and job (no request), or null. */
export function knownWalkDistance(
  job: GeoPoint,
  home: GeoPoint,
  google: boolean = FEATURES.googleMaps && !IS_DEMO
): WalkDistance | null {
  return known(walkKey(google, home, job));
}

// Cards ask one by one as they show; their questions are gathered for a moment and sent together.
type Ask = { key: string; job: Target; done: (d: WalkDistance | null) => void };
const asking = new Map<string, Promise<WalkDistance | null>>();
const groups = new Map<string, { home: GeoPoint; google: boolean; asks: Ask[] }>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * The distance on foot from the home to the job — the card's and the job page's number. Known: at once. Otherwise
 * asked together with the other cards on the screen (one request), then kept. null when nothing answers.
 */
export function walkDistance(
  job: Target,
  home: GeoPoint,
  google: boolean = FEATURES.googleMaps && !IS_DEMO
): Promise<WalkDistance | null> {
  const key = walkKey(google, home, job);
  const hit = known(key);
  if (hit) return Promise.resolve(hit);
  if ((failed.get(key) ?? 0) > Date.now()) return Promise.resolve(null);
  const going = asking.get(key);
  if (going) return going;
  const p = new Promise<WalkDistance | null>((done) => {
    const groupKey = `${google ? 'g' : 'f'}|${pointKey(home)}`;
    const group = groups.get(groupKey) ?? { home, google, asks: [] };
    group.asks.push({ key, job, done });
    groups.set(groupKey, group);
    flushTimer ??= setTimeout(flush, 40);
  });
  asking.set(key, p);
  p.then((d) => {
    asking.delete(key);
    if (!d) failed.set(key, Date.now() + FAILED_MS);
  });
  return p;
}

function flush(): void {
  flushTimer = null;
  const all = [...groups.values()];
  groups.clear();
  for (const group of all)
    for (let i = 0; i < group.asks.length; i += BATCH) void answer(group, group.asks.slice(i, i + BATCH));
}

async function answer(group: { home: GeoPoint; google: boolean }, asks: Ask[]): Promise<void> {
  const found = new Map<string, WalkDistance>();
  try {
    if (group.google) {
      const byJob = await googleWalkDistances(asks.map((a) => a.job.id));
      for (const a of asks) if (byJob?.[a.job.id]) found.set(a.key, byJob[a.job.id]);
    } else {
      const meters = await freeWalkMatrix(
        group.home,
        asks.map((a) => a.job)
      );
      asks.forEach((a, i) => {
        const m = meters?.[i];
        if (typeof m === 'number') found.set(a.key, { meters: m, provider: 'valhalla' });
      });
      // The matrix out: one route at a time (two at once, to spare the free servers). A matrix that answered is
      // trusted — a job it found no way to stays without one.
      const rest = meters ? [] : asks;
      for (let i = 0; i < rest.length; i += 2)
        await Promise.all(
          rest.slice(i, i + 2).map(async (a) => {
            const r = await freeRoute(group.home, a.job, 'walk');
            if (r) found.set(a.key, { meters: r.meters, provider: r.provider });
          })
        );
    }
  } catch {
    // whatever was found is kept; the rest falls back to the straight line
  }
  for (const a of asks) {
    const d = found.get(a.key) ?? null;
    if (d) keep(a.key, d);
    a.done(d);
  }
}

// ---- the job's page: the distance on foot (the same number as the card), its way on the map, the time by car ----

const routes = new Map<string, { until: number; route: Promise<JobRoute | null> }>();
const PAGE_TTL_MS = 5 * 60 * 1000;

/**
 * The route the job's page shows, from the worker's home (the address saved in the profile): Google's, when configured
 * and shown on Google's map (`google`), from the two addresses as Google Maps reads them; otherwise the free servers'.
 * The distance is always the one already kept for the card, when there is one — the two never disagree.
 */
export async function routeToJob(
  job: Target,
  home: GeoPoint,
  signal?: AbortSignal,
  google: boolean = FEATURES.googleMaps && !IS_DEMO
): Promise<JobRoute | null> {
  const key = walkKey(google, home, job);
  const hit = routes.get(key);
  let pending = hit && hit.until > Date.now() ? hit.route : null;
  if (!pending) {
    pending = loadRoute(job, home, google, key);
    const entry = { until: Date.now() + PAGE_TTL_MS, route: pending };
    routes.set(key, entry);
    pending.then(
      (r) => {
        if (!r) entry.until = Date.now() + FAILED_MS;
      },
      () => routes.delete(key)
    );
  }
  const r = await pending;
  return signal?.aborted ? null : r;
}

async function loadRoute(job: Target, home: GeoPoint, google: boolean, key: string): Promise<JobRoute | null> {
  if (google) {
    const g = await googleRoute(job.id);
    if (g) {
      const kept = known(key);
      if (!kept) keep(key, g.walk);
      return { ...g, walk: kept ?? g.walk };
    }
  }
  const [walk, drive] = await Promise.all([freeRoute(home, job, 'walk'), freeRoute(home, job, 'drive')]);
  const kept = known(walkKey(false, home, job));
  const distance = kept ?? (walk ? { meters: walk.meters, provider: walk.provider } : null);
  if (!distance) return null;
  if (!kept) keep(walkKey(false, home, job), distance);
  return { walk: distance, path: walk?.path ?? [], driveSeconds: drive ? drive.seconds : null };
}

/** For the tests: forget every distance and route. */
export function forgetRoutes(): void {
  routes.clear();
  asking.clear();
  failed.clear();
  groups.clear();
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;
  kept = new Map();
  try {
    localStorage.removeItem(STORE_KEY);
  } catch {
    // nothing kept
  }
}

// ---- how they read ----

/** How Google Maps writes a distance: "650 m", "3,2 km", "12 km", "142 km". */
export function formatRoadKm(meters: number): string {
  if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)} m`;
  const km = meters / 1000;
  return km < 100 ? `${km.toFixed(1).replace('.', ',')} km`.replace(',0 km', ' km') : `${Math.round(km)} km`;
}

/** How Google Maps writes a time in Portuguese: "9 min", "1 h 5 min", "2 h". */
export function formatDriveTime(seconds: number): string {
  const min = Math.max(1, Math.round(seconds / 60));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** The distance on foot as it reads on the card and on the job's page: Google's own words when Google answered. */
export const walkText = (d: WalkDistance) => d.text || formatRoadKm(d.meters);
/** The time by car as it reads on the job's page; null when unknown. */
export const driveText = (r: JobRoute) =>
  r.driveText || (r.driveSeconds == null ? null : formatDriveTime(r.driveSeconds));
