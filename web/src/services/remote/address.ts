// Addresses with the real backend — free public services that answer the browser directly (CORS), no key:
//   * CEP → street, neighbourhood, city: BrasilAPI (often with the CEP's point), then ViaCEP;
//   * street suggestions while typing: ViaCEP's search by address (the Correios' own data, each street with its CEP),
//     then the map's streets (Photon, OpenStreetMap) when ViaCEP doesn't answer;
//   * neighbourhood suggestions: Photon (OpenStreetMap), plus the neighbourhoods of the streets already suggested;
//   * the address's point: Nominatim (OpenStreetMap), then Photon, then the CEP's point, then the city's centre.
// U51 (docs/DECISOES.md) explains the choice. Nominatim is called once per saved address (never while typing, as its
// rules ask); every answer is cached for the session. Nothing here is sent anywhere else.
import type { GeoPoint, PlacePrecision } from '../../types/models';
import {
  fold,
  likelySameNeighborhood,
  splitHouseNumber,
  streetKind,
  streetSimilarity,
  streetWords
} from '../../utils/addressText';
import { distanceKm } from '../../utils/geo';
import type { CepResult, GeocodeInput, ResolvedAddress, StreetOption, Suggestions } from '../address';
import { serviceError } from '../errors';

interface BrasilApiCep {
  cep?: string;
  state?: string;
  city?: string;
  neighborhood?: string;
  street?: string;
  location?: { coordinates?: { latitude?: string | number; longitude?: string | number } };
}

interface ViaCep {
  erro?: boolean | string;
  cep?: string;
  logradouro?: string;
  complemento?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
}

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    osm_key?: string;
    osm_value?: string;
    type?: string;
    name?: string;
    street?: string;
    housenumber?: string;
    district?: string;
    locality?: string;
    city?: string;
    postcode?: string;
    countrycode?: string;
  };
}

interface NominatimPlace {
  lat?: string;
  lon?: string;
  name?: string;
  category?: string;
  type?: string;
  addresstype?: string;
  address?: Record<string, string | undefined>;
}

const maskCep = (d: string) => d.slice(0, 5) + '-' + d.slice(5);
/** The map's data is OpenStreetMap's, which asks to be credited where it is shown. */
const OSM_CREDIT = 'Dados © OpenStreetMap';
/** Farther than this from the city's centre is another city's street of the same name. */
const MAX_FROM_CENTRE_KM = 45;
/** U76: a CEP point closer than this to the city's centre may be only the city's point (see lookupCepOnline). */
const CITY_POINT_KM = 2;

function point(lat: unknown, lon: unknown): GeoPoint | null {
  const la = Number(lat);
  const lo = Number(lon);
  return Number.isFinite(la) && Number.isFinite(lo) && la !== 0 && lo !== 0 ? { lat: la, lon: lo } : null;
}

/** GET a JSON with a time limit (a slow provider must not hold the screen). */
async function getJson<T>(url: string, ms = 7000): Promise<{ status: number; body: T | null }> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: ctl.signal });
    if (!res.ok) return { status: res.status, body: null };
    return { status: res.status, body: (await res.json().catch(() => null)) as T | null };
  } finally {
    clearTimeout(timer);
  }
}

const cache = new Map<string, Promise<unknown>>();
/** One request per URL for the session (a failed one is forgotten, so it can be tried again). */
function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key) as Promise<T> | undefined;
  if (hit) return hit;
  const p = load();
  cache.set(key, p);
  p.catch(() => cache.delete(key));
  return p;
}

/** The answer, unless the caller gave up on it (a newer letter was typed): then it rejects. The request itself goes
 * on and stays cached — typing back to the same text answers at once. */
function unlessAborted<T>(p: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return p;
  return new Promise<T>((resolve, reject) => {
    const stop = () => reject(new DOMException('Aborted', 'AbortError'));
    if (signal.aborted) return stop();
    signal.addEventListener('abort', stop, { once: true });
    p.then(resolve, reject).finally(() => signal.removeEventListener('abort', stop));
  });
}

