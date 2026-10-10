// Applications: a worker's candidacy on a job and every change of its status. Each change goes through
// the transition table (applicationMachine.ts) and sends the matching notification to the other side,
// in one transaction. Each function says what the real backend does there (docs/CONTRATO-BACKEND.md).
import { jobTitle } from './catalog';
import { serviceError } from './errors';
import {
  holdsSlot,
  isPending,
  newApplication,
  occupiesSlot,
  transition,
  type ApplicationAction
} from './applicationMachine';
import { mockLatency } from './mockLatency';
import { withNotification, type NotificationInput } from './notifications';
import { applicationFor, companyOf, currentCompanyId, currentWorkerId, getJob, jobState } from './selectors';
import * as store from './store';
import type { Actor, Application, Database, Job } from '../types/models';
import { addDays, todayISO } from '../utils/dates';
import { isExpired, lastDay } from '../utils/jobInfo';
import { IS_DEMO } from './mode';
import * as remote from './remote/applications';
import * as remoteData from './remote/data';

const now = () => new Date().toISOString();
const firstName = (name: string) => name.split(' ')[0];

// ---- automatic rules for jobs whose time is up (Y04) ----

/** A hired diária is concluded by the system 2 days after the job's last day (time to mark a no-show). */
export const AUTO_CONCLUDE_AFTER_DAYS = 2;

/**
 * The routine for jobs whose time is up (Y04). Mock: runs whenever candidacies are read. Backend: the
 * same rules in a scheduled job (pg_cron, hourly: run_job_routines).
 *   - candidates still waiting for a decision → "não selecionado" (reason vaga_vencida), told so;
 *   - picked but never hired → "expirada", both sides told;
 *   - hired → "concluída" 2 days after the last day (both asked for a review);
 *   - nobody left to work → the job closes by itself (history).
 */
export function concludeFinishedJobs(now: Date = new Date()): void {
  const db = store.getDb();
  const today = todayISO(now);
  const at = now.toISOString();
  const dueHires = db.applications.filter((a) => {
    const job = getJob(db, a.jobId);
    const last = job && lastDay(job);
    return a.status === 'contratado' && last && addDays(last, AUTO_CONCLUDE_AFTER_DAYS) <= today;
  });
  const expired = Object.values(db.jobs).filter(
    (j) => !j.closed && !db.deletedJobIds.includes(j.id) && isExpired(j, now)
  );
  if (!dueHires.length && !expired.length) return;
  store.transact((d) => {
    let next = dueHires.reduce((acc, app) => conclude(acc, app.id, 'sistema', at), d);
    for (const job of expired) next = expireJob(next, job, at);
    return next;
  });
}

function expireJob(db: Database, job: Job, at: string): Database {
  let next = db;
  const company = companyOf(db, job);
  const title = jobTitle(job);
  for (const app of db.applications.filter((a) => a.jobId === job.id)) {
    if (isPending(app.status)) {
      next = withNotification(
        step(next, app, 'recusar', 'sistema', at, 'vaga_vencida'),
        toWorker(app, {
          kind: 'nao_selecionado',
          title: 'Vaga vencida',
          text: `O prazo de ${title} na ${company.name} passou sem uma decisão. Tem outros bicos no mural.`,
          target: '/mural'
        }),
        at
      );
    } else if (app.status === 'pre_selecionado') {
      const worker = next.workers[app.workerId];
      next = withNotification(
        withNotification(
          step(next, app, 'expirar', 'sistema', at),
          toWorker(app, {
            kind: 'nao_selecionado',
            title: 'A contratação não foi confirmada',
            text: `O prazo de ${title} passou sem a ${company.name} confirmar a contratação.`,
            target: '/vaga/' + job.id
          }),
          at
        ),
        toCompany(job, {
          kind: 'bico_fechado',
          title: 'Prazo da vaga vencido',
          text: `${worker?.name ?? 'O trabalhador'} não foi confirmado para ${title} antes do prazo.`,
          target: '/vaga-gerenciar/' + job.id
        }),
        at
      );
    }
  }
  // Nobody left to work: the job closes (it goes to the history).
  const current = next.jobs[job.id];
  if (current && !current.closed && !next.applications.some((a) => a.jobId === job.id && holdsSlot(a.status))) {
    const done = next.applications.some((a) => a.jobId === job.id && a.status === 'concluida');
    const closed: Job = { ...current, closed: true, semContratacao: !done };
    next = closeJobApplications({ ...next, jobs: { ...next.jobs, [job.id]: closed } }, closed, at);
  }
  return next;
}

