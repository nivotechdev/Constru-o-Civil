// U12/U13: "Usar minha localização atual" — the place saved in the profile (the mural opens on it, a new job
// starts in its city). The phone's GPS gives the point; the city is the nearest municipality in the IBGE list.
// The point is rounded to 2 decimals (~1 km): enough for "bicos perto de você", without keeping where the person
// lives. Errors come as ServiceError with the message to show.
import { serviceError } from './errors';
import { distanceKm } from '../utils/geo';

export interface SavedLocation {
  /** "Caxias do Sul, RS". */
  city: string;
  lat: number;
  lon: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Asks the phone where it is (it asks the person the first time). */
export async function currentLocation(): Promise<SavedLocation> {
  if (typeof navigator === 'undefined' || !navigator.geolocation)
    throw serviceError('validacao', 'Este aparelho não informa a localização. Escolha a cidade na lista.');
  const position = await new Promise<GeolocationPosition>((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 15000,
      maximumAge: 300000
    })
  ).catch((e: GeolocationPositionError) => {
    throw serviceError(
      'validacao',
      e?.code === 1
        ? 'O navegador não liberou a localização. Toque no cadeado ao lado do endereço, permita a localização e tente de novo.'
        : 'Não conseguimos achar sua localização. Confira se a localização do celular está ligada e tente de novo.'
    );
  });
  return locationFromPoint(position.coords.latitude, position.coords.longitude);
}

/** The saved location for a GPS point: the nearest municipality (must be in Brazil) and the rounded point. */
export async function locationFromPoint(lat: number, lon: number): Promise<SavedLocation> {
  // The list of municipalities is big: it loads only when a location is asked for.
  const { nearestCity } = await import('./cities');
  const city = nearestCity(lat, lon);
  if (!city || distanceKm({ lat, lon }, city) > 80)
    throw serviceError('validacao', 'Sua localização parece estar fora do Brasil. Escolha a cidade na lista.');
  return { city: city.label, lat: round2(lat), lon: round2(lon) };
}

/** A city chosen in the list (when the GPS can't be used): its centre is the point. */
export async function locationFromCity(label: string): Promise<SavedLocation | null> {
  const { cityByLabel } = await import('./cities');
  const city = cityByLabel(label);
  return city ? { city: city.label, lat: round2(city.lat), lon: round2(city.lon) } : null;
}
