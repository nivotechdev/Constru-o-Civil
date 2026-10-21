// Read-only queries over the mock database — the same queries the legacy store exposed, as pure
// functions of a Database snapshot (so components can memoize on it).
import { CURRENT_COMPANY_ID, CURRENT_WORKER_ID } from '../data/seed';
import type { Application, Company, Database, GeoPoint, HomeAddress, Job, Worker, WorkerPost } from '../types/models';
import { getSession } from './store';
import { occupiesSlot } from './applicationMachine';
import { isExpired } from '../utils/jobInfo';
import { distanceKm } from '../utils/geo';

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

/** U51: the session's own address; `null` when it has none yet (an account from before the address step). */
export function myAddress(db: Database): HomeAddress | null {
  const id = getSession()?.accountId;
  return (id && db.addresses?.[id]) || null;
}

/**
 * U51: where a worker's distances are measured from — their address (the street, ~200 m), or for an account from
 * before it, the profile's point (the city, ~1 km). `null` for a company or outside a session.
 */
export function workerHome(db: Database): GeoPoint | null {
  const session = getSession();
  if (!session?.workerId) return null;
  const home = myAddress(db);
  if (home) return { lat: home.lat, lon: home.lon };
  const w = db.workers[session.workerId];
  return w && (w.lat || w.lon) ? { lat: w.lat, lon: w.lon } : null;
}

/** U51: how far the job is from the worker's home, in km (`null` when either point is unknown). */
export function homeDistanceKm(db: Database, job: { address: Partial<GeoPoint> }): number | null {
  const from = workerHome(db);
  const { lat, lon } = job.address;
  if (!from || typeof lat !== 'number' || typeof lon !== 'number' || (!lat && !lon)) return null;
  return distanceKm(from, { lat, lon });
}

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
  if (!company) throw new Error(`Vaga ${job.id}: empresa ${job.companyId} não existe`);
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
      return { title: 'Vaga encerrada', text: 'A empresa encerrou essa vaga. Tem outros bicos no mural.' };
    case 'vencida':
      return { title: 'Vaga vencida', text: 'O prazo dessa vaga já passou. Tem outros bicos no mural.' };
    case 'excluida':
      return { title: 'Removida pela empresa', text: 'A empresa tirou essa vaga do ar.' };
  }
}

/** Not taking candidates (full, closed, deleted or past). */
export const isJobClosed = (db: Database, job: Job, now: Date = new Date()): boolean =>
  jobState(db, job, now) !== 'aberta';

/**
 * Whether the session sees the job's street, number and CEP. U53: everyone signed in does (before, Z06, only the
 * company and the worker it picked or hired); the public link, without a session, shows only the area.
 */
export function canSeeExactAddress(_db: Database, _job: Job): boolean {
  return Boolean(getSession());
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