// ---- reads ----

/** The worker's applications (+ their jobs). Backend: select applications where worker = me. */
export async function loadMyApplications(): Promise<void> {
  if (!IS_DEMO) return remoteData.loadMyApplications();
  await mockLatency(400);
  concludeFinishedJobs();
}

/** A job's candidates (+ their profiles), for the company. Backend: select applications where job = id. */
export async function loadJobCandidates(_jobId: string): Promise<void> {
  if (!IS_DEMO) return remoteData.loadJobCandidates(_jobId);
  await mockLatency(400);
  concludeFinishedJobs();
}

/** The company's closed jobs and their teams. Backend: select the company's closed jobs + applications. */
export async function loadHistory(): Promise<void> {
  if (!IS_DEMO) return remoteData.loadHistory();
  await mockLatency(400);
  concludeFinishedJobs();
}

// ---- helpers ----

function findApp(db: Database, jobId: string, workerId: string): Application {
  const app = applicationFor(db, jobId, workerId);
  if (!app) throw serviceError('nao_encontrado', 'Essa candidatura não existe mais.');
  return app;
}

function companyJob(db: Database, jobId: string): Job {
  const job = getJob(db, jobId);
  if (!job) throw serviceError('nao_encontrado', 'Essa vaga não existe mais.');
  if (job.companyId !== currentCompanyId())
    throw serviceError('nao_autorizado', 'Só a construtora da vaga pode decidir os candidatos.');
  return job;
}

function replaceApp(db: Database, app: Application): Database {
  return { ...db, applications: db.applications.map((a) => (a.id === app.id ? app : a)) };
}

function step(
  db: Database,
  app: Application,
  action: ApplicationAction,
  by: Actor,
  at: string,
  reason: string | null = null
): Database {
  return replaceApp(db, transition(app, action, by, at, reason));
}

const toWorker = (app: Application, n: Omit<NotificationInput, 'workerId' | 'companyId'>): NotificationInput => ({
  ...n,
  workerId: app.workerId,
  companyId: null
});
const toCompany = (job: Job, n: Omit<NotificationInput, 'workerId' | 'companyId'>): NotificationInput => ({
  ...n,
  workerId: null,
  companyId: job.companyId
});

/** The diária has begun (Y02): concluding or marking a no-show only from the first day. */
export function jobStarted(job: Job, now: Date = new Date()): boolean {
  return job.dateToArrange || !job.startDate || job.startDate <= todayISO(now);
}

/**
 * Y03: a place opened (a give-up, a cancelled hire, a no-show, an approval undone). If the job still takes
 * candidates, the ones turned down automatically when it filled up go back to "em análise" and are told.
 * The same as the server's job_reopen_auto_rejected.
 */
