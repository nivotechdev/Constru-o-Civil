// Read-only queries over the mock database — the same queries the legacy store exposed, as pure
// functions of a Database snapshot (so components can memoize on it).
import { CURRENT_COMPANY_ID, CURRENT_WORKER_ID } from '../data/seed';
import type { Application, Company, Database, Job, Worker, WorkerPost } from '../types/models';
import { getSession } from './store';

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

export function approvedCount(db: Database, jobId: string): number {
  const stats = statsOf(db, jobId);
  if (stats) return stats.holding;
  return db.applications.filter(
    (a) => a.jobId === jobId && (a.status === 'pre_selecionado' || a.status === 'contratado')
  ).length;
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
export const isJobClosed = (db: Database, job: Job): boolean => Boolean(job.closed) || isJobFull(db, job);

// ---- saved jobs ----
export const isJobSaved = (db: Database, jobId: string): boolean => db.savedJobIds.indexOf(jobId) >= 0;
export const savedJobs = (db: Database): Job[] =>
  db.savedJobIds.map((id) => getJob(db, id)).filter((j): j is Job => Boolean(j));

// ---- worker portfolio posts (photo/video, Instagram-style, no likes/comments) ----
export function postsForWorker(db: Database, workerId: string): WorkerPost[] {
  return db.workerPosts.filter((p) => p.workerId === workerId).sort((a, b) => (a.date < b.date ? 1 : -1));
}
