// CEP lookup with the real backend: BrasilAPI (which often has the CEP's coordinates), then ViaCEP as
// the fallback. Both are public, free and answer the browser directly (CORS). When the CEP comes
// without coordinates, the city's centre from the city list is used (services/cities.ts).
import type { GeoPoint } from '../../types/models';
import type { CepResult } from '../address';
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
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
}

const maskCep = (d: string) => d.slice(0, 5) + '-' + d.slice(5);

function point(lat: unknown, lon: unknown): GeoPoint | null {
  const la = Number(lat);
  const lo = Number(lon);
  return Number.isFinite(la) && Number.isFinite(lo) && la !== 0 && lo !== 0 ? { lat: la, lon: lo } : null;
}

async function getJson<T>(url: string): Promise<{ status: number; body: T | null }> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) return { status: res.status, body: null };
  return { status: res.status, body: (await res.json().catch(() => null)) as T | null };
}

async function cityCentre(label: string): Promise<GeoPoint | null> {
  const { cityByLabel } = await import('../cities');
  const city = cityByLabel(label);
  return city ? { lat: city.lat, lon: city.lon } : null;
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
      const p = point(coords?.latitude, coords?.longitude) ?? (await cityCentre(city));
      if (p)
        return {
          cep: maskCep(digits),
          street: body.street ?? '',
          neighborhood: body.neighborhood ?? '',
          city,
          point: p
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
    return { cep: maskCep(digits), street: body.logradouro ?? '', neighborhood: body.bairro ?? '', city, point: p };
  } catch {
    if (!reached) throw serviceError('offline', 'Não deu para buscar o CEP agora. Preencha o endereço à mão.');
    return null;
  }
}
