// Jobs: reading the mural and a job, publishing, saving, closing and deleting. Each function says what
// the real backend does there (docs/CONTRATO-BACKEND.md); the mock applies the change to the store.
import type { Company, Database, Job } from '../types/models';
import { closeJobApplications, reopenAutoRejected } from './applications';
import { holdsSlot, isPending, occupiesSlot, transition } from './applicationMachine';
import { jobTitle } from './catalog';
import { withNotification } from './notifications';
import { serviceError } from './errors';
import { mockLatency } from './mockLatency';
import { currentCompanyId, getJob, isJobSaved, jobState } from './selectors';
import * as store from './store';
import { IS_DEMO } from './mode';
import * as remote from './remote/jobs';
import * as remoteData from './remote/data';
import { feedKey, type FeedQuery } from './feedQuery';
import { withAlertNotices } from './alerts';

// ---- reads ----

/** The mural's open jobs. Backend: select open jobs (+ companies) near the worker; put them in the store. */
/**
 * The mural's first page. Demo: everything is already here (the screen filters and orders it). Backend:
 * the RPC feed_jobs (city or radius, boosted → urgent → order, 30 per page) and, for a search, the
 * companies (and, for a company, the workers) that match.
 */
export type { FeedQuery };
export { feedKey };

export async function loadFeed(q?: FeedQuery): Promise<void> {
  if (!IS_DEMO) return remoteData.loadFeed(q);
  await mockLatency(450);
}

/** "Carregar mais" in the mural: the next page. Demo: nothing more to load. */
export async function loadMoreFeed(q: FeedQuery): Promise<void> {
  if (!IS_DEMO) return remoteData.loadFeed(q, true);
}

/** One job with its company. Backend: select the job by id (+ company, + my application). */
export async function loadJob(_jobId: string): Promise<void> {
  if (!IS_DEMO) return remoteData.loadJob(_jobId);
  await mockLatency(300);
}

/** F09: a job as the public page shows it (no exact address, no contact). */
export interface PublicJob {
  job: Job;
  company: Pick<Company, 'name' | 'logoUrl' | 'rating' | 'reviewCount' | 'verified'>;
  /** Still taking candidates. */
  open: boolean;
}

/**
 * F09: the job behind a shared link, for someone who may not be signed in. `null` when it doesn't exist
 * or was deleted. L10: the link carries the job's random `publicSlug`, never the sequential id (BC-n).
 * Backend: RPC public_job_card (anon may call it; limited per IP).
 */
export async function loadPublicJob(slug: string): Promise<PublicJob | null> {
  if (!IS_DEMO) return remoteData.loadPublicJob(slug);
  await mockLatency(300);
  const db = store.getDb();
  // The demo's jobs have no slug: their link carries the id.
  const job = Object.values(db.jobs).find((j) => (j.publicSlug ?? j.id) === slug);
  if (!job || db.deletedJobIds.includes(job.id)) return null;
  const company = db.companies[job.companyId];
  const area = { ...job.address, street: '', number: '', complement: null, cep: '', exact: false };
  return {
    job: { ...job, address: area },
    company: {
      name: company?.name ?? '',
      logoUrl: company?.logoUrl ?? null,
      rating: company?.rating ?? 0,
      reviewCount: company?.reviewCount ?? 0,
      verified: Boolean(company?.verified)
    },
    open: jobState(db, job) === 'aberta'
  };
}

/** The worker's saved jobs. Backend: select saved_jobs join jobs for the logged-in worker. */
export async function loadSavedJobs(): Promise<void> {
  if (!IS_DEMO) return remoteData.loadSavedJobs();
  await mockLatency(300);
}

// ---- company actions ----

/** What the publish form sends; the backend fills in the id and the company. */
export type JobDraft = Omit<Job, 'id' | 'companyId'>;

// Demo ids: "BC-" + a number, like the seed jobs' — W09: the next number after the highest one ever used (no
// collision with a job that exists or was deleted).
function nextJobId(): string {
  const db = store.getDb();
  const used = [...Object.keys(db.jobs), ...db.deletedJobIds]
    .map((id) => Number(/^BC-(\d+)$/.exec(id)?.[1] ?? 0))
    .filter((n) => Number.isFinite(n));
  return 'BC-' + Math.max(5100, ...used.map((n) => n + 1));
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
  if (!IS_DEMO) return remote.publishJob(draft);
  await mockLatency(700);
  const id = nextJobId();
  store.createJob({ ...draft, id, companyId: currentCompanyId() });
  // Y28: workers whose alert matches hear about it (the trigger notify_job_alerts, in the backend).
  const job = store.getDb().jobs[id];
  if (job) store.transact((d) => withAlertNotices(d, job, new Date().toISOString()));
  return id;
}

