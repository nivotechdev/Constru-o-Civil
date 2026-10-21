// Addresses: CEP lookup, real suggestions while typing (streets with their CEP, neighbourhoods) and where an address
// is on the map. Each function says what the real backend does there (docs/CONTRATO-BACKEND.md); U51 explains the
// providers (docs/DECISOES.md).
import type { GeoPoint, HomeAddress, PlacePrecision } from '../types/models';
import { fold, hasWords, sameNeighborhood, sameStreet, streetKey } from '../utils/addressText';
import { cityByLabel, searchCities } from './cities';
import { serviceError } from './errors';
import { mockLatency } from './mockLatency';
import { IS_DEMO } from './mode';
import { geocodeOnline, lookupCepOnline, neighborhoodsOnline, streetsOnline } from './remote/address';

export interface CepResult {
  cep: string;
  street: string;
  neighborhood: string;
  /** "São Paulo, SP" (the city picker's label). */
  city: string;
  point: GeoPoint;
  /** U51: 'cep' when the point is the CEP's own; 'cidade' when it is only the city's centre. */
  pointPrecision?: 'cep' | 'cidade';
}

/** U51: a street suggested while typing — a real one, with its CEP (Correios), or from the map. */
export interface StreetOption {
  street: string;
  neighborhood: string;
  /** "95020-000"; empty when the source has no CEP for it. */
  cep: string;
  /** Which part of the street the CEP covers ("até 799/800", "lado ímpar"), when it varies. */
  detail: string;
}

/** Suggestions and where they come from (the map's data asks to be credited). */
export interface Suggestions<T> {
  items: T[];
  credit?: string;
}

/** U51: the address fields while being filled (sign-up, "Editar perfil", the job form). */
export interface AddressDraft {
  /** As typed ("95020-000", or empty when not known). */
  cep: string;
  /** "Caxias do Sul, RS" once chosen from the list; what was typed until then. */
  city: string;
  street: string;
  neighborhood: string;
  /** The job form only (optional there). */
  number?: string;
}

export type AddressField = 'cep' | 'city' | 'street' | 'neighborhood';
export type AddressErrors = Partial<Record<AddressField, string | null>>;

/** A located address, ready to save. */
export interface ResolvedAddress extends HomeAddress {
  /** "Caxias do Sul, RS". */
  cityLabel: string;
}

// Demo: a few real CEPs. Any other valid CEP is "not found", and the form lets the street, the
// neighbourhood and the city be filled in by hand.
const CEPS: CepResult[] = [
  {
    cep: '03307-000',
    street: 'Rua Serra de Bragança',
    neighborhood: 'Tatuapé',
    city: 'São Paulo, SP',
    point: { lat: -23.5407, lon: -46.5762 }
  },
  {
    cep: '03104-000',
    street: 'Rua da Mooca',
    neighborhood: 'Mooca',
    city: 'São Paulo, SP',
    point: { lat: -23.5598, lon: -46.6012 }
  },
  {
    cep: '01310-100',
    street: 'Avenida Paulista',
    neighborhood: 'Bela Vista',
    city: 'São Paulo, SP',
    point: { lat: -23.5631, lon: -46.6544 }
  },
  {
    cep: '13010-111',
    street: 'Rua Barão de Jaguara',
    neighborhood: 'Centro',
    city: 'Campinas, SP',
    point: { lat: -22.9056, lon: -47.0608 }
  },
  {
    cep: '20040-002',
    street: 'Rua da Assembleia',
    neighborhood: 'Centro',
    city: 'Rio de Janeiro, RJ',
    point: { lat: -22.9046, lon: -43.1767 }
  },
  {
    cep: '03081-000',
    street: 'Rua Tuiuti',
    neighborhood: 'Tatuapé',
    city: 'São Paulo, SP',
    point: { lat: -23.5394, lon: -46.5747 }
  },
  {
    cep: '95020-000',
    street: 'Rua Sinimbu',
    neighborhood: 'Centro',
    city: 'Caxias do Sul, RS',
    point: { lat: -29.1681, lon: -51.1794 }
  },
  {
    cep: '95020-470',
    street: 'Rua Os 18 do Forte',
    neighborhood: 'Centro',
    city: 'Caxias do Sul, RS',
    point: { lat: -29.1655, lon: -51.1808 }
  },
  {
    cep: '95010-000',
    street: 'Avenida Júlio de Castilhos',
    neighborhood: 'Centro',
    city: 'Caxias do Sul, RS',
    point: { lat: -29.1667, lon: -51.1795 }
  },
  {
    cep: '95084-470',
    street: 'Rua Os 18 do Forte',
    neighborhood: 'São Pelegrino',
    city: 'Caxias do Sul, RS',
    point: { lat: -29.1622, lon: -51.1866 }
  }
];

