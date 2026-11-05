// U76: the session Google's map tiles need (Map Tiles API) — a token valid for about two weeks, asked once and kept on
// the phone (one for the light map, one for the dark). No Leaflet here: the job page asks it before the map loads,
// to know whose map (and so whose route) to show.
import { FEATURES, GOOGLE_MAPS_KEY } from './features';

const SESSION_URL = 'https://tile.googleapis.com/v1/createSession';
const STORE_KEY = 'valorjob:google-tiles';

/** Google's dark map, for the dark theme (its own colours: Google's tiles are never filtered). */
const DARK_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#1f2735' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#9aa3b2' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1f2735' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#253043' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#1e3330' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#36404f' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#1a212c' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#4a5568' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2a3445' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f1a2b' }] }
];

export interface Session {
  session: string;
  /** Unix seconds. */
  expiry: number;
}

const sessions = new Map<string, Promise<Session | null>>();

function stored(theme: string): Session | null {
  try {
    const all = JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}') as Record<string, Session>;
    const s = all[theme];
    // An hour of margin: a tile asked with an expired session comes back as an error.
    return s && s.session && s.expiry * 1000 > Date.now() + 3600_000 ? s : null;
  } catch {
    return null;
  }
}

function keep(theme: string, s: Session): void {
  try {
    const all = JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}') as Record<string, Session>;
    localStorage.setItem(STORE_KEY, JSON.stringify({ ...all, [theme]: s }));
  } catch {
    // private window: asked again next time
  }
}

/** The Google tiles session for this theme (light or dark); null when Google refuses (wrong key, quota). */
export function googleSession(dark: boolean, key = GOOGLE_MAPS_KEY): Promise<Session | null> {
  if (!FEATURES.googleMaps || !key) return Promise.resolve(null);
  const theme = dark ? 'dark' : 'light';
  const known = stored(theme);
  if (known) return Promise.resolve(known);
  const hit = sessions.get(theme);
  if (hit) return hit;
  const p = (async () => {
    try {
      const res = await fetch(`${SESSION_URL}?key=${encodeURIComponent(key)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mapType: 'roadmap',
          language: 'pt-BR',
          region: 'BR',
          ...(dark ? { styles: DARK_STYLE } : {})
        })
      });
      if (!res.ok) return null;
      const body = (await res.json()) as { session?: string; expiry?: string | number };
      const s = { session: String(body.session ?? ''), expiry: Number(body.expiry ?? 0) };
      if (!s.session || !Number.isFinite(s.expiry)) return null;
      keep(theme, s);
      return s;
    } catch {
      return null;
    }
  })();
  sessions.set(theme, p);
  p.then((s) => !s && sessions.delete(theme));
  return p;
}
