// City picker helpers over the full list of Brazilian municipalities. A city is
// { name, uf, lat, lon, label: "Name, UF", key } with `key` accent/case-free for search.
import { CIDADES_RAW } from '../data/cidades';
import type { City, GeoPoint } from '../types/models';

export { DEFAULT_CITY } from './defaults';

let cache: City[] | null = null;
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function all(): City[] {
  if (!cache) {
    cache = CIDADES_RAW.split('\n').map((line) => {
      const [name, uf, lat, lon] = line.split('|');
      return { name, uf, lat: Number(lat), lon: Number(lon), label: `${name}, ${uf}`, key: fold(`${name} ${uf}`) };
    });
  }
  return cache;
}

/** The biggest cities, for the picker before anything is typed. */
export function popularCities(limit = 8): City[] {
  return all().slice(0, limit);
}

/**
 * Cities matching what was typed, ignoring accents and case. Names starting with the
 * query come first, then any word starting with it, then anywhere; ties keep the list's
 * population order. "campinas sp" / "campinas, sp" also narrows by state.
 */
export function searchCities(query: string, limit = 8): City[] {
  const q = fold(query.replace(/,/g, ' ')).replace(/\s+/g, ' ').trim();
  if (!q) return popularCities(limit);
  const starts: City[] = [];
  const word: City[] = [];
  const any: City[] = [];
  for (const c of all()) {
    if (c.key.startsWith(q)) starts.push(c);
    else if (c.key.includes(' ' + q)) word.push(c);
    else if (c.key.includes(q)) any.push(c);
    if (starts.length >= limit) break;
  }
  return starts.concat(word, any).slice(0, limit);
}

/** The municipality closest to a GPS position (straight-line distance). */
export function nearestCity(lat: number, lon: number): City | null {
  const rad = Math.PI / 180;
  let best: City | null = null;
  let bestD = Infinity;
  for (const c of all()) {
    const dLat = (c.lat - lat) * rad;
    const dLon = (c.lon - lon) * rad * Math.cos(lat * rad);
    const d = dLat * dLat + dLon * dLon;
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

/** The municipality with that label ("São Paulo, SP"), if it exists. */
/** U13: the label of a saved place when it is a real municipality ("Caxias do Sul, RS"), else null. */
export function knownCity(label: string | null | undefined): string | null {
  return label ? (cityByLabel(label)?.label ?? null) : null;
}

export function cityByLabel(label: string): City | null {
  const key = fold(label.replace(/,/g, ' ')).replace(/\s+/g, ' ').trim();
  return all().find((c) => c.key === key) ?? null;
}

/**
 * U67: the city the phone is in — the nearest Brazilian municipality to the GPS position (only the city is kept; the
 * position itself is returned for the mural's distances and never saved). 'denied': the browser said no.
 */
export function locateMyCity(): Promise<{ label: string; point: GeoPoint } | 'denied' | 'error'> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve('error');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = nearestCity(pos.coords.latitude, pos.coords.longitude);
        resolve(c ? { label: c.label, point: { lat: pos.coords.latitude, lon: pos.coords.longitude } } : 'error');
      },
      (err) => resolve(err && err.code === 1 ? 'denied' : 'error'),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
    );
  });
}
