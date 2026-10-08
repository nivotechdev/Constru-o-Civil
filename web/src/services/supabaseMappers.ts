// Conversion between the Supabase tables (types/supabase.ts) and the domain records the app works with
// (types/models.ts). Pure functions, no network: the future Supabase-backed services read rows and hand
// the store the same `Database` snapshot it holds today, so no screen changes.
//
// Conventions: snake_case columns ↔ camelCase fields; optional flags the mock only ever sets to `true`
// (urgent, boosted, closed, semContratacao, novo) are `boolean not null default false` columns and are
// left out of the record when false; other optional fields are nullable columns, left out when null.
import type {
  Account,
  Application,
  AppNotification,
  Company,
  Database,
  Job,
  Oficio,
  Review,
  Worker,
  WorkerPost
} from '../types/models';
import type { TableInsert, TableRow } from '../types/supabase';

type ReviewRow = Pick<
  TableRow<'reviews'>,
  'direction' | 'company_id' | 'worker_id' | 'author_label' | 'value' | 'text' | 'date_label'
>;

/** Copies `value` onto `target[key]` unless it is null/undefined (or false, for flags). */
function setIf<T, K extends keyof T>(target: T, key: K, value: T[K] | null | undefined | false): void {
  if (value !== null && value !== undefined && value !== false) target[key] = value;
}

// ---- accounts ----

export function accountFromRow(row: TableRow<'accounts'>): Account {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    document: row.document,
    whatsapp: row.whatsapp,
    whatsappVerifiedAt: row.whatsapp_verified_at,
    emailConfirmedAt: row.email_confirmed_at,
    profileCompletedAt: row.profile_completed_at,
    workerId: row.worker_id,
    companyId: row.company_id,
    createdAt: row.created_at
  };
}

export function accountToRow(account: Account): TableInsert<'accounts'> {
  return {
    id: account.id,
    email: account.email,
    role: account.role,
    document: account.document,
    whatsapp: account.whatsapp,
    whatsapp_verified_at: account.whatsappVerifiedAt,
    email_confirmed_at: account.emailConfirmedAt,
    profile_completed_at: account.profileCompletedAt,
    worker_id: account.workerId,
    company_id: account.companyId,
    created_at: account.createdAt
  };
}

// ---- ofícios (the catalog) ----

export function oficioFromRow(row: TableRow<'oficios'>): Oficio {
  return { id: row.id, nome: row.nome, sinonimos: row.sinonimos };
}

export function oficioToRow(oficio: Oficio): TableInsert<'oficios'> {
  return { id: oficio.id, nome: oficio.nome, sinonimos: oficio.sinonimos };
}

// ---- companies ----

export function companyFromRow(row: TableRow<'companies'>, reviews: ReviewRow[] = []): Company {
  const company: Company = {
    id: row.id,
    name: row.name,
    location: row.location,
    whatsapp: row.whatsapp,
    rating: row.rating,
    reviewCount: row.review_count,
    verified: row.verified,
    reviews: reviews
      .filter((r) => r.direction === 'para_construtora' && r.company_id === row.id)
      .map((r) => ({ author: r.author_label, value: r.value, text: r.text, date: r.date_label }))
  };
  setIf(company, 'cnpj', row.cnpj);
  setIf(company, 'tipoObra', row.tipo_obra);
  setIf(company, 'verifiedSince', row.verified_since);
  setIf(company, 'sinceLabel', row.since_label);
  setIf(company, 'respondTime', row.respond_time);
  setIf(company, 'paidCount', row.paid_count);
  return company;
}

export function companyToRow(company: Company): TableInsert<'companies'> {
  return {
    id: company.id,
    name: company.name,
    cnpj: company.cnpj ?? null,
    tipo_obra: company.tipoObra ?? null,
    location: company.location,
    whatsapp: company.whatsapp,
    rating: company.rating,
    review_count: company.reviewCount,
    verified: company.verified,
    verified_since: company.verifiedSince ?? null,
    since_label: company.sinceLabel ?? null,
    respond_time: company.respondTime ?? null,
    paid_count: company.paidCount ?? null
  };
}

// ---- workers ----