export function reopenAutoRejected(db: Database, jobId: string, reason: string, at: string): Database {
  const job = getJob(db, jobId);
  if (!job || jobState(db, job) !== 'aberta') return db;
  const back = db.applications.filter((a) => a.jobId === jobId && a.autoRejected && a.status === 'nao_selecionado');
  if (!back.length) return db;
  let next: Database = {
    ...db,
    applications: db.applications.map((a) =>
      back.includes(a)
        ? {
            ...a,
            status: 'em_analise',
            statusChangedAt: at,
            autoRejected: false,
            events: [...a.events, { status: 'em_analise', at, by: 'sistema', reason }]
          }
        : a
    )
  };
  const company = companyOf(db, job);
  for (const app of back) {
    next = withNotification(
      next,
      toWorker(app, {
        kind: 'candidatura_em_analise',
        title: 'A vaga reabriu',
        text: `${company.name} abriu de novo ${jobTitle(job)}. Sua candidatura voltou para análise.`,
        target: '/vaga/' + jobId
      }),
      at
    );
  }
  return next;
}

/**
 * Y01: when the whole team is done (every place taken and nobody picked or hired still to work), the job
 * closes by itself — it goes to the history and counts as a bico concluded.
 */
function closeIfTeamDone(db: Database, jobId: string, at: string): Database {
  const job = getJob(db, jobId);
  if (!job || job.closed || db.deletedJobIds.includes(jobId)) return db;
  const apps = db.applications.filter((a) => a.jobId === jobId);
  const done = apps.filter((a) => a.status === 'concluida').length;
  if (done < (job.slots || 1) || apps.some((a) => holdsSlot(a.status))) return db;
  const closed: Job = { ...job, closed: true, semContratacao: false };
  return closeJobApplications({ ...db, jobs: { ...db.jobs, [jobId]: closed } }, closed, at);
}

function conclude(db: Database, appId: string, by: Actor, at: string): Database {
  const app = db.applications.find((a) => a.id === appId);
  const job = app && getJob(db, app.jobId);
  if (!app || !job) return db;
  const worker = db.workers[app.workerId];
  let next = step(db, app, 'concluir', by, at);
  next = withNotification(
    next,
    toWorker(app, {
      kind: 'avaliar_diaria',
      title: 'Avalie sua diária',
      text: `${companyOf(db, job).name} · ${jobTitle(job)}. Conte como foi.`,
      target: '/avaliar/' + job.id
    }),
    at
  );
  next = withNotification(
    next,
    toCompany(job, {
      kind: 'avaliar_trabalhador',
      title: 'Avalie o trabalhador',
      text: `${worker?.name ?? 'O trabalhador'} concluiu a diária de ${jobTitle(job)}.`,
      target: `/avaliar-trabalhador/${job.id}/${app.workerId}`
    }),
    at
  );
  // B12/Z01: the worker's count of bicos done follows the concluded diárias, as on the server.
  const w = next.workers[app.workerId];
  if (w) next = { ...next, workers: { ...next.workers, [w.id]: { ...w, jobsDone: w.jobsDone + 1, novo: false } } };
  return closeIfTeamDone(next, job.id, at);
}

// ---- worker ----

/**
 * Sends the logged-in worker's application. Backend: insert into applications (status enviada) after
 * checking the job is still open; notifies the company.
 */
export async function submitApplication(jobId: string): Promise<void> {
  if (!IS_DEMO) return remote.submitApplication(jobId);
  await mockLatency(600);
  const db = store.getDb();
  const job = getJob(db, jobId);
  if (!job) throw serviceError('nao_encontrado', 'Essa vaga não existe mais.');
  const workerId = currentWorkerId();
  const state = jobState(db, job);
  if (state === 'excluida') throw serviceError('conflito', 'Essa vaga foi removida pela construtora.');
  if (applicationFor(db, jobId, workerId)) return;
  // Y07: the same checks as the server's submit_application.
  if (state === 'encerrada') throw serviceError('conflito', 'Essa vaga foi encerrada.');
  if (state === 'vencida') throw serviceError('conflito', 'O prazo dessa vaga já passou.');
  if (state === 'cheia') throw serviceError('conflito', 'Essa vaga já foi preenchida.');
  const at = now();
  const worker = db.workers[workerId];
  store.transact((d) =>
    withNotification(
      { ...d, applications: [...d.applications, newApplication('a' + Date.now().toString(36), jobId, workerId, at)] },
      toCompany(job, {
        kind: 'novos_candidatos',
        title: 'Nova candidatura',
        text: `${worker?.name ?? 'Um trabalhador'} se candidatou para ${jobTitle(job)}.`,
        target: '/vaga-gerenciar/' + jobId
      }),
      at
    )
  );
}