async function cityCentre(label: string): Promise<GeoPoint | null> {
  const { cityByLabel } = await import('../cities');
  const city = cityByLabel(label);
  return city ? { lat: city.lat, lon: city.lon } : null;
}

/** What set_my_address / finish_sign_up take (the server checks it all again). */
export function addressPayload(a: ResolvedAddress) {
  return {
    cep: a.cep,
    street: a.street,
    neighborhood: a.neighborhood,
    city: a.city,
    uf: a.uf,
    lat: a.lat,
    lon: a.lon,
    precision: a.precision
  };
}

/** The CEP's street, neighbourhood, city ("Cidade, UF") and point; `null` when it doesn't exist. */
export async function lookupCepOnline(digits: string): Promise<CepResult | null> {
  let reached = false;
  try {
    const { status, body } = await getJson<BrasilApiCep>(`https://brasilapi.com.br/api/cep/v2/${digits}`);
    reached = true;
    if (body?.city && body.state) {
      const city = `${body.city}, ${body.state}`;
      const coords = body.location?.coordinates;
      const centre = await cityCentre(city);
      const given = point(coords?.latitude, coords?.longitude);
      // U76: for many CEPs BrasilAPI gives the city's own point (the same for all of them) — taken for the CEP's, it
      // put a house kilometres away. A point that close to the centre counts only for a CEP of the centre.
      const own =
        given &&
        (!centre || distanceKm(given, centre) > CITY_POINT_KM || /^centro\b/.test(fold(body.neighborhood ?? '')))
          ? given
          : null;
      const p = own ?? centre;
      if (p)
        return {
          cep: maskCep(digits),
          street: body.street ?? '',
          neighborhood: body.neighborhood ?? '',
          city,
          point: p,
          pointPrecision: own ? 'cep' : 'cidade'
        };
    } else if (status !== 404 && status !== 400) {
      reached = false; // an outage, not "CEP not found": ask ViaCEP
    }
  } catch {
    // network or BrasilAPI down: try ViaCEP
  }
  try {
    const { body } = await getJson<ViaCep>(`https://viacep.com.br/ws/${digits}/json/`);
    reached = true;
    if (!body || body.erro || !body.localidade || !body.uf) return null;
    const city = `${body.localidade}, ${body.uf}`;
    const p = await cityCentre(city);
    if (!p) return null;
    return {
      cep: maskCep(digits),
      street: body.logradouro ?? '',
      neighborhood: body.bairro ?? '',
      city,
      point: p,
      pointPrecision: 'cidade'
    };
  } catch {
    if (!reached) throw serviceError('offline', 'Não deu para buscar o CEP agora. Confira a internet e tente de novo.');
    return null;
  }
}

/** Neighbourhoods seen in the streets suggested for each city ("caxias do sul|RS" → names). */
const seenNeighborhoods = new Map<string, Set<string>>();
const cityKey = (city: string, uf: string) => `${fold(city)}|${uf}`;

function remember(city: string, uf: string, names: string[]) {
  const key = cityKey(city, uf);
  const set = seenNeighborhoods.get(key) ?? new Set<string>();
  for (const n of names) if (n) set.add(n);
  seenNeighborhoods.set(key, set);
}

const photonUrl = (q: string, near: GeoPoint, layers: string[], limit = 15) =>
  `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&lat=${near.lat}&lon=${near.lon}&limit=${limit}&lang=default` +
  layers.map((l) => `&layer=${l}`).join('');

/** Photon's answers that are in this city (same name, close to its centre, in Brazil). */
function inCity(features: PhotonFeature[] | undefined, city: string, centre: GeoPoint): PhotonFeature[] {
  return (features ?? []).filter((f) => {
    const c = f.geometry?.coordinates;
    const p = c ? point(c[1], c[0]) : null;
    return (
      f.properties?.countrycode === 'BR' &&
      fold(f.properties.city ?? '') === fold(city) &&
      p !== null &&
      distanceKm(p, centre) <= MAX_FROM_CENTRE_KM
    );
  });
}

