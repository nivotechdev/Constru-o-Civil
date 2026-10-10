// B02 — the candidacy status machine: the table itself, and the services that run it (with the
// automatic rules and the notifications each change sends).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { canTransition, newApplication, TRANSITIONS, transition } from '../services/applicationMachine';
import type { ApplicationStatus } from '../types/models';

const ALL: ApplicationStatus[] = [
  'enviada',
  'em_analise',
  'pre_selecionado',
  'contratado',
  'concluida',
  'nao_selecionado',
  'desistiu',
  'cancelado_pela_construtora',
  'nao_compareceu'
];

describe('transition table', () => {
  it('allows exactly the listed moves, each only to who may make it', () => {
    const allowed: string[] = [];
    for (const [action, t] of Object.entries(TRANSITIONS))
      for (const from of ALL)
        for (const by of ['trabalhador', 'construtora', 'sistema'] as const)
          if (canTransition(from, action as keyof typeof TRANSITIONS, by))
            allowed.push(`${from} -${action}/${by}-> ${t.to}`);
    expect(allowed.sort()).toEqual(
      [
        'enviada -analisar/construtora-> em_analise',
        'enviada -analisar/sistema-> em_analise',
        'enviada -aprovar/construtora-> pre_selecionado',
        'em_analise -aprovar/construtora-> pre_selecionado',
        'enviada -recusar/construtora-> nao_selecionado',
        'enviada -recusar/sistema-> nao_selecionado',
        'em_analise -recusar/construtora-> nao_selecionado',
        'em_analise -recusar/sistema-> nao_selecionado',
        'pre_selecionado -desfazer_aprovacao/construtora-> em_analise',
        'nao_selecionado -desfazer_recusa/construtora-> em_analise',
        'pre_selecionado -contratar/construtora-> contratado',
        'pre_selecionado -desistir/trabalhador-> desistiu',
        'contratado -desistir/trabalhador-> desistiu',
        'pre_selecionado -cancelar_contratacao/construtora-> cancelado_pela_construtora',
        'contratado -cancelar_contratacao/construtora-> cancelado_pela_construtora',
        'contratado -concluir/construtora-> concluida',
        'contratado -concluir/sistema-> concluida',
        'contratado -marcar_falta/construtora-> nao_compareceu',
        'pre_selecionado -expirar/sistema-> expirada'
      ].sort()
    );
  });

  it('records each step with when, who and why; refuses a move the table does not allow', () => {
    const app = newApplication('a', 'BC-1', 'w', '2026-10-01T10:00:00.000Z');
    const picked = transition(app, 'aprovar', 'construtora', '2026-10-01T11:00:00.000Z');
    const gone = transition(picked, 'desistir', 'trabalhador', '2026-10-02T08:00:00.000Z', 'Fiquei doente');
    expect(gone.status).toBe('desistiu');
    expect(gone.statusChangedAt).toBe('2026-10-02T08:00:00.000Z');
    expect(gone.events.map((e) => [e.status, e.by, e.reason])).toEqual([
      ['enviada', 'trabalhador', null],
      ['pre_selecionado', 'construtora', null],
      ['desistiu', 'trabalhador', 'Fiquei doente']
    ]);
    expect(() => transition(app, 'contratar', 'construtora', 'x')).toThrow(/mudou de situação/);
    expect(() => transition(picked, 'desistir', 'construtora', 'x')).toThrow();
  });
});

type M = {
  apps: typeof import('../services/applications');
  jobs: typeof import('../services/jobs');
  auth: typeof import('../services/auth');
  store: typeof import('../services/store');
  sel: typeof import('../services/selectors');
};

