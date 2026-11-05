import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  decodePolyline,
  drivingRoute,
  forgetRoutes,
  formatDriveTime,
  formatRoadKm,
  routeDistanceText,
  routeTimeText
} from '../services/route';
import {
  decodificarLinha,
  lerRota,
  pedidoDeRota,
  porEndereco,
  textoDoEndereco
} from '../../supabase/functions/_shared/googleRoutes';

beforeEach(() => forgetRoutes());
afterEach(() => vi.unstubAllGlobals());

const valhallaOk = (km: number, s: number, shape = '') => ({
  trip: { status: 0, summary: { length: km, time: s }, legs: [{ shape }] }
});
const osrmOk = (m: number, s: number) => ({
  code: 'Ok',
  routes: [
    {
      distance: m,
      duration: s,
      geometry: {
        coordinates: [
          [-51.1, -29.1],
          [-51.2, -29.2]
        ]
      }
    }
  ]
});

describe('U54/U76: road distance and time, as Google Maps writes them', () => {
  it('formats the distance', () => {
    expect(formatRoadKm(640)).toBe('640 m');
    expect(formatRoadKm(3240)).toBe('3,2 km');
    expect(formatRoadKm(12000)).toBe('12 km');
    expect(formatRoadKm(12400)).toBe('12,4 km');
    expect(formatRoadKm(142000)).toBe('142 km');
  });
  it('formats the time the way Google Maps does in Portuguese', () => {
    expect(formatDriveTime(20)).toBe('1 min');
    expect(formatDriveTime(560)).toBe('9 min');
    expect(formatDriveTime(3900)).toBe('1 h 5 min');
    expect(formatDriveTime(7200)).toBe('2 h');
  });
  it("Google's own words win when Google answered", () => {
    const base = { meters: 3240, seconds: 560, path: [], provider: 'google' as const };
    expect(routeDistanceText({ ...base, distanceText: '3,3 km' })).toBe('3,3 km');
    expect(routeTimeText({ ...base, durationText: '11 min' })).toBe('11 min');
    expect(routeTimeText({ ...base, provider: 'valhalla' })).toBe('9 min');
  });
  it('decodes an encoded line (6 decimals: Valhalla; 5: Google)', () => {
    // The example of Google's documentation: (38.5, -120.2), (40.7, -120.95), (43.252, -126.453).
    expect(decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@', 5)).toEqual([
      [38.5, -120.2],
      [40.7, -120.95],
      [43.252, -126.453]
    ]);
    expect(decodificarLinha('_p~iF~ps|U_ulLnnqC_mqNvxq`@')).toEqual([
      [38.5, -120.2],
      [40.7, -120.95],
      [43.252, -126.453]
    ]);
  });
});

