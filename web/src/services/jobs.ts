// Jobs: reading the mural and a job, publishing, saving, closing and deleting. Each function says what
// the real backend does there (docs/CONTRATO-BACKEND.md); the mock applies the change to the store.
import type { Database, Job } from '../types/models';
import { closeJobApplications } from './applications';
import { holdsSlot, isPending } from './applicationMachine';
import { jobTitle } from './catalog';
import { withNotification } from './notifications';
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

/** What the publish form sends; the backend fills in the id and the company. */
export type JobDraft = Omit<Job, 'id' | 'companyId'>;

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
  store.createJob({ ...draft, id, companyId: currentCompanyId() });
  return id;
}

/** What changed between a job and its edited version that candidates need to hear about. */
export function significantChanges(job: Job, draft: JobDraft): string[] {
  const changes: string[] = [];
  if (job.pay !== draft.pay) changes.push('valor');
  if (
    job.dateToArrange !== draft.dateToArrange ||
    job.startDate !== draft.startDate ||
    job.endDate !== draft.endDate ||
    job.startTime !== draft.startTime ||
    job.endTime !== draft.endTime
  )
    changes.push('data');
  const a = job.address;
  const b = draft.address;
  if (a.cep !== b.cep || a.street !== b.street || a.number !== b.number || a.city !== b.city || a.uf !== b.uf)
    changes.push('endereço');
  return changes;
}

/** Candidacies still going on (they are told when the job changes or ends). */
const activeOn = (db: Database, jobId: string) =>
  db.applications.filter((a) => a.jobId === jobId && (isPending(a.status) || holdsSlot(a.status)));

/**
 * Saves the company's changes to an open job. The headcount can't go below who is already approved;
 * a change of pay, date or address notifies the candidates. Backend: update jobs (own, open) and insert
 * the notifications, in one transaction.
 */
export async function updateJob(jobId: string, draft: JobDraft): Promise<void> {
  await mockLatency(700);
  const job = ownJob(jobId);
  const db = store.getDb();
  if (job.closed || db.deletedJobIds.includes(jobId))
    throw serviceError('conflito', 'Essa vaga já foi encerrada e não pode mais ser editada.');
  const holding = db.applications.filter((a) => a.jobId === jobId && holdsSlot(a.status)).length;
  if ((draft.slots || 1) < holding)
    throw serviceError('validacao', `Você já aprovou ${holding} pessoas. Não dá para pedir menos que isso.`);
  const changes = significantChanges(job, draft);
  const at = new Date().toISOString();
  const updated: Job = { ...job, ...draft, id: job.id, companyId: job.companyId };
  store.transact((d) => {
    let next: Database = { ...d, jobs: { ...d.jobs, [jobId]: updated } };
    if (changes.length) {
      const company = d.companies[job.companyId];
      for (const app of activeOn(d, jobId)) {
        next = withNotification(
          next,
          {
            kind: 'vaga_editada',
            title: 'A vaga mudou',
            text: `${company.name} mudou ${changes.join(', ')} de ${jobTitle(updated)}. Confira antes de ir.`,
            workerId: app.workerId,
            companyId: null,
            target: '/vaga/' + jobId
          },
          at
        );
      }
    }
    return next;
  });
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
  const job = ownJob(jobId);
  const at = new Date().toISOString();
  store.transact((db) => {
    const hired = db.applications.some((a) => a.jobId === jobId && (holdsSlot(a.status) || a.status === 'concluida'));
    const closed: Job = { ...job, closed: true, ...(hired ? {} : { semContratacao: true }) };
    return closeJobApplications({ ...db, jobs: { ...db.jobs, [jobId]: closed } }, closed, at);
  });
}

/** Deletes the job post. Backend: set jobs.deleted_at (soft delete). */
export async function deleteJob(jobId: string): Promise<void> {
  await mockLatency(500);
  ownJob(jobId);
  store.deleteJobPost(jobId);
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
