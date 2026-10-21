// U51 — the address: comparing what people type, checking it, finding the CEP from the street, the suggestions while
// typing and where the address is on the map — in the demo and with the real providers (fetch answered here).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sameNeighborhood, sameStreet, streetKey } from '../utils/addressText';

vi.mock('../services/mockLatency', () => ({
  mockLatency: () => Promise.resolve(),
  localLatency: () => Promise.resolve()
}));

describe('comparing addresses as typed', () => {
  it('a street is the same with or without its kind, accents and case', () => {
    expect(sameStreet('rua sinimbu', 'Rua Sinimbu')).toBe(true);
    expect(sameStreet('Av. Júlio de Castilhos', 'Avenida Julio de Castilhos')).toBe(true);
    expect(sameStreet('18 do Forte', 'Rua Os 18 do Forte')).toBe(true);
    expect(sameStreet('Rua Sinimbu', 'Rua Pinheiro Machado')).toBe(false);
    expect(streetKey('Travessa da Paz')).toBe('paz');
  });
  it('a neighbourhood too, and a longer name of it', () => {
    expect(sameNeighborhood('sao pelegrino', 'São Pelegrino')).toBe(true);
    expect(sameNeighborhood('Centro', 'Centro Histórico')).toBe(true);
    expect(sameNeighborhood('Centro', 'Exposição')).toBe(false);
  });
});

