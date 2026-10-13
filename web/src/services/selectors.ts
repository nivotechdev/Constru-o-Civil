// Read-only queries over the mock database — the same queries the legacy store exposed, as pure
// functions of a Database snapshot (so components can memoize on it).
import { CURRENT_COMPANY_ID, CURRENT_WORKER_ID } from '../data/seed';
import type { Application, Company, Database, Job, Worker, WorkerPost } from '../types/models';
import { getSession } from './store';
import { occupiesSlot } from './applicationMachine';
import { isExpired } from '../utils/jobInfo';

// ---- companies & workers ----
export const getCompany = (db: Database, id: string): Company | undefined => db.companies[id];
export const allCompanies = (db: Database): Company[] => Object.values(db.companies);
// The logged-in account's profile. Outside a session (tests, the sign-in screens) they fall back to the
// demo accounts' profiles, so nothing reading them ever gets `undefined`.
export const currentCompanyId = (): string => getSession()?.companyId ?? CURRENT_COMPANY_ID;
export const currentCompany = (db: Database): Company => db.companies[currentCompanyId()];

export const getWorker = (db: Database, id: string): Worker | undefined => db.workers[id];
export const allWorkers = (db: Database): Worker[] => Object.values(db.workers);
export const currentWorkerId = (): string => getSession()?.workerId ?? CURRENT_WORKER_ID;
export const currentWorker = (db: Database): Worker => db.workers[currentWorkerId()];

// ---- jobs ----
export const allJobs = (db: Database): Job[] => Object.values(db.jobs);
export const getJob = (db: Database, id: string): Job | undefined => db.jobs[id];
export const activeJobs = (db: Database): Job[] => allJobs(db).filter((j) => db.deletedJobIds.indexOf(j.id) < 0);
export const isMine = (job: Job): boolean => job.companyId === currentCompanyId();

export function successfulJobsForCompany(db: Database, companyId: string): number {
  return allJobs(db).filter((j) => j.companyId === companyId && j.closed && !j.semContratacao).length;
}

// Referential integrity of the data: every job belongs to an existing company and every application to
// an existing worker. These accessors put that in the types (and fail loudly if it is ever broken).
export function companyOf(db: Database, job: Pick<Job, 'id' | 'companyId'>): Company {
  const company = getCompany(db, job.companyId);
  if (!company) throw new Error(`Vaga ${job.id}: construtora ${job.companyId} não existe`);
  return company;
}
export function workerOf(db: Database, app: Application): Worker {
  const worker = getWorker(db, app.workerId);
  if (!worker) throw new Error(`Candidatura ${app.id}: trabalhador ${app.workerId} não existe`);
  return worker;
}

// ---- applications ----
export const applicationsForJob = (db: Database, jobId: string): Application[] =>
  db.applications.filter((a) => a.jobId === jobId);
export const applicationsForWorker = (db: Database, workerId: string): Application[] =>
  db.applications.filter((a) => a.workerId === workerId);
export const applicationFor = (db: Database, jobId: string, workerId: string): Application | null =>
  db.applications.find((a) => a.jobId === jobId && a.workerId === workerId) || null;

/**
 * Counted from the server (db.jobStats) for jobs whose candidacies the session can't read — with the
 * real backend, any job that isn't the company's own. The company's own jobs (and every job in demo
 * mode) are counted from the candidacies themselves, which are always current.
 */
function statsOf(db: Database, jobId: string) {
  const stats = db.jobStats?.[jobId];
  return stats && db.jobs[jobId]?.companyId !== getSession()?.companyId ? stats : null;
}

/** Places taken: picked, hired or concluded (Y02; the server's job_stats.holding counts the same). */
export function approvedCount(db: Database, jobId: string): number {
  const stats = statsOf(db, jobId);
  if (stats) return stats.holding;
  return db.applications.filter((a) => a.jobId === jobId && occupiesSlot(a.status)).length;
}
export function pendingCount(db: Database, jobId: string): number {
  const stats = statsOf(db, jobId);
  if (stats) return stats.pending;
  return db.applications.filter((a) => a.jobId === jobId && (a.status === 'enviada' || a.status === 'em_analise'))
    .length;
}
/** How many candidates a job has had (any status). */
export function candidateCount(db: Database, jobId: string): number {
  const stats = statsOf(db, jobId);
  return stats ? stats.total : db.applications.filter((a) => a.jobId === jobId).length;
}
export const isJobFull = (db: Database, job: Job): boolean => approvedCount(db, job.id) >= (job.slots || 1);

