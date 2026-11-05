// U80: "A 1,2 km da sua casa" — the distance ON FOOT from the worker's saved address to a job, the same number on the
// mural's card and on the job's page (services/route.ts keeps one per home and job). Known: at once; otherwise asked
// with the other cards on the screen. Until it comes the card shows the neighbourhood; if no server answers, the
// straight line, said as "cerca de".
import { useEffect, useState } from 'react';
import type { GeoPoint } from '../types/models';
import { knownWalkDistance, walkDistance, walkText, formatRoadKm, type WalkDistance } from '../services/route';
import { myAddress } from '../services/selectors';
import { distanceKm } from '../utils/geo';
import { useDb } from './useStore';

export interface HomeDistance {
  /** "1,2 km" (on foot) or "cerca de 1,1 km" (straight line, when no route answered); null while unknown. */
  text: string | null;
  /** True when the number is the route on foot (not the straight line). */
  onFoot: boolean;
}

/** The point of a job, when it has one. */
function jobPoint(job: { address: Partial<GeoPoint> }): GeoPoint | null {
  const { lat, lon } = job.address;
  return typeof lat === 'number' && typeof lon === 'number' && (lat || lon) ? { lat, lon } : null;
}

export function useHomeDistance(job: { id: string; address: Partial<GeoPoint> }): HomeDistance {
  const home = myAddress(useDb());
  const point = jobPoint(job);
  const key = home && point ? `${home.lat},${home.lon}>${point.lat},${point.lon}` : '';
  // Only an answer that came back is kept here; a distance already known is read straight from the shared store.
  const [answer, setAnswer] = useState<{ key: string; d: WalkDistance | null } | null>(null);

  useEffect(() => {
    if (!home || !point || knownWalkDistance(point, home)) return;
    let live = true;
    walkDistance({ id: job.id, ...point }, home).then((d) => live && setAnswer({ key, d }));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, job.id]);

  if (!home || !point) return { text: null, onFoot: false };
  const d = knownWalkDistance(point, home) ?? (answer?.key === key ? answer.d : undefined);
  if (d) return { text: walkText(d), onFoot: true };
  if (d === null) return { text: `cerca de ${formatRoadKm(distanceKm(home, point) * 1000)}`, onFoot: false };
  return { text: null, onFoot: false };
}
