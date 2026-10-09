// Pure helpers: every legacy function and its TypeScript port must return the same thing.
import { describe, expect, it } from 'vitest';
import * as legacyFormat from '../../../app/js/utils/format.js';
import { nearestCity, popularCities, searchCities } from '../services/cities';
import { formatBRL, formatPostDate, isValidEmail, maskCNPJ, maskCPF, passwordStrength } from '../utils/format';
import { whatsappUrl } from '../utils/whatsapp';

const TEXTS = [
  '',
  '1',
  '12',
  '123',
  '1234',
  '123456',
  '1234567',
  '123456789',
  '12345678901',
  '123456789012345',
  '111.111.111-11',
  'ab1c2',
  ' 98 7 ',
  '11.111.111/1111-11',
  '(11) 98842-3310',
  '55 11 98842-3310',
  'abc'
];

describe('format', () => {
  it('masks CPF and CNPJ exactly like the legacy app', () => {
    for (const t of TEXTS) {
      expect(maskCPF(t)).toBe(legacyFormat.maskCPF(t));
      expect(maskCNPJ(t)).toBe(legacyFormat.maskCNPJ(t));
    }
    expect(maskCPF('12345678901')).toBe('123.456.789-01');
    expect(maskCNPJ('12345678000199')).toBe('12.345.678/0001-99');
  });

  it('validates e-mail and rates passwords the same way', () => {
    for (const t of ['', 'a@', 'a@b', 'a@b.c', ' jorge@email.com ', 'jo rge@x.com', 'x@y.com.br']) {
      expect(isValidEmail(t)).toBe(legacyFormat.isValidEmail(t));
    }
    for (const t of ['', 'abc', 'abcdefgh', 'abcdefgh1', 'abcdefgh1!', 'abcdefghijk1', '12345678']) {
      expect(passwordStrength(t)).toBe(legacyFormat.passwordStrength(t));
    }
  });

  it('formats money and post dates the same way', () => {
    for (const n of [0, 80, 150.4, 150.5, 1234, 12345.6, -3, NaN]) expect(formatBRL(n)).toBe(legacyFormat.formatBRL(n));
    for (const d of ['2026-09-10', '2026-01-01', 'x', '2026-13'])
      expect(formatPostDate(d)).toBe(legacyFormat.formatPostDate(d));
  });
});

// The legacy app no longer ships its cities and WhatsApp helpers (they moved into its bundle), so these
// two are pinned with direct expectations instead of a side-by-side comparison.
describe('whatsapp links', () => {
  it('build wa.me URLs with the Brazilian prefix', () => {
    expect(whatsappUrl('', 'oi')).toBeNull();
    expect(whatsappUrl('(11) 98842-3310', 'oi')).toBe('https://wa.me/5511988423310?text=oi');
    expect(whatsappUrl('5511988423310')).toBe('https://wa.me/5511988423310');
  });
});

describe('city picker', () => {
  it('searches and geolocates', () => {
    expect(popularCities()).toHaveLength(8);
    expect(searchCities('sao', 8).length).toBeGreaterThan(0);
    expect(searchCities('São Paulo', 8)[0]?.label).toBe('São Paulo, SP');
    expect(searchCities('campinas, sp', 8)[0]?.label).toBe('Campinas, SP');
    expect(searchCities('xyz', 8)).toEqual([]);
    expect(nearestCity(-23.55, -46.63)?.label).toBe('São Paulo, SP');
    expect(nearestCity(-22.9, -47.06)?.label).toBe('Campinas, SP');
  });
});

describe('documents (Y17)', () => {
  it('checks the CPF and CNPJ check digits', async () => {
    const { isValidCnpj, isValidCpf } = await import('../utils/document');
    for (const ok of ['529.982.247-25', '39053344705', '111.444.777-35']) expect(isValidCpf(ok)).toBe(true);
    for (const bad of ['', '123.456.789-01', '111.111.111-11', '5299822472', '529.982.247-26'])
      expect(isValidCpf(bad)).toBe(false);
    for (const ok of ['11.222.333/0001-81', '18402551000147']) expect(isValidCnpj(ok)).toBe(true);
    for (const bad of ['', '11.222.333/0001-80', '11.111.111/1111-11', '00000000000000', '1122233300018'])
      expect(isValidCnpj(bad)).toBe(false);
  });
});
