// U54: "Abrir no Google Maps" — the route from the worker to the job (the app opens on phones that have it), or the place.
import type { GeoPoint } from '../types/models';

const pair = (p: GeoPoint) => `${p.lat.toFixed(6)},${p.lon.toFixed(6)}`;

export function mapOpenUrl(job: GeoPoint, origin: GeoPoint | null): string {
  return origin
    ? `https://www.google.com/maps/dir/?api=1&origin=${pair(origin)}&destination=${pair(job)}&travelmode=driving`
    : `https://www.google.com/maps/search/?api=1&query=${pair(job)}`;
}
