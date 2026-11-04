// AUD-025: the sign-up draft survives a reload, never keeps the password, and goes when the flow ends.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetSignupDraft, loadSignupDraft, saveSignupDraft } from '../services/signupDraft';

describe('rascunho do cadastro (AUD-025)', () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    vi.stubGlobal('sessionStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k)
    });
  });

  it('keeps the step and the typed fields, so a reload resumes there', () => {
    saveSignupDraft('trabalhador', {
      step: 3,
      values: { nome: 'Ana Souza', doc: '529.982.247-25' },
      accepted: true,
      adult: true
    });
    expect(loadSignupDraft('trabalhador')).toEqual({
      step: 3,
      values: { nome: 'Ana Souza', doc: '529.982.247-25' },
      accepted: true,
      adult: true
    });
  });

  it('never stores or returns the password', () => {
    saveSignupDraft('trabalhador', {
      step: 2,
      values: { nome: 'Ana', senha: 'segredo123' },
      accepted: false,
      adult: false
    });
    expect(store.get('bicos.cadastro.trabalhador')).not.toContain('segredo123');
    expect(loadSignupDraft('trabalhador')?.values).toEqual({ nome: 'Ana' });
  });

  it('is forgotten when the flow ends, and a broken entry is ignored', () => {
    saveSignupDraft('recrutador', { step: 1, values: {}, accepted: false, adult: false });
    forgetSignupDraft('recrutador');
    expect(loadSignupDraft('recrutador')).toBeNull();
    store.set('bicos.cadastro.trabalhador', '{quebrado');
    expect(loadSignupDraft('trabalhador')).toBeNull();
  });
});
