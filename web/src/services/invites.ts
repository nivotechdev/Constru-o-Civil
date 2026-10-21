// F13: a company invites a worker to an open job; the worker accepts (it becomes a candidacy, with the
// usual rules) or declines, and the company hears the answer. Backend: table job_invites (each side reads
// its own), RPCs invite_worker / answer_invite (migration 20261013000300).
import type { Database, JobInvite } from '../types/models';
import { applicationFor, currentCompanyId, currentWorkerId, jobState } from './selectors';
import { submitApplication } from './applications';
import { jobTitle } from './catalog';
import { serviceError } from './errors';
import { mockLatency } from './mockLatency';
import { IS_DEMO } from './mode';
import { withNotification } from './notifications';
import * as store from './store';
import { db, request } from './remote/client';

export function inviteFor(database: Database, jobId: string, workerId: string): JobInvite | null {
  return database.invites?.find((i) => i.jobId === jobId && i.workerId === workerId) ?? null;
}

function putInvites(rows: JobInvite[]): void {
  store.transact((d) => {
    const keep = (d.invites ?? []).filter((i) => !rows.some((r) => r.jobId === i.jobId && r.workerId === i.workerId));
    return { ...d, invites: [...keep, ...rows] };
  });
}

/** The invitations of a job (the company's own) or of a worker (theirs; for a company, the ones it sent). */
export async function loadInvites(filter: { jobId?: string; workerId?: string }): Promise<void> {
  if (IS_DEMO) return mockLatency(200);
  const client = await db();
  let q = client.from('job_invites').select('*');
  if (filter.jobId) q = q.eq('job_id', filter.jobId);
  if (filter.workerId) q = q.eq('worker_id', filter.workerId);
  const rows = await request(() => q);
  putInvites(
    rows.map((r) => ({
      jobId: r.job_id,
      workerId: r.worker_id,
      companyId: r.company_id,
      status: r.status,
      createdAt: r.created_at
    }))
  );
}

/** The company invites a worker to one of its open jobs. */
export async function inviteWorker(jobId: string, workerId: string): Promise<void> {
  if (!IS_DEMO) {
    const client = await db();
    await request(() => client.rpc('invite_worker', { p_job_id: jobId, p_worker_id: workerId }));
    putInvites([
      { jobId, workerId, companyId: currentCompanyId(), status: 'pendente', createdAt: new Date().toISOString() }
    ]);
    return;
  }
  await mockLatency(400);
  const d = store.getDb();
  const job = d.jobs[jobId];
  if (!job || job.companyId !== currentCompanyId()) throw serviceError('nao_autorizado', 'Essa vaga não é sua.');
  if (jobState(d, job) !== 'aberta') throw serviceError('conflito', 'Essa vaga não está aberta para convites.');
  if (applicationFor(d, jobId, workerId)) throw serviceError('conflito', 'Essa pessoa já se candidatou a essa vaga.');
  if (inviteFor(d, jobId, workerId)) throw serviceError('conflito', 'Você já convidou essa pessoa para essa vaga.');
  const at = new Date().toISOString();
  const company = d.companies[job.companyId];
  store.transact((x) =>
    withNotification(
      {
        ...x,
        invites: [
          ...(x.invites ?? []),
          { jobId, workerId, companyId: job.companyId, status: 'pendente', createdAt: at }
        ]
      },
      {
        kind: 'convite',
        title: `${company?.name ?? 'Uma empresa'} convidou você`,
        text: `Para ${jobTitle(job)} em ${job.address.neighborhood || job.address.city}. Veja a vaga e responda.`,
        workerId,
        companyId: null,
        target: '/vaga/' + jobId
      },
      at
    )
  );
}

/** The worker answers: accepting sends the candidacy (same rules as "Quero esse bico"). */
export async function answerInvite(jobId: string, accept: boolean): Promise<void> {
  if (!IS_DEMO) {
    const client = await db();
    await request(() => client.rpc('answer_invite', { p_job_id: jobId, p_accept: accept }));
    const { loadJob } = await import('./jobs');
    await loadJob(jobId);
    await loadInvites({ jobId });
    return;
  }
  const workerId = currentWorkerId();
  const invite = inviteFor(store.getDb(), jobId, workerId);
  if (!invite) throw serviceError('nao_encontrado', 'Esse convite não existe mais.');
  if (invite.status !== 'pendente') return;
  if (accept) await submitApplication(jobId);
  else await mockLatency(300);
  const d = store.getDb();
  const worker = d.workers[workerId];
  const at = new Date().toISOString();
  store.transact((x) =>
    withNotification(
      {
        ...x,
        invites: (x.invites ?? []).map((i) =>
          i.jobId === jobId && i.workerId === workerId ? { ...i, status: accept ? 'aceito' : 'recusado' } : i
        )
      },
      {
        kind: 'convite',
        title: `${(worker?.name ?? 'O trabalhador').split(' ')[0]} ${accept ? 'aceitou' : 'recusou'} o convite`,
        text: accept ? 'A candidatura já está na lista da vaga.' : 'Convide outra pessoa ou espere candidatos.',
        workerId: null,
        companyId: invite.companyId,
        target: '/vaga-gerenciar/' + jobId
      },
      at
    )
  );
}
