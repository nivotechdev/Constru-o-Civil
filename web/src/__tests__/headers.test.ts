// L08 (lançamento): the security headers the site is served with (public/_headers, Cloudflare Pages) — every
// header securityheaders.com grades, and a CSP that allows each outside address the app's code calls.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const headers = readFileSync(fileURLToPath(new URL('../../public/_headers', import.meta.url)), 'utf8');
const header = (name: string) => new RegExp(`^\\s+${name}: (.+)$`, 'm').exec(headers)?.[1] ?? '';
const csp = Object.fromEntries(
  header('Content-Security-Policy')
    .split(';')
    .map((d) => d.trim().split(/\s+/))
    .map(([k, ...v]) => [k, v])
);

/** A CSP source list allows `url` (only the host forms this file uses). */
function allows(sources: string[], url: string): boolean {
  const { protocol, host } = new URL(url);
  return sources.some((s) => {
    const m = /^(https?:|wss:)\/\/(\*\.)?(.+)$/.exec(s);
    if (!m || m[1] !== protocol) return false;
    return m[2] ? host.endsWith('.' + m[3]) : host === m[3];
  });
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return f === '__tests__' || f === 'data' ? [] : sourceFiles(p);
    return /\.tsx?$/.test(f) ? [p] : [];
  });
}

describe('cabeçalhos de segurança (L08)', () => {
  it('sends every header securityheaders.com grades', () => {
    for (const name of [
      'Content-Security-Policy',
      'Strict-Transport-Security',
      'X-Content-Type-Options',
      'X-Frame-Options',
      'Referrer-Policy',
      'Permissions-Policy'
    ])
      expect(header(name), name).not.toBe('');
    expect(header('Strict-Transport-Security')).toMatch(/max-age=31536000/);
  });

  it('scripts only from the app and the two providers; nothing inline', () => {
    expect(csp['script-src']).not.toContain("'unsafe-inline'");
    expect(csp['script-src']).not.toContain("'unsafe-eval'");
    expect(csp['object-src']).toEqual(["'none'"]);
    expect(csp['frame-ancestors']).toEqual(["'none'"]);
  });

  it('allows what the app calls: Supabase, Sentry, Turnstile, Mercado Pago, CEP/CNPJ', () => {
    expect(allows(csp['connect-src'], 'https://ppnxdajiihsjaojxokzh.supabase.co/rest/v1/jobs')).toBe(true);
    expect(allows(csp['connect-src'], 'wss://ppnxdajiihsjaojxokzh.supabase.co/realtime/v1')).toBe(true);
    expect(allows(csp['connect-src'], 'https://o4506.ingest.us.sentry.io/api/1/store/')).toBe(true);
    expect(
      allows(csp['img-src'], 'https://ppnxdajiihsjaojxokzh.supabase.co/storage/v1/object/public/vagas/x.jpg')
    ).toBe(true);
    expect(allows(csp['script-src'], 'https://challenges.cloudflare.com/turnstile/v0/api.js')).toBe(true);
    expect(allows(csp['frame-src'], 'https://challenges.cloudflare.com/cdn-cgi/challenge')).toBe(true);
    expect(allows(csp['script-src'], 'https://sdk.mercadopago.com/js/v2')).toBe(true);
    expect(allows(csp['connect-src'], 'https://evil.example.com/steal')).toBe(false);
  });

  it('every outside address fetched or loaded by the code is in the CSP', () => {
    const src = fileURLToPath(new URL('..', import.meta.url));
    // Links people open (WhatsApp, maps, share) are navigations, not loads: the CSP doesn't apply to them.
    const NAVIGATION =
      /^(https:\/\/(wa\.me|api\.whatsapp\.com|waze\.com|www\.google\.com|maps\.google\.com|bicos\.nivotech\.com\.br)|https:\/\/x\.)/;
    const loads = new Set<string>();
    for (const f of sourceFiles(src)) {
      for (const m of readFileSync(f, 'utf8').matchAll(/['"`](https:\/\/[a-z0-9.-]+\.[a-z]{2,}[^'"`\s$]*)/gi))
        if (!NAVIGATION.test(m[1])) loads.add(m[1]);
    }
    expect(loads.size).toBeGreaterThan(0);
    for (const url of loads) {
      const ok = ['connect-src', 'script-src', 'img-src', 'frame-src'].some((d) => allows(csp[d] ?? [], url));
      expect(ok, `${url} fora da CSP (public/_headers)`).toBe(true);
    }
  });
});
