// U76: the address on the map as precisely as the free map data allows — names written the map's way, the right
// stretch of a long street, a CEP point that is only the city's, the neighbourhood before the city.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  likelySameNeighborhood,
  splitHouseNumber,
  streetKind,
  streetSimilarity,
  streetWords
} from '../utils/addressText';
import { stretchHas } from '../services/address';

describe('U76: street names as the map, the Correios and people write them', () => {
  it('spells out abbreviations and numbers, drops the kind and linking words', () => {
    expect(streetWords('R. Pe. Alberto Luiz Lamonato')).toEqual(['padre', 'alberto', 'luiz', 'lamonato']);
    expect(streetWords('Rua Os Dezoito do Forte')).toEqual(['18', 'forte']);
    expect(streetWords('Av. XV de Novembro')).toEqual(['15', 'novembro']);
    expect(streetWords('Rua Vinte e Cinco de Julho')).toEqual(['25', 'julho']);
    expect(streetWords('Rua A')).toEqual(['a']);
    expect(streetKind('Av. Júlio de Castilhos')).toBe('avenida');
    expect(streetKind('Sinimbu')).toBe('');
  });
  it('the same street with a title, a middle name or a surname left out', () => {
    expect(streetSimilarity('Rua Padre Alberto Luiz Lamonato', 'R. Pe. Alberto Lamonato')).toBe(0.9);
    expect(streetSimilarity('Rua Os 18 do Forte', 'Rua Os Dezoito do Forte')).toBe(1);
    expect(streetSimilarity('Rua Mário João Beviláqua', 'Rua Mario Joao Bevilacqua')).toBe(1);
    expect(streetSimilarity('Rua Marechal Floriano', 'Rua Mal. Floriano Peixoto')).toBe(0.85);
    expect(streetSimilarity('Avenida Júlio de Castilhos', 'Rua Júlio de Castilhos')).toBe(1);
  });
  it('another street is not the same', () => {
    expect(streetSimilarity('Rua Sinimbu', 'Rua Pinheiro Machado')).toBe(0);
    expect(streetSimilarity('Rua A', 'Rua B')).toBe(0);
    expect(streetSimilarity('Rua Floriano', 'Rua Marechal Floriano Peixoto')).toBeLessThan(0.8);
    expect(streetSimilarity('Rua João Pessoa', 'Rua Fernando Pessoa')).toBeLessThan(0.8);
  });
  it('neighbourhoods by their short and long names', () => {
    expect(likelySameNeighborhood('Lourdes', 'Nossa Senhora de Lourdes')).toBe(true);
    expect(likelySameNeighborhood('N. Sra. de Lourdes', 'Nossa Senhora de Lourdes')).toBe(true);
    expect(likelySameNeighborhood('Jd. América', 'Jardim América')).toBe(true);
    expect(likelySameNeighborhood('Centro', 'São Pelegrino')).toBe(false);
  });
  it('takes the house number typed with the street, never a name that is a number', () => {
    expect(splitHouseNumber('Rua Sinimbu, 1234')).toEqual({ street: 'Rua Sinimbu', number: '1234' });
    expect(splitHouseNumber('Rua Sinimbu nº 1234 ap 3')).toEqual({ street: 'Rua Sinimbu', number: '1234' });
    expect(splitHouseNumber('Rua Sinimbu 1234 A')).toEqual({ street: 'Rua Sinimbu', number: '1234A' });
    expect(splitHouseNumber('Rua Sinimbu, 1234, apto 202')).toEqual({ street: 'Rua Sinimbu', number: '1234' });
    expect(splitHouseNumber('Rua Os 18 do Forte 200')).toEqual({ street: 'Rua Os 18 do Forte', number: '200' });
    expect(splitHouseNumber('Rua 7, 120')).toEqual({ street: 'Rua 7', number: '120' });
    expect(splitHouseNumber('Rua Os 18 do Forte')).toEqual({ street: 'Rua Os 18 do Forte', number: '' });
    expect(splitHouseNumber('Avenida 25 de Julho')).toEqual({ street: 'Avenida 25 de Julho', number: '' });
    expect(splitHouseNumber('Rua 7')).toEqual({ street: 'Rua 7', number: '' });
    expect(splitHouseNumber('Rua Sinimbu s/n')).toEqual({ street: 'Rua Sinimbu s/n', number: '' });
  });
  it("reads which numbers a CEP's stretch of the street has", () => {
    expect(stretchHas('até 799/800', '640')).toBe(true);
    expect(stretchHas('até 799/800', '1200')).toBe(false);
    expect(stretchHas('de 801/802 a 1499/1500', '1200')).toBe(true);
    expect(stretchHas('de 1501/1502 ao fim', '1200')).toBe(false);
    expect(stretchHas('de 1501/1502 ao fim', '2210')).toBe(true);
    expect(stretchHas('lado ímpar', '1201')).toBe(true);
    expect(stretchHas('de 1001 ao fim - lado par', '1201')).toBe(false);
    expect(stretchHas('', '1200')).toBeNull();
    expect(stretchHas('até 799/800', '')).toBeNull();
  });
});

