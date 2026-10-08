// Applications: a worker's candidacy on a job and the company's decisions on it. Each function says
// what the real backend does there (docs/CONTRATO-BACKEND.md); the mock applies it to the store.
import type { Decision } from '../types/models';
import { serviceError } from './errors';
import { mockLatency } from './mockLatency';
import { applicationFor, currentCompanyId, currentWorkerId, getJob } from './selectors';
import * as store from './store';

// ---- reads ----

/** The worker's applications (+ their jobs). Backend: select applications where worker = me. */
export async function loadMyApplications(): Promise<void> {
  await mockLatency(400);
}

/** A job's candidates (+ their profiles), for the company. Backend: select applications where job = id. */
export async function loadJobCandidates(_jobId: string): Promise<void> {
  await mockLatency(400);
}

/** The company's closed jobs and their teams. Backend: select the company's closed jobs + applications. */
export async function loadHistory(): Promise<void> {
  await mockLatency(400);
}

// ---- worker ----

/** Sends the logged-in worker's application. Backend: insert into applications (status enviada). */
export async function submitApplication(jobId: string): Promise<void> {
  await mockLatency(600);
  if (!getJob(store.getDb(), jobId)) throw serviceError('nao_encontrado', 'Essa vaga não existe mais.');
  store.applyToJob(jobId, currentWorkerId());
}

/** Withdraws the worker's application while it is still pending. Backend: delete the application. */
export async function withdrawApplication(jobId: string): Promise<void> {
  await mockLatency(500);
  store.cancelApplication(jobId, currentWorkerId());
}

/** Marks the worker's side as reviewed. Temporary: B04 stores the review itself. */
export async function markJobReviewed(jobId: string): Promise<void> {
  await mockLatency(500);
  store.markReviewed(jobId, currentWorkerId());
}

// ---- company ----

/**
 * Approves, turns down or puts back "em análise" a candidate of one of the company's jobs.
 * Backend: update applications.status (B02 replaces this with the status machine).
 */
export async function decideApplication(jobId: string, workerId: string, decision: Decision): Promise<void> {
  await mockLatency(400);
  const db = store.getDb();
  const job = getJob(db, jobId);
  if (!job || job.companyId !== currentCompanyId())
    throw serviceError('nao_autorizado', 'Só a construtora da vaga pode decidir os candidatos.');
  if (!applicationFor(db, jobId, workerId)) throw serviceError('nao_encontrado', 'Essa candidatura não existe mais.');
  store.decideApplication(jobId, workerId, decision);
}
