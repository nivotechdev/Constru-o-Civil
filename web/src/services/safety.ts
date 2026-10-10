// F04: reporting (a job, a profile, a review, a post) and blocking an account. Blocking ends the pending
// candidacies and invitations between the two and stops new ones (server); the app also hides the blocked
// account from the mural and the search. Backend: tables reports / blocks, RPCs report_content,
// block_account, unblock_account (migration 20261013000400).
import type { Database, Job, ReportReason, ReportTarget } from '../types/models';
import { isPending } from './applicationMachine';
import { serviceError } from './errors';
import { mockLatency } from './mockLatency';
import { IS_DEMO } from './mode';
import * as store from './store';
import { db, request } from './remote/client';

export const REPORT_REASONS: { id: ReportReason; label: string }[] = [
  { id: 'golpe', label: 'Golpe ou pedido de dinheiro' },
  { id: 'ofensa', label: 'Ofensa ou discriminação' },
  { id: 'falso', label: 'Informação falsa' },
  { id: 'perigoso', label: 'Trabalho perigoso ou ilegal' },
  { id: 'spam', label: 'Propaganda ou spam' },
  { id: 'outro', label: 'Outro motivo' }
];

/** Demo only: the reports made on this device. */
export const demoReports: { target: ReportTarget; id: string; reason: ReportReason }[] = [];

export const blockedIds = (database: Database): string[] => database.blockedIds ?? [];
export const isBlocked = (database: Database, accountId: string | null | undefined): boolean =>
  Boolean(accountId && blockedIds(database).includes(accountId));
/** The mural and the search leave out the jobs of blocked companies. */
export const notBlocked = (database: Database) => (job: Pick<Job, 'companyId'>) => !isBlocked(database, job.companyId);

export async function reportContent(
  target: ReportTarget,
  targetId: string,
  reason: ReportReason,
  details?: string
): Promise<void> {
  if (!REPORT_REASONS.some((r) => r.id === reason)) throw serviceError('validacao', 'Escolha o motivo da denúncia.');
  if (!IS_DEMO) {
    const client = await db();
    await request(() =>
      client.rpc('report_content', {
        p_target_type: target,
        p_target_id: targetId,
        p_reason: reason,
        p_details: details?.trim() || null
      })
    );
    return;
  }
  await mockLatency(400);
  demoReports.push({ target, id: targetId, reason });
}

/** The accounts the session blocked. Backend: select blocks (own) + their names. */
export async function loadMyBlocks(): Promise<void> {
  if (IS_DEMO) return mockLatency(150);
  const remote = await import('./remote/data');
  await remote.loadMyBlocks();
}

/**
 * Blocks a worker or a company, by its profile id (with the real backend the profile id is the account id;
 * the demo keeps separate ids).
 */
export async function blockAccount(accountId: string): Promise<void> {
  const session = store.getSession();
  if (!session) throw serviceError('nao_autorizado');
  const me = session.workerId ?? session.companyId ?? session.accountId;
  if (accountId === me) throw serviceError('validacao', 'Você não pode bloquear a própria conta.');
  if (!IS_DEMO) {
    const client = await db();
    await request(() => client.rpc('block_account', { p_account: accountId }));
  } else await mockLatency(400);
  store.transact((d) => ({
    ...d,
    blockedIds: [...new Set([...(d.blockedIds ?? []), accountId])],
    // Pending candidacies between the two end (the server does the same).
    applications: d.applications.filter((a) => {
      if (!isPending(a.status)) return true;
      const company = d.jobs[a.jobId]?.companyId;
      return !((a.workerId === me && company === accountId) || (a.workerId === accountId && company === me));
    })
  }));
}

export async function unblockAccount(accountId: string): Promise<void> {
  if (!IS_DEMO) {
    const client = await db();
    await request(() => client.rpc('unblock_account', { p_account: accountId }));
  } else await mockLatency(300);
  store.transact((d) => ({ ...d, blockedIds: (d.blockedIds ?? []).filter((id) => id !== accountId) }));
}
