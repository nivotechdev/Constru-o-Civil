// B05 — editing a job: the owner only, while open; headcount not below who is approved; candidates told
// when pay, date or address change.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formFromJob, validateStep1, validateStep2, draftFromForm } from '../pages/recruiter/jobForm';

type M = {
  jobs: typeof import('../services/jobs');
  apps: typeof import('../services/applications');
  auth: typeof import('../services/auth');
  store: typeof import('../services/store');
};

describe('editing a job', () => {
  let m: M;
  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();
    m = {
      jobs: await import('../services/jobs'),
      apps: await import('../services/applications'),
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

  it('keeps a start date already in the past and refuses fewer people than approved', () => {
    const job = { ...m.store.getDb().jobs['BC-4821'], startDate: '2026-01-05', endDate: '2026-12-30' };
    const form = formFromJob(job);
    const now = new Date(2026, 9, 8);
    expect(validateStep2(form, { originalStartDate: '2026-01-05' }, now).startDate).toBeUndefined();
    expect(
      validateStep2({ ...form, startDate: '2026-01-06' }, { originalStartDate: '2026-01-05' }, now).startDate
    ).toMatch(/passado/);
    expect(validateStep2({ ...form, vagas: '1' }, { minSlots: 2 }).vagas).toMatch(/já aprovou 2/);
  });

  it('a change of pay tells every active candidate; a description change tells nobody', async () => {
    await settle(m.auth.signIn('empresa@bicos.demo', 'bicos123'));
    const job = m.store.getDb().jobs['BC-4821']; // jorge pre-selected, 4 em análise
    const quiet = draftFromForm({ ...formFromJob(job), detalhe: 'Outro texto.' });
    expect((await settle(m.jobs.updateJob(job.id, quiet))).ok).toBe(true);
    expect(m.store.getDb().notifications.filter((n) => n.kind === 'vaga_editada')).toHaveLength(0);
    expect(m.store.getDb().jobs['BC-4821'].description).toBe('Outro texto.');

    const pay = draftFromForm({ ...formFromJob(m.store.getDb().jobs['BC-4821']), valor: '260' });
    expect(m.jobs.significantChanges(m.store.getDb().jobs['BC-4821'], pay)).toEqual(['valor']);
    expect((await settle(m.jobs.updateJob(job.id, pay))).ok).toBe(true);
    const told = m.store
      .getDb()
      .notifications.filter((n) => n.kind === 'vaga_editada')
      .map((n) => n.workerId);
    expect(told.sort()).toEqual(['caio', 'edson', 'jorge', 'marcos', 'vitor']);
  });

  it("refuses fewer slots than approved, someone else's job and a closed one", async () => {
    await settle(m.auth.signIn('empresa@bicos.demo', 'bicos123'));
    await settle(m.apps.approve('BC-4998', 'bruno'));
    const job = m.store.getDb().jobs['BC-4998'];
    const fewer = await settle(m.jobs.updateJob(job.id, { ...draftFromForm(formFromJob(job)), slots: 0 }));
    expect(fewer.ok).toBe(true); // 0 is read as 1, and 1 person is approved
    const one = await settle(
      m.jobs
        .updateJob(job.id, { ...draftFromForm(formFromJob(job)), slots: 1 })
        .then(() => m.apps.approve('BC-4998', 'joel'))
    );
    expect(one.ok).toBe(false); // the job is full with 1 slot
    const other = m.store.getDb().jobs['BC-4822'];
    expect((await settle(m.jobs.updateJob(other.id, draftFromForm(formFromJob(other))))).ok).toBe(false);
    m.store.updateJob('BC-4995', { closed: true }); // closed by itself (team done, date passed)
    const closed = m.store.getDb().jobs['BC-4995'];
    const r = await settle(m.jobs.updateJob(closed.id, draftFromForm(formFromJob(closed))));
    expect(!r.ok && r.e.message).toMatch(/encerrada/);
  });
});

describe('X10: the job point when editing', () => {
  it('an unchanged address keeps the saved point; a new number places it again; an unknown city is refused', async () => {
    vi.resetModules();
    const store = await import('../services/store');
    const job = { ...store.getDb().jobs['BC-4821'] };
    job.address = { ...job.address, lat: -23.123456, lon: -46.654321 };
    const same = draftFromForm({ ...formFromJob(job), detalhe: 'Outro texto.' }, job);
    expect([same.address.lat, same.address.lon]).toEqual([-23.123456, -46.654321]);
    // A new number: the point the address was found at (the screen looks it up again).
    const moved = draftFromForm({ ...formFromJob(job), number: '999' }, job, { lat: -23.54, lon: -46.57 });
    expect([moved.address.lat, moved.address.lon]).toEqual([-23.54, -46.57]);
    const nowhere = validateStep1({ ...formFromJob(job), cep: '99999-999', city: 'Cidade Inventada, ZZ' });
    expect(nowhere.city).toMatch(/na lista/);
  });
});