describe('U76: the free route — Valhalla first, then OSRM', () => {
  it('reads Valhalla (km → m, its line) and sends only the two points', async () => {
    const urls: string[] = [];
    vi.stubGlobal('fetch', async (u: string) => {
      urls.push(String(u));
      return new Response(JSON.stringify(valhallaOk(3.24, 612, '_p~iF~ps|U')));
    });
    const r = await drivingRoute({ lat: -29.1, lon: -51.1 }, { lat: -29.2, lon: -51.2 });
    expect(r).toMatchObject({ meters: 3240, seconds: 612, provider: 'valhalla' });
    expect(r?.path.length).toBe(1);
    expect(urls[0]).toMatch(/^https:\/\/valhalla1\.openstreetmap\.de\/route\?json=/);
    const req = JSON.parse(decodeURIComponent(urls[0].split('?json=')[1]));
    expect(req).toMatchObject({ costing: 'auto', units: 'kilometers' });
    expect(req.locations).toEqual([
      { lat: -29.1, lon: -51.1, type: 'break' },
      { lat: -29.2, lon: -51.2, type: 'break' }
    ]);
  });
  it('Valhalla out: OSRM (lon,lat → lat,lon); nothing answers: null', async () => {
    const urls: string[] = [];
    vi.stubGlobal('fetch', async (u: string) => {
      urls.push(String(u));
      return String(u).includes('valhalla')
        ? new Response('x', { status: 503 })
        : new Response(JSON.stringify(osrmOk(3240, 560)));
    });
    const r = await drivingRoute({ lat: -29.1, lon: -51.1 }, { lat: -29.2, lon: -51.2 });
    expect(r).toEqual({
      meters: 3240,
      seconds: 560,
      provider: 'osrm',
      path: [
        [-29.1, -51.1],
        [-29.2, -51.2]
      ]
    });
    expect(urls[1]).toContain(
      'routing.openstreetmap.de/routed-car/route/v1/driving/-51.100000,-29.100000;-51.200000,-29.200000'
    );
    forgetRoutes();
    vi.stubGlobal('fetch', async () => Promise.reject(new Error('offline')));
    expect(await drivingRoute({ lat: 0, lon: 0 }, { lat: 1, lon: 1 })).toBeNull();
  });
  it('asks each route once; a screen that gives up gets null and the answer stays for the next', async () => {
    let calls = 0;
    vi.stubGlobal('fetch', async () => {
      calls++;
      return new Response(JSON.stringify(valhallaOk(1.2, 200)));
    });
    const ctl = new AbortController();
    const first = drivingRoute({ lat: -29.1, lon: -51.1 }, { lat: -29.2, lon: -51.2 }, ctl.signal);
    ctl.abort();
    expect(await first).toBeNull();
    const again = await drivingRoute({ lat: -29.1, lon: -51.1 }, { lat: -29.2, lon: -51.2 });
    expect(again?.meters).toBe(1200);
    expect(calls).toBe(1);
  });
});

describe('U76: the route by Google (Edge Function calcular-rota)', () => {
  const casa = {
    street: 'Rua Sinimbu, 1234',
    neighborhood: 'Centro',
    city: 'Caxias do Sul',
    uf: 'RS',
    cep: '95020-000',
    lat: -29.168,
    lon: -51.179
  };
  it('writes each address the way it is typed in Google Maps', () => {
    expect(textoDoEndereco(casa)).toBe('Rua Sinimbu, 1234 - Centro, Caxias do Sul - RS, 95020-000, Brasil');
    expect(textoDoEndereco({ ...casa, street: 'Rua Bolívia', number: '77', neighborhood: 'Jardim América' })).toBe(
      'Rua Bolívia, 77 - Jardim América, Caxias do Sul - RS, 95020-000, Brasil'
    );
  });
  it('asks a car route with the traffic of now, in Portuguese, one route', () => {
    expect(pedidoDeRota(porEndereco(casa), { location: { latLng: { latitude: 1, longitude: 2 } } })).toEqual({
      origin: { address: 'Rua Sinimbu, 1234 - Centro, Caxias do Sul - RS, 95020-000, Brasil' },
      destination: { location: { latLng: { latitude: 1, longitude: 2 } } },
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_AWARE_OPTIMAL',
      computeAlternativeRoutes: false,
      languageCode: 'pt-BR',
      regionCode: 'br',
      units: 'METRIC'
    });
  });
  it("reads Google's answer: metres, seconds with traffic, its words, the line and where it put each address", () => {
    expect(
      lerRota({
        routes: [
          {
            distanceMeters: 3312,
            duration: '664s',
            staticDuration: '590s',
            polyline: { encodedPolyline: '_p~iF~ps|U' },
            localizedValues: { distance: { text: '3,3 km' }, duration: { text: '11 min' } },
            legs: [
              {
                startLocation: { latLng: { latitude: -29.1681, longitude: -51.1794 } },
                endLocation: { latLng: { latitude: -29.1569, longitude: -51.1712 } }
              }
            ]
          }
        ]
      })
    ).toEqual({
      metros: 3312,
      segundos: 664,
      segundos_sem_transito: 590,
      texto_distancia: '3,3 km',
      texto_tempo: '11 min',
      caminho: [[38.5, -120.2]],
      origem: { lat: -29.1681, lon: -51.1794 },
      destino: { lat: -29.1569, lon: -51.1712 }
    });
    expect(lerRota({})).toBeNull();
    expect(lerRota({ routes: [{ distanceMeters: 10 }] })).toBeNull();
  });
});
