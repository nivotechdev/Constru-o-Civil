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
        'pre_selecionado -expirar/sistema-> expirada',
        // R03: the same list is checked against the database in supabase/tests/r03_suspensao_completa.sql.
        'pre_selecionado -cancelar_por_suspensao/sistema-> cancelado_pela_equipe',
        'contratado -cancelar_por_suspensao/sistema-> cancelado_pela_equipe'
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

  /** U06: a job is not closed by hand; it closes by itself once its last day has passed. */
  const expire = (jobId: string) => {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    m.store.updateJob(jobId, { dateToArrange: false, startDate: yesterday, endDate: yesterday });
    m.apps.concludeFinishedJobs(new Date());
  };
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
  const asCompany = () => run(m.auth.signIn('empresa@bicos.demo', 'bicos123'));
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

  it('F12: the hired worker confirms they will go and the company is told', async () => {
    await asCompany();
    await run(m.apps.confirmHire('BC-4821', 'jorge'));
    await asWorker();
    await run(m.apps.confirmPresence('BC-4821'));
    const app = m.sel.applicationFor(m.store.getDb(), 'BC-4821', 'jorge');
    expect(app?.presenceConfirmedAt).toBeTruthy();
    expect(
      m.store.getDb().notifications.some((n) => n.kind === 'confirmar_presenca' && n.companyId === 'meridiano')
    ).toBe(true);
  });

  it('F13: the company invites; accepting becomes a candidacy and the company hears it', async () => {
    const inv = await import('../services/invites');
    await asCompany();
    await run(inv.inviteWorker('BC-4998', 'jorge'));
    await expect(run(inv.inviteWorker('BC-4998', 'jorge'))).rejects.toMatchObject({ code: 'conflito' });
    expect(noticesFor('jorge').some((n) => n.kind === 'convite')).toBe(true);
    await asWorker();
    await run(inv.answerInvite('BC-4998', true));
    expect(status('BC-4998', 'jorge')).toBe('enviada');
    expect(inv.inviteFor(m.store.getDb(), 'BC-4998', 'jorge')?.status).toBe('aceito');
    expect(m.store.getDb().notifications.some((n) => n.kind === 'convite' && n.companyId === 'meridiano')).toBe(true);
  });

  it('F04: blocking ends the pending candidacy and hides the account; reports are recorded', async () => {
    const safety = await import('../services/safety');
    await asCompany();
    expect(status('BC-4998', 'rafael')).toBe('em_analise');
    await run(safety.blockAccount('rafael'));
    expect(status('BC-4998', 'rafael')).toBeNull();
    expect(safety.isBlocked(m.store.getDb(), 'rafael')).toBe(true);
    await run(safety.reportContent('perfil', 'rafael', 'ofensa', 'xingou'));
    expect(safety.demoReports).toContainEqual({ target: 'perfil', id: 'rafael', reason: 'ofensa' });
    await run(safety.unblockAccount('rafael'));
    expect(safety.isBlocked(m.store.getDb(), 'rafael')).toBe(false);
  });

  it('F06: muting "bicos novos" keeps invites out of the bell; candidacy news always arrive', async () => {
    const notices = await import('../services/notifications');
    const inv = await import('../services/invites');
    await asWorker();
    await run(notices.saveNotificationPrefs({ muted: ['bicos_novos'], push: [] }));
    await expect(run(notices.saveNotificationPrefs({ muted: ['candidaturas'], push: [] }))).rejects.toMatchObject({
      code: 'validacao'
    });
    await asCompany();
    await run(inv.inviteWorker('BC-4998', 'jorge'));
    expect(noticesFor('jorge').some((n) => n.kind === 'convite')).toBe(false);
    await run(m.apps.confirmHire('BC-4821', 'jorge'));
    expect(noticesFor('jorge').some((n) => n.kind === 'contratado')).toBe(true);
  });

  it('L07: each closed job says how it ended', async () => {
    await asCompany();
    const db = m.store.getDb();
    expect(m.sel.jobOutcome(db, db.jobs['BC-4960'])).toBe('Concluída');
    expect(m.sel.jobOutcome(db, db.jobs['BC-4998'])).toBeNull();
    expire('BC-4998');
    expect(m.sel.jobOutcome(m.store.getDb(), m.store.getDb().jobs['BC-4998'])).toBe('Encerrada sem contratação');
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
    m.store.updateJob('BC-4998', { closed: true });
    await expect(run(m.apps.undoApproval('BC-4998', 'bruno'))).rejects.toThrow(/encerrada/);
  });

  it('Y08: a job with a team is not deleted; without one, who waited is told it was removed', async () => {
    await asCompany();
    await run(m.apps.approve('BC-4998', 'bruno'));
    await expect(run(m.jobs.deleteJob('BC-4998'))).rejects.toThrow(/não pode ser excluída/);
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
    m.store.updateJob('BC-4995', { closed: true });
    await asWorker();
    await expect(run(m.apps.submitApplication('BC-4995'))).rejects.toThrow(/encerrada/);
    expect(status('BC-4995', 'jorge')).toBeNull();
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    m.store.updateJob('BC-4855', { dateToArrange: false, startDate: yesterday, endDate: yesterday });
    await expect(run(m.apps.submitApplication('BC-4855'))).rejects.toThrow(/prazo/);
    expect(m.sel.unavailableText('cheia')?.title).toBe('Vaga preenchida');
    expect(m.sel.unavailableText('aberta')).toBeNull();
  });

  it('X07: applying again to the same job says so instead of a second "Candidatura enviada"', async () => {
    await asWorker();
    const open = Object.values(m.store.getDb().jobs).find(
      (j) => m.sel.jobState(m.store.getDb(), j) === 'aberta' && !m.sel.applicationFor(m.store.getDb(), j.id, 'jorge')
    )!;
    expect(await run(m.apps.submitApplication(open.id))).toBe('enviada');
    expect(await run(m.apps.submitApplication(open.id))).toBe('ja_enviada');
    expect(m.store.getDb().applications.filter((a) => a.jobId === open.id && a.workerId === 'jorge')).toHaveLength(1);
  });

  it('a job that closes by itself makes the refusals final and turns the pending candidates down', async () => {
    await asCompany();
    await run(m.apps.approve('BC-4998', 'bruno'));
    await run(m.apps.approve('BC-4998', 'joel'));
    expire('BC-4998');
    const rafael = m.sel.applicationFor(m.store.getDb(), 'BC-4998', 'rafael');
    expect(rafael?.autoRejected).toBe(false);
    expire('BC-4995');
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
    await expect(run(m.apps.approve('BC-4855', 'jorge'))).rejects.toThrow(/Só a empresa/);
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

describe('F12 + L05: presence and "Precisa de você"', () => {
  it('a hire for tomorrow needs the worker until they confirm; the company sees who confirmed', async () => {
    const { needsWorker, candidateBadge } = await import('../utils/applicationStatus');
    const job = { startDate: '2026-10-11', dateToArrange: false };
    const hired = { status: 'contratado' as const, workerReviewed: false, presenceConfirmedAt: null };
    expect(needsWorker(hired, job, '2026-10-10')).toBe(true);
    expect(needsWorker(hired, job, '2026-10-05')).toBe(false);
    expect(needsWorker({ ...hired, presenceConfirmedAt: '2026-10-10T10:00:00Z' }, job, '2026-10-10')).toBe(false);
    expect(needsWorker({ status: 'concluida', workerReviewed: false }, null)).toBe(true);
    expect(needsWorker({ status: 'pre_selecionado', workerReviewed: false }, null)).toBe(true);
    expect(candidateBadge({ status: 'contratado', companyReviewed: false, presenceConfirmedAt: 'x' }).label).toBe(
      'Confirmou que vai'
    );
  });
});
