// U53/U54: "Onde vai ser" — the job's place and where the worker is (the phone's position when the person allows it,
// otherwise their saved address), the road between them and its real length and time (a driving route, as Google Maps
// writes it), on a clean map one finger moves. "Abrir no Google Maps" opens the same route in the app or the site.
// The map (Leaflet) is a separate chunk that loads only when the section comes near the screen.
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { GeoPoint } from '../types/models';
import { distanceKm, formatKm } from '../utils/geo';
import { mapOpenUrl } from '../utils/mapUrls';
import { drivingRoute, formatDriveTime, formatRoadKm, type DrivingRoute } from '../services/route';
import { Icon } from './icons/Icon';

const MapCanvas = lazy(() => import('./MapCanvas'));

type Origin = { point: GeoPoint; from: 'aqui' | 'casa' } | null;
type Gps = 'idle' | 'asking' | 'denied' | 'error';
type Road = { key: string; route: DrivingRoute | null } | null;

function askPosition(): Promise<GeoPoint> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('sem gps'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      reject,
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );
  });
}

export function JobMap({ job, place, home }: { job: GeoPoint; place: string; home: GeoPoint | null }) {
  const [here, setHere] = useState<GeoPoint | null>(null);
  const [gps, setGps] = useState<Gps>('idle');
  const [visible, setVisible] = useState(false);
  const [road, setRoad] = useState<Road>(null);
  const box = useRef<HTMLDivElement>(null);

  // The map loads only when the section is about to show (it is far down the page and weighs on a weak connection).
  useEffect(() => {
    const el = box.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && setVisible(true), {
      rootMargin: '300px'
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Where the person is now, without asking again if they already allowed it.
  useEffect(() => {
    let off = false;
    const perms = (navigator as Navigator & { permissions?: Permissions }).permissions;
    perms
      ?.query({ name: 'geolocation' as PermissionName })
      .then((s) => {
        if (s.state === 'granted' && !off) return askPosition().then((p) => !off && setHere(p));
      })
      .catch(() => undefined);
    return () => {
      off = true;
    };
  }, []);

  function locate() {
    setGps('asking');
    askPosition()
      .then((p) => {
        setHere(p);
        setGps('idle');
      })
      .catch((e: GeolocationPositionError | Error) => setGps('code' in e && e.code === 1 ? 'denied' : 'error'));
  }

  const origin: Origin = here ? { point: here, from: 'aqui' } : home ? { point: home, from: 'casa' } : null;
  const key = origin ? `${origin.point.lat.toFixed(5)},${origin.point.lon.toFixed(5)}>${job.lat},${job.lon}` : '';

  // The road from the origin to the job (the real distance and time); no answer leaves the straight line.
  useEffect(() => {
    if (!origin || !visible) return;
    const ctl = new AbortController();
    drivingRoute(origin.point, job, ctl.signal).then((route) => !ctl.signal.aborted && setRoad({ key, route }));
    return () => ctl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, visible]);

  const answered = road !== null && road.key === key;
  const route = answered ? road.route : null;
  const calculating = Boolean(origin) && !answered;
  const straightKm = origin ? distanceKm(origin.point, job) : null;
  const who = origin?.from === 'aqui' ? 'Você está a' : 'A';
  const whereFrom = origin?.from === 'aqui' ? 'do bico' : 'da sua casa';

  return (
    <div className="flex flex-col gap-3">
      <span className="text-concrete-700">{place}</span>
      <div
        ref={box}
        className="relative w-full h-80 rounded-2xl overflow-hidden border border-concrete-200 bg-concrete-100"
      >
        {visible ? (
          <Suspense fallback={<MapLoading />}>
            <MapCanvas
              job={job}
              origin={origin?.point ?? null}
              path={route?.path ?? null}
              label="Mapa de onde vai ser o bico. Arraste com um dedo para mover."
            />
          </Suspense>
        ) : (
          <MapLoading />
        )}
      </div>
      {origin ? (
        <div className="text-concrete-900" aria-live="polite">
          {route ? (
            <span>
              {who} <strong className="font-bold">{formatRoadKm(route.meters)}</strong> {whereFrom}
              <span className="text-concrete-700"> · {formatDriveTime(route.seconds)} de carro</span>
            </span>
          ) : calculating ? (
            <span className="text-concrete-700">Calculando o caminho…</span>
          ) : straightKm !== null ? (
            <span className="text-concrete-700">
              {who} cerca de {formatKm(straightKm)} {whereFrom} (em linha reta).
            </span>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <a
          className="flex-1 min-w-[12rem] inline-flex items-center justify-center gap-1.5 h-11 px-4 rounded-control bg-brand-500 text-white text-sm font-bold hover:bg-brand-600"
          href={mapOpenUrl(job, origin?.point ?? null)}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Icon name="map" size={18} />
          Abrir no Google Maps
        </a>
        {here ? null : (
          <button
            type="button"
            className="inline-flex items-center justify-center gap-1.5 h-11 px-4 rounded-control border border-concrete-300 bg-concrete-0 text-sm font-bold text-concrete-900 hover:bg-concrete-50 disabled:opacity-60"
            disabled={gps === 'asking'}
            onClick={locate}
          >
            <Icon name="locate-fixed" size={18} />
            {gps === 'asking' ? 'Achando você…' : 'Mostrar onde estou'}
          </button>
        )}
      </div>
      {gps === 'denied' ? (
        <span className="text-sm text-concrete-600">
          O navegador não liberou a localização. Toque no cadeado ao lado do endereço do site para permitir.
        </span>
      ) : gps === 'error' ? (
        <span className="text-sm text-concrete-600">Não deu para achar onde você está agora.</span>
      ) : null}
    </div>
  );
}

function MapLoading() {
  return (
    <span className="absolute inset-0 flex items-center justify-center text-sm text-concrete-600">
      Carregando o mapa…
    </span>
  );
}
