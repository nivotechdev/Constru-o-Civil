import { CIDADES_RAW } from '../data/cidades.js';

// City picker helpers over the full list of Brazilian municipalities. A city is
// { name, uf, lat, lon, label: "Name, UF", key } with `key` accent/case-free for search.

let cache = null;
const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function all() {
  if (!cache) {
    cache = CIDADES_RAW.split('\n').map((line) => {
      const [name, uf, lat, lon] = line.split('|');
      return { name, uf, lat: Number(lat), lon: Number(lon), label: `${name}, ${uf}`, key: fold(`${name} ${uf}`) };
    });
  }
  return cache;
}

/** The biggest cities, for the picker before anything is typed. */
export function popularCities(limit = 8) {
  return all().slice(0, limit);
}

/**
 * Cities matching what was typed, ignoring accents and case. Names starting with the
 * query come first, then any word starting with it, then anywhere; ties keep the list's
 * population order. "campinas sp" / "campinas, sp" also narrows by state.
 */
export function searchCities(query, limit = 8) {
  const q = fold(query.replace(/,/g, ' ')).replace(/\s+/g, ' ').trim();
  if (!q) return popularCities(limit);
  const starts = [], word = [], any = [];
  for (const c of all()) {
    if (c.key.startsWith(q)) starts.push(c);
    else if (c.key.includes(' ' + q)) word.push(c);
    else if (c.key.includes(q)) any.push(c);
    if (starts.length >= limit) break;
  }
  return starts.concat(word, any).slice(0, limit);
}

/** The municipality closest to a GPS position (straight-line distance). */
export function nearestCity(lat, lon) {
  const rad = Math.PI / 180;
  let best = null, bestD = Infinity;
  for (const c of all()) {
    const dLat = (c.lat - lat) * rad;
    const dLon = (c.lon - lon) * rad * Math.cos(lat * rad);
    const d = dLat * dLat + dLon * dLon;
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}
