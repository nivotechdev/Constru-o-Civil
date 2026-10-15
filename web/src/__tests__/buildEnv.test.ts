// L01 (lançamento): the production build refuses to run without its variables.
import { describe, expect, it } from 'vitest';
import { isDemoMode, productionEnvError, productionEnvProblems } from '../../build/env';

const FULL = {
  VITE_SUPABASE_URL: 'https://abcdefgh.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'eyJ-public-anon',
  VITE_SITE_URL: 'https://bicos.nivotech.com.br',
  VITE_TURNSTILE_SITE_KEY: '0x4AAAAAAA',
  VITE_SENTRY_DSN: 'https://abc@o1.ingest.sentry.io/1'
};

describe('build de produção (L01)', () => {
  it('passes with every variable set', () => {
    expect(productionEnvProblems(FULL)).toEqual([]);
  });

  it('lists every missing variable when the environment is empty', () => {
    const problems = productionEnvProblems({});
    expect(problems).toHaveLength(5);
    for (const name of Object.keys(FULL)) expect(problems.join('\n')).toContain(name);
    const message = productionEnvError(problems);
    expect(message).toContain('Build de produção interrompido');
    expect(message).toContain('npm run build:demo');
  });

  it('treats blank values as missing and rejects addresses without https', () => {
    const problems = productionEnvProblems({
      ...FULL,
      VITE_SUPABASE_ANON_KEY: '   ',
      VITE_SITE_URL: 'http://bicos.nivotech.com.br'
    });
    expect(problems).toEqual([
      'VITE_SUPABASE_ANON_KEY — falta (chave pública (anon) do Supabase)',
      'VITE_SITE_URL — precisa ser um endereço https://'
    ]);
  });

  it('only the demo modes skip the check', () => {
    expect(isDemoMode('demo')).toBe(true);
    expect(isDemoMode('standalone')).toBe(true);
    expect(isDemoMode('production')).toBe(false);
    expect(isDemoMode('staging')).toBe(false);
  });
});
