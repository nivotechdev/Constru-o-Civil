// U54: the driving route between two points (OSRM, free, no key) — the same kind of number Google Maps shows
// ("3,2 km · 9 min"), not the straight line. Called from the browser, like the address providers; it sends only two
// coordinates (no name, no account). Any failure resolves to null and the screen falls back to the straight line.
import type { GeoPoint } from '../types/models';

export type DrivingRoute = { meters: number; seconds: number; path: [number, number][] };

const URL_BASE = 'https://router.project-osrm.org/route/v1/driving/';

export async function drivingRoute(from: GeoPoint, to: GeoPoint, signal?: AbortSignal): Promise<DrivingRoute | null> {
  const coords = `${from.lon.toFixed(6)},${from.lat.toFixed(6)};${to.lon.toFixed(6)},${to.lat.toFixed(6)}`;
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), 9000);
  signal?.addEventListener('abort', () => timeout.abort(), { once: true });
  try {
    const res = await fetch(`${URL_BASE}${coords}?overview=full&geometries=geojson`, { signal: timeout.signal });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      code?: string;
      routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[];
    };
    const r = data.code === 'Ok' ? data.routes?.[0] : undefined;
    if (!r || !Number.isFinite(r.distance)) return null;
    return {
      meters: r.distance,
      seconds: r.duration,
      path: r.geometry.coordinates.map(([lon, lat]) => [lat, lon] as [number, number])
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** How Google Maps writes a road distance: "650 m", "3,2 km", "12 km". */
export function formatRoadKm(meters: number): string {
  if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)} m`;
  const km = meters / 1000;
  return km < 100 ? `${km.toFixed(1).replace('.', ',')} km`.replace(',0 km', ' km') : `${Math.round(km)} km`;
}

/** "9 min", "1 h 05 min". */
export function formatDriveTime(seconds: number): string {
  const min = Math.max(1, Math.round(seconds / 60));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${String(m).padStart(2, '0')} min` : `${h} h`;
}
