// Applications: a worker's candidacy on a job and every change of its status. Each change goes through
// the transition table (applicationMachine.ts) and sends the matching notification to the other side,
// in one transaction. Each function says what the real backend does there (docs/CONTRATO-BACKEND.md).
import { jobTitle } from './catalog';
import { serviceError } from './errors';
import { holdsSlot, isPending, newApplication, transition, type ApplicationAction } from './applicationMachine';
import { mockLatency } from './mockLatency';
import { withNotification, type NotificationInput } from './notifications';
import { applicationFor, companyOf, currentCompanyId, currentWorkerId, getJob } from './selectors';
import * as store from './store';
import type { Actor, Application, Database, Job } from '../types/models';
import { todayISO } from '../utils/dates';
import { IS_DEMO } from './mode';
import * as remote from './remote/applications';
import * as remoteData from './remote/data';

const now = () => new Date().toISOString();
const firstName = (name: string) => name.split(' ')[0];

// ---- automatic rule: a hired diária whose last day has passed is concluded ----

/**
 * Concludes the hired candidacies of jobs whose last day has passed and asks both sides for a review.
 * Mock: runs whenever candidacies are read. Backend: a scheduled job (e.g. pg_cron, daily).
 */
export function concludeFinishedJobs(at: Date = new Date()): void {
  const today = todayISO(at);
  const due = store
    .getDb()
    .applications.filter((a) => {
      const job = getJob(store.getDb(), a.jobId);
      return a.status === 'contratado' && job && !job.dateToArrange && job.endDate && job.endDate < today;
    })
    .map((a) => a.id);
  if (!due.length) return;
  store.transact((db) => due.reduce((d, id) => conclude(d, id, 'sistema', at.toISOString()), db));
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
  return withNotification(
    next,
    toCompany(job, {
      kind: 'avaliar_trabalhador',
      title: 'Avalie o trabalhador',
      text: `${worker?.name ?? 'O trabalhador'} concluiu a diária de ${jobTitle(job)}.`,
      target: `/avaliar-trabalhador/${job.id}/${app.workerId}`
    }),
    at
  );
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
  if (applicationFor(db, jobId, workerId)) return;
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
  store.transact((d) =>
    withNotification(
      step(d, app, 'desistir', 'trabalhador', at, reason),
      toCompany(job, {
        kind: 'desistencia',
        title: `${firstName(worker?.name ?? 'O trabalhador')} não vai poder ir`,
        text: `${jobTitle(job)}: a vaga dele voltou a ficar aberta. Motivo: ${reason}.`,
        target: '/vaga-gerenciar/' + jobId
      }),
      at
    )
  );
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
  const filled = db.applications.filter((a) => a.jobId === jobId && holdsSlot(a.status)).length;
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
    const holding = next.applications.filter((a) => a.jobId === jobId && holdsSlot(a.status)).length;
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
  const at = now();
  store.transact((d) => {
    let next = step(d, app, 'desfazer_aprovacao', 'construtora', at);
    if (!job.closed) {
      next = {
        ...next,
        applications: next.applications.map((a) =>
          a.jobId === jobId && a.autoRejected && a.status === 'nao_selecionado'
            ? {
                ...a,
                status: 'em_analise',
                statusChangedAt: at,
                autoRejected: false,
                events: [...a.events, { status: 'em_analise', at, by: 'sistema', reason: 'aprovacao_desfeita' }]
              }
            : a
        )
      };
    }
    // The "você foi pré-selecionado" notice is taken back if the worker hasn't seen it yet.
    return {
      ...next,
      notifications: next.notifications.filter(
        (n) =>
          !(
            n.kind === 'pre_selecionado' &&
            n.workerId === workerId &&
            n.target === '/selecionado/' + jobId &&
            !n.readAt
          )
      )
    };
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
      step(d, app, 'cancelar_contratacao', 'construtora', at, reason),
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
  companyJob(db, jobId);
  const app = findApp(db, jobId, workerId);
  transition(app, 'concluir', 'construtora', now()); // fails early, with the right message, if not allowed
  store.transact((d) => conclude(d, app.id, 'construtora', now()));
}

/** The hired worker didn't show up. Backend: transition marcar_falta; notifies the worker. */
export async function markNoShow(jobId: string, workerId: string): Promise<void> {
  if (!IS_DEMO) return remote.markNoShow(jobId, workerId);
  await mockLatency(500);
  const db = store.getDb();
  const job = companyJob(db, jobId);
  const app = findApp(db, jobId, workerId);
  const at = now();
  store.transact((d) =>
    withNotification(
      step(d, app, 'marcar_falta', 'construtora', at),
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