describe('status machine in the services', () => {
  let m: M;
  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();
    m = {
      apps: await import('../services/applications'),
      jobs: await import('../services/jobs'),
      auth: await import('../services/auth'),
      store: await import('../services/store'),
      sel: await import('../services/selectors')
    };
  });
  afterEach(() => vi.useRealTimers());

  const run = async <T>(p: Promise<T>) => {
    const settled = p.then(
      (v) => ({ ok: true as const, v }),
      (e: unknown) => ({ ok: false as const, e })
    );
    await vi.runAllTimersAsync();
    const r = await settled;
    if (!r.ok) throw r.e;
    return r.v;
  };
  const status = (jobId: string, workerId: string) =>
    m.sel.applicationFor(m.store.getDb(), jobId, workerId)?.status ?? null;
  const noticesFor = (workerId: string) => m.store.getDb().notifications.filter((n) => n.workerId === workerId);
  const asCompany = () => run(m.auth.signIn('construtora@bicos.demo', 'bicos123'));
  const asWorker = () => run(m.auth.signIn('trabalhador@bicos.demo', 'bicos123'));

  it('filling the last slot turns the pending candidates down; undoing brings them back', async () => {
    await asCompany();
    // BC-4998 has 2 slots and rafael, bruno, joel em análise.
    await run(m.apps.approve('BC-4998', 'bruno'));
    expect(status('BC-4998', 'rafael')).toBe('em_analise');
    await run(m.apps.approve('BC-4998', 'joel'));
    expect(status('BC-4998', 'rafael')).toBe('nao_selecionado');
    expect(m.sel.applicationFor(m.store.getDb(), 'BC-4998', 'rafael')?.autoRejected).toBe(true);
    expect(noticesFor('rafael').map((n) => n.kind)).toEqual(['nao_selecionado']);
    expect(noticesFor('joel').map((n) => n.kind)).toEqual(['pre_selecionado']);

    await run(m.apps.undoApproval('BC-4998', 'joel'));
    expect(status('BC-4998', 'joel')).toBe('em_analise');
    expect(status('BC-4998', 'rafael')).toBe('em_analise');
    // The unread "pré-selecionado" notice is taken back.
    expect(noticesFor('joel')).toEqual([]);
  });

  it('L22: a refusal can be undone for 10 minutes; the unseen notice is taken back', async () => {
    await asCompany();
    await run(m.apps.reject('BC-4998', 'rafael'));
    expect(noticesFor('rafael').map((n) => n.kind)).toEqual(['nao_selecionado']);
    await run(m.apps.undoReject('BC-4998', 'rafael'));
    expect(status('BC-4998', 'rafael')).toBe('em_analise');
    expect(noticesFor('rafael')).toEqual([]);
    // Too late.
    await run(m.apps.reject('BC-4998', 'bruno'));
    vi.setSystemTime(Date.now() + 11 * 60_000);
    await expect(run(m.apps.undoReject('BC-4998', 'bruno'))).rejects.toMatchObject({ code: 'conflito' });
  });

  it('Y03: a place that opens (cancelled hire) brings back the automatic refusals, told "A vaga reabriu"', async () => {
    await asCompany();
    await run(m.apps.approve('BC-4998', 'bruno'));
    await run(m.apps.approve('BC-4998', 'joel'));
    expect(status('BC-4998', 'rafael')).toBe('nao_selecionado');
    await run(m.apps.cancelHire('BC-4998', 'joel', 'A obra foi adiada'));
    expect(status('BC-4998', 'rafael')).toBe('em_analise');
    expect(noticesFor('rafael').map((n) => n.title)).toContain('A vaga reabriu');
  });

  it('Y05: undoing an approval on a closed job is refused', async () => {
    await asCompany();
    await run(m.apps.approve('BC-4998', 'bruno'));
    await run(m.jobs.closeJob('BC-4998'));
    await expect(run(m.apps.undoApproval('BC-4998', 'bruno'))).rejects.toThrow(/encerrada/);
  });

  it('Y08: a job with a team is not deleted; without one, who waited is told it was removed', async () => {
    await asCompany();
    await run(m.apps.approve('BC-4998', 'bruno'));
    await expect(run(m.jobs.deleteJob('BC-4998'))).rejects.toThrow(/Encerre a vaga/);
    await run(m.jobs.deleteJob('BC-4995'));
    expect(status('BC-4995', 'nelson')).toBe('nao_selecionado');
    expect(noticesFor('nelson').map((n) => n.title)).toContain('Vaga removida');
    expect(m.store.getDb().deletedJobIds).toContain('BC-4995');
    expect(m.sel.jobState(m.store.getDb(), m.store.getDb().jobs['BC-4995'])).toBe('excluida');
  });

  it('Y01: a full job stays editable; when the whole team is done, it closes by itself', async () => {
    await asCompany();
    const today = new Date().toISOString().slice(0, 10);
    m.store.updateJob('BC-4995', { slots: 1, startDate: today, endDate: today, dateToArrange: false });
    await run(m.apps.approve('BC-4995', 'nelson'));
    expect(m.sel.jobState(m.store.getDb(), m.store.getDb().jobs['BC-4995'])).toBe('cheia');
    await run(m.apps.confirmHire('BC-4995', 'nelson'));
    await run(m.apps.completeWorkday('BC-4995', 'nelson'));
    const job = m.store.getDb().jobs['BC-4995'];
    expect(job.closed).toBe(true);
    expect(job.semContratacao).toBeFalsy();
  });

  it('Y04: an expired job leaves nobody waiting; a hire is concluded 2 days after the end', async () => {
    await asCompany();
    await run(m.apps.approve('BC-4998', 'bruno'));
    const now = new Date();
    const iso = (d: number) => new Date(now.getTime() + d * 86400000).toISOString().slice(0, 10);
    m.store.updateJob('BC-4998', { startDate: iso(-3), endDate: iso(-1), dateToArrange: false });
    m.apps.concludeFinishedJobs(now);
    expect(status('BC-4998', 'rafael')).toBe('nao_selecionado');
    expect(status('BC-4998', 'bruno')).toBe('expirada');
    expect(m.store.getDb().jobs['BC-4998'].closed).toBe(true);
    expect(noticesFor('bruno').map((n) => n.title)).toContain('A contratação não foi confirmada');
  });

  it('Y07: no candidacy on a job that is full, closed, past or removed (same checks as the server)', async () => {
    await asCompany();
    await run(m.jobs.closeJob('BC-4995'));
    await asWorker();
    await expect(run(m.apps.submitApplication('BC-4995'))).rejects.toThrow(/encerrada/);
    expect(status('BC-4995', 'jorge')).toBeNull();
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    m.store.updateJob('BC-4855', { dateToArrange: false, startDate: yesterday, endDate: yesterday });
    await expect(run(m.apps.submitApplication('BC-4855'))).rejects.toThrow(/prazo/);
    expect(m.sel.unavailableText('cheia')?.title).toBe('Vaga preenchida');
    expect(m.sel.unavailableText('aberta')).toBeNull();
  });

  it('closing the job makes the refusals final and turns the pending candidates down', async () => {
    await asCompany();
    await run(m.apps.approve('BC-4998', 'bruno'));
    await run(m.apps.approve('BC-4998', 'joel'));
    await run(m.jobs.closeJob('BC-4998'));
    const rafael = m.sel.applicationFor(m.store.getDb(), 'BC-4998', 'rafael');
    expect(rafael?.autoRejected).toBe(false);
    await run(m.jobs.closeJob('BC-4995'));
    expect(status('BC-4995', 'nelson')).toBe('nao_selecionado');
    expect(m.store.getDb().jobs['BC-4995'].semContratacao).toBe(true);
  });

  it('hire, conclude and ask both sides for a review', async () => {
    await asCompany();
    await run(m.apps.approve('BC-4995', 'nelson'));
    await run(m.apps.confirmHire('BC-4995', 'nelson'));
    expect(status('BC-4995', 'nelson')).toBe('contratado');
    // Y02: not before the day of the job.
    const start = m.store.getDb().jobs['BC-4995'].startDate as string;
    if (start > new Date().toISOString().slice(0, 10)) {
      await expect(run(m.apps.completeWorkday('BC-4995', 'nelson'))).rejects.toThrow(/a partir do dia/);
      vi.setSystemTime(new Date(start + 'T12:00:00'));
    }
    await run(m.apps.completeWorkday('BC-4995', 'nelson'));
    expect(status('BC-4995', 'nelson')).toBe('concluida');
    const kinds = m.store
      .getDb()
      .notifications.filter((n) => n.workerId === 'nelson' || n.companyId === 'meridiano')
      .map((n) => n.kind);
    expect(kinds).toContain('avaliar_diaria');
    expect(kinds).toContain('avaliar_trabalhador');
  });

  it('no-show and cancellation need a hire; another company cannot decide', async () => {
    await asCompany();
    await expect(run(m.apps.markNoShow('BC-4998', 'bruno'))).rejects.toThrow(/mudou de situação/);
    await run(m.apps.approve('BC-4998', 'bruno'));
    await run(m.apps.cancelHire('BC-4998', 'bruno', 'A obra foi adiada'));
    expect(status('BC-4998', 'bruno')).toBe('cancelado_pela_construtora');
    await expect(run(m.apps.approve('BC-4855', 'jorge'))).rejects.toThrow(/Só a construtora/);
  });

  it('the worker withdraws only while pending, and gives up a picked job with a reason', async () => {
    await asWorker();
    await run(m.apps.withdrawApplication('BC-4830'));
    expect(status('BC-4830', 'jorge')).toBeNull();
    await expect(run(m.apps.withdrawApplication('BC-4821'))).rejects.toThrow(/já decidiu/);
    await run(m.apps.giveUp('BC-4821', 'Fiquei doente'));
    expect(status('BC-4821', 'jorge')).toBe('desistiu');
    const notice = m.store.getDb().notifications.find((n) => n.kind === 'desistencia');
    expect(notice?.companyId).toBe('meridiano');
    expect(notice?.text).toMatch(/Fiquei doente/);
  });

  it('concludes a hire on its own once the last day has passed', async () => {
    // a8: jorge hired for BC-4712, a job a month ago.
    expect(status('BC-4712', 'jorge')).toBe('contratado');
    m.apps.concludeFinishedJobs();
    const app = m.sel.applicationFor(m.store.getDb(), 'BC-4712', 'jorge');
    expect(app?.status).toBe('concluida');
    expect(app?.events.at(-1)?.by).toBe('sistema');
  });

  it('opening a new candidate puts the candidacy in review and tells the worker', async () => {
    await asCompany();
    await run(m.apps.approve('BC-4821', 'vitor')); // something else first, so the notice order is clear
    await asWorker();
    await run(m.apps.submitApplication('BC-4855'));
    await asCompany();
    // BC-4855 isn't Meridiano's: nothing changes.
    await run(m.apps.markInReview('BC-4855', 'jorge'));
    expect(status('BC-4855', 'jorge')).toBe('enviada');
  });
});