export function workerFromRow(row: TableRow<'workers'>, reviews: ReviewRow[] = []): Worker {
  const worker: Worker = {
    id: row.id,
    name: row.name,
    initials: row.initials,
    oficioId: row.oficio_id ?? '',
    city: row.city,
    neighborhood: row.neighborhood,
    lat: row.lat,
    lon: row.lon,
    rating: row.rating,
    jobsDone: row.jobs_done,
    verified: row.verified,
    specialties: row.specialties,
    facts: row.facts,
    reviews: reviews
      .filter((r) => r.direction === 'para_trabalhador' && r.worker_id === row.id)
      .map((r) => ({ company: r.author_label, value: r.value, text: r.text, date: r.date_label }))
  };
  setIf(worker, 'novo', row.novo);
  return worker;
}

export function workerToRow(worker: Worker): TableInsert<'workers'> {
  return {
    id: worker.id,
    name: worker.name,
    initials: worker.initials,
    oficio_id: worker.oficioId || null,
    city: worker.city,
    neighborhood: worker.neighborhood,
    lat: worker.lat,
    lon: worker.lon,
    rating: worker.rating,
    jobs_done: worker.jobsDone,
    novo: Boolean(worker.novo),
    verified: worker.verified,
    specialties: worker.specialties,
    facts: worker.facts
  };
}

// ---- reviews (both directions live in one table) ----

function reviewRow(
  review: Review,
  direction: ReviewRow['direction'],
  ids: { company_id: string | null; worker_id: string | null }
): TableInsert<'reviews'> {
  return {
    direction,
    ...ids,
    author_label: (direction === 'para_construtora' ? review.author : review.company) ?? '',
    value: review.value,
    text: review.text,
    date_label: review.date
  };
}

/** A company's reviews (written by workers), in the order they are shown. */
export function companyReviewsToRows(company: Company): TableInsert<'reviews'>[] {
  return company.reviews.map((r) => reviewRow(r, 'para_construtora', { company_id: company.id, worker_id: null }));
}

/** A worker's reviews (written by companies), in the order they are shown. */
export function workerReviewsToRows(worker: Worker): TableInsert<'reviews'>[] {
  return worker.reviews.map((r) => reviewRow(r, 'para_trabalhador', { company_id: null, worker_id: worker.id }));
}

// ---- jobs ----

export function jobFromRow(row: TableRow<'jobs'>): Job {
  const job: Job = {
    id: row.id,
    companyId: row.company_id,
    oficioId: row.oficio_id,
    title: row.title,
    pay: row.pay,
    address: {
      cep: row.cep,
      street: row.street,
      number: row.number,
      complement: row.complement,
      neighborhood: row.neighborhood,
      city: row.city,
      uf: row.uf,
      lat: row.lat,
      lon: row.lon
    },
    dateToArrange: row.date_to_arrange,
    startDate: row.start_date,
    endDate: row.end_date,
    startTime: row.start_time,
    endTime: row.end_time,
    diarias: row.diarias,
    dias: row.dias,
    slots: row.slots,
    description: row.description,
    requirements: row.requirements
  };
  setIf(job, 'urgent', row.urgent);
  setIf(job, 'boosted', row.boosted);
  setIf(job, 'photos', row.photos);
  setIf(job, 'closed', row.closed);
  setIf(job, 'semContratacao', row.sem_contratacao);
  return job;
}

/** `deletedAt`: when the company deleted the post (Database.deletedJobIds). */
export function jobToRow(job: Job, deletedAt: string | null = null): TableInsert<'jobs'> {
  const a = job.address;
  return {
    id: job.id,
    company_id: job.companyId,
    oficio_id: job.oficioId,
    title: job.title,
    pay: job.pay,
    cep: a.cep,
    street: a.street,
    number: a.number,
    complement: a.complement,
    neighborhood: a.neighborhood,
    city: a.city,
    uf: a.uf,
    lat: a.lat,
    lon: a.lon,
    date_to_arrange: job.dateToArrange,
    start_date: job.startDate,
    end_date: job.endDate,
    start_time: job.startTime,
    end_time: job.endTime,
    diarias: job.diarias,
    dias: job.dias ?? null,
    urgent: Boolean(job.urgent),
    boosted: Boolean(job.boosted),
    photos: job.photos ?? null,
    slots: job.slots ?? 1,
    closed: Boolean(job.closed),
    sem_contratacao: Boolean(job.semContratacao),
    description: job.description,
    requirements: job.requirements,
    deleted_at: deletedAt
  };
}

