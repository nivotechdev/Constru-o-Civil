// U54/U76: the drive from the worker's home to the job — its real length and time, the way Google Maps gives them.
//   * With Google configured (FEATURES.googleMaps): Google's own route (Routes API, through the Edge Function
//     calcular-rota, which keeps the key): the two ADDRESSES go as text, so Google places them exactly where Google
//     Maps does, and the time counts the traffic of now — the same numbers as opening the route in Google Maps.
//   * Otherwise, free and with no key: Valhalla (FOSSGIS), then OSRM (FOSSGIS, then the project's demo server).
//     Valhalla counts turns, crossings and traffic lights, so its time is closer to Google's than OSRM's free-flow
//     time; neither knows the traffic.
// The free servers get only two coordinates (no name, no account). Answers are kept for the session; any failure
// resolves to null and the screen falls back to the straight line. docs/DECISOES.md › U76.
import type { GeoPoint } from '../types/models';
import { FEATURES } from './features';
import { IS_DEMO } from './mode';
import { googleRoute } from './remote/route';

export type RouteProvider = 'google' | 'valhalla' | 'osrm';

export type DrivingRoute = {
  meters: number;
  seconds: number;
  /** The road, as [lat, lon] points. */
  path: [number, number][];
  provider: RouteProvider;
  /** Where the route starts and ends (Google: the points it found for the two addresses). */
  from?: GeoPoint;
  to?: GeoPoint;
  /** Google's own words for the distance and the time ("3,2 km", "12 min"), when Google answered. */
  distanceText?: string;
  durationText?: string;
};

const TIMEOUT_MS = 7000;
/** A free route doesn't change during the session; Google's time follows the traffic, so it is asked again. */
const FREE_TTL_MS = 6 * 60 * 60 * 1000;
const GOOGLE_TTL_MS = 5 * 60 * 1000;
const FAILED_TTL_MS = 60 * 1000;

const OSRM_SERVERS = [
  'https://routing.openstreetmap.de/routed-car/route/v1/driving/',
  'https://router.project-osrm.org/route/v1/driving/'
];
const VALHALLA = 'https://valhalla1.openstreetmap.de/route';

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

async function valhalla(from: GeoPoint, to: GeoPoint): Promise<DrivingRoute | null> {
  const req = {
    locations: [
      { lat: +from.lat.toFixed(6), lon: +from.lon.toFixed(6), type: 'break' },
      { lat: +to.lat.toFixed(6), lon: +to.lon.toFixed(6), type: 'break' }
    ],
    costing: 'auto',
    units: 'kilometers',
    directions_type: 'none'
  };
  // GET (no preflight): the body goes in ?json=, as the OpenStreetMap site does.
  const data = await getJson<{
    trip?: { status?: number; summary?: { length?: number; time?: number }; legs?: { shape?: string }[] };
  }>(`${VALHALLA}?json=${encodeURIComponent(JSON.stringify(req))}`);
  const trip = data?.trip;
  const km = trip?.summary?.length;
  const seconds = trip?.summary?.time;
  if (!trip || (trip.status ?? 0) !== 0 || !finite(km, seconds)) return null;
  const path = (trip.legs ?? []).flatMap((l) => (l.shape ? decodePolyline(l.shape, 6) : []));
  return { meters: (km as number) * 1000, seconds: seconds as number, path, provider: 'valhalla' };
}

async function osrm(base: string, from: GeoPoint, to: GeoPoint): Promise<DrivingRoute | null> {
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

const cache = new Map<string, { until: number; route: Promise<DrivingRoute | null> }>();

/** One request per key while its answer is fresh (two screens asking the same route share it). */
function remembered(key: string, ttl: number, load: () => Promise<DrivingRoute | null>): Promise<DrivingRoute | null> {
  const hit = cache.get(key);
  if (hit && hit.until > Date.now()) return hit.route;
  const route = load();
  const entry = { until: Date.now() + ttl, route };
  cache.set(key, entry);
  route.then(
    (r) => {
      if (!r) entry.until = Math.min(entry.until, Date.now() + FAILED_TTL_MS);
    },
    () => cache.delete(key)
  );
  return route;
}

const pointKey = (p: GeoPoint) => `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`;

/**
 * The drive between two points by the free servers (Valhalla, then OSRM); null when none answers. A screen that
 * gives up (`signal`) gets null; the request itself goes on and its answer is kept for the next screen.
 */
export async function drivingRoute(from: GeoPoint, to: GeoPoint, signal?: AbortSignal): Promise<DrivingRoute | null> {
  const r = await remembered(`free:${pointKey(from)}>${pointKey(to)}`, FREE_TTL_MS, async () => {
    const first = await valhalla(from, to);
    if (first) return first;
    for (const base of OSRM_SERVERS) {
      const other = await osrm(base, from, to);
      if (other) return other;
    }
    return null;
  });
  return signal?.aborted ? null : r;
}

/**
 * The drive from the worker's home (the address saved in the profile) to the job: Google's, when configured and
 * shown on Google's map (`google`), from the two addresses as Google Maps reads them; otherwise the free servers'.
 */
export async function routeToJob(
  job: { id: string } & GeoPoint,
  home: GeoPoint,
  signal?: AbortSignal,
  google: boolean = FEATURES.googleMaps
): Promise<DrivingRoute | null> {
  if (google && !IS_DEMO) {
    const google = await remembered(`google:${job.id}:${pointKey(home)}`, GOOGLE_TTL_MS, () => googleRoute(job.id));
    if (signal?.aborted) return null;
    if (google) return google;
  }
  return drivingRoute(home, job, signal);
}

/** For the tests: forget the routes already asked. */
export function forgetRoutes(): void {
  cache.clear();
}

/** How Google Maps writes a road distance: "650 m", "3,2 km", "12 km", "142 km". */
export function formatRoadKm(meters: number): string {
  if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)} m`;
  const km = meters / 1000;
  return km < 100 ? `${km.toFixed(1).replace('.', ',')} km`.replace(',0 km', ' km') : `${Math.round(km)} km`;
}

/** How Google Maps writes a drive's time in Portuguese: "9 min", "1 h 5 min", "2 h". */
export function formatDriveTime(seconds: number): string {
  const min = Math.max(1, Math.round(seconds / 60));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** The distance as it reads on the screen: Google's own words when Google answered. */
export const routeDistanceText = (r: DrivingRoute) => r.distanceText || formatRoadKm(r.meters);
/** The time as it reads on the screen: Google's own words when Google answered. */
export const routeTimeText = (r: DrivingRoute) => r.durationText || formatDriveTime(r.seconds);