export const onlyDigits = (v: string) => v.replace(/\D/g, '');

/** "03307000" → "03307-000" (as typed). */
export function maskCEP(v: string): string {
  const d = onlyDigits(v).slice(0, 8);
  return d.length > 5 ? d.slice(0, 5) + '-' + d.slice(5) : d;
}

/** Example CEPs for the form's hint. */
export const EXAMPLE_CEPS = CEPS.map((c) => c.cep);

/**
 * Finds the street, neighbourhood and city of a CEP; `null` when the CEP doesn't exist.
 * Backend: BrasilAPI (with the CEP's point), then ViaCEP — both answer the browser directly.
 */
export async function lookupCep(cep: string): Promise<CepResult | null> {
  const digits = onlyDigits(cep);
  if (digits.length !== 8) throw serviceError('validacao', 'O CEP tem 8 números.');
  if (looked.has(digits)) return looked.get(digits) ?? null;
  if (!IS_DEMO) {
    const found = await lookupCepOnline(digits);
    if (found) looked.set(digits, found);
    return found;
  }
  await mockLatency(450);
  return CEPS.find((c) => onlyDigits(c.cep) === digits) ?? null;
}

/** CEPs found online in this session: their point places the address (see locate). */
const looked = new Map<string, CepResult>();

/** W08: the city of a CEP already looked up ("Name, UF"), or null when it isn't known here. */
export function cepCity(cep: string): string | null {
  const d = onlyDigits(cep);
  return looked.get(d)?.city ?? CEPS.find((c) => onlyDigits(c.cep) === d)?.city ?? null;
}

/** Small fixed offset from a text, so two addresses in the same city don't sit on the same point. */
function offset(seed: string, size = 0.01): number {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return ((Math.abs(h) % 2001) / 1000 - 1) * size;
}

/**
 * Where an address is on the map, right away (the job form before U52). Demo: the CEP's point when known, otherwise
 * the centre of the city plus a small offset. Online: the CEP's point, when it was looked up.
 */
export function locate(input: { cep: string; street: string; number: string; city: string }): GeoPoint | null {
  // Online, the CEP's own point is used as it is (it is already the street's).
  const online = looked.get(onlyDigits(input.cep));
  if (online && online.city === input.city) return online.point;
  const known = CEPS.find((c) => onlyDigits(c.cep) === onlyDigits(input.cep));
  const base = known?.point ?? cityByLabel(input.city);
  if (!base) return null;
  const key = `${input.street} ${input.number}`;
  return { lat: +(base.lat + offset(key)).toFixed(5), lon: +(base.lon + offset(key + '#')).toFixed(5) };
}

// ---- U51: suggestions while typing ----

/** "Caxias do Sul, RS" → its name and state; null when it isn't a municipality from the list. */
function cityParts(label: string): { name: string; uf: string; point: GeoPoint } | null {
  const c = cityByLabel(label);
  return c ? { name: c.name, uf: c.uf, point: { lat: c.lat, lon: c.lon } } : null;
}

/**
 * Streets of the city that match what was typed (at least 3 letters), each with its CEP and neighbourhood — so
 * choosing one fills the CEP right. Backend: ViaCEP's search by address (the Correios' data), the map's
 * streets (OpenStreetMap, Photon) when ViaCEP doesn't answer.
 */
export async function suggestStreets(
  cityLabel: string,
  typed: string,
  signal?: AbortSignal
): Promise<Suggestions<StreetOption>> {
  const city = cityParts(cityLabel);
  if (!city || fold(typed).length < 3) return { items: [] };
  if (!IS_DEMO) return streetsOnline(city.name, city.uf, typed.trim(), city.point, signal);
  await mockLatency(250);
  const words = streetKey(typed) || fold(typed);
  return {
    items: CEPS.filter((c) => c.city === cityByLabel(cityLabel)?.label && hasWords(c.street, words)).map((c) => ({
      street: c.street,
      neighborhood: c.neighborhood,
      cep: c.cep,
      detail: ''
    }))
  };
}

