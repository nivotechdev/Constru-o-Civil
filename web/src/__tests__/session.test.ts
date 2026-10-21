// B09 — session and route guards: who opens what, and the account's way from sign-up to the mural.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { guardRoute, homeFor } from '../services/guards';
import { TERMS_VERSION } from '../services/legal';
import type { Session } from '../types/models';

const worker: Session = {
  accountId: 'conta-jorge',
  email: 'trabalhador@bicos.demo',
  role: 'trabalhador',
  workerId: 'jorge',
  companyId: null,
  emailConfirmed: true,
  profileComplete: true,
  termsCurrent: true
};
const company: Session = {
  ...worker,
  accountId: 'conta-meridiano',
  role: 'recrutador',
  workerId: null,
  companyId: 'meridiano'
};

describe('route guards', () => {
  it('L07: a new version of the terms is accepted before the app opens', () => {
    const outdated = { ...worker, termsCurrent: false };
    expect(homeFor(outdated)).toBe('/aceitar-termos');
    expect(guardRoute('app', '/mural', outdated)).toEqual({ kind: 'redirect', to: '/aceitar-termos' });
    expect(guardRoute('onboarding', '/aceitar-termos', outdated)).toEqual({ kind: 'ok' });
    expect(guardRoute('public', '/termos', outdated)).toEqual({ kind: 'ok' });
    expect(guardRoute('onboarding', '/aceitar-termos', worker)).toEqual({ kind: 'redirect', to: '/mural' });
  });

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
      reason: 'credenciais'
    });
    expect(await run(auth.signIn('trabalhador@bicos.demo', 'errada'))).toEqual({ ok: false, reason: 'credenciais' });
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
        password: 'abcdefgh1',
        acceptedTermsVersion: TERMS_VERSION,
        adult: true
      })
    );
    expect(result).toEqual({ ok: true });
    const session = store.getSession();
    expect(session).toMatchObject({ role: 'trabalhador', emailConfirmed: false, profileComplete: false });
    // The accepted version of the terms is stored with the account (B11).
    expect(store.getDb().accounts[session!.accountId]).toMatchObject({ termsVersion: TERMS_VERSION });
    expect(homeFor(session!)).toBe('/verificar-email');
    expect(sel.currentWorker(store.getDb())).toMatchObject({ name: 'Ana Souza', initials: 'AS' });

    // U11: "Corrigir e-mail" on the code screen: an address with an account is refused, a new one takes over.
    expect(auth.canChangePendingEmail()).toBe(true);
    expect(await run(auth.changePendingEmail('trabalhador@bicos.demo'))).toEqual({ ok: false, reason: 'email-taken' });
    expect(await run(auth.changePendingEmail('ana.souza@exemplo.com'))).toEqual({ ok: true });
    expect(store.getSession()?.email).toBe('ana.souza@exemplo.com');
    // U11: a wrong code doesn't confirm; the right one does (demo: any 6 numbers but 000000).
    const wrong = await run(auth.verifyEmailCode('ana.souza@exemplo.com', '000000').catch((e: unknown) => e));
    expect(wrong).toMatchObject({ code: 'validacao' });
    expect(homeFor(store.getSession()!)).toBe('/verificar-email');
    await run(auth.verifyEmailCode('ana.souza@exemplo.com', '123456'));
    expect(auth.canChangePendingEmail()).toBe(false);
    expect(homeFor(store.getSession()!)).toBe('/completar-perfil/trabalhador');

    // U12/U51: completing the profile saves the address: the account keeps it, the profile shows only the city and a
    // point rounded to ~1 km.
    const address = {
      cep: '95020-000',
      street: 'Rua Sinimbu',
      neighborhood: 'Centro',
      city: 'Caxias do Sul',
      uf: 'RS',
      cityLabel: 'Caxias do Sul, RS',
      lat: -29.168123,
      lon: -51.179456,
      precision: 'rua' as const
    };
    await run(auth.finishSignUp(address));
    expect(homeFor(store.getSession()!)).toBe('/mural');
    expect(sel.currentWorker(store.getDb())).toMatchObject({
      city: 'Caxias do Sul, RS',
      neighborhood: null,
      lat: -29.17,
      lon: -51.18
    });
    expect(sel.myAddress(store.getDb())).toMatchObject({ street: 'Rua Sinimbu', lat: -29.168123, precision: 'rua' });

    // The same e-mail can't sign up twice.
    const again = await run(
      auth.signUp({
        role: 'recrutador',
        name: 'Outra',
        doc: '12.345.678/0001-95',
        email: 'ANA.Souza@exemplo.com',
        whatsapp: '(11) 91234-0000',
        password: 'abcdefgh1',
        acceptedTermsVersion: TERMS_VERSION,
        adult: true
      })
    );
    expect(again).toEqual({ ok: false, reason: 'email-taken' });
  });

  it('signing out ends the session and forgets the screens', async () => {
    await run(auth.signIn('empresa@bicos.demo', 'bicos123'));
    store.setUI('qualquer-tela', { aberto: true });
    await run(auth.signOut());
    expect(store.getSession()).toBeNull();
    expect(store.getUI('qualquer-tela', { aberto: false })).toEqual({ aberto: false });
  });
});
