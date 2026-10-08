// Paying for a boost ("Impulsionar vaga"): PIX (code to pay in the bank app) or card. Only a confirmed
// payment puts the job at the top of the mural, until `boostEndsAt`. Each function says what the real
// backend does there (docs/CONTRATO-BACKEND.md); the demo simulates the payment provider.
import type { BoostPayment, BoostPlanId, Database, Job } from '../types/models';
import { BOOST_PLANS, jobTitle } from './catalog';
import { serviceError } from './errors';
import { mockLatency } from './mockLatency';
import { withNotification } from './notifications';
import { currentCompanyId, isJobClosed } from './selectors';
import * as store from './store';
import { isExpired } from '../utils/jobInfo';
import { validateCard, type CardInput } from '../utils/card';

/** How long a PIX code can be paid. */
export const PIX_MINUTES = 30;

/** The job is at the top of the mural right now. */
export function isBoosted(job: Pick<Job, 'boostEndsAt'>, now: Date = new Date()): boolean {
  return Boolean(job.boostEndsAt && new Date(job.boostEndsAt).getTime() > now.getTime());
}

function plan(id: BoostPlanId) {
  const p = BOOST_PLANS.find((x) => x.id === id);
  if (!p) throw serviceError('validacao', 'Escolha um dos planos.');
  return p;
}

/** Why this job can't be boosted now, or `null` when it can. */
export function boostBlocker(db: Database, job: Job, now: Date = new Date()): string | null {
  if (job.companyId !== currentCompanyId()) return 'Só a construtora da vaga pode impulsionar.';
  if (db.deletedJobIds.includes(job.id) || isJobClosed(db, job) || isExpired(job, now))
    return 'Só dá para impulsionar uma vaga aberta.';
  if (isBoosted(job, now)) return 'Essa vaga já está impulsionada.';
  return null;
}

function checkJob(jobId: string): Job {
  const db = store.getDb();
  const job = db.jobs[jobId];
  if (!job) throw serviceError('nao_encontrado', 'Essa vaga não existe mais.');
  const blocker = boostBlocker(db, job);
  if (blocker) throw serviceError('conflito', blocker);
  return job;
}

function fakePixCode(id: string, cents: number): string {
  return `00020126580014BR.GOV.BCB.PIX0136bicos-${id}520400005303986540${(cents / 100).toFixed(2)}5802BR5905BICOS6009SAO PAULO62070503***6304`;
}

/** Marks PIX codes past their time as expired (the bank no longer accepts them). */
function expireStale(db: Database, now: Date): Database {
  const stale = db.boostPayments.some(
    (p) => p.status === 'aguardando' && p.expiresAt && new Date(p.expiresAt).getTime() <= now.getTime()
  );
  if (!stale) return db;
  return {
    ...db,
    boostPayments: db.boostPayments.map((p) =>
      p.status === 'aguardando' && p.expiresAt && new Date(p.expiresAt).getTime() <= now.getTime()
        ? { ...p, status: 'expirado' }
        : p
    )
  };
}

/** One payment, as it stands now (an unpaid PIX code may have expired). Backend: select the payment (own). */
export async function getPayment(paymentId: string): Promise<BoostPayment> {
  await mockLatency(200);
  store.transact((db) => expireStale(db, new Date()));
  const p = store.getDb().boostPayments.find((x) => x.id === paymentId);
  if (!p || p.companyId !== currentCompanyId()) throw serviceError('nao_encontrado', 'Esse pagamento não existe.');
  return p;
}

/**
 * Creates a PIX charge for the plan: a code to pay in the bank app, valid for PIX_MINUTES.
 * Backend: create the charge with the payment provider; its webhook confirms it (see confirmPayment).
 */
