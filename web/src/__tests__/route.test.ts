import { afterEach, describe, expect, it, vi } from 'vitest';
import { drivingRoute, formatDriveTime, formatRoadKm } from '../services/route';
import { mapOpenUrl } from '../utils/mapUrls';

afterEach(() => vi.unstubAllGlobals());

describe('U54: road distance and time, as Google Maps writes them', () => {
  it('formats the distance', () => {
    expect(formatRoadKm(640)).toBe('640 m');
    expect(formatRoadKm(3240)).toBe('3,2 km');
    expect(formatRoadKm(12000)).toBe('12 km');
    expect(formatRoadKm(12400)).toBe('12,4 km');
    expect(formatRoadKm(142000)).toBe('142 km');
  });
  it('formats the time', () => {
    expect(formatDriveTime(20)).toBe('1 min');
    expect(formatDriveTime(560)).toBe('9 min');
    expect(formatDriveTime(3900)).toBe('1 h 05 min');
    expect(formatDriveTime(7200)).toBe('2 h');
  });
  it('reads the route (lon,lat → lat,lon) and gives null on any failure', async () => {
    const ok = {
      code: 'Ok',
      routes: [
        {
          distance: 3240,
          duration: 560,
          geometry: {
            coordinates: [
              [-51.1, -29.1],
              [-51.2, -29.2]
            ]
          }
        }
      ]
    };
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(ok)));
    vi.stubGlobal('fetch', fetchMock);
    const r = await drivingRoute({ lat: -29.1, lon: -51.1 }, { lat: -29.2, lon: -51.2 });
    expect(r).toEqual({
      meters: 3240,
      seconds: 560,
      path: [
        [-29.1, -51.1],
        [-29.2, -51.2]
      ]
    });
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toContain(
      '/driving/-51.100000,-29.100000;-51.200000,-29.200000'
    );
    vi.stubGlobal('fetch', async () => new Response('x', { status: 500 }));
    expect(await drivingRoute({ lat: 0, lon: 0 }, { lat: 1, lon: 1 })).toBeNull();
    vi.stubGlobal('fetch', async () => Promise.reject(new Error('offline')));
    expect(await drivingRoute({ lat: 0, lon: 0 }, { lat: 1, lon: 1 })).toBeNull();
  });
  it('asks the second server when the first does not answer', async () => {
    const ok = { code: 'Ok', routes: [{ distance: 900, duration: 120, geometry: { coordinates: [[-51.1, -29.1]] } }] };
    const urls: string[] = [];
    vi.stubGlobal('fetch', async (u: string) => {
      urls.push(String(u));
      return urls.length === 1 ? new Response('x', { status: 503 }) : new Response(JSON.stringify(ok));
    });
    const r = await drivingRoute({ lat: -29.1, lon: -51.1 }, { lat: -29.2, lon: -51.2 });
    expect(r?.meters).toBe(900);
    expect(urls[1]).toContain('routing.openstreetmap.de');
  });
  it('opens the route in Google Maps by car', () => {
    expect(mapOpenUrl({ lat: -29.1, lon: -51.2 }, { lat: -29.3, lon: -51.4 })).toBe(
      'https://www.google.com/maps/dir/?api=1&origin=-29.300000,-51.400000&destination=-29.100000,-51.200000&travelmode=driving'
    );
  });
});
