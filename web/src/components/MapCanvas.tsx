// U54: the map itself (Leaflet + OpenStreetMap tiles), loaded only when the job map is about to show. One finger moves
// it, two fingers pinch; the buttons zoom and put the job and the worker back in view. Nothing but the job's pin, the
// worker's blue dot and the road between them.
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '../styles/map.css';
import { useEffect, useRef } from 'react';
import type { GeoPoint } from '../types/models';
import { Icon } from './icons/Icon';

type Props = { job: GeoPoint; origin: GeoPoint | null; path: [number, number][] | null; label: string };

const ctl =
  'w-11 h-11 flex items-center justify-center rounded-full bg-concrete-0 text-concrete-900 text-2xl leading-none font-semibold border border-concrete-200 shadow-[0_2px_8px_rgba(16,24,40,0.18)] active:bg-concrete-100';

export default function MapCanvas({ job, origin, path, label }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const m = L.map(el, { zoomControl: false, minZoom: 4, maxZoom: 18, zoomSnap: 0.5, bounceAtZoomLimits: false });
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
  }, []);

  function fit(animate: boolean) {
    const m = map.current;
    if (!m) return;
    if (!origin) return void m.setView([job.lat, job.lon], 16, { animate });
    const pts: L.LatLngExpression[] = path?.length ? path : [[origin.lat, origin.lon]];
    m.fitBounds(L.latLngBounds([[job.lat, job.lon], ...pts]), { padding: [48, 48], maxZoom: 16, animate });
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
      icon: L.divIcon({ className: '', html: '<div class="bicos-pin"></div>', iconSize: [36, 36], iconAnchor: [4, 40] })
    }).addTo(g);
    fit(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.lat, job.lon, origin?.lat, origin?.lon, path]);

  return (
    <div className="relative w-full h-full">
      <div ref={box} role="application" aria-label={label} className="bicos-map absolute inset-0" />
      <div className="absolute right-3 top-3 z-[500] flex flex-col gap-2">
        <button type="button" aria-label="Aproximar o mapa" className={ctl} onClick={() => map.current?.zoomIn()}>
          +
        </button>
        <button type="button" aria-label="Afastar o mapa" className={ctl} onClick={() => map.current?.zoomOut()}>
          −
        </button>
        <button type="button" aria-label="Ver o caminho todo" className={ctl} onClick={() => fit(true)}>
          <Icon name="locate-fixed" size={20} />
        </button>
      </div>
    </div>
  );
}
