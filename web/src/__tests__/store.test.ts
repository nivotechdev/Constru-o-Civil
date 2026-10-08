// Business rules of the store (they used to be checked against the legacy app's store; the data model
// has since moved on — real dates, catalog ids, explicit statuses — so they are checked on their own).
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

  it('applies once (no duplicate) and cancels', () => {
    m.store.applyToJob('BC-4855', 'jorge');
    m.store.applyToJob('BC-4855', 'jorge');
    expect(m.sel.applicationsForJob(m.store.getDb(), 'BC-4855')).toHaveLength(1);
    m.store.cancelApplication('BC-4855', 'jorge');
    expect(m.sel.applicationFor(m.store.getDb(), 'BC-4855', 'jorge')).toBeNull();
  });

  it('approving the last slot turns the pending candidates down', () => {
    m.store.decideApplication('BC-4998', 'rafael', 'recusado');
    m.store.decideApplication('BC-4998', 'bruno', 'aprovado');
    m.store.decideApplication('BC-4998', 'joel', 'aprovado');
    const db = m.store.getDb();
    expect(m.sel.isJobClosed(db, m.sel.getJob(db, 'BC-4998')!)).toBe(true);
    expect(m.sel.applicationFor(db, 'BC-4998', 'rafael')?.status).toBe('nao_selecionado');
  });

  it('closing a job turns the pending candidates down and records whether anyone was hired', () => {
    m.store.closeJob('BC-4995');
    m.store.closeJob('BC-4821');
    const db = m.store.getDb();
    expect(db.jobs['BC-4995'].semContratacao).toBe(true);
    expect(db.jobs['BC-4821'].semContratacao).toBeUndefined();
    expect(m.sel.applicationFor(db, 'BC-4995', 'nelson')?.status).toBe('nao_selecionado');
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