describe('U76: where the address is on the map', () => {
  let r: typeof import('../services/remote/address');
  let answers: ((url: string) => { status: number; body: unknown } | null)[];
  const urls: string[] = [];
  const centre = { lat: -29.16, lon: -51.18 };

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
    r.nominatimPolicy.gapMs = 0;
  });
  afterEach(() => vi.unstubAllGlobals());

  const input = {
    street: 'Rua Sinimbu',
    number: '',
    neighborhood: 'Lourdes',
    city: 'Caxias do Sul',
    uf: 'RS',
    cep: '95070-000',
    cityCentre: centre,
    cepPoint: null
  };
  const road = (lat: number, lon: number, address: Record<string, string>, name = 'Rua Sinimbu') => ({
    lat: String(lat),
    lon: String(lon),
    name,
    category: 'highway',
    addresstype: 'road',
    address: { road: name, 'ISO3166-2-lvl4': 'BR-RS', ...address }
  });
  const streetSearch =
    (body: unknown[], match = '&street=') =>
    (url: string) =>
      url.startsWith('https://nominatim.openstreetmap.org/') && url.includes(match) ? { status: 200, body } : null;
  const placeSearch = (body: unknown[]) => (url: string) =>
    url.startsWith('https://nominatim.openstreetmap.org/') && url.includes('&q=') ? { status: 200, body } : null;

  it('a long street: the stretch in the neighbourhood, by its long name too, the middle one of several', async () => {
    answers.push(
      streetSearch([
        road(-29.1686, -51.1666, { suburb: 'Centro' }),
        road(-29.172, -51.188, { suburb: 'Nossa Senhora de Lourdes' }),
        road(-29.1725, -51.19, { suburb: 'Nossa Senhora de Lourdes' }),
        road(-29.173, -51.192, { suburb: 'Nossa Senhora de Lourdes' }),
        road(-29.16, -51.17, { suburb: 'Lourdes' }, 'Rua Pinheiro Machado')
      ])
    );
    expect(await r.geocodeOnline(input)).toEqual({ point: { lat: -29.1725, lon: -51.19 }, precision: 'rua' });
    expect(urls[0]).toContain('dedupe=0');
    expect(urls[0]).toContain('&street=Rua%20Sinimbu&city=Caxias%20do%20Sul');
  });

  it('the map names the street another way: asks by its last word and matches the name', async () => {
    answers.push(
      streetSearch([], '&street=Rua%20Padre'),
      streetSearch(
        [road(-29.2101, -51.1702, { suburb: 'Nossa Senhora da Saúde' }, 'Rua Padre Alberto Lamonato')],
        '&street=lamonato'
      )
    );
    const found = await r.geocodeOnline({
      ...input,
      street: 'Rua Padre Alberto Luiz Lamonato',
      neighborhood: 'Nossa Senhora da Saúde',
      cep: '95032-773'
    });
    expect(found).toEqual({ point: { lat: -29.2101, lon: -51.1702 }, precision: 'rua' });
  });

  it('no stretch in the neighbourhood by name: the one nearest the neighbourhood on the map', async () => {
    answers.push(
      streetSearch([road(-29.1686, -51.1666, { suburb: 'Centro' }), road(-29.19, -51.21, { suburb: 'Desvio Rizzo' })]),
      placeSearch([{ lat: '-29.1880', lon: '-51.2080', name: 'Lourdes', category: 'place', address: {} }])
    );
    expect(await r.geocodeOnline(input)).toEqual({ point: { lat: -29.19, lon: -51.21 }, precision: 'rua' });
  });

  it('the house with the number typed in the street field', async () => {
    answers.push(
      streetSearch([
        { ...road(-29.17251, -51.19011, { suburb: 'Lourdes', house_number: '1234' }), addresstype: 'building' },
        road(-29.1725, -51.19, { suburb: 'Lourdes' })
      ])
    );
    expect(await r.geocodeOnline({ ...input, street: 'Rua Sinimbu, 1234' })).toEqual({
      point: { lat: -29.17251, lon: -51.19011 },
      precision: 'numero'
    });
    expect(urls[0]).toContain('&street=1234%20Rua%20Sinimbu');
  });

  it('a street of another city or another state is never taken', async () => {
    answers.push(
      streetSearch([
        road(-23.5, -46.6, { suburb: 'Lourdes' }),
        road(-29.17, -51.19, { suburb: 'Lourdes', 'ISO3166-2-lvl4': 'BR-SC' })
      ]),
      placeSearch([{ lat: '-29.1880', lon: '-51.2080', name: 'Nossa Senhora de Lourdes', category: 'place' }])
    );
    expect(await r.geocodeOnline(input)).toEqual({ point: { lat: -29.188, lon: -51.208 }, precision: 'bairro' });
  });

  it('a CEP point that is only the city centre is not the CEP point', async () => {
    answers.push((url) =>
      url.includes('brasilapi')
        ? {
            status: 200,
            body: {
              city: 'Caxias do Sul',
              state: 'RS',
              street: 'Rua Padre Alberto Luiz Lamonato',
              neighborhood: 'Nossa Senhora da Saúde',
              location: { coordinates: { latitude: '-29.16806', longitude: '-51.17944' } }
            }
          }
        : null
    );
    expect(await r.lookupCepOnline('95032773')).toMatchObject({ pointPrecision: 'cidade', point: centre });
  });

  it('asks Nominatim one request at a time, spaced as its rules ask', async () => {
    r.nominatimPolicy.gapMs = 120;
    const times: number[] = [];
    answers.push((url) => {
      if (!url.startsWith('https://nominatim')) return null;
      times.push(Date.now());
      return { status: 200, body: [] };
    });
    await r.geocodeOnline({ ...input, street: 'Rua Que Não Existe Mesmo' });
    expect(times.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < times.length; i++) expect(times[i] - times[i - 1]).toBeGreaterThanOrEqual(110);
  });
});