// ---- applications, saved jobs, posts ----

export function applicationFromRow(row: TableRow<'applications'>): Application {
  return { id: row.id, jobId: row.job_id, workerId: row.worker_id, status: row.status };
}

export function applicationToRow(app: Application): TableInsert<'applications'> {
  return { id: app.id, job_id: app.jobId, worker_id: app.workerId, status: app.status };
}

export function postFromRow(row: TableRow<'worker_posts'>): WorkerPost {
  return {
    id: row.id,
    workerId: row.worker_id,
    mediaUrl: row.media_url,
    mediaType: row.media_type,
    caption: row.caption,
    date: row.posted_on
  };
}

export function postToRow(post: WorkerPost): TableInsert<'worker_posts'> {
  return {
    id: post.id,
    worker_id: post.workerId,
    media_url: post.mediaUrl,
    media_type: post.mediaType,
    caption: post.caption,
    posted_on: post.date
  };
}

// ---- notifications ----

/** "Há 12 min", "Há 2h", "Ontem", "3 dias atrás" — how the app shows when something happened. */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 60000));
  if (minutes < 60) return `Há ${Math.max(1, minutes)} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Há ${hours}h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'Ontem' : `${days} dias atrás`;
}

export function notificationFromRow(row: TableRow<'notifications'>, now?: Date): AppNotification {
  return {
    kind: row.kind,
    title: row.title,
    text: row.body,
    time: relativeTime(row.created_at, now),
    read: row.read_at !== null
  };
}

// ---- the whole snapshot ----

/** Every row the app reads at start-up — what a Supabase-backed store would load. */
export interface DatabaseRows {
  accounts: TableRow<'accounts'>[];
  companies: TableRow<'companies'>[];
  workers: TableRow<'workers'>[];
  /** Deleted posts included (deleted_at set), oldest deletion first. */
  jobs: TableRow<'jobs'>[];
  applications: TableRow<'applications'>[];
  /** The logged-in worker's saved jobs, in the order they were saved. */
  savedJobs: Pick<TableRow<'saved_jobs'>, 'job_id'>[];
  /** In the order each list shows them. */
  reviews: ReviewRow[];
  workerPosts: TableRow<'worker_posts'>[];
}

const byId = <T extends { id: string }>(items: T[]): Record<string, T> =>
  Object.fromEntries(items.map((item) => [item.id, item]));

/** Assembles the domain snapshot the store holds (services/store.ts) from the tables' rows. */
export function databaseFromRows(rows: DatabaseRows): Database {
  return {
    accounts: byId(rows.accounts.map(accountFromRow)),
    companies: byId(rows.companies.map((row) => companyFromRow(row, rows.reviews))),
    workers: byId(rows.workers.map((row) => workerFromRow(row, rows.reviews))),
    jobs: byId(rows.jobs.map(jobFromRow)),
    applications: rows.applications.map(applicationFromRow),
    savedJobIds: rows.savedJobs.map((s) => s.job_id),
    deletedJobIds: rows.jobs
      .filter((j) => j.deleted_at !== null)
      .sort((a, b) => (a.deleted_at ?? '').localeCompare(b.deleted_at ?? ''))
      .map((j) => j.id),
    workerPosts: rows.workerPosts.map(postFromRow)
  };
}

/** The inserts that recreate a snapshot in Supabase — e.g. to load the demo data into a new project. */
export function databaseToInserts(db: Database, savedBy: string) {
  const deleted = new Map(db.deletedJobIds.map((id, i) => [id, new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString()]));
  return {
    accounts: Object.values(db.accounts).map(accountToRow),
    companies: Object.values(db.companies).map(companyToRow),
    workers: Object.values(db.workers).map(workerToRow),
    jobs: Object.values(db.jobs).map((job) => jobToRow(job, deleted.get(job.id) ?? null)),
    applications: db.applications.map(applicationToRow),
    saved_jobs: db.savedJobIds.map((job_id): TableInsert<'saved_jobs'> => ({ worker_id: savedBy, job_id })),
    reviews: [
      ...Object.values(db.companies).flatMap(companyReviewsToRows),
      ...Object.values(db.workers).flatMap(workerReviewsToRows)
    ],
    worker_posts: db.workerPosts.map(postToRow)
  };
}
