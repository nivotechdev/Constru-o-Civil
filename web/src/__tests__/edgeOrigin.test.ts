// L05: the Edge Functions refuse to start without APP_ORIGIN and only answer CORS to the app's addresses.
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import {
  allowedOrigin,
  BROWSER_FUNCTIONS,
  corsHeaders,
  originsProblem,
  parseOrigins,
  SERVER_FUNCTIONS
} from '../../supabase/functions/_shared/origin.ts';

describe('APP_ORIGIN obrigatório (L05)', () => {
  it('missing or malformed blocks the start', () => {
    expect(originsProblem(parseOrigins(undefined))).toMatch(/APP_ORIGIN não configurado/);
    expect(originsProblem(parseOrigins(' , '))).toMatch(/APP_ORIGIN não configurado/);
    expect(originsProblem(parseOrigins('*'))).toMatch(/inválido/);
    expect(originsProblem(parseOrigins('https://bicos.nivotech.com.br/app'))).toMatch(/inválido/);
    expect(originsProblem(parseOrigins('https://bicos.nivotech.com.br/'))).toBeNull();
  });

  it('answers the caller only when it is listed (with *. for previews)', () => {
    const origins = parseOrigins('https://bicos.nivotech.com.br, https://*.bicos-app.pages.dev');
    expect(allowedOrigin(origins, 'https://bicos.nivotech.com.br')).toBe('https://bicos.nivotech.com.br');
    expect(allowedOrigin(origins, 'https://pr-12.bicos-app.pages.dev')).toBe('https://pr-12.bicos-app.pages.dev');
    expect(allowedOrigin(origins, 'https://evil.com')).toBe('https://bicos.nivotech.com.br');
    expect(allowedOrigin(origins, 'https://evilbicos-app.pages.dev')).toBe('https://bicos.nivotech.com.br');
    expect(allowedOrigin(origins, null)).toBe('https://bicos.nivotech.com.br');
  });
});

describe('APP_ORIGIN só nas funções do navegador (R02)', () => {
  const dir = new URL('../../supabase/functions/', import.meta.url);
  const source = (fn: string) => readFileSync(new URL(`${fn}/index.ts`, dir), 'utf8');

  it('every function is either called by the browser or server-to-server', () => {
    const all = readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith('_'))
      .map((d) => d.name)
      .sort();
    expect([...BROWSER_FUNCTIONS, ...SERVER_FUNCTIONS].sort()).toEqual(all);
  });

  it('browser functions require APP_ORIGIN when they start and answer the preflight', () => {
    for (const fn of BROWSER_FUNCTIONS) {
      expect(source(fn), fn).toMatch(/^requireAppOrigin\(\);$/m);
      expect(source(fn), fn).toContain('return preflight(req)');
    }
  });

  it('server-to-server functions start without APP_ORIGIN and send no CORS', () => {
    for (const fn of SERVER_FUNCTIONS) {
      expect(source(fn), fn).not.toMatch(/requireAppOrigin|preflight|CORS/);
    }
    const http = readFileSync(new URL('_shared/http.ts', dir), 'utf8');
    // Nothing at module level reads APP_ORIGIN: only requireAppOrigin() does.
    expect(http.match(/Deno\.env\.get\('APP_ORIGIN'\)/g)).toHaveLength(1);
    expect(http).not.toMatch(/^if \(problem\)/m);
  });

  it('the CORS headers answer the allowed caller', () => {
    expect(corsHeaders(parseOrigins('https://bicos.nivotech.com.br'), 'https://evil.com')).toEqual({
      'Access-Control-Allow-Origin': 'https://bicos.nivotech.com.br',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Max-Age': '7200',
      Vary: 'Origin'
    });
  });
});