/** Neighbourhoods of the city that match what was typed (at least 2 letters). Backend: OpenStreetMap (Photon). */
export async function suggestNeighborhoods(
  cityLabel: string,
  typed: string,
  signal?: AbortSignal
): Promise<Suggestions<string>> {
  const city = cityParts(cityLabel);
  if (!city || fold(typed).length < 2) return { items: [] };
  if (!IS_DEMO) return neighborhoodsOnline(city.name, city.uf, typed.trim(), city.point, signal);
  await mockLatency(250);
  const label = cityByLabel(cityLabel)?.label;
  const names = new Set(CEPS.filter((c) => c.city === label).map((c) => c.neighborhood));
  return { items: [...names].filter((n) => hasWords(n, typed)) };
}

/** Municipalities matching what was typed (the IBGE list, on the phone: instant). */
export function suggestCities(typed: string, limit = 6): string[] {
  return fold(typed) ? searchCities(typed, limit).map((c) => c.label) : [];
}

/** What was typed in "Cidade" as the list's label ("caxias do sul" → "Caxias do Sul, RS"), when it is one. */
export function knownCityLabel(typed: string): string | null {
  const exact = cityByLabel(typed);
  if (exact) return exact.label;
  const [first, second] = searchCities(typed, 2);
  if (!first) return null;
  // Only a name typed in full: "caxias" alone is not "Caxias do Sul" (nor "Caxias", MA).
  if (fold(first.name) === fold(typed.replace(/,.*$/, '')) && (!second || fold(second.name) !== fold(first.name)))
    return first.label;
  return null;
}

// ---- U51: checking and locating an address ----

/** An empty address (optionally already in a city). */
export function emptyAddress(city = ''): AddressDraft {
  return { cep: '', city, street: '', neighborhood: '' };
}

/** The fields filled with a saved address. */
export function draftFromAddress(a: HomeAddress | null | undefined, fallbackCity = ''): AddressDraft {
  if (!a) return emptyAddress(fallbackCity);
  return { cep: a.cep, city: `${a.city}, ${a.uf}`, street: a.street, neighborhood: a.neighborhood };
}

/** Whether two drafts are the same address (what the map needs; spacing and case aside). */
export function sameDraft(a: AddressDraft, b: AddressDraft): boolean {
  return (
    onlyDigits(a.cep) === onlyDigits(b.cep) &&
    fold(a.city) === fold(b.city) &&
    fold(a.street) === fold(b.street) &&
    fold(a.neighborhood) === fold(b.neighborhood) &&
    fold(a.number ?? '') === fold(b.number ?? '')
  );
}

/** The problems that need no lookup: empty fields, a city that isn't in the list, a CEP with missing numbers. */
export function addressErrors(d: AddressDraft): AddressErrors {
  const e: AddressErrors = {};
  const cep = onlyDigits(d.cep);
  if (cep.length > 0 && cep.length !== 8) e.cep = 'O CEP tem 8 números. Se não souber, deixe em branco.';
  if (!d.city.trim()) e.city = 'Informe a cidade.';
  else if (!knownCityLabel(d.city)) e.city = 'Escolha a cidade na lista.';
  if (fold(d.street).length < 2) e.street = 'Informe a rua.';
  if (fold(d.neighborhood).length < 2) e.neighborhood = 'Informe o bairro.';
  return e;
}

const hasErrors = (e: AddressErrors) => Object.values(e).some(Boolean);

/**
 * Checks the address and finds where it is, for saving: the CEP must be the city's and the street's (a CEP left
 * blank is found from the street and the neighbourhood), and the point is the street's (or the house's, with a
 * number) — the most precise the free providers give. Returns the field problems instead when there are any.
 * Throws a ServiceError only when the lookups can't be reached at all.
 */
