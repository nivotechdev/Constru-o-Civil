// Plain store changes (the candidacies' rules live in the status machine: applications.test.ts).
import { beforeEach, describe, expect, it, vi } from 'vitest';

type M = { store: typeof import('../services/store'); sel: typeof import('../services/selectors') };
async function fresh(): Promise<M> {
  vi.resetModules();
  return { store: await import('../services/store'), sel: await import('../services/selectors') };
}

describe('store business rules', () => {
  let m: M;
  beforeEach(async () => {
    m = await fresh();
  });

  it('saves, deletes posts and job posts', () => {
    m.store.toggleSavedJob('BC-4841');
    m.store.toggleSavedJob('BC-5010');
    m.store.deleteJobPost('BC-5025');
    m.store.addWorkerPost('jorge', { mediaUrl: 'blob:x', mediaType: 'image', caption: 'Muro' });
    m.store.deleteWorkerPost('wp2');
    const db = m.store.getDb();
    expect(m.sel.isJobSaved(db, 'BC-4841')).toBe(false);
    expect(m.sel.isJobSaved(db, 'BC-5010')).toBe(true);
    expect(m.sel.activeJobs(db).some((j) => j.id === 'BC-5025')).toBe(false);
    expect(m.sel.postsForWorker(db, 'jorge').map((p) => p.caption)).toContain('Muro');
    expect(db.workerPosts.some((p) => p.id === 'wp2')).toBe(false);
  });
});
