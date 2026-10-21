// U53: the Google Maps addresses for the job map (JobMap): the embed (no key needed) and "Abrir no Google Maps".
import type { GeoPoint } from '../types/models';

const pair = (p: GeoPoint) => `${p.lat.toFixed(6)},${p.lon.toFixed(6)}`;

/** The embed: the route from the worker to the job, or just the job's pin. */
export function mapEmbedUrl(job: GeoPoint, origin: GeoPoint | null): string {
  return origin
    ? `https://maps.google.com/maps?saddr=${pair(origin)}&daddr=${pair(job)}&hl=pt-BR&output=embed`
    : `https://maps.google.com/maps?q=${pair(job)}&z=15&hl=pt-BR&output=embed`;
}

/** "Abrir no Google Maps": the route (the app opens on phones that have it), or the place. */
export function mapOpenUrl(job: GeoPoint, origin: GeoPoint | null): string {
  return origin
    ? `https://www.google.com/maps/dir/?api=1&origin=${pair(origin)}&destination=${pair(job)}`
    : `https://www.google.com/maps/search/?api=1&query=${pair(job)}`;
}
