// U76/U80: Google's numbers from the worker's home to jobs, by the Edge Function calcular-rota — it reads the
// addresses on the server (the worker's own and the jobs'), asks Google's Routes API with them as text and keeps the
// key. Only job ids go from here. Any refusal or failure is null: the screen uses the free servers (services/route.ts).
import type { GeoPoint } from '../../types/models';
import type { JobRoute, WalkDistance } from '../route';
import { invokeFunction } from './client';

/** What calcular-rota answers for one job: the way on foot and the time by car. */
interface GoogleRouteAnswer {
  metros?: number;
  texto_distancia?: string | null;
  caminho?: [number, number][];
  origem?: GeoPoint | null;
  destino?: GeoPoint | null;
  carro_segundos?: number | null;
  carro_texto?: string | null;
}

/** What it answers for many jobs (the mural's cards): the distance on foot of each. */
interface GoogleDistancesAnswer {
  distancias?: Record<string, { metros?: number; texto?: string | null } | null>;
}

const isPoint = (p: unknown): p is GeoPoint =>
  Boolean(p) &&
  Number.isFinite((p as GeoPoint).lat) &&
  Number.isFinite((p as GeoPoint).lon) &&
  Math.abs((p as GeoPoint).lat) <= 90 &&
  Math.abs((p as GeoPoint).lon) <= 180;

const text = (t: unknown) => (typeof t === 'string' && t.trim() ? t.trim() : undefined);

/** The job's page: on foot (distance, way, ends) and by car (time). */
export async function googleRoute(jobId: string): Promise<JobRoute | null> {
  let a: GoogleRouteAnswer;
  try {
    a = await invokeFunction<GoogleRouteAnswer>('calcular-rota', { job_id: jobId });
  } catch {
    return null;
  }
  if (!a || !Number.isFinite(a.metros)) return null;
  const path = Array.isArray(a.caminho)
    ? a.caminho.filter((p) => Array.isArray(p) && isPoint({ lat: p[0], lon: p[1] }))
    : [];
  const distanceText = text(a.texto_distancia);
  const carText = text(a.carro_texto);
  return {
    walk: { meters: a.metros as number, provider: 'google', ...(distanceText ? { text: distanceText } : {}) },
    path,
    ...(isPoint(a.origem) ? { from: { lat: a.origem.lat, lon: a.origem.lon } } : {}),
    ...(isPoint(a.destino) ? { to: { lat: a.destino.lat, lon: a.destino.lon } } : {}),
    driveSeconds: Number.isFinite(a.carro_segundos) ? (a.carro_segundos as number) : null,
    ...(carText ? { driveText: carText } : {})
  };
}

/** The mural's cards: the distance on foot to each job, in one request. null when the function refuses. */
export async function googleWalkDistances(jobIds: string[]): Promise<Record<string, WalkDistance> | null> {
  let a: GoogleDistancesAnswer;
  try {
    a = await invokeFunction<GoogleDistancesAnswer>('calcular-rota', { job_ids: jobIds });
  } catch {
    return null;
  }
  const out: Record<string, WalkDistance> = {};
  for (const id of jobIds) {
    const d = a?.distancias?.[id];
    if (!d || !Number.isFinite(d.metros)) continue;
    const t = text(d.texto);
    out[id] = { meters: d.metros as number, provider: 'google', ...(t ? { text: t } : {}) };
  }
  return out;
}