export async function resolveAddress(
  d: AddressDraft
): Promise<{ ok: true; address: ResolvedAddress; draft: AddressDraft } | { ok: false; errors: AddressErrors }> {
  const errors = addressErrors(d);
  if (hasErrors(errors)) return { ok: false, errors };
  const cityLabel = knownCityLabel(d.city) as string;
  const city = cityParts(cityLabel) as NonNullable<ReturnType<typeof cityParts>>;
  const street = d.street.trim().replace(/\s+/g, ' ');
  const neighborhood = d.neighborhood.trim().replace(/\s+/g, ' ');

  // The CEP: the one typed, if it is this city's and this street's; otherwise found from the street.
  let cep = maskCEP(d.cep);
  let cepFound: CepResult | null = null;
  if (onlyDigits(cep).length === 8) {
    cepFound = await lookupCep(cep);
    if (!cepFound)
      return { ok: false, errors: { cep: 'Não achamos esse CEP. Confira os números ou deixe em branco.' } };
    if (cepFound.city !== cityLabel)
      return { ok: false, errors: { cep: `Esse CEP é de ${cepFound.city}. Confira o CEP ou a cidade.` } };
    if (cepFound.street && !sameStreet(cepFound.street, street)) {
      // The street changed after the CEP was filled: the street's own CEP replaces it.
      const other = await findCep(cityLabel, street, neighborhood);
      if (!other) return { ok: false, errors: { cep: `Esse CEP é da ${cepFound.street}. Confira o CEP ou a rua.` } };
      cep = other.cep;
      cepFound = await lookupCep(cep).catch(() => null);
    }
  } else {
    const found = await findCep(cityLabel, street, neighborhood);
    if (!found)
      return {
        ok: false,
        errors: {
          street: `Não achamos essa rua em ${city.name}. Escolha a rua na lista ou digite o CEP.`
        }
      };
    if (!found.cep) return { ok: false, errors: { cep: 'Não achamos o CEP dessa rua. Digite o CEP, por favor.' } };
    cep = found.cep;
    cepFound = await lookupCep(cep).catch(() => null);
  }

  const located = await geocode({
    street,
    number: d.number?.trim() ?? '',
    neighborhood,
    city: city.name,
    uf: city.uf,
    cep,
    cityCentre: city.point,
    cepPoint: cepFound && cepFound.pointPrecision !== 'cidade' ? cepFound.point : null
  });
  return {
    ok: true,
    address: {
      cep,
      street,
      neighborhood,
      city: city.name,
      uf: city.uf,
      cityLabel,
      lat: +located.point.lat.toFixed(6),
      lon: +located.point.lon.toFixed(6),
      precision: located.precision
    },
    draft: { ...d, cep, city: cityLabel, street, neighborhood }
  };
}

/** The address as saved (without the form's city label). */
export function homeFromResolved(a: ResolvedAddress): HomeAddress {
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

/** The CEP of a street of the city, choosing the stretch in the given neighbourhood. */
async function findCep(cityLabel: string, street: string, neighborhood: string): Promise<StreetOption | null> {
  const { items } = await suggestStreets(cityLabel, street);
  const same = items.filter((o) => sameStreet(o.street, street));
  if (!same.length) return null;
  return same.find((o) => sameNeighborhood(o.neighborhood, neighborhood)) ?? same[0];
}

export interface GeocodeInput {
  street: string;
  number: string;
  neighborhood: string;
  /** The municipality's name and state. */
  city: string;
  uf: string;
  cep: string;
  cityCentre: GeoPoint;
  /** The CEP's own point, when the CEP lookup brought one. */
  cepPoint: GeoPoint | null;
}

/**
 * The address's point and how far it reaches. Backend: OpenStreetMap (Nominatim; Photon when it doesn't answer),
 * then the CEP's point, then the city's centre. Demo: the CEP's point (or the city's centre) moved a little by the
 * street and number.
 */
export async function geocode(input: GeocodeInput): Promise<{ point: GeoPoint; precision: PlacePrecision }> {
  if (!IS_DEMO) return geocodeOnline(input);
  await mockLatency(300);
  const known = CEPS.find((c) => onlyDigits(c.cep) === onlyDigits(input.cep));
  const base = known?.point ?? input.cepPoint ?? input.cityCentre;
  const key = `${input.street} ${input.number}`;
  return {
    point: { lat: +(base.lat + offset(key, 0.002)).toFixed(6), lon: +(base.lon + offset(key + '#', 0.002)).toFixed(6) },
    precision: known ? (input.number ? 'numero' : 'rua') : 'cidade'
  };
}
