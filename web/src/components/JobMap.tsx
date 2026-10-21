// U53: "Onde vai ser" — the Google map of the job, inside the job page: the job's place and where the worker is (the
// phone's position when the person allows it, otherwise their saved address), with the route between them, so the
// distance is seen and not only read. The map moves and zooms in place; "Abrir no Google Maps" opens the route in the
// app/site. The map is Google's embed by address (no key needed); it loads only when the section comes near the screen.
import { useEffect, useRef, useState } from 'react';
import type { GeoPoint } from '../types/models';
import { distanceKm, formatKm } from '../utils/geo';
import { mapEmbedUrl, mapOpenUrl } from '../utils/mapUrls';
import { Icon } from './icons/Icon';

type Origin = { point: GeoPoint; from: 'aqui' | 'casa' } | null;
type Gps = 'idle' | 'asking' | 'denied' | 'error';

function askPosition(): Promise<GeoPoint> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('sem gps'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      reject,
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  });
}

export function JobMap({ job, place, home }: { job: GeoPoint; place: string; home: GeoPoint | null }) {
  const [here, setHere] = useState<GeoPoint | null>(null);
  const [gps, setGps] = useState<Gps>('idle');
  const [visible, setVisible] = useState(false);
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
  const km = origin ? distanceKm(origin.point, job) : null;

  return (
    <div className="flex flex-col gap-3">
      <span className="text-concrete-700">{place}</span>
      <div
        ref={box}
        className="relative w-full h-72 sm:h-80 rounded-2xl overflow-hidden border border-concrete-200 bg-concrete-100"
      >
        {visible ? (
          <iframe
            key={mapEmbedUrl(job, origin?.point ?? null)}
            title={origin ? 'Mapa com o caminho até o bico' : 'Mapa de onde é o bico'}
            src={mapEmbedUrl(job, origin?.point ?? null)}
            className="absolute inset-0 w-full h-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-sm text-concrete-500">
            Carregando o mapa…
          </span>
        )}
      </div>
      {origin && km !== null ? (
        <span className="flex items-center gap-2 text-sm text-concrete-700">
          <Icon name="navigation" size={16} color="var(--text-brand)" />
          {origin.from === 'aqui'
            ? `Você está a ${formatKm(km)} do bico (em linha reta).`
            : `A ${formatKm(km)} da sua casa (em linha reta).`}
        </span>
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
        <span className="text-sm text-concrete-500">
          O navegador não liberou a localização. Toque no cadeado ao lado do endereço do site para permitir.
        </span>
      ) : gps === 'error' ? (
        <span className="text-sm text-concrete-500">Não deu para achar onde você está agora.</span>
      ) : null}
    </div>
  );
}
