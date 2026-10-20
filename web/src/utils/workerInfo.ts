import type { GeoPoint, Worker } from '../types/models';
import { distanceKm, formatKm } from './geo';

/** "Tatuapé, SP" or "Campinas, SP" — where a worker is based, as shown on cards. */
export function workerPlace(w: Pick<Worker, 'city' | 'neighborhood'>): string {
  const uf = w.city.split(',')[1]?.trim();
  return w.neighborhood && uf ? `${w.neighborhood}, ${uf}` : w.city;
}

/** "3,2 km" from the worker's base to a point (a job's address). */
export function workerDistance(w: Pick<Worker, 'lat' | 'lon'>, to: GeoPoint): string {
  return formatKm(distanceKm(w, to));
}
