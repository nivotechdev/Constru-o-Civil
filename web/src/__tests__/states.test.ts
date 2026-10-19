// B10 — every service call can fail like a request: the demo's failure switch, no connection, and what
// the screens get back (a loading state, a message, a retry; optimistic changes undone).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Mods = {
  demo: typeof import('../services/demo');
  errors: typeof import('../services/errors');
  queries: typeof import('../services/queries');
  jobs: typeof import('../services/jobs');
  store: typeof import('../services/store');
  sel: typeof import('../services/selectors');
};

async function fresh(): Promise<Mods> {
  vi.resetModules();
  return {
    demo: await import('../services/demo'),
    errors: await import('../services/errors'),
    queries: await import('../services/queries'),
    jobs: await import('../services/jobs'),
    store: await import('../services/store'),
    sel: await import('../services/selectors')
  };
}

/** Settles `p` (advancing the fake clock) and returns how it ended. */
async function outcome<T>(p: Promise<T>): Promise<{ ok: true; value: T } | { ok: false; error: unknown }> {
  const result = p.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error })
  );
  await vi.runAllTimersAsync();
  return result;
}

describe('failing like a request', () => {
  let m: Mods;
  beforeEach(async () => {
    vi.useFakeTimers();
    m = await fresh();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('rejects every call while the failure switch is on, with a message for the screen', async () => {
    m.demo.setFailureMode(true);
    const r = await outcome(m.jobs.loadFeed());
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toBeInstanceOf(m.errors.ServiceError);
      expect((r.error as InstanceType<typeof m.errors.ServiceError>).code).toBe('falha_demo');
      expect(m.errors.errorMessage(r.error)).toMatch(/Tente de novo/);
    }
    m.demo.setFailureMode(false);
    expect((await outcome(m.jobs.loadFeed())).ok).toBe(true);
  });

  it('says "sem internet" when the device is offline', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    const r = await outcome(m.jobs.loadFeed());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(m.errors.isOfflineError(r.error)).toBe(true);
  });

  it('puts a saved flag back when saving fails', async () => {
    const before = m.sel.isJobSaved(m.store.getDb(), 'BC-4821');
    m.demo.setFailureMode(true);
    const pending = m.jobs.toggleSavedJob('BC-4821');
    // Optimistic: the flag flips at once…
    expect(m.sel.isJobSaved(m.store.getDb(), 'BC-4821')).toBe(!before);
    expect((await outcome(pending)).ok).toBe(false);
    // …and goes back when the request fails.
    expect(m.sel.isJobSaved(m.store.getDb(), 'BC-4821')).toBe(before);
  });

  it("refuses to delete another company's job", async () => {
    const r = await outcome(m.jobs.deleteJob('BC-4822')); // Construtora Alvorada's
    expect(r.ok).toBe(false);
    if (!r.ok) expect((r.error as InstanceType<typeof m.errors.ServiceError>).code).toBe('nao_autorizado');
  });
});

describe('reads through the query cache', () => {
  let m: Mods;
  beforeEach(async () => {
    vi.useFakeTimers();
    m = await fresh();
  });
  afterEach(() => vi.useRealTimers());

  it('goes loading → ready, then opens straight away', async () => {
    const loader = vi.fn(() => m.jobs.loadFeed());
    expect(m.queries.getQuery('feed').status).toBe('loading');
    await outcome(m.queries.runQuery('feed', loader));
    expect(m.queries.getQuery('feed')).toEqual({ status: 'ready', error: null, offline: false });
    await outcome(m.queries.runQuery('feed', loader));
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('keeps the error until "Tentar de novo" works, and never loads twice at once', async () => {
    m.demo.setFailureMode(true);
    const loader = vi.fn(() => m.jobs.loadFeed());
    const a = m.queries.runQuery('feed', loader);
    const b = m.queries.runQuery('feed', loader);
    expect(a).toBe(b);
    await outcome(a);
    expect(m.queries.getQuery('feed').status).toBe('error');
    expect(m.queries.getQuery('feed').error).toMatch(/Tente de novo/);

    m.demo.setFailureMode(false);
    await outcome(m.queries.runQuery('feed', loader, true));
    expect(m.queries.getQuery('feed').status).toBe('ready');
    expect(loader).toHaveBeenCalledTimes(2);

    m.queries.clearQueries();
    expect(m.queries.getQuery('feed').status).toBe('loading');
  });
});
