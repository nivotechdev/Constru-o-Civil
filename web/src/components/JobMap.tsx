// U53/U54/U57: "Onde vai ser" — the job's place and the worker's home (the address saved in their profile, never the
// phone's position), the road between them and its real length and time (a driving route, as Google Maps writes it).
// The picture is still; one button opens it full screen, where it moves. The map (Leaflet) is a separate chunk that
// loads only when the section comes near the screen.
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { GeoPoint } from '../types/models';
import { distanceKm, formatKm } from '../utils/geo';
import { drivingRoute, formatDriveTime, formatRoadKm, type DrivingRoute } from '../services/route';
import { useModal } from '../hooks/useModal';
import { navigate } from '../services/router';
import { Icon } from './icons/Icon';

const MapCanvas = lazy(() => import('./MapCanvas'));

type Road = { key: string; route: DrivingRoute | null } | null;

type Props = {
  job: GeoPoint;
  place: string;
  /** The address saved in the worker's profile — the only starting point there is. */
  home: GeoPoint | null;
  /** A worker without a saved address is told where to put it. */
  askHome?: boolean;
};

export function JobMap({ job, place, home, askHome = false }: Props) {
  const [visible, setVisible] = useState(false);
  const [road, setRoad] = useState<Road>(null);
  const [open, setOpen] = useState(false);
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

  // The full-screen map holds the page still behind it.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const origin = home;
  const key = origin ? `${origin.lat.toFixed(5)},${origin.lon.toFixed(5)}>${job.lat},${job.lon}` : '';

  // The road from the origin to the job (the real distance and time); no answer leaves the straight line.
  useEffect(() => {
    if (!origin || !visible) return;
    const ctl = new AbortController();
    drivingRoute(origin, job, ctl.signal).then((route) => !ctl.signal.aborted && setRoad({ key, route }));
    return () => ctl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, visible]);

  const answered = road !== null && road.key === key;
  const route = answered ? road.route : null;
  const calculating = Boolean(origin) && !answered;
  const straightKm = origin ? distanceKm(origin, job) : null;

  const distanceLine = origin ? (
    <div className="text-concrete-900" aria-live="polite">
      {route ? (
        <span>
          A <strong className="font-bold">{formatRoadKm(route.meters)}</strong> da sua casa
          <span className="text-concrete-700"> · {formatDriveTime(route.seconds)} de carro</span>
        </span>
      ) : calculating ? (
        <span className="text-concrete-700">Calculando o caminho…</span>
      ) : straightKm !== null ? (
        <span className="text-concrete-700">A cerca de {formatKm(straightKm)} da sua casa (em linha reta).</span>
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
        job={job}
        origin={origin}
        path={route?.path ?? null}
        mode={mode}
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
    <div className="flex flex-col gap-3">
      <span className="text-concrete-700">{place}</span>
      <div
        ref={box}
        className="relative w-full h-72 rounded-2xl overflow-hidden border border-concrete-200 bg-concrete-100"
        onClick={() => visible && setOpen(true)}
      >
        {visible ? canvas('static') : <MapLoading />}
      </div>
      {distanceLine}
      {open ? (
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
        </div>
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