describe('the address in the demo', () => {
  let a: typeof import('../services/address');
  beforeEach(async () => {
    vi.resetModules();
    a = await import('../services/address');
  });

  it('the city must be one of the list, typed in full', () => {
    expect(a.knownCityLabel('caxias do sul')).toBe('Caxias do Sul, RS');
    expect(a.knownCityLabel('São Paulo, SP')).toBe('São Paulo, SP');
    expect(a.knownCityLabel('caxias')).toBeNull();
    expect(a.suggestCities('caxias')).toContain('Caxias do Sul, RS');
  });

  it('says what is missing before looking anything up', () => {
    expect(a.addressErrors(a.emptyAddress())).toEqual({
      city: 'Informe a cidade.',
      street: 'Informe a rua.',
      neighborhood: 'Informe o bairro.'
    });
    expect(a.addressErrors({ cep: '9502', city: 'Lugar Nenhum', street: 'Rua A', neighborhood: 'Centro' })).toEqual({
      cep: 'O CEP tem 8 números. Se não souber, deixe em branco.',
      city: 'Escolha a cidade na lista.'
    });
  });

  it('suggests real streets of the city, each with its CEP and neighbourhood', async () => {
    const { items } = await a.suggestStreets('Caxias do Sul, RS', '18 do for');
    expect(items).toEqual([
      { street: 'Rua Os 18 do Forte', neighborhood: 'Centro', cep: '95020-470', detail: '' },
      { street: 'Rua Os 18 do Forte', neighborhood: 'São Pelegrino', cep: '95084-470', detail: '' }
    ]);
    expect((await a.suggestStreets('Caxias do Sul, RS', 'si')).items).toEqual([]); // under 3 letters
    expect((await a.suggestNeighborhoods('Caxias do Sul, RS', 'pele')).items).toEqual(['São Pelegrino']);
  });

  it('without the CEP, finds it from the street, in the neighbourhood typed', async () => {
    const r = await a.resolveAddress({
      cep: '',
      city: 'caxias do sul',
      street: 'rua os 18 do forte',
      neighborhood: 'sao pelegrino'
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.address).toMatchObject({
      cep: '95084-470',
      street: 'rua os 18 do forte',
      city: 'Caxias do Sul',
      uf: 'RS',
      cityLabel: 'Caxias do Sul, RS',
      precision: 'rua'
    });
    expect(r.draft).toMatchObject({ cep: '95084-470', city: 'Caxias do Sul, RS' });
  });

  it('refuses a CEP of another city or of another street, and a street the city does not have', async () => {
    const other = await a.resolveAddress({
      cep: '03307-000',
      city: 'Caxias do Sul, RS',
      street: 'Rua Sinimbu',
      neighborhood: 'Centro'
    });
    expect(other).toEqual({ ok: false, errors: { cep: 'Esse CEP é de São Paulo, SP. Confira o CEP ou a cidade.' } });
    // The street changed after the CEP: the new street's own CEP takes its place.
    const moved = await a.resolveAddress({
      cep: '95020-000',
      city: 'Caxias do Sul, RS',
      street: 'Rua Os 18 do Forte',
      neighborhood: 'Centro'
    });
    expect(moved.ok && moved.address.cep).toBe('95020-470');
    const unknown = await a.resolveAddress({
      cep: '',
      city: 'Caxias do Sul, RS',
      street: 'Rua Que Não Existe',
      neighborhood: 'Centro'
    });
    expect(unknown).toEqual({
      ok: false,
      errors: { street: 'Não achamos essa rua em Caxias do Sul. Escolha a rua na lista ou digite o CEP.' }
    });
  });
});

describe('the address with the real providers', () => {
  let r: typeof import('../services/remote/address');
  let answers: ((url: string) => { status: number; body: unknown } | null)[];
  const urls: string[] = [];
  const centre = { lat: -29.17, lon: -51.18 };

  beforeEach(async () => {
    vi.resetModules();
    urls.length = 0;
    answers = [];
    vi.stubGlobal('fetch', async (url: string) => {
      urls.push(url);
      for (const answer of answers) {
        const a = answer(url);
        if (a) return { ok: a.status === 200, status: a.status, json: async () => a.body };
      }
      throw new TypeError('Failed to fetch');
    });
    r = await import('../services/remote/address');
  });
  afterEach(() => vi.unstubAllGlobals());

  const viacep =
    (body: unknown, status = 200) =>
    (url: string) =>
      url.startsWith('https://viacep.com.br/ws/RS/') ? { status, body } : null;
  const photon = (features: unknown[]) => (url: string) =>
    url.startsWith('https://photon.komoot.io/') ? { status: 200, body: { features } } : null;
  const nominatim =
    (body: unknown, status = 200) =>
    (url: string) =>
      url.startsWith('https://nominatim.openstreetmap.org/') ? { status, body } : null;
  const feature = (p: Record<string, unknown>, lon = -51.18, lat = -29.17) => ({
    geometry: { coordinates: [lon, lat] },
    properties: { countrycode: 'BR', city: 'Caxias do Sul', ...p }
  });

  it('streets come from the Correios (ViaCEP) with their CEP and stretch; their neighbourhoods are suggested too', async () => {
    answers.push(
      viacep([
        { cep: '95020-470', logradouro: 'Rua Os 18 do Forte', complemento: 'até 1099/1100', bairro: 'Centro' },
        { cep: '95020-470', logradouro: 'Rua Os 18 do Forte', complemento: 'até 1099/1100', bairro: 'Centro' },
        { cep: '95084-470', logradouro: 'Rua Os 18 do Forte', complemento: '', bairro: 'São Pelegrino' }
      ]),
      photon([
        feature({ osm_key: 'place', name: 'São Pelegrino' }),
        feature({ osm_key: 'landuse', name: 'Pelegrino Residencial' }),
        feature({ osm_key: 'place', name: 'Pelegrino', city: 'Farroupilha' })
      ])
    );
    const streets = await r.streetsOnline('Caxias do Sul', 'RS', '18 do forte', centre);
    expect(urls[0]).toBe('https://viacep.com.br/ws/RS/Caxias%20do%20Sul/18%20do%20forte/json/');
    expect(streets).toEqual({
      items: [
        { street: 'Rua Os 18 do Forte', neighborhood: 'Centro', cep: '95020-470', detail: 'até 1099/1100' },
        { street: 'Rua Os 18 do Forte', neighborhood: 'São Pelegrino', cep: '95084-470', detail: '' }
      ]
    });
    const hoods = await r.neighborhoodsOnline('Caxias do Sul', 'RS', 'pele', centre);
    expect(hoods).toEqual({ items: ['São Pelegrino'], credit: 'Dados © OpenStreetMap' });
  });

  it('with ViaCEP out, the streets come from the map (credited)', async () => {
    answers.push(
      viacep(null, 503),
      photon([
        feature({ osm_key: 'highway', name: 'Rua Sinimbu', district: 'Centro', postcode: '95020-172' }),
        feature({ osm_key: 'highway', name: 'Rua Sinimbu', district: 'Centro', postcode: '95020-371' }),
        feature({ osm_key: 'highway', name: 'Rua Sinimbu', district: 'Centro' }, -46.6, -23.5) // far: another city
      ])
    );
    const streets = await r.streetsOnline('Caxias do Sul', 'RS', 'sinimbu', centre);
    expect(streets).toEqual({
      items: [{ street: 'Rua Sinimbu', neighborhood: 'Centro', cep: '95020-172', detail: '' }],
      credit: 'Dados © OpenStreetMap'
    });
  });

  const input = {
    street: 'Rua Sinimbu',
    number: '',
    neighborhood: 'São Pelegrino',
    city: 'Caxias do Sul',
    uf: 'RS',
    cep: '95020-510',
    cityCentre: centre,
    cepPoint: { lat: -29.16806, lon: -51.17944 }
  };
  const place = (lat: number, lon: number, address: Record<string, string>) => ({
    lat: String(lat),
    lon: String(lon),
    category: 'highway',
    addresstype: 'road',
    address: { road: 'Rua Sinimbu', 'ISO3166-2-lvl4': 'BR-RS', ...address }
  });

  it('the point is the stretch of the street in the neighbourhood typed (OpenStreetMap)', async () => {
    answers.push(
      nominatim([
        place(-29.1686, -51.1666, { suburb: 'Nossa Senhora de Lourdes', postcode: '95020-170' }),
        place(-29.1689, -51.1871, { suburb: 'São Pelegrino', postcode: '95020-510' }),
        place(-29.1688, -51.1787, { suburb: 'Centro', postcode: '95020-460' }),
        place(-23.5, -46.6, { suburb: 'São Pelegrino', 'ISO3166-2-lvl4': 'BR-SP' })
      ])
    );
    expect(await r.geocodeOnline(input)).toEqual({ point: { lat: -29.1689, lon: -51.1871 }, precision: 'rua' });
    expect(urls[0]).toContain('&street=Rua%20Sinimbu&city=Caxias%20do%20Sul');
  });

  it('with a number the map knows, the house itself', async () => {
    answers.push(
      nominatim([
        { ...place(-29.16891, -51.18705, { suburb: 'São Pelegrino', house_number: '1200' }), addresstype: 'building' }
      ])
    );
    expect(await r.geocodeOnline({ ...input, number: '1200' })).toEqual({
      point: { lat: -29.16891, lon: -51.18705 },
      precision: 'numero'
    });
    expect(urls[0]).toContain('&street=1200%20Rua%20Sinimbu');
  });

  it('Nominatim out: Photon; the map out: the CEP point; nothing: the city centre', async () => {
    answers.push(
      nominatim(null, 503),
      photon([feature({ osm_key: 'highway', name: 'Rua Sinimbu', district: 'São Pelegrino' }, -51.187, -29.1689)])
    );
    expect(await r.geocodeOnline(input)).toEqual({ point: { lat: -29.1689, lon: -51.187 }, precision: 'rua' });
    answers = [];
    expect(await r.geocodeOnline({ ...input, street: 'Rua Pinheiro Machado' })).toEqual({
      point: input.cepPoint,
      precision: 'cep'
    });
    expect(await r.geocodeOnline({ ...input, street: 'Rua Marechal Floriano', cepPoint: null })).toEqual({
      point: centre,
      precision: 'cidade'
    });
  });

  it('the CEP says whether its point is its own or only the city centre', async () => {
    answers.push((url) =>
      url.includes('brasilapi')
        ? {
            status: 200,
            body: url.endsWith('95020000')
              ? {
                  city: 'Caxias do Sul',
                  state: 'RS',
                  street: 'Rua Sinimbu',
                  neighborhood: 'Centro',
                  location: { coordinates: { latitude: '-29.16806', longitude: '-51.17944' } }
                }
              : { city: 'Caxias do Sul', state: 'RS', street: '', neighborhood: '', location: {} }
          }
        : null
    );
    expect(await r.lookupCepOnline('95020000')).toMatchObject({
      cep: '95020-000',
      point: { lat: -29.16806, lon: -51.17944 },
      pointPrecision: 'cep'
    });
    expect(await r.lookupCepOnline('95099999')).toMatchObject({ pointPrecision: 'cidade' });
  });
});