/** Withdraws the worker's application while the company hasn't decided. Backend: delete it (own, pending). */
export async function withdrawApplication(jobId: string): Promise<void> {
  if (!IS_DEMO) return remote.withdrawApplication(jobId);
  await mockLatency(500);
  const app = findApp(store.getDb(), jobId, currentWorkerId());
  if (!isPending(app.status))
    throw serviceError('conflito', 'A construtora já decidiu sobre essa candidatura. Atualize a tela.');
  store.transact((db) => ({ ...db, applications: db.applications.filter((a) => a.id !== app.id) }));
}

/**
 * "Não vou poder ir": the picked/hired worker gives up the diária. The slot opens again.
 * Backend: transition desistir (worker = me); notifies the company.
 */
export async function giveUp(jobId: string, reason: string): Promise<void> {
  if (!IS_DEMO) return remote.giveUp(jobId, reason);
  await mockLatency(500);
  const db = store.getDb();
  const app = findApp(db, jobId, currentWorkerId());
  const job = getJob(db, jobId) as Job;
  const at = now();
  const worker = db.workers[app.workerId];
  store.transact((d) => {
    const after = reopenAutoRejected(step(d, app, 'desistir', 'trabalhador', at, reason), jobId, 'vaga_reaberta', at);
    // Y06: say whether the place goes back to the mural.
    const reopened = jobState(after, job) === 'aberta';
    return withNotification(
      after,
      toCompany(job, {
        kind: 'desistencia',
        title: `${firstName(worker?.name ?? 'O trabalhador')} não vai poder ir`,
        text: `${jobTitle(job)}${reopened ? ': a vaga voltou a ficar aberta no mural.' : ': a vaga já estava encerrada e não volta para o mural.'} Motivo: ${reason}.`,
        target: '/vaga-gerenciar/' + jobId
      }),
      at
    );
  });
}

// ---- company ----

/**
 * The company opened the candidate's profile: "enviada" becomes "em_analise" and the worker is told.
 * Silent when there is nothing to change. Backend: transition analisar (on reading the profile).
 */
export async function markInReview(jobId: string, workerId: string): Promise<void> {
  if (!IS_DEMO) return remote.markInReview(jobId, workerId);
  await mockLatency(200);
  const db = store.getDb();
  const app = applicationFor(db, jobId, workerId);
  const job = getJob(db, jobId);
  if (!app || !job || app.status !== 'enviada' || job.companyId !== currentCompanyId()) return;
  const at = now();
  store.transact((d) =>
    withNotification(
      step(d, app, 'analisar', 'construtora', at),
      toWorker(app, {
        kind: 'candidatura_em_analise',
        title: 'Candidatura em análise',
        text: `${companyOf(db, job).name} está avaliando seu perfil para ${jobTitle(job)}.`,
        target: '/vaga/' + jobId
      }),
      at
    )
  );
}

/**
 * Approves a candidate: contact by WhatsApp opens for both sides. Filling the last slot turns the
 * still-pending candidates down automatically (undone if this approval is undone).
 * Backend: transition aprovar + the automatic recusar, in one transaction; notifies the workers.
 */
