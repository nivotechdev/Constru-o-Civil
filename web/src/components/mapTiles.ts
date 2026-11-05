// U76: the map's picture under the job's pin: OpenStreetMap's, or Google's (Map Tiles API) when Google is configured
// — Google's terms ask for its distance, time and route to be shown on its own map, never on another. The copyright
// line follows what is on the screen, as the terms ask. Loaded with the map (MapCanvas), never on the first screen.
import L from 'leaflet';

const TILE_URL = 'https://tile.googleapis.com/v1/2dtiles/{z}/{x}/{y}';
const VIEWPORT_URL = 'https://tile.googleapis.com/tile/v1/viewport';

/** Google's tiles on a Leaflet map, with Google's copyright for what is on the screen. */
export function googleLayer(map: L.Map, key: string, session: string): L.TileLayer {
  const layer = L.tileLayer(`${TILE_URL}?session=${encodeURIComponent(session)}&key=${encodeURIComponent(key)}`, {
    maxZoom: 21,
    maxNativeZoom: 21,
    attribution: 'Google'
  });
  let seq = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let shown = 'Google';
  const refresh = () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const b = map.getBounds();
      const mine = ++seq;
      try {
        const res = await fetch(
          `${VIEWPORT_URL}?session=${encodeURIComponent(session)}&key=${encodeURIComponent(key)}` +
            `&zoom=${Math.round(map.getZoom())}&north=${b.getNorth()}&south=${b.getSouth()}` +
            `&east=${b.getEast()}&west=${b.getWest()}`
        );
        const body = res.ok ? ((await res.json()) as { copyright?: string }) : null;
        const text = body?.copyright ? `Google · ${body.copyright}` : 'Google';
        if (mine !== seq || text === shown || !map.attributionControl) return;
        map.attributionControl.removeAttribution(shown);
        map.attributionControl.addAttribution(text);
        shown = text;
      } catch {
        // the line stays as it was
      }
    }, 400);
  };
  layer.on('add', () => {
    map.on('moveend', refresh);
    refresh();
  });
  layer.on('remove', () => {
    clearTimeout(timer);
    map.off('moveend', refresh);
    map.attributionControl?.removeAttribution(shown);
  });
  return layer;
}

/** OpenStreetMap's tiles (free, credited). */
export function osmLayer(): L.TileLayer {
  return L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
  });
}
