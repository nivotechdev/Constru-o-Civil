// AUD-028: with no internet, the street search says "offline" (not "no such street"), and placing the house falls back to
// the city's centre only with a warning.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { geocodeOnline, streetsOnline } from '../services/remote/address';

describe('endereço sem internet (AUD-028)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('the street search fails as offline when ViaCEP and the map are both out', async () => {
    await expect(
      streetsOnline('Caxias do Sul', 'RS', 'Sinimbu', { lat: -29.1688, lon: -51.1787 })
    ).rejects.toMatchObject({ code: 'offline' });
  });

  it('placing the house with both maps out falls back to the city centre and says so', async () => {
    const point = await geocodeOnline({
      street: 'Rua Sinimbu',
      number: '120',
      neighborhood: 'Centro',
      city: 'Caxias do Sul',
      uf: 'RS',
      cep: '95020-000',
      cityCentre: { lat: -29.1688, lon: -51.1787 },
      cepPoint: null
    });
    expect(point).toMatchObject({ precision: 'cidade', degraded: true });
  });
});