/** Streets of the city matching what was typed, each with its CEP (ViaCEP), or from the map when ViaCEP is down. */
export async function streetsOnline(
  city: string,
  uf: string,
  typed: string,
  centre: GeoPoint,
  signal?: AbortSignal
): Promise<Suggestions<StreetOption>> {
  const url = `https://viacep.com.br/ws/${uf}/${encodeURIComponent(city)}/${encodeURIComponent(typed)}/json/`;
  let list: ViaCep[] | null = null;
  try {
    list = await unlessAborted(
      cached(url, async () => {
        const { status, body } = await getJson<ViaCep[] | ViaCep>(url);
        // 400: a search ViaCEP doesn't take (too short, odd characters) — nothing found, not an outage.
        if (status !== 200 && status !== 400) throw new Error('viacep ' + status);
        return Array.isArray(body) ? body : [];
      }),
      signal
    );
  } catch (e) {
    if (signal?.aborted) throw e;
  }
  if (list) {
    const seen = new Set<string>();
    const items: StreetOption[] = [];
    for (const r of list) {
      if (!r.logradouro || !r.cep) continue;
      const digits = r.cep.replace(/\D/g, '');
      const option = {
        street: r.logradouro,
        neighborhood: r.bairro ?? '',
        cep: digits.length === 8 ? maskCep(digits) : '',
        detail: (r.complemento ?? '').trim()
      };
      const key = `${fold(option.street)}|${fold(option.neighborhood)}|${option.cep}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(option);
    }
    remember(
      city,
      uf,
      items.map((i) => i.neighborhood)
    );
    return { items: items.slice(0, 30) };
  }
  // ViaCEP out: the map's streets (with the CEP when the map has it).
  const mapUrl = photonUrl(`${typed} ${city}`, centre, ['street']);
  const { body } = await unlessAborted(
    cached(mapUrl, () => getJson<{ features?: PhotonFeature[] }>(mapUrl)),
    signal
  ).catch((e: unknown) => {
    if (signal?.aborted) throw e;
    return { body: null };
  });
  const seen = new Set<string>();
  const items: StreetOption[] = [];
  for (const f of inCity(body?.features, city, centre)) {
    const name = f.properties?.name ?? '';
    const district = f.properties?.district ?? f.properties?.locality ?? '';
    const cep = (f.properties?.postcode ?? '').replace(/\D/g, '');
    const key = `${fold(name)}|${fold(district)}`;
    if (!name || seen.has(key)) continue;
    seen.add(key);
    items.push({ street: name, neighborhood: district, cep: cep.length === 8 ? maskCep(cep) : '', detail: '' });
  }
  remember(
    city,
    uf,
    items.map((i) => i.neighborhood)
  );
  return { items, credit: items.length ? OSM_CREDIT : undefined };
}

/** Neighbourhoods of the city matching what was typed: the map's, plus those of the streets already suggested. */
export async function neighborhoodsOnline(
  city: string,
  uf: string,
  typed: string,
  centre: GeoPoint,
  signal?: AbortSignal
): Promise<Suggestions<string>> {
  const want = fold(typed);
  const names = new Map<string, string>();
  for (const n of seenNeighborhoods.get(cityKey(city, uf)) ?? []) if (fold(n).includes(want)) names.set(fold(n), n);
  const url = photonUrl(`${typed} ${city}`, centre, ['district', 'locality']);
  const { body } = await unlessAborted(
    cached(url, () => getJson<{ features?: PhotonFeature[] }>(url)),
    signal
  ).catch((e: unknown) => {
    if (signal?.aborted) throw e;
    return { body: null };
  });
  let fromMap = false;
  for (const f of inCity(body?.features, city, centre)) {
    const name = f.properties?.name ?? '';
    if (f.properties?.osm_key !== 'place' || !name || !fold(name).includes(want)) continue;
    if (!names.has(fold(name))) names.set(fold(name), name);
    fromMap = true;
  }
  return { items: [...names.values()].slice(0, 8), credit: fromMap ? OSM_CREDIT : undefined };
}

/** The parts of a Nominatim address that name the neighbourhood. */
const NEIGHBORHOOD_KEYS = ['suburb', 'neighbourhood', 'quarter', 'city_district', 'residential', 'borough', 'hamlet'];

/**
 * U76: Nominatim's rules ask for at most one request per second from each app. Saving an address may need two or
 * three (the street, a shorter form of its name, the neighbourhood), so they go out spaced, in order.
 */
export const nominatimPolicy = { gapMs: 1100 };
let nominatimTurn: Promise<unknown> = Promise.resolve();
let nominatimLast = 0;

function nominatim<T>(params: string): Promise<T[]> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&countrycodes=br&accept-language=pt-BR&${params}`;
  return cached(url, () => {
    const run = nominatimTurn.then(async () => {
      const wait = nominatimLast + nominatimPolicy.gapMs - Date.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      nominatimLast = Date.now();
      const { status, body } = await getJson<T[]>(url);
      if (status !== 200) throw new Error('nominatim ' + status);
      return Array.isArray(body) ? body : [];
    });
    nominatimTurn = run.catch(() => undefined);
    return run;
  });
}

/** A place the map gave for the address: a stretch of the street, or a house on it. */
interface Place {
  p: GeoPoint;
  /** The street's name as the map writes it. */
  street: string;
  neighborhoods: string[];
  /** Digits only; '' when the map has none. */
  postcode: string;
  /** The house number, for a house; '' for the street itself. */
  house: string;
}

const cepDigits = (cep: string) => cep.replace(/\D/g, '');

function fromNominatim(list: NominatimPlace[], uf: string): Place[] {
  return list
    .filter((x) => !x.address?.['ISO3166-2-lvl4'] || x.address['ISO3166-2-lvl4'] === `BR-${uf}`)
    .map((x) => ({
      p: point(x.lat, x.lon) as GeoPoint,
      street: x.address?.road ?? x.address?.pedestrian ?? x.name ?? '',
      neighborhoods: NEIGHBORHOOD_KEYS.map((k) => x.address?.[k] ?? '').filter(Boolean),
      postcode: cepDigits(x.address?.postcode ?? ''),
      house: x.address?.house_number ?? ''
    }))
    .filter((x) => x.p && x.street);
}

function fromPhoton(features: PhotonFeature[]): Place[] {
  return features
    .map((f) => ({
      p: point(f.geometry?.coordinates?.[1], f.geometry?.coordinates?.[0]) as GeoPoint,
      street: (f.properties?.housenumber ? f.properties.street : f.properties?.name) ?? '',
      neighborhoods: [f.properties?.district ?? '', f.properties?.locality ?? ''].filter(Boolean),
      postcode: cepDigits(f.properties?.postcode ?? ''),
      house: f.properties?.housenumber ?? ''
    }))
    .filter((x) => x.p && x.street);
}

/** The place in the middle of a group (the one closest to all the others) — a point on the street, not off it. */
function medoid(places: Place[]): Place {
  let best = places[0];
  let bestSum = Infinity;
  for (const a of places) {
    let sum = 0;
    for (const b of places) sum += distanceKm(a.p, b.p);
    if (sum < bestSum) {
      bestSum = sum;
      best = a;
    }
  }
  return best;
}

/** Same house number, as written ("1200", "1200 A" = "1200A"). */
const sameHouse = (a: string, b: string) => fold(a).replace(/\s+/g, '') === fold(b).replace(/\s+/g, '');

/**
 * Of the map's answers, where the address is. Only the answers in the city (near its centre) and of this street (by
 * name, the way the map writes it — see streetSimilarity), the best-named first and the same kind ("Rua" or
 * "Avenida") when both exist. With a number the map knows: the house. Otherwise the stretch of the street in the
 * neighbourhood typed (a long street crosses many), or with the CEP typed, or the one closest to the neighbourhood's
 * centre; of several, the middle one.
 */
function choosePlace(
  places: Place[],
  input: GeocodeInput,
  hood: GeoPoint | null
): { point: GeoPoint; precision: PlacePrecision } | null {
  const scored = places
    .filter((x) => distanceKm(x.p, input.cityCentre) <= MAX_FROM_CENTRE_KM)
    .map((x) => ({ x, sim: streetSimilarity(x.street, input.street) }))
    .filter((c) => c.sim >= 0.8);
  if (!scored.length) return null;
  const top = Math.max(...scored.map((c) => c.sim));
  let same = scored.filter((c) => c.sim >= top - 0.05).map((c) => c.x);
  const kind = streetKind(input.street);
  if (kind && same.some((x) => streetKind(x.street) === kind)) {
    const sameKind = same.filter((x) => streetKind(x.street) === kind || !streetKind(x.street));
    if (sameKind.length) same = sameKind;
  }
  const inHood = (x: Place) => x.neighborhoods.some((n) => likelySameNeighborhood(n, input.neighborhood));
  const cep = cepDigits(input.cep);
  const byCep = (x: Place) => Boolean(cep) && x.postcode === cep;

  if (input.number) {
    const houses = same.filter((x) => x.house && sameHouse(x.house, input.number));
    if (houses.length) {
      const pick = houses.find(inHood) ?? houses.find(byCep) ?? houses[0];
      return { point: pick.p, precision: 'numero' };
    }
  }
  // Houses with another number are not where this address is.
  const roads = same.filter((x) => !x.house);
  const pool = roads.length ? roads : same;
  const both = pool.filter((x) => inHood(x) && byCep(x));
  const hoodOnes = pool.filter(inHood);
  const cepOnes = pool.filter(byCep);
  let chosen = both.length ? both : hoodOnes.length ? hoodOnes : cepOnes;
  if (!chosen.length && hood) {
    const nearest = pool.reduce((a, b) => (distanceKm(b.p, hood) < distanceKm(a.p, hood) ? b : a));
    if (distanceKm(nearest.p, hood) <= 3) chosen = [nearest];
  }
  if (!chosen.length) chosen = pool;
  return { point: medoid(chosen).p, precision: 'rua' };
}

/** "Rua Júlio de Castilhos" → "Júlio de Castilhos" (the map may call it "Avenida"). */
function withoutKind(street: string): string {
  const rest = street.replace(
    /^\s*(rua|r\.?|avenida|av\.?|travessa|tv\.?|trav\.?|alameda|al\.?|estrada|est\.?|rodovia|rod\.?|praça|praca|pça\.?|largo|beco|viela)\s+/i,
    ''
  );
  return rest === street ? '' : rest;
}

/** Where the neighbourhood is (its centre on the map), or null when the map doesn't know it in this city. */
async function neighborhoodCentre(input: GeocodeInput): Promise<GeoPoint | null> {
  if (fold(input.neighborhood).length < 2) return null;
  const pick = (places: { p: GeoPoint | null; name: string }[]) =>
    places.find(
      (x) =>
        x.p !== null &&
        distanceKm(x.p, input.cityCentre) <= MAX_FROM_CENTRE_KM &&
        likelySameNeighborhood(x.name, input.neighborhood)
    )?.p ?? null;
  try {
    const list = await nominatim<NominatimPlace>(
      `limit=10&q=${encodeURIComponent(`${input.neighborhood}, ${input.city}, ${input.uf}`)}`
    );
    const found = pick(
      list
        .filter(
          (x) =>
            (x.category === 'place' || x.category === 'boundary') &&
            (!x.address?.['ISO3166-2-lvl4'] || x.address['ISO3166-2-lvl4'] === `BR-${input.uf}`)
        )
        .map((x) => ({ p: point(x.lat, x.lon), name: x.name ?? '' }))
    );
    if (found) return found;
  } catch {
    // Nominatim out: Photon
  }
  try {
    const url = photonUrl(`${input.neighborhood} ${input.city}`, input.cityCentre, ['district', 'locality'], 10);
    const { body } = await cached(url, () => getJson<{ features?: PhotonFeature[] }>(url));
    return pick(
      inCity(body?.features, input.city, input.cityCentre)
        .filter((f) => f.properties?.osm_key === 'place')
        .map((f) => ({
          p: point(f.geometry?.coordinates?.[1], f.geometry?.coordinates?.[0]),
          name: f.properties?.name ?? ''
        }))
    );
  } catch {
    return null;
  }
}

/**
 * U76: where the address is — the house (a number the map knows), its stretch of the street, the CEP's own point,
 * the neighbourhood's centre or the city's centre, in that order. The street is looked up by its name as typed and,
 * when the map writes it differently ("Rua Pe. Alberto Lamonato" for the Correios' "Rua Padre Alberto Luiz
 * Lamonato"), by its last word, then matched by name (streetSimilarity). docs/DECISOES.md › U76.
 */
export async function geocodeOnline(input: GeocodeInput): Promise<{ point: GeoPoint; precision: PlacePrecision }> {
  const typed = splitHouseNumber(input.street);
  const q: GeocodeInput = { ...input, street: typed.street, number: input.number.trim() || typed.number };
  const city = encodeURIComponent(q.city);
  let hood: GeoPoint | null | undefined;
  const hoodCentre = async () => (hood === undefined ? (hood = await neighborhoodCentre(q)) : hood);
  const decide = async (places: Place[]) => {
    if (!places.length) return null;
    const first = choosePlace(places, q, null);
    // Only a street stretch chosen without the neighbourhood's help asks where the neighbourhood is.
    if (!first || first.precision === 'numero') return first;
    const helped = places.some(
      (x) =>
        streetSimilarity(x.street, q.street) >= 0.8 &&
        (x.neighborhoods.some((n) => likelySameNeighborhood(n, q.neighborhood)) ||
          (cepDigits(q.cep) && x.postcode === cepDigits(q.cep)))
    );
    return helped ? first : choosePlace(places, q, await hoodCentre());
  };

  // The names to ask the map by, until one answers: as typed, as the Correios write it, without its kind ("Rua" for
  // what the map calls "Avenida") and, last, only its last word — the map's own name is then matched here.
  const words = streetWords(q.street);
  const last = words[words.length - 1] ?? '';
  const names = [q.street, input.officialStreet ?? '', withoutKind(q.street)]
    .map((n) => n.trim())
    .filter((n, i, all) => n && all.findIndex((m) => fold(m) === fold(n)) === i);
  if (last.length >= 3 && words.length > 1 && !names.some((n) => fold(n) === last)) names.push(last);

  let mapReached = false;
  try {
    for (const [i, name] of names.entries()) {
      // The number goes with the first name only: a house is asked once.
      const line = q.number && i === 0 ? `${q.number} ${name}` : name;
      const found = await decide(
        fromNominatim(
          await nominatim<NominatimPlace>(
            `limit=40&dedupe=0&layer=address&street=${encodeURIComponent(line)}&city=${city}`
          ),
          q.uf
        )
      );
      mapReached = true;
      if (found) return found;
    }
  } catch {
    // Nominatim out or slow: Photon has the same map.
  }
  try {
    const text = `${q.street}${q.number ? ' ' + q.number : ''}, ${q.neighborhood}, ${q.city}`;
    const url = photonUrl(text, q.cityCentre, ['house', 'street'], 15);
    const { body } = await cached(url, () => getJson<{ features?: PhotonFeature[] }>(url));
    mapReached = true;
    const found = await decide(fromPhoton(inCity(body?.features, q.city, q.cityCentre)));
    if (found) return found;
  } catch {
    // the map is out: the CEP's point
  }
  if (input.cepPoint) return { point: input.cepPoint, precision: 'cep' };
  const centre = mapReached ? await hoodCentre() : null;
  if (centre) return { point: centre, precision: 'bairro' };
  return { point: input.cityCentre, precision: 'cidade' };
}