/**
 * Where a job stands (Y01), the same in every screen:
 *   aberta — takes candidates; cheia — every place taken (still editable and closable);
 *   encerrada — closed by the company (or by itself when the team finished); excluida — deleted;
 *   vencida — its last day has passed (or 30 days with the date to be arranged: Y04).
 */
export type JobState = 'aberta' | 'cheia' | 'encerrada' | 'excluida' | 'vencida';

export function jobState(db: Database, job: Job, now: Date = new Date()): JobState {
  if (db.deletedJobIds.includes(job.id)) return 'excluida';
  if (job.closed) return 'encerrada';
  if (isExpired(job, now)) return 'vencida';
  if (isJobFull(db, job)) return 'cheia';
  return 'aberta';
}

/** Why a job doesn't take candidates, as the job page says it (Y07); `null` while it is open. */
export function unavailableText(state: JobState): { title: string; text: string } | null {
  switch (state) {
    case 'aberta':
      return null;
    case 'cheia':
      return { title: 'Vaga preenchida', text: 'Todas as vagas desse bico já foram preenchidas.' };
    case 'encerrada':
      return { title: 'Vaga encerrada', text: 'A construtora encerrou essa vaga. Tem outros bicos no mural.' };
    case 'vencida':
      return { title: 'Vaga vencida', text: 'O prazo dessa vaga já passou. Tem outros bicos no mural.' };
    case 'excluida':
      return { title: 'Removida pela construtora', text: 'A construtora tirou essa vaga do ar.' };
  }
}

/** Not taking candidates (full, closed, deleted or past). */
export const isJobClosed = (db: Database, job: Job, now: Date = new Date()): boolean =>
  jobState(db, job, now) !== 'aberta';

/**
 * Whether the session may see the job's street, number and CEP (Z06): the company that owns it, or the
 * worker picked or hired for it. Everyone else sees the neighbourhood, the city and the distance. In real
 * mode the server only sends the address to them (get_job_addresses); in the demo this is what hides it.
 */
export function canSeeExactAddress(db: Database, job: Job): boolean {
  const session = getSession();
  if (!session) return false;
  if (session.companyId && job.companyId === session.companyId) return true;
  const app = session.workerId ? applicationFor(db, job.id, session.workerId) : null;
  return Boolean(app && (app.status === 'pre_selecionado' || app.status === 'contratado'));
}

// ---- saved jobs ----
export const isJobSaved = (db: Database, jobId: string): boolean => db.savedJobIds.indexOf(jobId) >= 0;
export const savedJobs = (db: Database): Job[] =>
  db.savedJobIds.map((id) => getJob(db, id)).filter((j): j is Job => Boolean(j));

// ---- worker portfolio posts (photo/video, Instagram-style, no likes/comments) ----
export function postsForWorker(db: Database, workerId: string): WorkerPost[] {
  return db.workerPosts.filter((p) => p.workerId === workerId).sort((a, b) => (a.date < b.date ? 1 : -1));
}

/**
 * L07: how a job that left the mural ended, for the company's history. `null` while it is open or full.
 * "Concluída": everyone hired did the work (the job closes itself then, Y01).
 */
export function jobOutcome(db: Database, job: Job, now: Date = new Date()): string | null {
  const state = jobState(db, job, now);
  if (state === 'aberta' || state === 'cheia') return null;
  if (state === 'excluida') return 'Excluída';
  const team = applicationsForJob(db, job.id).filter((a) =>
    ['pre_selecionado', 'contratado', 'concluida'].includes(a.status)
  );
  if (state === 'vencida') return team.length ? 'Prazo acabou com equipe' : 'Prazo acabou sem contratação';
  if (team.length && team.every((a) => a.status === 'concluida')) return 'Concluída';
  return team.length ? 'Encerrada com contratação' : 'Encerrada sem contratação';
}

/** F10: a worker's no-shows and give-ups (from the server's count when loaded, else the candidacies here). */
export function trackRecord(db: Database, workerId: string): { faltas: number; desistencias: number } {
  const known = db.workerTrack?.[workerId];
  if (known) return known;
  const apps = db.applications.filter((a) => a.workerId === workerId);
  return {
    faltas: apps.filter((a) => a.status === 'nao_compareceu').length,
    desistencias: apps.filter((a) => a.status === 'desistiu').length
  };
}
