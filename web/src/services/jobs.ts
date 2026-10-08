// Jobs: reading the mural and a job, publishing, saving, closing and deleting. Each function says what
// the real backend does there (docs/CONTRATO-BACKEND.md); the mock applies the change to the store.
import type { Job } from '../types/models';
import { serviceError } from './errors';
import { mockLatency } from './mockLatency';
import { currentCompanyId, getJob, isJobSaved } from './selectors';
import * as store from './store';

// ---- reads ----

/** The mural's open jobs. Backend: select open jobs (+ companies) near the worker; put them in the store. */
export async function loadFeed(): Promise<void> {
  await mockLatency(450);
}

/** One job with its company. Backend: select the job by id (+ company, + my application). */
export async function loadJob(_jobId: string): Promise<void> {
  await mockLatency(300);
}

/** The worker's saved jobs. Backend: select saved_jobs join jobs for the logged-in worker. */
export async function loadSavedJobs(): Promise<void> {
  await mockLatency(300);
}

// ---- company actions ----

/** What the publish form sends; the backend fills in the id, the company and where the job is. */
export type JobDraft = Omit<Job, 'id' | 'companyId' | 'location' | 'distance'>;

// Demo ids: "BC-" + a number, like the seed jobs'.
function nextJobId(): string {
  return 'BC-' + (5100 + Math.floor(Math.random() * 800));
}

function ownJob(jobId: string): Job {
  const job = getJob(store.getDb(), jobId);
  if (!job) throw serviceError('nao_encontrado', 'Essa vaga não existe mais.');
  if (job.companyId !== currentCompanyId())
    throw serviceError('nao_autorizado', 'Só a construtora da vaga pode fazer isso.');
  return job;
}

/** Publishes the company's job; resolves to its id. Backend: insert into jobs (company from the session). */
export async function publishJob(draft: JobDraft): Promise<string> {
  await mockLatency(700);
  const id = nextJobId();
  // Demo: every job the logged-in company publishes is in Tatuapé, where it is.
  store.createJob({ ...draft, id, companyId: currentCompanyId(), location: 'Tatuapé, SP', distance: '0 km' });
  return id;
}

/** Replaces the job's photos (the first is the cover). Backend: upload to Storage, update jobs.photos. */
export async function updateJobPhotos(jobId: string, photos: string[]): Promise<void> {
  await mockLatency(400);
  ownJob(jobId);
  store.updateJob(jobId, { photos });
}

/**
 * Closes the job: it leaves the mural and pending candidates are turned down. Backend: update jobs +
 * applications in one transaction, notify the candidates.
 */
export async function closeJob(jobId: string): Promise<void> {
  await mockLatency(500);
  ownJob(jobId);
  store.closeJob(jobId);
}

/** Deletes the job post. Backend: set jobs.deleted_at (soft delete). */
export async function deleteJob(jobId: string): Promise<void> {
  await mockLatency(500);
  ownJob(jobId);
  store.deleteJobPost(jobId);
}

/** Puts the job at the top of the mural. Temporary: B08 adds the payment before this. */
export async function boostJob(jobId: string): Promise<void> {
  await mockLatency(600);
  ownJob(jobId);
  store.updateJob(jobId, { boosted: true, urgent: true });
}

// ---- worker actions ----

/**
 * Saves or un-saves a job for the worker. The flag flips at once and goes back if the request fails.
 * Backend: insert into / delete from saved_jobs.
 */
export async function toggleSavedJob(jobId: string): Promise<boolean> {
  const wasSaved = isJobSaved(store.getDb(), jobId);
  store.toggleSavedJob(jobId);
  try {
    await mockLatency(300);
  } catch (e) {
    if (isJobSaved(store.getDb(), jobId) !== wasSaved) store.toggleSavedJob(jobId);
    throw e;
  }
  return !wasSaved;
}