export async function startPixPayment(jobId: string, planId: BoostPlanId): Promise<BoostPayment> {
  await mockLatency(700);
  const job = checkJob(jobId);
  const p = plan(planId);
  const now = new Date();
  const id = 'pg' + Date.now().toString(36);
  const payment: BoostPayment = {
    id,
    jobId: job.id,
    companyId: job.companyId,
    plan: p.id,
    method: 'pix',
    amountCents: p.priceCents,
    status: 'aguardando',
    pixCode: fakePixCode(id, p.priceCents),
    cardLast4: null,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + PIX_MINUTES * 60000).toISOString(),
    confirmedAt: null,
    boostEndsAt: null
  };
  store.transact((db) => ({ ...db, boostPayments: [payment, ...db.boostPayments] }));
  return payment;
}

function confirm(db: Database, paymentId: string, now: Date): Database {
  const payment = db.boostPayments.find((p) => p.id === paymentId) as BoostPayment;
  const job = db.jobs[payment.jobId];
  const p = plan(payment.plan);
  const endsAt = new Date(now.getTime() + p.hours * 3600000).toISOString();
  const next: Database = {
    ...db,
    jobs: { ...db.jobs, [job.id]: { ...job, boostEndsAt: endsAt } },
    boostPayments: db.boostPayments.map((x) =>
      x.id === paymentId ? { ...x, status: 'confirmado', confirmedAt: now.toISOString(), boostEndsAt: endsAt } : x
    )
  };
  return withNotification(
    next,
    {
      kind: 'impulsionamento',
      title: 'Vaga impulsionada',
      text: `${jobTitle(job)} está no topo do mural até ${new Date(endsAt).toLocaleString('pt-BR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}.`,
      workerId: null,
      companyId: job.companyId,
      target: '/vaga-gerenciar/' + job.id
    },
    now.toISOString()
  );
}

/**
 * Demo only: stands in for the bank confirming the PIX. Backend: the payment provider's webhook (an
 * edge function) confirms the charge and sets jobs.boost_ends_at; the app only re-reads the payment.
 */
export async function simulatePixPaid(paymentId: string): Promise<BoostPayment> {
  await mockLatency(800);
  const now = new Date();
  store.transact((db) => expireStale(db, now));
  const payment = store.getDb().boostPayments.find((p) => p.id === paymentId);
  if (!payment || payment.companyId !== currentCompanyId())
    throw serviceError('nao_encontrado', 'Esse pagamento não existe.');
  if (payment.status === 'expirado') throw serviceError('conflito', 'Esse código PIX venceu. Gere um novo.');
  if (payment.status !== 'aguardando') return payment;
  store.transact((db) => confirm(db, paymentId, now));
  return store.getDb().boostPayments.find((p) => p.id === paymentId) as BoostPayment;
}

/**
 * Pays the plan by card. Demo: any valid card is approved; a number ending in 0000 is declined.
 * Backend: tokenize the card with the provider in the browser (the number never reaches our server),
 * charge it in an edge function, and confirm like the PIX webhook.
 */
export async function payWithCard(jobId: string, planId: BoostPlanId, card: CardInput): Promise<BoostPayment> {
  const errors = validateCard(card);
  if (Object.keys(errors).length) throw serviceError('validacao', 'Confira os dados do cartão.');
  await mockLatency(1200);
  const job = checkJob(jobId);
  const p = plan(planId);
  const now = new Date();
  const number = card.number.replace(/\D/g, '');
  const payment: BoostPayment = {
    id: 'pg' + Date.now().toString(36),
    jobId: job.id,
    companyId: job.companyId,
    plan: p.id,
    method: 'cartao',
    amountCents: p.priceCents,
    status: number.endsWith('0000') ? 'recusado' : 'aguardando',
    pixCode: null,
    cardLast4: number.slice(-4),
    createdAt: now.toISOString(),
    expiresAt: null,
    confirmedAt: null,
    boostEndsAt: null
  };
  store.transact((db) => {
    const withPayment = { ...db, boostPayments: [payment, ...db.boostPayments] };
    return payment.status === 'recusado' ? withPayment : confirm(withPayment, payment.id, now);
  });
  if (payment.status === 'recusado')
    throw serviceError('conflito', 'O banco recusou o cartão. Confira os dados ou use outro cartão ou o PIX.');
  return store.getDb().boostPayments.find((x) => x.id === payment.id) as BoostPayment;
}
