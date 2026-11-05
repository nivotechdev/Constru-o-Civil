import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  decodePolyline,
  driveText,
  forgetRoutes,
  formatDriveTime,
  formatRoadKm,
  knownWalkDistance,
  routeToJob,
  walkDistance,
  walkText
} from '../services/route';
import {
  decodificarLinha,
  lerMatriz,
  lerRota,
  pedidoDeMatriz,
  pedidoDeRota,
  porEndereco,
  textoDoEndereco
} from '../../supabase/functions/_shared/googleRoutes';

beforeEach(() => forgetRoutes());
afterEach(() => vi.unstubAllGlobals());

const home = { lat: -29.1681, lon: -51.1794 };
const job = (id: string, lat: number, lon: number) => ({ id, lat, lon });
const valhallaRoute = (km: number, s: number, shape = '') => ({
  trip: { status: 0, summary: { length: km, time: s }, legs: [{ shape }] }
});
/** The JSON a free-server URL carries in ?json=. */
const reqOf = (url: string) => JSON.parse(decodeURIComponent(url.split('?json=')[1]));

describe('U54/U76: distance and time, as Google Maps writes them', () => {
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
    expect(walkText({ meters: 1240, provider: 'google', text: '1,3 km' })).toBe('1,3 km');
    expect(walkText({ meters: 1240, provider: 'valhalla' })).toBe('1,2 km');
    const route = { walk: { meters: 1, provider: 'google' as const }, path: [], driveSeconds: 560 };
    expect(driveText({ ...route, driveText: '11 min' })).toBe('11 min');
    expect(driveText(route)).toBe('9 min');
    expect(driveText({ ...route, driveSeconds: null })).toBeNull();
  });
  it('decodes an encoded line (6 decimals: Valhalla; 5: Google)', () => {
    // The example of Google's documentation: (38.5, -120.2), (40.7, -120.95), (43.252, -126.453).
    const line = [
      [38.5, -120.2],
      [40.7, -120.95],
      [43.252, -126.453]
    ];
    expect(decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@', 5)).toEqual(line);
    expect(decodificarLinha('_p~iF~ps|U_ulLnnqC_mqNvxq`@')).toEqual(line);
  });
});

