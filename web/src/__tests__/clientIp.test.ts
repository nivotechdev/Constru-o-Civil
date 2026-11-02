// AUD-005: the rate limits key on the caller's IP, so it must come from the header the platform writes
// (cf-connecting-ip, then x-real-ip) or from the LAST hop of x-forwarded-for — never from the first one,
// which the caller writes.
import { describe, expect, it } from 'vitest';
import { clientIp } from '../../supabase/functions/_shared/clientIp.ts';

const req = (headers: Record<string, string>) => new Request('https://x.test/f', { headers });

describe('clientIp (AUD-005)', () => {
  it('trusts the edge header over anything the caller sends', () => {
    expect(clientIp(req({ 'cf-connecting-ip': '203.0.113.7', 'x-forwarded-for': '1.2.3.4, 203.0.113.7' }))).toBe(
      '203.0.113.7'
    );
    expect(clientIp(req({ 'x-real-ip': '198.51.100.9', 'x-forwarded-for': '1.2.3.4, 198.51.100.9' }))).toBe(
      '198.51.100.9'
    );
  });

  it('with only x-forwarded-for, uses the last hop (the one our proxy appended), not the first', () => {
    expect(clientIp(req({ 'x-forwarded-for': '6.6.6.6, 7.7.7.7, 203.0.113.7' }))).toBe('203.0.113.7');
    // The same machine forging a different first hop on every call still gets the same key.
    const keys = new Set(
      ['1.1.1.1', '2.2.2.2', '3.3.3.3'].map((fake) => clientIp(req({ 'x-forwarded-for': `${fake}, 203.0.113.7` })))
    );
    expect(keys).toEqual(new Set(['203.0.113.7']));
  });

  it('IPv6, spaces and junk', () => {
    expect(clientIp(req({ 'cf-connecting-ip': ' 2001:db8::1 ' }))).toBe('2001:db8::1');
    expect(clientIp(req({}))).toBe('desconhecido');
    expect(clientIp(req({ 'cf-connecting-ip': 'x'.repeat(500), 'x-forwarded-for': '203.0.113.7' }))).toBe(
      '203.0.113.7'
    );
    expect(clientIp(req({ 'x-forwarded-for': ' , ' }))).toBe('desconhecido');
  });
});