/** What changed between a job and its edited version that candidates need to hear about. */
export function significantChanges(job: Job, draft: JobDraft): string[] {
  const changes: string[] = [];
  if (job.pay !== draft.pay) changes.push('valor');
  if ((job.payment ?? null) !== (draft.payment ?? null) || (job.paymentNote ?? null) !== (draft.paymentNote ?? null))
    changes.push('pagamento');
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
  if (!IS_DEMO) return remote.updateJob(jobId, draft);
  await mockLatency(700);
  const job = ownJob(jobId);
  const db = store.getDb();
  if (job.closed || db.deletedJobIds.includes(jobId))
    throw serviceError('conflito', 'Essa vaga já foi encerrada e não pode mais ser editada.');
  const holding = db.applications.filter((a) => a.jobId === jobId && occupiesSlot(a.status)).length;
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
    // More places on a job that had filled up: the automatic refusals go back to review (Y03).
    return (draft.slots || 1) > (job.slots || 1) ? reopenAutoRejected(next, jobId, 'vaga_reaberta', at) : next;
  });
}

/** Replaces the job's photos (the first is the cover). Backend: upload to Storage, update jobs.photos. */
export async function updateJobPhotos(jobId: string, photos: string[]): Promise<void> {
  if (!IS_DEMO) return remote.updateJobPhotos(jobId, photos);
  await mockLatency(400);
  ownJob(jobId);
  store.updateJob(jobId, { photos });
}

/**
 * Closes the job: it leaves the mural and pending candidates are turned down. Backend: update jobs +
 * applications in one transaction, notify the candidates.
 */
export async function closeJob(jobId: string): Promise<void> {
  if (!IS_DEMO) return remote.closeJob(jobId);
  await mockLatency(500);
  const job = ownJob(jobId);
  const at = new Date().toISOString();
  store.transact((db) => {
    const hired = db.applications.some((a) => a.jobId === jobId && (holdsSlot(a.status) || a.status === 'concluida'));
    const closed: Job = { ...job, closed: true, ...(hired ? {} : { semContratacao: true }) };
    return closeJobApplications({ ...db, jobs: { ...db.jobs, [jobId]: closed } }, closed, at);
  });
}

/**
 * Deletes the job post (Y08). Only without a team: with someone picked or hired, closing the job is the
 * way (the team stays). Candidates still waiting become "não selecionado" and are told the job was
 * removed. Backend: delete_job (closes and sets deleted_at, in one transaction).
 */
export async function deleteJob(jobId: string): Promise<void> {
  if (!IS_DEMO) return remote.deleteJob(jobId);
  await mockLatency(500);
  const job = ownJob(jobId);
  const db = store.getDb();
  if (db.deletedJobIds.includes(jobId)) return;
  if (db.applications.some((a) => a.jobId === jobId && holdsSlot(a.status)))
    throw serviceError('conflito', 'Essa vaga tem gente escolhida ou contratada. Encerre a vaga em vez de excluir.');
  const at = new Date().toISOString();
  store.transact((d) => {
    const company = d.companies[job.companyId];
    let next: Database = {
      ...d,
      applications: d.applications.map((a) => (a.jobId === jobId && a.autoRejected ? { ...a, autoRejected: false } : a))
    };
    for (const app of next.applications.filter((a) => a.jobId === jobId && isPending(a.status))) {
      next = withNotification(
        {
          ...next,
          applications: next.applications.map((a) =>
            a.id === app.id ? transition(a, 'recusar', 'sistema', at, 'vaga_removida') : a
          )
        },
        {
          kind: 'nao_selecionado',
          title: 'Vaga removida',
          text: `${company.name} removeu ${jobTitle(job)}. Tem outros bicos no mural.`,
          workerId: app.workerId,
          companyId: null,
          target: '/mural'
        },
        at
      );
    }
    const done = next.applications.some((a) => a.jobId === jobId && a.status === 'concluida');
    return {
      ...next,
      jobs: { ...next.jobs, [jobId]: { ...job, closed: true, semContratacao: job.semContratacao || !done } },
      deletedJobIds: [...next.deletedJobIds, jobId]
    };
  });
}

// ---- worker actions ----

/**
 * Saves or un-saves a job for the worker. The flag flips at once and goes back if the request fails.
 * Backend: insert into / delete from saved_jobs.
 */
export async function toggleSavedJob(jobId: string): Promise<boolean> {
  if (!IS_DEMO) return remote.toggleSavedJob(jobId);
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
