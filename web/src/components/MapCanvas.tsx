// U54/U56: the map itself (Leaflet + OpenStreetMap tiles), loaded only when the job map is about to show. Nothing but the
// job's pin, the worker's blue dot and the road between them. `static` is the picture inside the job page (it does not
// move; one button opens it); `full` is the full-screen one: one finger moves it, two fingers pinch, the buttons zoom
// and put the job and the worker back in view.
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '../styles/map.css';
import { useEffect, useRef } from 'react';
import type { GeoPoint } from '../types/models';
import { Icon } from './icons/Icon';

type Props = {
  job: GeoPoint;
  origin: GeoPoint | null;
  path: [number, number][] | null;
  label: string;
  mode: 'static' | 'full';
  onExpand?: () => void;
};

const ctl =
  'w-11 h-11 flex items-center justify-center rounded-full bg-concrete-0 text-concrete-900 border border-concrete-200 shadow-[0_2px_8px_rgba(16,24,40,0.18)] active:bg-concrete-100';

/** A 24-box stroke icon, drawn like the others (round caps, 2px) so every button glyph sits on the same centre. */
function Glyph({ d }: { d: string }) {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

const PIN =
  '<svg width="34" height="44" viewBox="0 0 34 44" xmlns="http://www.w3.org/2000/svg"><path d="M17 43C17 43 3 28.5 3 16.5a14 14 0 0 1 28 0C31 28.5 17 43 17 43Z" fill="#1d4bed" stroke="#fff" stroke-width="2.5" stroke-linejoin="round"/><circle cx="17" cy="16.5" r="5.5" fill="#fff"/></svg>';

export default function MapCanvas({ job, origin, path, label, mode, onExpand }: Props) {
  const full = mode === 'full';
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const m = L.map(el, {
      zoomControl: false,
      minZoom: 4,
      maxZoom: 18,
      zoomSnap: 0.5,
      bounceAtZoomLimits: false,
      dragging: full,
      touchZoom: full,
      doubleClickZoom: full,
      scrollWheelZoom: full ? 'center' : false,
      boxZoom: false,
      keyboard: full
    });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(m);
    m.attributionControl.setPrefix(false);
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(el);
    return () => {
      ro.disconnect();
      m.remove();
      map.current = null;
    };
  }, [full]);

  function fit(animate: boolean) {
    const m = map.current;
    if (!m) return;
    if (!origin) return void m.setView([job.lat, job.lon], full ? 16 : 15, { animate });
    const pts: L.LatLngExpression[] = path?.length ? path : [[origin.lat, origin.lon]];
    m.fitBounds(L.latLngBounds([[job.lat, job.lon], ...pts]), {
      ...(full
        ? { paddingTopLeft: L.point(56, 88), paddingBottomRight: L.point(56, 210) }
        : { padding: L.point(40, 40) }),
      maxZoom: 16,
      animate
    });
  }

  useEffect(() => {
    const g = layer.current;
    if (!g) return;
    g.clearLayers();
    if (path?.length) {
      L.polyline(path, { color: '#fff', weight: 9, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }).addTo(g);
      L.polyline(path, { color: '#1d4bed', weight: 5, lineCap: 'round', lineJoin: 'round' }).addTo(g);
    } else if (origin) {
      L.polyline(
        [
          [origin.lat, origin.lon],
          [job.lat, job.lon]
        ],
        { color: '#1d4bed', weight: 4, dashArray: '2 9', lineCap: 'round' }
      ).addTo(g);
    }
    if (origin)
      L.marker([origin.lat, origin.lon], {
        keyboard: false,
        interactive: false,
        icon: L.divIcon({ className: '', html: '<div class="bicos-me"></div>', iconSize: [18, 18], iconAnchor: [9, 9] })
      }).addTo(g);
    L.marker([job.lat, job.lon], {
      keyboard: false,
      interactive: false,
      icon: L.divIcon({ className: '', html: PIN, iconSize: [34, 44], iconAnchor: [17, 43] })
    }).addTo(g);
    fit(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.lat, job.lon, origin?.lat, origin?.lon, path]);

  return (
    <div className="relative isolate w-full h-full">
      <div
        ref={box}
        role={full ? 'application' : 'img'}
        aria-label={label}
        className={'bicos-map absolute inset-0' + (full ? '' : ' bicos-map-static')}
      />
      {full ? (
        <div className="absolute right-3 top-3 z-[500] flex flex-col gap-2">
          <button type="button" aria-label="Aproximar o mapa" className={ctl} onClick={() => map.current?.zoomIn()}>
            <Glyph d="M12 5v14M5 12h14" />
          </button>
          <button type="button" aria-label="Afastar o mapa" className={ctl} onClick={() => map.current?.zoomOut()}>
            <Glyph d="M5 12h14" />
          </button>
          <button type="button" aria-label="Ver o caminho todo" className={ctl} onClick={() => fit(true)}>
            <Icon name="locate-fixed" size={20} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          aria-label="Abrir o mapa em tela cheia"
          className="absolute right-3 top-3 z-[500] w-12 h-12 flex items-center justify-center rounded-full bg-concrete-0 text-concrete-900 shadow-[0_2px_10px_rgba(16,24,40,0.25)] active:bg-concrete-100"
          onClick={(e) => {
            e.stopPropagation();
            onExpand?.();
          }}
        >
          <svg
            width={22}
            height={22}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
          </svg>
        </button>
      )}
    </div>
  );
}
