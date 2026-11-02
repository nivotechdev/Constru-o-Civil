// The logged-in account's privacy operations (LGPD): exporting and deleting its data. Each function
// says what the real backend does there (docs/CONTRATO-BACKEND.md).
import type { Application, Database, Job, Review } from '../types/models';
import { holdsSlot } from './applicationMachine';
import { concludeFinishedJobs } from './applications';
import { checkPassword, forgetPassword, signOut } from './auth';
import type { CaptchaSource } from './auth';
import { jobTitle } from './catalog';
import { serviceError } from './errors';
import { mockLatency } from './mockLatency';
import { withNotification } from './notifications';
import { getSession, getDb, transact } from './store';
import { IS_DEMO } from './mode';
import * as remote from './remote/actions';
import * as remoteData from './remote/data';

/** Sends a copy of the account's data to its e-mail. Backend: an edge function builds and e-mails it. */
export async function exportMyData(): Promise<void> {
  if (!IS_DEMO) return remote.exportMyData();
  await mockLatency(900);
}

/**
 * What the account has going on, before deleting it (past diárias are concluded first).
 * Backend: select the account's candidacies/jobs in progress.
 */
export async function loadDeletionImpact(): Promise<void> {
  if (!IS_DEMO) return remoteData.loadDeletionImpact();
  await mockLatency(300);
  concludeFinishedJobs();
}

/**
 * AUD-004: the reviews the leaving account WROTE (on candidacies in `gone`) lose the author's name and the comment;
 * the rating stays in the other side's average.
 */
function anonymizedReviews<P extends { reviews: Review[] }>(profile: P, gone: Set<string>, label: string): P {
  if (!profile.reviews.some((r) => r.applicationId && gone.has(r.applicationId))) return profile;
  return {
    ...profile,
    reviews: profile.reviews.map((r) =>
      r.applicationId && gone.has(r.applicationId) ? { ...r, authorLabel: label, comment: '' } : r
    )
  };
}

/** What deleting the account would affect, to show before confirming. */
export interface DeletionImpact {
  /** Worker: diárias picked/hired that will be given up. Company: hires that will be cancelled. */
  commitments: { app: Application; job: Job }[];
  /** Company (U24): every job it published, all deleted with their candidacies. */
  jobs: Job[];
}

export function deletionImpact(db: Database = getDb()): DeletionImpact {
  const session = getSession();
  if (!session) return { commitments: [], jobs: [] };
  if (session.role === 'trabalhador') {
    return {
      commitments: db.applications
        .filter((a) => a.workerId === session.workerId && holdsSlot(a.status))
        .map((app) => ({ app, job: db.jobs[app.jobId] })),
      jobs: []
    };
  }
  const mine = Object.values(db.jobs).filter(
    (j) => j.companyId === session.companyId && !db.deletedJobIds.includes(j.id)
  );
  // Hires still to happen are on the open jobs (the server checks the same).
  const openIds = new Set(mine.filter((j) => !j.closed).map((j) => j.id));
  return {
    commitments: db.applications
      .filter((a) => openIds.has(a.jobId) && holdsSlot(a.status))
      .map((app) => ({ app, job: db.jobs[app.jobId] })),
    jobs: mine
  };
}

/**
 * U16: how the account proves it is its owner before deleting — its password, or, for an account without one
 * (made with "Continuar com o Google"), a 6-number code sent to its e-mail. The code also works for anyone who
 * forgot the password.
 */
export type DeletionProof = { password: string } | { code: string };

/** U16: whether the account has a password (an account made with Google has none: it confirms by code). */
export async function accountHasPassword(): Promise<boolean> {
  if (!IS_DEMO) return remote.accountHasPassword();
  return true;
}

/** U16: sends the 6-number security code to the account's own e-mail. */
export async function sendSecurityCode(captcha: CaptchaSource = async () => undefined): Promise<void> {
  if (!IS_DEMO) return remote.sendSecurityCode(captcha);
  if (!getSession()) throw serviceError('nao_autorizado', 'Entre na sua conta de novo para continuar.');
  await mockLatency(600);
}

/**
 * Deletes the logged-in account after it proves it is its owner (password or e-mail code). A worker gives up
 * the diárias in progress and withdraws pending applications; a company cancels its hires and closes its open
 * jobs (the other side is told). The profile is anonymised (history the other side keeps, like reviews, stays
 * without the name) and the session ends. Only the session's own account: the backend takes it from the token.
 * Backend: re-authenticate, then an RPC does the same in one transaction and deletes the Auth user.
 */
