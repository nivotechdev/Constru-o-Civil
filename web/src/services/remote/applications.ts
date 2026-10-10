// Candidacies with the real backend: every change of status is the RPC transition_application, which
// applies the transition table (services/applicationMachine.ts), the automatic refusals and the
// notifications in one transaction. Afterwards the job is read again, so the screen shows the result.
import type { ApplicationAction } from '../applicationMachine';
import { serviceError } from '../errors';
import { getSession } from '../store';
import { db, request } from './client';
import { loadJob } from './data';

async function transition(jobId: string, workerId: string, action: ApplicationAction, reason: string | null = null) {
  const client = await db();
  await request(() =>
    client.rpc('transition_application', { p_job_id: jobId, p_worker_id: workerId, p_action: action, p_reason: reason })
  );
  await loadJob(jobId);
}

function myWorkerId(): string {
  const id = getSession()?.workerId;
  if (!id) throw serviceError('nao_autorizado', 'Só a conta de trabalhador pode fazer isso.');
  return id;
}

export async function submitApplication(jobId: string): Promise<void> {
  const client = await db();
  await request(() => client.rpc('submit_application', { p_job_id: jobId }));
  await loadJob(jobId);
}

export async function withdrawApplication(jobId: string): Promise<void> {
  const client = await db();
  await request(() => client.rpc('withdraw_application', { p_job_id: jobId }));
  await loadJob(jobId);
}

export const giveUp = (jobId: string, reason: string) => transition(jobId, myWorkerId(), 'desistir', reason);
export const markInReview = (jobId: string, workerId: string) => transition(jobId, workerId, 'analisar');
export const approve = (jobId: string, workerId: string) => transition(jobId, workerId, 'aprovar');
export const reject = (jobId: string, workerId: string) => transition(jobId, workerId, 'recusar');
export const undoApproval = (jobId: string, workerId: string) => transition(jobId, workerId, 'desfazer_aprovacao');
/** L22: RPC undo_reject (only a refusal by the company in the last 10 minutes, on an open job). */
export async function undoReject(jobId: string, workerId: string): Promise<void> {
  const client = await db();
  await request(() => client.rpc('undo_reject', { p_job_id: jobId, p_worker_id: workerId }));
  await loadJob(jobId);
}
export const confirmHire = (jobId: string, workerId: string) => transition(jobId, workerId, 'contratar');
export const cancelHire = (jobId: string, workerId: string, reason: string) =>
  transition(jobId, workerId, 'cancelar_contratacao', reason);
export const completeWorkday = (jobId: string, workerId: string) => transition(jobId, workerId, 'concluir');
export const markNoShow = (jobId: string, workerId: string) => transition(jobId, workerId, 'marcar_falta');
