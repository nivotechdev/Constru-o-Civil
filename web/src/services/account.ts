// The logged-in account's privacy operations (LGPD): exporting and deleting its data. Each function
// says what the real backend does there (docs/CONTRATO-BACKEND.md).
import type { Application, Database, Job } from '../types/models';
import { holdsSlot, isPending, transition } from './applicationMachine';
import { closeJobApplications, concludeFinishedJobs } from './applications';
import { checkPassword, forgetPassword, signOut } from './auth';
import { jobTitle } from './catalog';
import { serviceError } from './errors';
import { mockLatency } from './mockLatency';
import { withNotification } from './notifications';
import { getSession, getDb, transact } from './store';

/** Sends a copy of the account's data to its e-mail. Backend: an edge function builds and e-mails it. */
export async function exportMyData(): Promise<void> {
  await mockLatency(900);
}

/**
 * What the account has going on, before deleting it (past diárias are concluded first).
 * Backend: select the account's candidacies/jobs in progress.
 */
export async function loadDeletionImpact(): Promise<void> {
  await mockLatency(300);
  concludeFinishedJobs();
}

/** What deleting the account would affect, to show before confirming. */
export interface DeletionImpact {
  /** Worker: diárias picked/hired that will be given up. Company: hires that will be cancelled. */
  commitments: { app: Application; job: Job }[];
  /** Company: open jobs that will be closed (their candidates are told). */
  openJobs: Job[];
}

export function deletionImpact(db: Database = getDb()): DeletionImpact {
  const session = getSession();
  if (!session) return { commitments: [], openJobs: [] };
  if (session.role === 'trabalhador') {
    return {
      commitments: db.applications
        .filter((a) => a.workerId === session.workerId && holdsSlot(a.status))
        .map((app) => ({ app, job: db.jobs[app.jobId] })),
      openJobs: []
    };
  }
  const mine = Object.values(db.jobs).filter(
    (j) => j.companyId === session.companyId && !j.closed && !db.deletedJobIds.includes(j.id)
  );
  const mineIds = new Set(mine.map((j) => j.id));
  return {
    commitments: db.applications
      .filter((a) => mineIds.has(a.jobId) && holdsSlot(a.status))
      .map((app) => ({ app, job: db.jobs[app.jobId] })),
    openJobs: mine
  };
}

/**
 * Deletes the logged-in account after checking its password. A worker gives up the diárias in progress
 * and withdraws pending applications; a company cancels its hires and closes its open jobs (the other
 * side is told). The profile is anonymised (history the other side keeps, like reviews, stays without
 * the name) and the session ends.
 * Backend: re-authenticate, then an RPC does the same in one transaction and deletes the Auth user.
 */
export async function deleteAccount(password: string, confirmCommitments: boolean): Promise<void> {
  if (!(await checkPassword(password))) throw serviceError('validacao', 'Senha incorreta. Confira e tente de novo.');
  const session = getSession();
  if (!session) throw serviceError('nao_autorizado', 'Entre na sua conta de novo para continuar.');
  concludeFinishedJobs();
  const impact = deletionImpact();
  if (impact.commitments.length && !confirmCommitments)
    throw serviceError('conflito', 'Confirme o que acontece com os bicos em andamento antes de excluir.');
  await mockLatency(900);
  const at = new Date().toISOString();
  const reason = 'Conta excluída';

  transact((db) => {
    let next: Database = db;
    if (session.role === 'trabalhador' && session.workerId) {
      const workerId = session.workerId;
      for (const { app, job } of impact.commitments) {
        next = {
          ...next,
          applications: next.applications.map((a) =>
            a.id === app.id ? transition(a, 'desistir', 'trabalhador', at, reason) : a
          )
        };
        next = withNotification(
          next,
          {
            kind: 'desistencia',
            title: 'Um trabalhador saiu da Bicos',
            text: `A vaga dele em ${jobTitle(job)} voltou a ficar aberta.`,
            workerId: null,
            companyId: job.companyId,
            target: '/vaga-gerenciar/' + job.id
          },
          at
        );
      }
      const worker = next.workers[workerId];
      next = {
        ...next,
        applications: next.applications.filter((a) => !(a.workerId === workerId && isPending(a.status))),
        workerPosts: next.workerPosts.filter((p) => p.workerId !== workerId),
        notifications: next.notifications.filter((n) => n.workerId !== workerId),
        workers: {
          ...next.workers,
          [workerId]: { ...worker, name: 'Conta excluída', initials: '–', whatsapp: '', specialties: [], facts: [] }
        }
      };
    } else if (session.companyId) {
      const companyId = session.companyId;
      for (const { app, job } of impact.commitments) {
        next = {
          ...next,
          applications: next.applications.map((a) =>
            a.id === app.id ? transition(a, 'cancelar_contratacao', 'construtora', at, reason) : a
          )
        };
        next = withNotification(
          next,
          {
            kind: 'contratacao_cancelada',
            title: 'Contratação cancelada',
            text: `A construtora de ${jobTitle(job)} saiu da Bicos e o bico foi cancelado.`,
            workerId: app.workerId,
            companyId: null,
            target: '/minhas-candidaturas'
          },
          at
        );
      }
      for (const job of impact.openJobs) {
        const closed: Job = { ...job, closed: true, semContratacao: true };
        next = closeJobApplications({ ...next, jobs: { ...next.jobs, [job.id]: closed } }, closed, at);
      }
      const company = next.companies[companyId];
      next = {
        ...next,
        notifications: next.notifications.filter((n) => n.companyId !== companyId),
        companies: {
          ...next.companies,
          [companyId]: { ...company, name: 'Construtora (conta excluída)', whatsapp: '' }
        }
      };
    }
    const accounts = { ...next.accounts };
    delete accounts[session.accountId];
    return { ...next, accounts };
  });
  forgetPassword(session.accountId);
  await signOut();
}
