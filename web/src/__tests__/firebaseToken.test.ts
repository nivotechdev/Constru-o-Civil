// U28: the Edge Function only opens a Bicos session for a Firebase ID token signed by Firebase, for this project,
// still valid and from a fresh sign-in — and for the phone, only for a Brazilian mobile.
import { beforeEach, describe, expect, it } from 'vitest';
import { brazilianMobile, forgetFirebaseKeys, verifyFirebaseToken } from '../../supabase/functions/_shared/firebase.ts';

const PROJECT = 'bicoapp-6cc68';
const NOW = Date.UTC(2026, 9, 21, 12, 0, 0);
const secs = Math.floor(NOW / 1000);

const b64url = (bytes: Uint8Array | string) =>
  Buffer.from(typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

async function keyPair() {
  return crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify']
  );
}

async function sign(key: CryptoKey, claims: Record<string, unknown>, kid = 'k1') {
  const head = b64url(JSON.stringify({ alg: 'RS256', kid, typ: 'JWT' }));
  const body = b64url(JSON.stringify(claims));
  const sig = new Uint8Array(
    await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(head + '.' + body))
  );
  return `${head}.${body}.${b64url(sig)}`;
}

const base = (over: Record<string, unknown> = {}) => ({
  iss: 'https://securetoken.google.com/' + PROJECT,
  aud: PROJECT,
  sub: 'uid-1',
  iat: secs - 30,
  exp: secs + 3000,
  auth_time: secs - 30,
  email: 'Ana@Gmail.com',
  email_verified: true,
  name: 'Ana Souza',
  firebase: { sign_in_provider: 'google.com' },
  ...over
});

describe('ID token do Firebase (U28)', () => {
  let good: CryptoKeyPair;
  let fetcher: typeof fetch;
  beforeEach(async () => {
    forgetFirebaseKeys();
    good = await keyPair();
    const jwk = await crypto.subtle.exportKey('jwk', good.publicKey);
    fetcher = (async () =>
      new Response(JSON.stringify({ keys: [{ ...jwk, kid: 'k1', alg: 'RS256' }] }), {
        headers: { 'cache-control': 'public, max-age=600' }
      })) as unknown as typeof fetch;
  });

  it('accepts a Google sign-in signed by Firebase for this project', async () => {
    const who = await verifyFirebaseToken(await sign(good.privateKey, base()), PROJECT, { fetcher, now: NOW });
    expect(who).toEqual({
      uid: 'uid-1',
      provider: 'google.com',
      email: 'ana@gmail.com',
      emailVerified: true,
      name: 'Ana Souza',
      phone: null
    });
  });

  it('refuses a forged signature, another project, an expired token and an old sign-in', async () => {
    const other = await keyPair();
    const opts = { fetcher, now: NOW };
    expect(await verifyFirebaseToken(await sign(other.privateKey, base()), PROJECT, opts)).toBeNull();
    expect(await verifyFirebaseToken(await sign(good.privateKey, base({ aud: 'outro' })), PROJECT, opts)).toBeNull();
    expect(
      await verifyFirebaseToken(
        await sign(good.privateKey, base({ iss: 'https://securetoken.google.com/outro' })),
        PROJECT,
        opts
      )
    ).toBeNull();
    expect(await verifyFirebaseToken(await sign(good.privateKey, base({ exp: secs - 1 })), PROJECT, opts)).toBeNull();
    expect(
      await verifyFirebaseToken(await sign(good.privateKey, base({ auth_time: secs - 3600 })), PROJECT, opts)
    ).toBeNull();
    expect(await verifyFirebaseToken(await sign(good.privateKey, base(), 'outra-chave'), PROJECT, opts)).toBeNull();
    expect(await verifyFirebaseToken('nao.e.token', PROJECT, opts)).toBeNull();
  });

  it('reads the phone of an SMS sign-in; only Brazilian mobiles become a WhatsApp', async () => {
    const token = await sign(
      good.privateKey,
      base({
        email: undefined,
        email_verified: undefined,
        name: undefined,
        phone_number: '+5554991234567',
        firebase: { sign_in_provider: 'phone' }
      })
    );
    const who = await verifyFirebaseToken(token, PROJECT, { fetcher, now: NOW });
    expect([who?.provider, who?.phone]).toEqual(['phone', '+5554991234567']);
    expect(brazilianMobile('+5554991234567')).toBe('54991234567');
    expect(brazilianMobile('+14155550123')).toBeNull();
    expect(brazilianMobile(null)).toBeNull();
  });
});
