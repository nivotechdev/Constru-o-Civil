// U76: Google's route from the worker's home to a job, by the Edge Function calcular-rota — it reads the two
// addresses on the server (the worker's own and the job's), asks Google's Routes API with them as text and keeps the
// key. Any refusal or failure is null: the screen uses the free route servers instead (services/route.ts).
import type { GeoPoint } from '../../types/models';
import type { DrivingRoute } from '../route';
import { invokeFunction } from './client';

/** What calcular-rota answers. */
interface GoogleRouteAnswer {
  metros?: number;
  segundos?: number;
  texto_distancia?: string;
  texto_tempo?: string;
  caminho?: [number, number][];
  origem?: GeoPoint | null;
  destino?: GeoPoint | null;
}

const isPoint = (p: unknown): p is GeoPoint =>
  Boolean(p) &&
  Number.isFinite((p as GeoPoint).lat) &&
  Number.isFinite((p as GeoPoint).lon) &&
  Math.abs((p as GeoPoint).lat) <= 90 &&
  Math.abs((p as GeoPoint).lon) <= 180;

export async function googleRoute(jobId: string): Promise<DrivingRoute | null> {
  let a: GoogleRouteAnswer;
  try {
    a = await invokeFunction<GoogleRouteAnswer>('calcular-rota', { job_id: jobId });
  } catch {
    return null;
  }
  if (!a || !Number.isFinite(a.metros) || !Number.isFinite(a.segundos)) return null;
  const path = Array.isArray(a.caminho)
    ? a.caminho.filter((p) => Array.isArray(p) && isPoint({ lat: p[0], lon: p[1] }))
    : [];
  return {
    meters: a.metros as number,
    seconds: a.segundos as number,
    path,
    provider: 'google',
    ...(isPoint(a.origem) ? { from: { lat: a.origem.lat, lon: a.origem.lon } } : {}),
    ...(isPoint(a.destino) ? { to: { lat: a.destino.lat, lon: a.destino.lon } } : {}),
    ...(typeof a.texto_distancia === 'string' && a.texto_distancia ? { distanceText: a.texto_distancia } : {}),
    ...(typeof a.texto_tempo === 'string' && a.texto_tempo ? { durationText: a.texto_tempo } : {})
  };
}
