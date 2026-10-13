// The mural's query (X01), shared by the screen, the demo and the real backend.
import type { GeoPoint } from '../types/models';

/** What the mural asks the server for (X01): the same filters the screen applies. */
export interface FeedQuery {
  /** "São Paulo, SP" */
  location: string;
  /** Where distances are measured from. */
  from: GeoPoint;
  /** "Até X km" (`null`: the whole city). */
  radiusKm: number | null;
  oficio: string | null;
  quando: string | null;
  sort: 'perto' | 'valor' | 'cedo';
  /** Text search ('' for none). */
  search: string;
  /** Search the whole country, not only `location` (L17). */
  allCities: boolean;
}

/** The read-cache and paging key of one mural query. */
export const feedKey = (q: FeedQuery): string =>
  'feed:' +
  JSON.stringify([q.location, q.from.lat, q.from.lon, q.radiusKm, q.oficio, q.quando, q.sort, q.search, q.allCities]);
