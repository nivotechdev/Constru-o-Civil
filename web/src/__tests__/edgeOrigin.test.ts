// L05: the Edge Functions refuse to start without APP_ORIGIN and only answer CORS to the app's addresses.
import { describe, expect, it } from 'vitest';
import { allowedOrigin, originsProblem, parseOrigins } from '../../supabase/functions/_shared/origin.ts';

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