export async function deleteAccount(
  proof: DeletionProof,
  confirmCommitments: boolean,
  captcha: CaptchaSource = async () => undefined
): Promise<void> {
  if (!IS_DEMO) {
    // U30: the theme goes with the account (account_prefs is deleted in cascade).
    return remote.deleteAccount(proof, confirmCommitments, captcha);
  }
  if ('password' in proof) {
    if (!(await checkPassword(proof.password)))
      throw serviceError('validacao', 'Senha incorreta. Confira e tente de novo.');
  } else if (!/^\d{6}$/.test(proof.code)) {
    throw serviceError('validacao', 'Código incorreto ou vencido. Confira o e-mail mais recente ou peça outro código.');
  }
  const session = getSession();
  if (!session) throw serviceError('nao_autorizado', 'Entre na sua conta de novo para continuar.');
  concludeFinishedJobs();
  const impact = deletionImpact();
  if (impact.commitments.length && !confirmCommitments)
    throw serviceError('conflito', 'Confirme o que acontece com os bicos em andamento antes de excluir.');
  await mockLatency(900);
  const at = new Date().toISOString();

  transact((db) => {
    let next: Database = db;
    // U24: everything the account has goes away; the other side is told first and its numbers are redone.
    if (session.role === 'trabalhador' && session.workerId) {
      const workerId = session.workerId;
      for (const { job } of impact.commitments) {
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
      const gone = new Set(next.applications.filter((a) => a.workerId === workerId).map((a) => a.id));
      const workers = { ...next.workers };
      delete workers[workerId];
      const alerts = { ...next.jobAlerts };
      delete alerts[workerId];
      next = {
        ...next,
        applications: next.applications.filter((a) => !gone.has(a.id)),
        workerPosts: next.workerPosts.filter((p) => p.workerId !== workerId),
        notifications: next.notifications.filter((n) => n.workerId !== workerId),
        invites: next.invites?.filter((i) => i.workerId !== workerId),
        savedJobIds: [],
        jobAlerts: alerts,
        workers,
        // The companies it reviewed keep the rating, without its name and comment (AUD-004).
        companies: Object.fromEntries(
          Object.entries(next.companies).map(([id, c]) => [id, anonymizedReviews(c, gone, 'Conta excluída')])
        )
      };
    } else if (session.companyId) {
      const companyId = session.companyId;
      for (const { app, job } of impact.commitments) {
        next = withNotification(
          next,
          {
            kind: 'contratacao_cancelada',
            title: 'Contratação cancelada',
            text: `A empresa de ${jobTitle(job)} saiu da Bicos e o bico foi cancelado.`,
            workerId: app.workerId,
            companyId: null,
            target: '/minhas-candidaturas'
          },
          at
        );
      }
      const jobIds = new Set(
        Object.values(next.jobs)
          .filter((j) => j.companyId === companyId)
          .map((j) => j.id)
      );
      const goneApps = next.applications.filter((a) => jobIds.has(a.jobId));
      const gone = new Set(goneApps.map((a) => a.id));
      const jobs = Object.fromEntries(Object.entries(next.jobs).filter(([id]) => !jobIds.has(id)));
      const companies = { ...next.companies };
      delete companies[companyId];
      next = {
        ...next,
        jobs,
        applications: next.applications.filter((a) => !gone.has(a.id)),
        boostPayments: next.boostPayments.filter((p) => !jobIds.has(p.jobId)),
        notifications: next.notifications.filter((n) => n.companyId !== companyId),
        invites: next.invites?.filter((i) => i.companyId !== companyId),
        savedJobIds: next.savedJobIds.filter((id) => !jobIds.has(id)),
        companies,
        // The workers it reviewed keep the rating, without its name and comment (AUD-004); the bicos done with it
        // leave the count.
        workers: Object.fromEntries(
          Object.entries(next.workers).map(([id, w]) => {
            const done = goneApps.filter((a) => a.workerId === id && a.status === 'concluida').length;
            const cleared = anonymizedReviews(w, gone, 'Empresa (conta excluída)');
            return [id, done ? { ...cleared, jobsDone: Math.max(0, cleared.jobsDone - done) } : cleared];
          })
        )
      };
    }
    const accounts = { ...next.accounts };
    delete accounts[session.accountId];
    return { ...next, accounts };
  });
  forgetPassword(session.accountId);
  await signOut();
}