export async function approve(jobId: string, workerId: string): Promise<void> {
  if (!IS_DEMO) return remote.approve(jobId, workerId);
  await mockLatency(400);
  const db = store.getDb();
  const job = companyJob(db, jobId);
  const app = findApp(db, jobId, workerId);
  const company = companyOf(db, job);
  if (job.closed || db.deletedJobIds.includes(jobId)) throw serviceError('conflito', 'Essa vaga já foi encerrada.');
  const filled = db.applications.filter((a) => a.jobId === jobId && occupiesSlot(a.status)).length;
  if (filled >= (job.slots || 1)) throw serviceError('conflito', 'As vagas desse bico já foram preenchidas.');
  const at = now();
  store.transact((d) => {
    let next = withNotification(
      step(d, app, 'aprovar', 'construtora', at),
      toWorker(app, {
        kind: 'pre_selecionado',
        title: 'Você foi pré-selecionado',
        text: `${company.name} quer falar com você sobre ${jobTitle(job)}. O WhatsApp está liberado.`,
        target: '/selecionado/' + jobId
      }),
      at
    );
    const slots = job.slots || 1;
    const holding = next.applications.filter((a) => a.jobId === jobId && occupiesSlot(a.status)).length;
    if (holding >= slots) {
      for (const other of next.applications.filter((a) => a.jobId === jobId && isPending(a.status))) {
        next = withNotification(
          step(next, other, 'recusar', 'sistema', at, 'vaga_preenchida'),
          toWorker(other, {
            kind: 'nao_selecionado',
            title: 'Não foi dessa vez',
            text: `As vagas de ${jobTitle(job)} na ${company.name} foram preenchidas.`,
            target: '/vaga/' + jobId
          }),
          at
        );
      }
    }
    return next;
  });
}

/** Turns a candidate down. Backend: transition recusar; notifies the worker. */
export async function reject(jobId: string, workerId: string): Promise<void> {
  if (!IS_DEMO) return remote.reject(jobId, workerId);
  await mockLatency(400);
  const db = store.getDb();
  const job = companyJob(db, jobId);
  const app = findApp(db, jobId, workerId);
  const at = now();
  store.transact((d) =>
    withNotification(
      step(d, app, 'recusar', 'construtora', at),
      toWorker(app, {
        kind: 'nao_selecionado',
        title: 'Não foi dessa vez',
        text: `${companyOf(db, job).name} escolheu outro candidato para ${jobTitle(job)}.`,
        target: '/vaga/' + jobId
      }),
      at
    )
  );
}

/**
 * Undoes an approval: the candidate goes back to "em análise", and so do the candidates that approval
 * had turned down automatically (the job has a free slot again). Backend: transition desfazer_aprovacao
 * + revert the automatic refusals of that job, in one transaction.
 */
export async function undoApproval(jobId: string, workerId: string): Promise<void> {
  if (!IS_DEMO) return remote.undoApproval(jobId, workerId);
  await mockLatency(400);
  const db = store.getDb();
  const job = companyJob(db, jobId);
  const app = findApp(db, jobId, workerId);
  // Y05: a closed job doesn't take candidates back into review.
  if (job.closed || db.deletedJobIds.includes(jobId))
    throw serviceError(
      'conflito',
      'Essa vaga já foi encerrada. Não dá para desfazer a aprovação; cancele, se precisar.'
    );
  const at = now();
  store.transact((d) => {
    const next = reopenAutoRejected(
      step(d, app, 'desfazer_aprovacao', 'construtora', at),
      jobId,
      'aprovacao_desfeita',
      at
    );
    // The "você foi pré-selecionado" notice is taken back if the worker hasn't seen it yet; if they did,
    // they are told the candidacy went back to review (L01).
    const unseen = (n: Database['notifications'][number]) =>
      n.kind === 'pre_selecionado' && n.workerId === workerId && n.target === '/selecionado/' + jobId && !n.readAt;
    if (next.notifications.some(unseen))
      return { ...next, notifications: next.notifications.filter((n) => !unseen(n)) };
    return withNotification(
      next,
      toWorker(app, {
        kind: 'candidatura_em_analise',
        title: 'Sua candidatura voltou para análise',
        text: `${companyOf(d, job).name} ainda está decidindo sobre ${jobTitle(job)}. Aguarde o retorno.`,
        target: '/vaga/' + jobId
      }),
      at
    );
  });
}

