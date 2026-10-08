// Business rules: the same sequence of actions on the legacy store and on the new one must leave the
// marketplace in the same state (applications, jobs, saved jobs, posts).
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Legacy = Record<string, (...args: unknown[]) => unknown>;
type Modules = {
  legacy: Legacy;
  store: typeof import('../services/store');
  sel: typeof import('../services/selectors');
};

async function fresh(): Promise<Modules> {
  vi.resetModules();
  const legacy = (await import('../../../app/js/store.js')) as Legacy;
  const store = await import('../services/store');
  const sel = await import('../services/selectors');
  return { legacy, store, sel };
}

function comparable({ legacy, store, sel }: Modules) {
  const db = store.getDb();
  const strip = <T extends object>(o: T) => JSON.parse(JSON.stringify(o));
  return {
    legacy: strip({
      jobs: legacy.allJobs(),
      active: (legacy.activeJobs() as { id: string }[]).map((j) => j.id),
      applications: (legacy.allJobs() as { id: string }[]).flatMap((j) => legacy.applicationsForJob(j.id) as object[]),
      saved: (legacy.savedJobs() as { id: string }[]).map((j) => j.id),
      posts: legacy.postsForWorker('jorge')
    }),
    react: strip({
      jobs: sel.allJobs(db),
      active: sel.activeJobs(db).map((j) => j.id),
      applications: sel.allJobs(db).flatMap((j) => sel.applicationsForJob(db, j.id)),
      saved: sel.savedJobs(db).map((j) => j.id),
      posts: sel.postsForWorker(db, 'jorge')
    })
  };
}

function expectSameState(m: Modules) {
  const { legacy, react } = comparable(m);
  expect(react).toEqual(legacy);
}

describe('store business rules (legacy vs React)', () => {
  let m: Modules;
  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-25T12:00:00Z'));
    m = await fresh();
  });

  it('starts from the same seed', () => expectSameState(m));

  it('applies, re-applies (no duplicate) and cancels', () => {
    for (const s of [m.legacy, m.store] as unknown as Legacy[]) {
      s.applyToJob('BC-4855', 'jorge');
      s.applyToJob('BC-4855', 'jorge');
    }
    expectSameState(m);
    for (const s of [m.legacy, m.store] as unknown as Legacy[]) s.cancelApplication('BC-4830', 'jorge');
    expectSameState(m);
  });

  it('approving the last slot turns the pending candidates down; undo puts one back in review', () => {
    const run = (s: Legacy) => {
      s.decideApplication('BC-4998', 'rafael', 'recusado');
      s.decideApplication('BC-4998', 'bruno', 'aprovado');
      s.decideApplication('BC-4998', 'bruno', null);
      s.decideApplication('BC-4998', 'bruno', 'aprovado');
      s.decideApplication('BC-4998', 'joel', 'aprovado');
      s.decideApplication('BC-4998', 'ninguem', 'aprovado');
    };
    run(m.legacy);
    run(m.store as unknown as Legacy);
    expectSameState(m);
    const db = m.store.getDb();
    expect(m.sel.isJobClosed(db, m.sel.getJob(db, 'BC-4998')!)).toBe(true);
  });

  it('closing a job with and without hires', () => {
    for (const s of [m.legacy, m.store] as unknown as Legacy[]) {
      s.closeJob('BC-4995');
      s.closeJob('BC-4821');
      s.closeJob('nao-existe');
    }
    expectSameState(m);
    expect(m.store.getDb().jobs['BC-4995'].semContratacao).toBe(true);
    expect(m.store.getDb().jobs['BC-4821'].semContratacao).toBeUndefined();
  });

  it('saving, deleting posts, reviews, publishing and editing jobs', () => {
    const job = {
      id: 'BC-5500',
      companyId: 'meridiano',
      role: 'Pedreiro',
      pay: 250,
      location: 'Tatuapé, SP',
      address: 'Rua A, 10',
      distance: '0 km',
      date: '12 out',
      hours: '8h–16h',
      dias: 'fimdesemana',
      duration: '3 diárias',
      slots: 1,
      requirements: ['Ferramenta própria'],
      description: 'Assentar blocos.',
      photos: []
    };
    for (const s of [m.legacy, m.store] as unknown as Legacy[]) {
      s.toggleSavedJob('BC-4841');
      s.toggleSavedJob('BC-5010');
      s.deleteJobPost('BC-5025');
      s.markReviewed('BC-4703', 'jorge');
      s.createJob(JSON.parse(JSON.stringify(job)));
      s.updateJob('BC-5500', { boosted: true, urgent: true });
      s.updateJob('nao-existe', { boosted: true });
      s.addWorkerPost('jorge', { mediaUrl: 'blob:x', mediaType: 'image', caption: 'Muro' });
      s.deleteWorkerPost('wp2');
    }
    expectSameState(m);
  });
});
