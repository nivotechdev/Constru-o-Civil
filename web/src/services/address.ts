// Addresses of the jobs: CEP lookup and where an address is on the map. Each function says what the
// real backend does there (docs/CONTRATO-BACKEND.md).
import type { GeoPoint } from '../types/models';
import { cityByLabel } from './cities';
import { serviceError } from './errors';
import { mockLatency } from './mockLatency';
import { IS_DEMO } from './mode';
import { lookupCepOnline } from './remote/address';

export interface CepResult {
  cep: string;
  street: string;
  neighborhood: string;
  /** "São Paulo, SP" (the city picker's label). */
  city: string;
  point: GeoPoint;
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
 * Backend: an edge function in front of ViaCEP/BrasilAPI (with cache), returning the same shape.
 */
export async function lookupCep(cep: string): Promise<CepResult | null> {
  const digits = onlyDigits(cep);
  if (digits.length !== 8) throw serviceError('validacao', 'O CEP tem 8 números.');
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
function offset(seed: string): number {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return ((Math.abs(h) % 2001) / 1000 - 1) * 0.01;
}

/**
 * Where an address is on the map. Demo: the CEP's point when known, otherwise the centre of the city
 * plus a small offset. Backend: geocode the full address (and keep the CEP's point as the fallback).
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
