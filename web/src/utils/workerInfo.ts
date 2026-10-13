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

const AVAILABILITY = { semana: 'Dias de semana', fimdesemana: 'Fins de semana', qualquer: 'Qualquer dia' } as const;

/** F10: what the company reads about the worker, built from the professional profile. */
export function workerFacts(
  w: Pick<Worker, 'availability' | 'yearsExperience' | 'desiredPay' | 'travelKm' | 'jobsDone'>
): string[] {
  return [
    w.yearsExperience != null
      ? w.yearsExperience === 0
        ? 'Começando na profissão'
        : `${w.yearsExperience} ${w.yearsExperience === 1 ? 'ano' : 'anos'} de experiência`
      : null,
    w.availability ? `Disponível: ${AVAILABILITY[w.availability].toLowerCase()}` : null,
    w.desiredPay ? `Diária a partir de R$ ${w.desiredPay.toLocaleString('pt-BR')}` : null,
    w.travelKm ? `Vai até ${w.travelKm} km de casa` : null,
    w.jobsDone ? `${w.jobsDone} ${w.jobsDone === 1 ? 'bico concluído' : 'bicos concluídos'} na Bicos` : null
  ].filter((f): f is string => Boolean(f));
}

export const AVAILABILITY_OPTIONS = Object.entries(AVAILABILITY).map(([id, label]) => ({
  id: id as keyof typeof AVAILABILITY,
  label
}));