/**
 * F12: the hired worker confirms they'll go; the company is told. Backend: RPC confirm_presence (the
 * reminder the day before is a daily routine: remind_presence).
 */
export async function confirmPresence(jobId: string): Promise<void> {
  if (!IS_DEMO) return remote.confirmPresence(jobId);
  await mockLatency(400);
  const db = store.getDb();
  const app = findApp(db, jobId, currentWorkerId());
  const job = db.jobs[jobId];
  if (!job) throw serviceError('nao_encontrado', 'Essa vaga não existe mais.');
  if (app.status !== 'contratado') throw serviceError('conflito', 'Só quem está contratado confirma presença.');
  if (app.presenceConfirmedAt) return;
  const at = now();
  const worker = db.workers[app.workerId];
  store.transact((d) =>
    withNotification(
      {
        ...d,
        applications: d.applications.map((a) => (a.id === app.id ? { ...a, presenceConfirmedAt: at } : a))
      },
      {
        kind: 'confirmar_presenca',
        title: `${(worker?.name ?? 'O trabalhador').split(' ')[0]} confirmou que vai`,
        text: `${jobTitle(job)}.`,
        workerId: null,
        companyId: job.companyId,
        target: '/vaga-gerenciar/' + jobId
      },
      at
    )
  );
}

/** How long after refusing a candidate the company can still undo it (L22). */
export const UNDO_REJECT_MINUTES = 10;

/**
 * L22: undoes a refusal the company just made: the candidate goes back to "em análise". The "não foi dessa
 * vez" notice is taken back if unseen; otherwise the worker hears it went back to review. Backend: RPC
 * undo_reject (same rules).
 */
export async function undoReject(jobId: string, workerId: string): Promise<void> {
  if (!IS_DEMO) return remote.undoReject(jobId, workerId);
  await mockLatency(400);
  const db = store.getDb();
  const job = companyJob(db, jobId);
  const app = findApp(db, jobId, workerId);
  const refusal = [...app.events].reverse().find((e) => e.status === 'nao_selecionado');
  const recent = refusal && Date.now() - new Date(refusal.at).getTime() <= UNDO_REJECT_MINUTES * 60_000;
  if (app.status !== 'nao_selecionado' || refusal?.by !== 'construtora' || !recent)
    throw serviceError('conflito', 'Não dá mais para desfazer essa recusa.');
  if (jobState(db, job) !== 'aberta' && jobState(db, job) !== 'cheia')
    throw serviceError('conflito', 'Essa vaga já foi encerrada.');
  const at = now();
  store.transact((d) => {
    const next = step(d, app, 'desfazer_recusa', 'construtora', at);
    const unseen = (n: Database['notifications'][number]) =>
      n.kind === 'nao_selecionado' && n.workerId === workerId && n.target === '/vaga/' + jobId && !n.readAt;
    if (next.notifications.some(unseen))
      return { ...next, notifications: next.notifications.filter((n) => !unseen(n)) };
    return withNotification(
      next,
      toWorker(app, {
        kind: 'candidatura_em_analise',
        title: 'Sua candidatura voltou para análise',
        text: `${companyOf(d, job).name} ainda está decidindo sobre ${jobTitle(job)}.`,
        target: '/vaga/' + jobId
      }),
      at
    );
  });
}

/** Confirms the hire of a picked candidate. Backend: transition contratar; notifies the worker. */
export async function confirmHire(jobId: string, workerId: string): Promise<void> {
  if (!IS_DEMO) return remote.confirmHire(jobId, workerId);
  await mockLatency(500);
  const db = store.getDb();
  const job = companyJob(db, jobId);
  const app = findApp(db, jobId, workerId);
  const at = now();
  store.transact((d) =>
    withNotification(
      step(d, app, 'contratar', 'construtora', at),
      toWorker(app, {
        kind: 'contratado',
        title: 'Contratação confirmada',
        text: `${companyOf(db, job).name} confirmou você para ${jobTitle(job)}.`,
        target: '/selecionado/' + jobId
      }),
      at
    )
  );
}

