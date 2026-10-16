// L01 (lançamento): the production build refuses to run without its variables.
import { describe, expect, it } from 'vitest';
import { brMobileProblem, isDemoMode, productionEnvError, productionEnvProblems } from '../../build/env';

const FULL = {
  VITE_SUPABASE_URL: 'https://abcdefgh.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'eyJ-public-anon',
  VITE_SITE_URL: 'https://bicos.nivotech.com.br',
  VITE_TURNSTILE_SITE_KEY: '0x4AAAAAAA',
  VITE_SENTRY_DSN: 'https://abc@o1.ingest.sentry.io/1',
  VITE_SUPORTE_WHATSAPP: '(11) 98765-4321'
};

describe('build de produção (L01)', () => {
  it('passes with every variable set', () => {
    expect(productionEnvProblems(FULL)).toEqual([]);
  });

  it('lists every missing variable when the environment is empty', () => {
    const problems = productionEnvProblems({});
    expect(problems).toHaveLength(6);
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

  it('only the local E2E build accepts a Supabase on this machine', () => {
    const local = { ...FULL, VITE_SUPABASE_URL: 'http://127.0.0.1:55400', VITE_SITE_URL: 'http://localhost:4173' };
    expect(productionEnvProblems(local, 'e2e')).toEqual([]);
    expect(productionEnvProblems(local)).toHaveLength(2);
    expect(productionEnvProblems(local, 'staging')).toHaveLength(2);
  });

  it('only the demo modes skip the check', () => {
    expect(isDemoMode('demo')).toBe(true);
    expect(isDemoMode('standalone')).toBe(true);
    expect(isDemoMode('production')).toBe(false);
    expect(isDemoMode('staging')).toBe(false);
  });
});

describe('WhatsApp do suporte (L11)', () => {
  it('takes a mobile with DDD, with or without 55 and punctuation', () => {
    for (const ok of ['11987654321', '(11) 98765-4321', '+55 11 98765-4321', '5555991234567'])
      expect(brMobileProblem(ok)).toBeNull();
  });

  it('refuses the old default and anything that is not a mobile with DDD', () => {
    for (const bad of ['5494731661', '987654321', '1132654321', '01987654321', '551198765432'])
      expect(brMobileProblem(bad)).toBe('precisa ser um celular com DDD (ex.: 11 98765-4321)');
    expect(productionEnvProblems({ ...FULL, VITE_SUPORTE_WHATSAPP: '5494731661' })).toEqual([
      'VITE_SUPORTE_WHATSAPP — precisa ser um celular com DDD (ex.: 11 98765-4321)'
    ]);
  });
});
