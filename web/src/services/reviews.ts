// Reviews after a concluded diária: the worker reviews the company and the company reviews the worker,
// once each. Each function says what the real backend does there (docs/CONTRATO-BACKEND.md).
import type { Application, Review, ReviewDirection } from '../types/models';
import { canReview } from './applicationMachine';
import { serviceError } from './errors';
import { mockLatency } from './mockLatency';
import { applicationFor, currentCompanyId, currentWorkerId } from './selectors';
import * as store from './store';
import { IS_DEMO } from './mode';
import * as remote from './remote/actions';

export const MAX_COMMENT = 300;

/** Ready-made points the worker can mark about the company. */
export const COMPANY_TAGS = ['Pagou no dia', 'Local seguro', 'Horário combinado', 'Equipe respeitosa'];
/** Ready-made points the company can mark about the worker. */
export const WORKER_TAGS = [
  'Chegou no horário',
  'Trabalho caprichado',
  'Cuidadoso',
  'Respeitou a equipe',
  'Deixou o local limpo'
];

export interface ReviewInput {
  applicationId: string;
  direction: ReviewDirection;
  /** 1 to 5. */
  value: number;
  tags: string[];
  comment: string;
}

/** The new average after one more review, rounded to one decimal, from the rounded average so far. */
export function addToAverage(rating: number, count: number, value: number): { rating: number; count: number } {
  const total = rating * count + value;
  return { rating: Math.round((total / (count + 1)) * 10) / 10, count: count + 1 };
}

/**
 * Y18: the profile's rating with one more review — round(avg, 1) over all its reviews, like the database
 * (the rounding never piles up). The demo's seed lists only each profile's latest reviews; for those the
 * rounded average so far stands in for the missing ones.
 */
export function ratingWith(
  profile: { rating: number; reviewCount: number; reviews: { value: number }[] },
  value: number
): { rating: number; count: number } {
  if (profile.reviews.length < profile.reviewCount) return addToAverage(profile.rating, profile.reviewCount, value);
  const values = [...profile.reviews.map((r) => r.value), value];
  const sum = values.reduce((s, v) => s + v, 0);
  // Integer sum × 10 / n, so 4.25 rounds to 4.3 like Postgres (no floating-point 4.2499…).
  return { rating: Math.round((sum * 10) / values.length) / 10, count: values.length };
}

/** The candidacy the logged-in side may review now, or why not. */
export function reviewableApplication(
  jobId: string,
  workerId: string | null,
  side: 'trabalhador' | 'construtora'
): Application | null {
  const db = store.getDb();
  const job = db.jobs[jobId];
  if (!job) return null;
  const app = applicationFor(db, jobId, side === 'trabalhador' ? currentWorkerId() : (workerId ?? ''));
  if (!app) return null;
  if (side === 'construtora' && job.companyId !== currentCompanyId()) return null;
  return canReview(app, side) ? app : null;
}

/**
 * Stores a review on the reviewed profile, updates its rating and count, and marks the reviewer's side
 * as done. Only for a concluded candidacy, once per side. Backend: insert into reviews + update the
 * profile's rating/review_count + the application's flag, in one transaction (RPC).
 */
export async function submitReview(input: ReviewInput): Promise<void> {
  if (!IS_DEMO) return remote.submitReview(input);
  await mockLatency(600);
  const db = store.getDb();
  const app = db.applications.find((a) => a.id === input.applicationId);
  if (!app) throw serviceError('nao_encontrado', 'Essa diária não existe mais.');
  const job = db.jobs[app.jobId];
  const side = input.direction === 'para_construtora' ? 'trabalhador' : 'construtora';
  const allowed = side === 'trabalhador' ? app.workerId === currentWorkerId() : job?.companyId === currentCompanyId();
  if (!job || !allowed) throw serviceError('nao_autorizado', 'Essa avaliação não é sua para fazer.');
  if (!canReview(app, side)) throw serviceError('conflito', 'Essa avaliação não está disponível.');
  if (!Number.isInteger(input.value) || input.value < 1 || input.value > 5)
    throw serviceError('validacao', 'Escolha uma nota de 1 a 5 estrelas.');
  const comment = input.comment.trim();
  if (comment.length > MAX_COMMENT) throw serviceError('validacao', `Use até ${MAX_COMMENT} caracteres.`);

  const worker = db.workers[app.workerId];
  const company = db.companies[job.companyId];
  const review: Review = {
    id: 'r' + Date.now().toString(36),
    applicationId: app.id,
    direction: input.direction,
    authorLabel:
      side === 'trabalhador' ? `${worker.name.split(' ')[0]} ${worker.name.split(' ').slice(-1)[0][0]}.` : company.name,
    value: input.value,
    tags: input.tags,
    comment,
    createdAt: new Date().toISOString()
  };
  store.transact((d) => {
    const applications = d.applications.map((a) =>
      a.id === app.id ? { ...a, ...(side === 'trabalhador' ? { workerReviewed: true } : { companyReviewed: true }) } : a
    );
    if (side === 'trabalhador') {
      const c = d.companies[company.id];
      const avg = ratingWith(c, review.value);
      return {
        ...d,
        applications,
        companies: {
          ...d.companies,
          [c.id]: { ...c, rating: avg.rating, reviewCount: avg.count, reviews: [review, ...c.reviews] }
        }
      };
    }
    const w = d.workers[worker.id];
    const avg = ratingWith(w, review.value);
    return {
      ...d,
      applications,
      workers: {
        ...d.workers,
        [w.id]: { ...w, rating: avg.rating, reviewCount: avg.count, reviews: [review, ...w.reviews] }
      }
    };
  });
}
