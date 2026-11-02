// AUD-019: the keys of the rate limits (auth_attempts) hold a hash of the CPF/CNPJ the person typed. With a secret
// (RATE_LIMIT_PEPPER) the hash is an HMAC, so a copy of the table cannot be turned back into documents by brute force.
import { describe, expect, it } from 'vitest';
import { keyedHash } from '../../supabase/functions/_shared/keyedHash.ts';

describe('keyedHash (AUD-019)', () => {
  it('without a secret it is the plain SHA-256 (as before)', async () => {
    expect(await keyedHash('abc', '')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
  it('with a secret it is an HMAC-SHA256: different from the plain hash and from another secret', async () => {
    const plain = await keyedHash('52998224725', '');
    const a = await keyedHash('52998224725', 'segredo-a');
    const b = await keyedHash('52998224725', 'segredo-b');
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(new Set([plain, a, b]).size).toBe(3);
    expect(await keyedHash('52998224725', 'segredo-a')).toBe(a);
  });
  it('matches the known HMAC-SHA256 test vector', async () => {
    expect(await keyedHash('The quick brown fox jumps over the lazy dog', 'key')).toBe(
      'f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8'
    );
  });
  it('the functions use it for the document keys', async () => {
    const { readFileSync } = await import('node:fs');
    for (const fn of ['entrar-com-documento', 'verificar-cadastro']) {
      const source = readFileSync(new URL(`../../supabase/functions/${fn}/index.ts`, import.meta.url), 'utf8');
      expect(source, fn).toContain('keyedHash');
      expect(source, fn).not.toMatch(/function sha256Hex/);
    }
  });
});
