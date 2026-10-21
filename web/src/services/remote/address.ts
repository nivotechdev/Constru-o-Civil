// Addresses with the real backend — free public services that answer the browser directly (CORS), no key:
//   * CEP → street, neighbourhood, city: BrasilAPI (often with the CEP's point), then ViaCEP;
//   * street suggestions while typing: ViaCEP's search by address (the Correios' own data, each street with its CEP),
//     then the map's streets (Photon, OpenStreetMap) when ViaCEP doesn't answer;
//   * neighbourhood suggestions: Photon (OpenStreetMap), plus the neighbourhoods of the streets already suggested;
//   * the address's point: Nominatim (OpenStreetMap), then Photon, then the CEP's point, then the city's centre.
// U51 (docs/DECISOES.md) explains the choice. Nominatim is called once per saved address (never while typing, as its
// rules ask); every answer is cached for the session. Nothing here is sent anywhere else.
import type { GeoPoint, PlacePrecision } from '../../types/models';
import { fold, sameStreet } from '../../utils/addressText';
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
      const own = point(coords?.latitude, coords?.longitude);
      const p = own ?? (await cityCentre(city));
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
const NEIGHBORHOOD_KEYS = ['suburb', 'neighbourhood', 'quarter', 'city_district', 'residential', 'borough'];

interface Candidate {
  p: GeoPoint;
  neighborhoods: string[];
  postcode: string;
  house: boolean;
}

/** Of the map's answers near the city: the one in the neighbourhood, with the CEP, at the house number. */
function bestPlace(places: Candidate[], input: GeocodeInput): Candidate | null {
  const near = places.filter((x) => distanceKm(x.p, input.cityCentre) <= MAX_FROM_CENTRE_KM);
  if (!near.length) return null;
  const want = fold(input.neighborhood);
  const cep = input.cep.replace(/\D/g, '');
  const score = (x: Candidate) =>
    (x.neighborhoods.some((n) => fold(n) === want || fold(n).startsWith(want + ' ') || want.startsWith(fold(n) + ' '))
      ? 4
      : 0) +
    (x.postcode && x.postcode === cep ? 2 : 0) +
    (input.number && x.house ? 1 : 0);
  return near.reduce((a, b) => (score(b) > score(a) ? b : a));
}

/** Where the address is: the house (with a number the map knows), its street, the CEP or the city's centre. */
export async function geocodeOnline(input: GeocodeInput): Promise<{ point: GeoPoint; precision: PlacePrecision }> {
  const streetLine = input.number ? `${input.number} ${input.street}` : input.street;
  const nominatim =
    'https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=10&countrycodes=br' +
    `&street=${encodeURIComponent(streetLine)}&city=${encodeURIComponent(input.city)}`;
  try {
    const list = await cached(nominatim, async () => {
      const { status, body } = await getJson<NominatimPlace[]>(nominatim);
      if (status !== 200) throw new Error('nominatim ' + status);
      return body ?? [];
    });
    const best = bestPlace(
      list
        .filter((x) => !x.address?.['ISO3166-2-lvl4'] || x.address['ISO3166-2-lvl4'] === `BR-${input.uf}`)
        .filter((x) => !x.address?.road || sameStreet(x.address.road, input.street))
        .map((x) => ({
          p: point(x.lat, x.lon) as GeoPoint,
          neighborhoods: NEIGHBORHOOD_KEYS.map((k) => x.address?.[k] ?? '').filter(Boolean),
          postcode: (x.address?.postcode ?? '').replace(/\D/g, ''),
          house: Boolean(x.address?.house_number) || x.addresstype === 'building' || x.category === 'building'
        }))
        .filter((x) => x.p),
      input
    );
    if (best) return { point: best.p, precision: input.number && best.house ? 'numero' : 'rua' };
  } catch {
    // Nominatim out or slow: Photon has the same map.
  }
  try {
    const q = `${input.street}${input.number ? ' ' + input.number : ''}, ${input.neighborhood}, ${input.city}`;
    const { body } = await getJson<{ features?: PhotonFeature[] }>(
      photonUrl(q, input.cityCentre, ['house', 'street'], 10)
    );
    const best = bestPlace(
      inCity(body?.features, input.city, input.cityCentre)
        .filter((f) =>
          f.properties?.housenumber
            ? sameStreet(f.properties.street ?? '', input.street)
            : sameStreet(f.properties?.name ?? '', input.street)
        )
        .map((f) => ({
          p: point(f.geometry?.coordinates?.[1], f.geometry?.coordinates?.[0]) as GeoPoint,
          neighborhoods: [f.properties?.district ?? '', f.properties?.locality ?? ''].filter(Boolean),
          postcode: (f.properties?.postcode ?? '').replace(/\D/g, ''),
          house: Boolean(f.properties?.housenumber)
        })),
      input
    );
    if (best) return { point: best.p, precision: input.number && best.house ? 'numero' : 'rua' };
  } catch {
    // the map is out: the CEP's point
  }
  if (input.cepPoint) return { point: input.cepPoint, precision: 'cep' };
  return { point: input.cityCentre, precision: 'cidade' };
}