/** Cancels a pick or a hire. The slot opens again. Backend: transition cancelar_contratacao; notifies. */
export async function cancelHire(jobId: string, workerId: string, reason: string): Promise<void> {
  if (!IS_DEMO) return remote.cancelHire(jobId, workerId, reason);
  await mockLatency(500);
  const db = store.getDb();
  const job = companyJob(db, jobId);
  const app = findApp(db, jobId, workerId);
  const at = now();
  store.transact((d) =>
    withNotification(
      reopenAutoRejected(step(d, app, 'cancelar_contratacao', 'construtora', at, reason), jobId, 'vaga_reaberta', at),
      toWorker(app, {
        kind: 'contratacao_cancelada',
        title: 'Contratação cancelada',
        text: `${companyOf(db, job).name} cancelou ${jobTitle(job)}. Motivo: ${reason}.`,
        target: '/vaga/' + jobId
      }),
      at
    )
  );
}

/** Marks the hired diária as done; both sides are asked to review. Backend: transition concluir. */
export async function completeWorkday(jobId: string, workerId: string): Promise<void> {
  if (!IS_DEMO) return remote.completeWorkday(jobId, workerId);
  await mockLatency(500);
  const db = store.getDb();
  const job = companyJob(db, jobId);
  const app = findApp(db, jobId, workerId);
  transition(app, 'concluir', 'construtora', now()); // fails early, with the right message, if not allowed
  if (!jobStarted(job)) throw serviceError('conflito', 'Só dá para concluir a diária a partir do dia do bico.');
  store.transact((d) => conclude(d, app.id, 'construtora', now()));
}

/** The hired worker didn't show up. Backend: transition marcar_falta; notifies the worker. */
export async function markNoShow(jobId: string, workerId: string): Promise<void> {
  if (!IS_DEMO) return remote.markNoShow(jobId, workerId);
  await mockLatency(500);
  const db = store.getDb();
  const job = companyJob(db, jobId);
  const app = findApp(db, jobId, workerId);
  if (app.status === 'contratado' && !jobStarted(job))
    throw serviceError('conflito', 'Só dá para marcar falta a partir do dia do bico.');
  const at = now();
  store.transact((d) =>
    withNotification(
      reopenAutoRejected(step(d, app, 'marcar_falta', 'construtora', at), jobId, 'vaga_reaberta', at),
      toWorker(app, {
        kind: 'nao_compareceu',
        title: 'Falta registrada',
        text: `${companyOf(db, job).name} registrou que você não foi em ${jobTitle(job)}. Fale com a construtora se foi um engano.`,
        target: '/vaga/' + jobId
      }),
      at
    )
  );
}

/**
 * Closing a job turns its pending candidates down (and makes the automatic refusals final).
 * Used by jobs.closeJob, in the same transaction as the job's change.
 */
export function closeJobApplications(db: Database, job: Job, at: string): Database {
  let next: Database = {
    ...db,
    applications: db.applications.map((a) => (a.jobId === job.id && a.autoRejected ? { ...a, autoRejected: false } : a))
  };
  const company = companyOf(db, job);
  for (const app of next.applications.filter((a) => a.jobId === job.id && isPending(a.status))) {
    next = withNotification(
      step(next, app, 'recusar', 'sistema', at, 'vaga_encerrada'),
      toWorker(app, {
        kind: 'nao_selecionado',
        title: 'Vaga encerrada',
        text: `${company.name} encerrou ${jobTitle(job)}. Tem outros bicos no mural.`,
        target: '/mural'
      }),
      at
    );
  }
  return next;
}