describe('U80: the distance ON FOOT — one number for the card and the job page', () => {
  it("the mural's cards are asked together, on foot, in one request, and kept", async () => {
    const urls: string[] = [];
    vi.stubGlobal('fetch', async (u: string) => {
      urls.push(String(u));
      return new Response(
        JSON.stringify({
          sources_to_targets: [
            [
              { distance: 1.24, time: 900, to_index: 0 },
              { distance: 0.65, time: 470, to_index: 1 },
              { distance: null, time: null, to_index: 2 }
            ]
          ]
        })
      );
    });
    const [a, b, c] = await Promise.all([
      walkDistance(job('BC-1', -29.16, -51.17), home, false),
      walkDistance(job('BC-2', -29.17, -51.18), home, false),
      walkDistance(job('BC-3', -29.19, -51.2), home, false)
    ]);
    expect(urls).toHaveLength(1);
    expect(urls[0]).toMatch(/^https:\/\/valhalla1\.openstreetmap\.de\/sources_to_targets\?json=/);
    expect(reqOf(urls[0])).toMatchObject({ costing: 'pedestrian', sources: [home], targets: [{}, {}, {}] });
    expect(a).toEqual({ meters: 1240, provider: 'valhalla' });
    expect(b).toEqual({ meters: 650, provider: 'valhalla' });
    expect(c).toBeNull();
    // Kept: asked again, no request — and readable at once by the job's page.
    expect(await walkDistance(job('BC-1', -29.16, -51.17), home, false)).toEqual(a);
    expect(knownWalkDistance({ lat: -29.16, lon: -51.17 }, home, false)).toEqual(a);
    expect(urls).toHaveLength(1);
  });

  it("the job's page: the way ON FOOT on the map, the time BY CAR — and the card's number, never another", async () => {
    const urls: string[] = [];
    vi.stubGlobal('fetch', async (u: string) => {
      urls.push(String(u));
      if (String(u).includes('sources_to_targets'))
        return new Response(JSON.stringify({ sources_to_targets: [[{ distance: 1.24, to_index: 0 }]] }));
      const costing = reqOf(String(u)).costing;
      // The route on foot measures 1.25 km: the page still says the card's 1,2 km.
      return new Response(
        JSON.stringify(costing === 'pedestrian' ? valhallaRoute(1.25, 940, '_p~iF~ps|U') : valhallaRoute(1.9, 300))
      );
    });
    const card = await walkDistance(job('BC-1', -29.16, -51.17), home, false);
    const page = await routeToJob(job('BC-1', -29.16, -51.17), home, undefined, false);
    expect(page).toEqual({ walk: card, path: [[3.85, -12.02]], driveSeconds: 300 });
    const costings = urls.filter((u) => u.includes('/route?')).map((u) => reqOf(u).costing);
    expect(costings.sort()).toEqual(['auto', 'pedestrian']);
  });

  it('a job opened straight (no card before): the route on foot is the number, and the card then says the same', async () => {
    vi.stubGlobal('fetch', async (u: string) => {
      if (String(u).includes('sources_to_targets')) throw new Error('the card must not ask');
      const costing = reqOf(String(u)).costing;
      return new Response(
        JSON.stringify(costing === 'pedestrian' ? valhallaRoute(0.82, 600) : valhallaRoute(1.1, 180))
      );
    });
    const page = await routeToJob(job('BC-9', -29.17, -51.18), home, undefined, false);
    expect(page?.walk).toEqual({ meters: 820, provider: 'valhalla' });
    expect(await walkDistance(job('BC-9', -29.17, -51.18), home, false)).toEqual({ meters: 820, provider: 'valhalla' });
  });

  it('kept on the phone: the next visit reads the same number without asking', async () => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k)
    });
    forgetRoutes();
    vi.stubGlobal(
      'fetch',
      async () => new Response(JSON.stringify({ sources_to_targets: [[{ distance: 2.31, to_index: 0 }]] }))
    );
    await walkDistance(job('BC-1', -29.16, -51.17), home, false);
    const saved = [...store.values()].join('');
    vi.resetModules();
    const fresh = await import('../services/route');
    vi.stubGlobal('fetch', async () => {
      throw new Error('no request on the next visit');
    });
    store.set('valorjob:distancia-a-pe-v1', saved);
    expect(fresh.knownWalkDistance({ lat: -29.16, lon: -51.17 }, home, false)).toEqual({
      meters: 2310,
      provider: 'valhalla'
    });
  });

  it("Valhalla's matrix out: OSRM's table on foot; both out: one route on foot each; nothing: null", async () => {
    const urls: string[] = [];
    vi.stubGlobal('fetch', async (u: string) => {
      urls.push(String(u));
      if (String(u).includes('valhalla')) return new Response('x', { status: 503 });
      return new Response(JSON.stringify({ code: 'Ok', distances: [[0, 1500, 720]] }));
    });
    const [a, b] = await Promise.all([
      walkDistance(job('BC-1', -29.16, -51.17), home, false),
      walkDistance(job('BC-2', -29.17, -51.18), home, false)
    ]);
    expect([a?.meters, b?.meters]).toEqual([1500, 720]);
    expect(urls[1]).toContain('routing.openstreetmap.de/routed-foot/table/v1/driving/-51.179400,-29.168100;');
    expect(urls[1]).toContain('?sources=0&annotations=distance');

    forgetRoutes();
    urls.length = 0;
    vi.stubGlobal('fetch', async (u: string) => {
      urls.push(String(u));
      if (String(u).includes('/route?')) return new Response(JSON.stringify(valhallaRoute(0.9, 650)));
      return new Response('x', { status: 503 });
    });
    expect(await walkDistance(job('BC-1', -29.16, -51.17), home, false)).toEqual({ meters: 900, provider: 'valhalla' });
    expect(reqOf(urls.find((u) => u.includes('/route?')) as string).costing).toBe('pedestrian');

    forgetRoutes();
    vi.stubGlobal('fetch', async () => Promise.reject(new Error('offline')));
    expect(await walkDistance(job('BC-1', -29.16, -51.17), home, false)).toBeNull();
    expect(await routeToJob(job('BC-1', -29.16, -51.17), home, undefined, false)).toBeNull();
  });

  it('on foot, OSRM answers through its "foot" server when Valhalla is out', async () => {
    const urls: string[] = [];
    vi.stubGlobal('fetch', async (u: string) => {
      urls.push(String(u));
      if (String(u).includes('valhalla')) return new Response('x', { status: 503 });
      return new Response(
        JSON.stringify({
          code: 'Ok',
          routes: [{ distance: 1320, duration: 990, geometry: { coordinates: [[-51.1, -29.1]] } }]
        })
      );
    });
    const page = await routeToJob(job('BC-1', -29.16, -51.17), home, undefined, false);
    expect(page?.walk).toEqual({ meters: 1320, provider: 'osrm' });
    expect(page?.path).toEqual([[-29.1, -51.1]]);
    expect(urls.some((u) => u.includes('/routed-foot/route/v1/driving/'))).toBe(true);
    expect(urls.some((u) => u.includes('/routed-car/route/v1/driving/'))).toBe(true);
  });
});

