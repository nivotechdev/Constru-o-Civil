// AUD-030: an empty mural says "com esse filtro" only when a filter is on, and "Limpar filtros" really clears them.
import { describe, expect, it } from 'vitest';
import { ALL_CITY, feedNarrowed, noFilters, type FeedUI } from '../pages/worker/feed/feedUI';

const HOME = 'Caxias do Sul, RS';
const base = (over: Partial<FeedUI> = {}) =>
  ({
    search: '',
    location: HOME,
    origin: null,
    oficio: null,
    dist: ALL_CITY,
    quando: null,
    minPay: null,
    ...over
  }) as FeedUI;

describe('mural vazio (AUD-030)', () => {
  it('no filter on: not narrowed', () => {
    expect(feedNarrowed(base(), HOME)).toBe(false);
  });
  it('each filter narrows it', () => {
    expect(feedNarrowed(base({ oficio: 'garcom' }), HOME)).toBe(true);
    expect(feedNarrowed(base({ quando: 'Hoje' }), HOME)).toBe(true);
    expect(feedNarrowed(base({ minPay: 150 }), HOME)).toBe(true);
    expect(feedNarrowed(base({ search: '  faxina ' }), HOME)).toBe(true);
    expect(feedNarrowed(base({ dist: '5 km' }), HOME)).toBe(true);
    expect(feedNarrowed(base({ location: 'Porto Alegre, RS' }), HOME)).toBe(true);
  });
  it('"Limpar filtros" clears the search too (before it left the search text in place)', () => {
    const cleared = noFilters(HOME);
    expect(cleared).toMatchObject({ search: '', oficio: null, quando: null, minPay: null, location: HOME });
    expect(feedNarrowed(base({ ...cleared } as Partial<FeedUI>), HOME)).toBe(false);
  });
});
