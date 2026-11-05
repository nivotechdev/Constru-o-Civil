// U53/U54/U57: "Onde vai ser" — the job's place and the worker's home (the address saved in their profile, never the
// phone's position), the way between them and its real length (U80: ON FOOT, the same number as the mural's card) and
// the time by car, as Google Maps writes them.
// The picture is still; one button opens it full screen, where it moves. The map (Leaflet) is a separate chunk that
// loads only when the section comes near the screen. U76: with Google configured, Google's route (the same numbers as
// Google Maps) on Google's map; an address saved before U76 is placed again, once (profiles.refineMyAddress).
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { GeoPoint } from '../types/models';
import { distanceKm } from '../utils/geo';
import { driveText, formatRoadKm, knownWalkDistance, routeToJob, walkText, type JobRoute } from '../services/route';
import { FEATURES, GOOGLE_MAPS_KEY } from '../services/features';
import { googleSession, type Session } from '../services/googleTiles';
import { refineMyAddress } from '../services/profiles';
import { useModal } from '../hooks/useModal';
import { navigate } from '../services/router';
import { Icon } from './icons/Icon';

const MapCanvas = lazy(() => import('./MapCanvas'));

type Road = { key: string; route: JobRoute | null } | null;

type Props = {
  /** The job's id (Google's route is asked by it: the server reads both addresses). */
  jobId: string;
  job: GeoPoint;
  place: string;
  /** The address saved in the worker's profile — the only starting point there is. */
  home: GeoPoint | null;
  /** A worker without a saved address is told where to put it. */
  askHome?: boolean;
};

const isDark = () => typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dark';

