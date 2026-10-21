// B12 — deleting the account: password first, commitments confirmed, the other side told, session ended.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type M = {
  account: typeof import('../services/account');
  auth: typeof import('../services/auth');
  store: typeof import('../services/store');
};

describe('deleting the account', () => {
  let m: M;
  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();
    m = {
      account: await import('../services/account'),
      auth: await import('../services/auth'),
      store: await import('../services/store')
    };
  });
  afterEach(() => vi.useRealTimers());

  const settle = async <T>(p: Promise<T>) => {
    const r = p.then(
      (v) => ({ ok: true as const, v }),
      (e: unknown) => ({ ok: false as const, e: e as Error })
    );
    await vi.runAllTimersAsync();
    return r;
  };

  it('worker: wrong password and unconfirmed commitments are refused; then everything of it is deleted (U24)', async () => {
    await settle(m.auth.signIn('trabalhador@bicos.demo', 'bicos123'));
    const impact = m.account.deletionImpact();
    // a1 (pré-selecionado on BC-4821) and a8 (contratado on BC-4712) hold slots.
    expect(impact.commitments.map((c) => c.app.id).sort()).toEqual(['a1', 'a8']);

    const wrong = await settle(m.account.deleteAccount({ password: 'errada' }, true));
    expect(!wrong.ok && wrong.e.message).toMatch(/Senha incorreta/);
    const unconfirmed = await settle(m.account.deleteAccount({ password: 'bicos123' }, false));
    expect(!unconfirmed.ok && unconfirmed.e.message).toMatch(/Confirme/);
    expect(m.store.getSession()).not.toBeNull();

    expect((await settle(m.account.deleteAccount({ password: 'bicos123' }, true))).ok).toBe(true);
    const db = m.store.getDb();
    expect(m.store.getSession()).toBeNull();
    expect(db.accounts['conta-jorge']).toBeUndefined();
    // U24: the profile and everything of it is gone — every candidacy, post and notice.
    expect(db.workers.jorge).toBeUndefined();
    expect(db.applications.some((a) => a.workerId === 'jorge')).toBe(false);
    expect(db.workerPosts.some((p) => p.workerId === 'jorge')).toBe(false);
    expect(db.notifications.some((n) => n.workerId === 'jorge')).toBe(false);
    // The company of the bico in progress is told.
    expect(db.notifications.some((n) => n.kind === 'desistencia' && n.companyId === 'meridiano')).toBe(true);
    // The old login no longer works.
    expect(await settle(m.auth.signIn('trabalhador@bicos.demo', 'bicos123'))).toMatchObject({
      ok: true,
      v: { ok: false, reason: 'credenciais' }
    });
  });

  it('U16: the e-mail code also proves it is the owner (accounts without a password)', async () => {
    await settle(m.auth.signIn('trabalhador@bicos.demo', 'bicos123'));
    expect(await m.account.accountHasPassword()).toBe(true);
    expect((await settle(m.account.sendSecurityCode())).ok).toBe(true);
    const short = await settle(m.account.deleteAccount({ code: '12' }, true));
    expect(!short.ok && short.e.message).toMatch(/Código incorreto/);
    expect((await settle(m.account.deleteAccount({ code: '123456' }, true))).ok).toBe(true);
    expect(m.store.getSession()).toBeNull();
  });

  it('company: every job and candidacy deleted, the hired worker told (U24)', async () => {
    await settle(m.auth.signIn('empresa@bicos.demo', 'bicos123'));
    const impact = m.account.deletionImpact();
    expect(impact.jobs.map((j) => j.id)).toContain('BC-4998');
    expect((await settle(m.account.deleteAccount({ password: 'bicos123' }, true))).ok).toBe(true);
    const db = m.store.getDb();
    // U24: every job it published is gone, with its candidacies; the hired worker is told.
    expect(Object.values(db.jobs).some((j) => j.companyId === 'meridiano')).toBe(false);
    expect(db.jobs['BC-4998']).toBeUndefined();
    expect(db.applications.some((a) => a.id === 'a11' || a.id === 'a1')).toBe(false);
    expect(db.companies.meridiano).toBeUndefined();
    expect(db.notifications.some((n) => n.workerId === 'jorge' && n.kind === 'contratacao_cancelada')).toBe(true);
  });
});
