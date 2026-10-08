// B09 — session and route guards: who opens what, and the account's way from sign-up to the mural.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { guardRoute, homeFor } from '../services/guards';
import type { Session } from '../types/models';

const worker: Session = {
  accountId: 'conta-jorge',
  email: 'trabalhador@bicos.demo',
  role: 'trabalhador',
  workerId: 'jorge',
  companyId: null,
  emailConfirmed: true,
  profileComplete: true
};
const company: Session = {
  ...worker,
  accountId: 'conta-meridiano',
  role: 'recrutador',
  workerId: null,
  companyId: 'meridiano'
};

describe('route guards', () => {
  it('without a session only public and guest screens open; the rest goes to login', () => {
    expect(guardRoute('guest', '/login', null)).toEqual({ kind: 'ok' });
    expect(guardRoute('public', '/esqueci-senha', null)).toEqual({ kind: 'ok' });
    for (const access of ['app', 'trabalhador', 'recrutador', 'onboarding'] as const)
      expect(guardRoute(access, '/mural', null)).toEqual({ kind: 'redirect', to: '/login' });
  });

  it('a logged-in user skips the sign-in screens', () => {
    expect(guardRoute('guest', '/splash', worker)).toEqual({ kind: 'redirect', to: '/mural' });
    expect(guardRoute('onboarding', '/verificar-email', worker)).toEqual({ kind: 'redirect', to: '/mural' });
  });

  it('each side opens only its own area', () => {
    expect(guardRoute('trabalhador', '/minhas-candidaturas', worker)).toEqual({ kind: 'ok' });
    expect(guardRoute('recrutador', '/criar-vaga', worker)).toEqual({ kind: 'forbidden', area: 'recrutador' });
    expect(guardRoute('trabalhador', '/perfil', company)).toEqual({ kind: 'forbidden', area: 'trabalhador' });
    expect(guardRoute('app', '/mural', company)).toEqual({ kind: 'ok' });
  });

  it('onboarding comes first: unconfirmed e-mail, then the profile', () => {
    const unconfirmed = { ...worker, emailConfirmed: false, profileComplete: false };
    expect(homeFor(unconfirmed)).toBe('/verificar-email');
    expect(guardRoute('app', '/mural', unconfirmed)).toEqual({ kind: 'redirect', to: '/verificar-email' });
    expect(guardRoute('onboarding', '/verificar-email', unconfirmed)).toEqual({ kind: 'ok' });

    const noProfile = { ...company, profileComplete: false };
    expect(homeFor(noProfile)).toBe('/completar-perfil/recrutador');
    expect(guardRoute('onboarding', '/completar-perfil/trabalhador', noProfile)).toEqual({
      kind: 'redirect',
      to: '/completar-perfil/recrutador'
    });
    expect(guardRoute('onboarding', '/completar-perfil/recrutador', noProfile)).toEqual({ kind: 'ok' });
    expect(guardRoute('public', '/esqueci-senha', noProfile)).toEqual({ kind: 'ok' });
  });
});

describe('accounts (mock auth)', () => {
  let auth: typeof import('../services/auth');
  let store: typeof import('../services/store');
  let sel: typeof import('../services/selectors');
  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();
    auth = await import('../services/auth');
    store = await import('../services/store');
    sel = await import('../services/selectors');
  });
  afterEach(() => vi.useRealTimers());

  const run = async <T>(p: Promise<T>) => {
    await vi.runAllTimersAsync();
    return p;
  };

  it('refuses unknown accounts and wrong passwords; accepts the CPF too', async () => {
    expect(await run(auth.signIn('ninguem@bicos.demo', 'bicos123'))).toEqual({
      ok: false,
      reason: 'conta-inexistente'
    });
    expect(await run(auth.signIn('trabalhador@bicos.demo', 'errada'))).toEqual({ ok: false, reason: 'senha-errada' });
    expect(store.getSession()).toBeNull();
    expect(await run(auth.signIn('529.982.247-25', 'bicos123'))).toEqual({ ok: true, role: 'trabalhador' });
    expect(store.getSession()?.workerId).toBe('jorge');
  });

  it('takes a new worker from sign-up through e-mail and profile to the app', async () => {
    const result = await run(
      auth.signUp({
        role: 'trabalhador',
        name: 'Ana Souza',
        doc: '123.456.789-09',
        email: 'ana@exemplo.com',
        whatsapp: '(11) 91234-5678',
        password: 'abcdefgh1'
      })
    );
    expect(result).toEqual({ ok: true });
    const session = store.getSession();
    expect(session).toMatchObject({ role: 'trabalhador', emailConfirmed: false, profileComplete: false });
    expect(homeFor(session!)).toBe('/verificar-email');
    expect(sel.currentWorker(store.getDb())).toMatchObject({ name: 'Ana Souza', initials: 'AS' });

    await run(auth.confirmEmail());
    expect(homeFor(store.getSession()!)).toBe('/completar-perfil/trabalhador');

    await run(
      auth.finishSignUp({ role: 'trabalhador', oficioId: 'pintor', city: 'Campinas, SP', specialties: ['Textura'] })
    );
    expect(homeFor(store.getSession()!)).toBe('/mural');
    expect(sel.currentWorker(store.getDb())).toMatchObject({
      oficioId: 'pintor',
      region: 'Campinas, SP',
      specialties: ['Textura']
    });

    // The same e-mail can't sign up twice.
    const again = await run(
      auth.signUp({
        role: 'recrutador',
        name: 'Outra',
        doc: '12.345.678/0001-95',
        email: 'ANA@exemplo.com',
        whatsapp: '(11) 91234-5678',
        password: 'abcdefgh1'
      })
    );
    expect(again).toEqual({ ok: false, reason: 'email-taken' });
  });

  it('signing out ends the session and forgets the screens', async () => {
    await run(auth.signIn('construtora@bicos.demo', 'bicos123'));
    store.setUI('qualquer-tela', { aberto: true });
    await run(auth.signOut());
    expect(store.getSession()).toBeNull();
    expect(store.getUI('qualquer-tela', { aberto: false })).toEqual({ aberto: false });
  });
});