export function JobMap({ jobId, job, place, home, askHome = false }: Props) {
  const [visible, setVisible] = useState(false);
  const [road, setRoad] = useState<Road>(null);
  const [open, setOpen] = useState(false);
  // U76: Google's tiles session — undefined while asked; null without Google (OpenStreetMap's map, free routes).
  const [google, setGoogle] = useState<Session | null | undefined>(FEATURES.googleMaps ? undefined : null);
  const modal = useModal(open, () => setOpen(false));
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

  useEffect(() => {
    if (!visible || google !== undefined) return;
    let live = true;
    googleSession(isDark()).then((s) => live && setGoogle(s));
    return () => {
      live = false;
    };
  }, [visible, google]);

  const origin = home;
  const key = origin ? `${origin.lat.toFixed(6)},${origin.lon.toFixed(6)}>${job.lat},${job.lon}` : '';

  // The road from the origin to the job (the real distance and time); no answer leaves the straight line.
  useEffect(() => {
    if (!origin || !visible || google === undefined) return;
    const ctl = new AbortController();
    routeToJob({ id: jobId, lat: job.lat, lon: job.lon }, origin, ctl.signal, Boolean(google)).then(
      (route) => !ctl.signal.aborted && setRoad({ key, route })
    );
    return () => ctl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, visible, google === undefined, Boolean(google)]);

  // U76: an address saved by an older version is placed again once; the route follows the better point.
  useEffect(() => {
    if (askHome && origin && visible) void refineMyAddress();
  }, [askHome, origin, visible]);

  const answered = road !== null && road.key === key;
  const route = answered ? road.route : null;
  // U80: the distance the card showed is known at once (the same number); the route adds the way and the car's time.
  const known = origin && google !== undefined ? knownWalkDistance(job, origin, Boolean(google)) : null;
  const walk = route?.walk ?? known;
  const car = route ? driveText(route) : null;
  const calculating = Boolean(origin) && !answered;
  const straightKm = origin ? distanceKm(origin, job) : null;
  // Google's route starts and ends where Google placed the two addresses: the pin and the dot sit there too.
  const jobPoint = route?.walk.provider === 'google' && route.to ? route.to : job;
  const originPoint = route?.walk.provider === 'google' && route.from ? route.from : origin;
  const tiles = google ? { key: GOOGLE_MAPS_KEY, session: google.session } : null;

  const distanceLine = origin ? (
    <div className="flex items-center gap-3 text-concrete-900" aria-live="polite">
      <span className="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-xl bg-brand-50 text-brand-600">
        <Icon name="navigation" size={20} />
      </span>
      {walk ? (
        <span>
          A <strong className="font-bold">{walkText(walk)}</strong> da sua casa
          {car ? <span className="text-concrete-700"> · {car} de carro</span> : null}
        </span>
      ) : calculating ? (
        <span className="text-concrete-700">Calculando o caminho…</span>
      ) : straightKm !== null ? (
        <span className="text-concrete-700">
          A cerca de {formatRoadKm(straightKm * 1000)} da sua casa (em linha reta).
        </span>
      ) : null}
    </div>
  ) : askHome ? (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-concrete-700">
      <span>Para ver a distância e o tempo até aqui, cadastre o seu endereço.</span>
      <button
        type="button"
        className="font-bold text-brand-700 underline underline-offset-2 rounded outline-none focus-visible:ring-4 focus-visible:ring-brand-100"
        onClick={() => navigate('/perfil/editar')}
      >
        Cadastrar endereço
      </button>
    </div>
  ) : null;
  const canvas = (mode: 'static' | 'full') => (
    <Suspense fallback={<MapLoading />}>
      <MapCanvas
        job={jobPoint}
        origin={originPoint}
        path={route?.path.length ? route.path : null}
        mode={mode}
        google={tiles}
        onExpand={() => setOpen(true)}
        label={
          mode === 'full'
            ? 'Mapa de onde vai ser o bico. Arraste com um dedo para mover.'
            : 'Mapa de onde vai ser o bico'
        }
      />
    </Suspense>
  );

  return (
    <div className="flex flex-col gap-3.5">
      <span className="flex items-start gap-2 text-concrete-700">
        <span className="mt-0.5 shrink-0 inline-flex">
          <Icon name="map-pin" size={18} color="var(--text-subtle)" />
        </span>
        <span className="min-w-0">{place}</span>
      </span>
      <div className="flex flex-col rounded-2xl overflow-hidden border border-concrete-200 bg-concrete-0">
        <div
          ref={box}
          className="relative w-full h-64 sm:h-72 bg-concrete-100"
          onClick={() => visible && setOpen(true)}
        >
          {visible && google !== undefined ? canvas('static') : <MapLoading />}
        </div>
        {distanceLine ? <div className="px-4 py-3.5 border-t border-concrete-200">{distanceLine}</div> : null}
      </div>
      {/* U79: in a portal on <body>, so the full-screen map covers the whole page — the "Quero esse bico" bar, the
          header and the desktop card included (inside the page's stacking context they stayed on top of it). */}
      {open
        ? createPortal(
            <div
              ref={modal}
              tabIndex={-1}
              role="dialog"
              aria-modal="true"
              aria-label="Mapa de onde vai ser o bico"
              className="fixed inset-0 z-[60] bg-concrete-100 outline-none animate-fade-in"
            >
              {canvas('full')}
              <button
                type="button"
                aria-label="Fechar o mapa"
                className="absolute left-3 z-[600] w-12 h-12 flex items-center justify-center rounded-full bg-concrete-0 text-concrete-900 shadow-[0_2px_10px_rgba(16,24,40,0.25)] active:bg-concrete-100"
                style={{ top: 'calc(0.75rem + env(safe-area-inset-top, 0px))' }}
                onClick={() => setOpen(false)}
              >
                <Icon name="x" size={22} />
              </button>
              <div
                className="absolute inset-x-3 z-[600] flex flex-col gap-1 rounded-2xl bg-concrete-0 p-4 shadow-[0_6px_24px_rgba(16,24,40,0.2)]"
                style={{ bottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
              >
                <span className="font-semibold text-concrete-900">{place}</span>
                {distanceLine}
              </div>
            </div>,
            document.body
          )
        : null}
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