describe('U80: Google (Edge Function calcular-rota) — on foot for the distance, by car for the time', () => {
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
  it('asks on foot without traffic preference (Google refuses it there), by car with the traffic of now', () => {
    const walk = pedidoDeRota(porEndereco(casa), porEndereco(casa), 'WALK');
    expect(walk).toMatchObject({ travelMode: 'WALK', languageCode: 'pt-BR', regionCode: 'br', units: 'METRIC' });
    expect(walk).not.toHaveProperty('routingPreference');
    expect(pedidoDeRota(porEndereco(casa), porEndereco(casa))).toMatchObject({
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_AWARE_OPTIMAL'
    });
  });
  it("reads a route: metres, seconds, Google's words, the line and where it put each address", () => {
    expect(
      lerRota({
        routes: [
          {
            distanceMeters: 1312,
            duration: '964s',
            polyline: { encodedPolyline: '_p~iF~ps|U' },
            localizedValues: { distance: { text: '1,3 km' }, duration: { text: '16 min' } },
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
      metros: 1312,
      segundos: 964,
      segundos_sem_transito: null,
      texto_distancia: '1,3 km',
      texto_tempo: '16 min',
      caminho: [[38.5, -120.2]],
      origem: { lat: -29.1681, lon: -51.1794 },
      destino: { lat: -29.1569, lon: -51.1712 }
    });
    expect(lerRota({})).toBeNull();
  });
  it('the cards: one matrix on foot from the home to every job, read in the order asked', () => {
    expect(pedidoDeMatriz(porEndereco(casa), [porEndereco(casa)])).toEqual({
      origins: [{ waypoint: { address: textoDoEndereco(casa) } }],
      destinations: [{ waypoint: { address: textoDoEndereco(casa) } }],
      travelMode: 'WALK',
      languageCode: 'pt-BR',
      regionCode: 'br',
      units: 'METRIC'
    });
    expect(
      lerMatriz(
        [
          { originIndex: 0, destinationIndex: 2, condition: 'ROUTE_EXISTS', distanceMeters: 640 },
          {
            originIndex: 0,
            destinationIndex: 0,
            condition: 'ROUTE_EXISTS',
            distanceMeters: 1312,
            localizedValues: { distance: { text: '1,3 km' } }
          },
          { originIndex: 0, destinationIndex: 1, condition: 'ROUTE_NOT_FOUND' },
          { originIndex: 0, destinationIndex: 3, condition: 'ROUTE_EXISTS' }
        ],
        4
      )
    ).toEqual([{ metros: 1312, texto: '1,3 km' }, null, { metros: 640, texto: null }, { metros: 0, texto: null }]);
  });
});
