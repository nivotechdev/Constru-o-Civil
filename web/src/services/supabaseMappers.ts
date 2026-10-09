// Conversion between the Supabase tables (types/supabase.ts) and the domain records the app works with
// (types/models.ts). Pure functions, no network: the future Supabase-backed services read rows and hand
// the store the same `Database` snapshot it holds today, so no screen changes.
//
// Conventions: snake_case columns ↔ camelCase fields; optional flags the mock only ever sets to `true`
// (urgent, closed, semContratacao, novo) are `boolean not null default false` columns and are
// left out of the record when false; other optional fields are nullable columns, left out when null.
import type {
  Account,
  Application,
  AppNotification,
  BoostPayment,
  Company,
  Database,
  Job,
  Oficio,
  Review,
  Worker,
  WorkerPost
} from '../types/models';
import type { TableInsert, TableRow } from '../types/supabase';

type ReviewRow = TableRow<'reviews'>;

export function reviewFromRow(r: ReviewRow): Review {
  return {
    id: r.id,
    applicationId: r.application_id,
    direction: r.direction,
    authorLabel: r.author_label,
    value: r.value,
    tags: r.tags,
    comment: r.comment,
    createdAt: r.created_at
  };
}

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
    termsVersion: row.terms_version,
    termsAcceptedAt: row.terms_accepted_at,
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
    terms_version: account.termsVersion,
    terms_accepted_at: account.termsAcceptedAt,
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
    reviews: reviews.filter((r) => r.direction === 'para_construtora' && r.company_id === row.id).map(reviewFromRow)
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
    whatsapp: row.whatsapp,
    city: row.city,
    neighborhood: row.neighborhood,
    lat: row.lat,
    lon: row.lon,
    rating: row.rating,
    reviewCount: row.review_count,
    jobsDone: row.jobs_done,
    verified: row.verified,
    specialties: row.specialties,
    facts: row.facts,
    reviews: reviews.filter((r) => r.direction === 'para_trabalhador' && r.worker_id === row.id).map(reviewFromRow)
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
    whatsapp: worker.whatsapp,
    city: worker.city,
    neighborhood: worker.neighborhood,
    lat: worker.lat,
    lon: worker.lon,
    rating: worker.rating,
    review_count: worker.reviewCount,
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
  ids: { company_id: string | null; worker_id: string | null }
): TableInsert<'reviews'> {
  return {
    id: review.id,
    application_id: review.applicationId,
    direction: review.direction,
    ...ids,
    author_label: review.authorLabel,
    value: review.value,
    tags: review.tags,
    comment: review.comment,
    created_at: review.createdAt
  };
}

/** A company's reviews (written by workers), in the order they are shown. */
export function companyReviewsToRows(company: Company): TableInsert<'reviews'>[] {
  return company.reviews.map((r) => reviewRow(r, { company_id: company.id, worker_id: null }));
}

/** A worker's reviews (written by companies), in the order they are shown. */
export function workerReviewsToRows(worker: Worker): TableInsert<'reviews'>[] {
  return worker.reviews.map((r) => reviewRow(r, { company_id: null, worker_id: worker.id }));
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
  setIf(job, 'boostEndsAt', row.boost_ends_at);
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
    boost_ends_at: job.boostEndsAt ?? null,
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

export function applicationFromRow(
  row: TableRow<'applications'>,
  events: TableRow<'application_events'>[] = []
): Application {
  return {
    id: row.id,
    jobId: row.job_id,
    workerId: row.worker_id,
    status: row.status,
    createdAt: row.created_at,
    statusChangedAt: row.status_changed_at,
    events: events
      .filter((e) => e.application_id === row.id)
      .sort((a, b) => a.at.localeCompare(b.at) || a.id - b.id)
      .map((e) => ({ status: e.status, at: e.at, by: e.by, reason: e.reason })),
    autoRejected: row.auto_rejected,
    workerReviewed: row.worker_reviewed,
    companyReviewed: row.company_reviewed
  };
}

export function applicationToRow(app: Application): TableInsert<'applications'> {
  return {
    id: app.id,
    job_id: app.jobId,
    worker_id: app.workerId,
    status: app.status,
    created_at: app.createdAt,
    status_changed_at: app.statusChangedAt,
    auto_rejected: app.autoRejected,
    worker_reviewed: app.workerReviewed,
    company_reviewed: app.companyReviewed
  };
}

export function applicationEventsToRows(app: Application): TableInsert<'application_events'>[] {
  return app.events.map((e) => ({ application_id: app.id, status: e.status, at: e.at, by: e.by, reason: e.reason }));
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

export { relativeTime } from '../utils/dates';

export function notificationFromRow(row: TableRow<'notifications'>): AppNotification {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    text: row.body,
    workerId: row.worker_id,
    companyId: row.company_id,
    target: row.target,
    createdAt: row.created_at,
    readAt: row.read_at
  };
}

export function notificationToRow(n: AppNotification): TableInsert<'notifications'> {
  return {
    id: n.id,
    worker_id: n.workerId,
    company_id: n.companyId,
    kind: n.kind,
    title: n.title,
    body: n.text,
    target: n.target,
    created_at: n.createdAt,
    read_at: n.readAt
  };
}

// ---- boost payments ----

export function boostPaymentFromRow(r: TableRow<'boost_payments'>): BoostPayment {
  return {
    id: r.id,
    jobId: r.job_id,
    companyId: r.company_id,
    plan: r.plan,
    method: r.method,
    amountCents: r.amount_cents,
    status: r.status,
    pixCode: r.pix_code,
    ...(r.pix_qr_base64 ? { pixQrBase64: r.pix_qr_base64 } : {}),
    cardLast4: r.card_last4,
    createdAt: r.created_at,
    expiresAt: r.expires_at,
    confirmedAt: r.confirmed_at,
    boostEndsAt: r.boost_ends_at
  };
}

export function boostPaymentToRow(p: BoostPayment): TableInsert<'boost_payments'> {
  return {
    id: p.id,
    job_id: p.jobId,
    company_id: p.companyId,
    plan: p.plan,
    method: p.method,
    amount_cents: p.amountCents,
    status: p.status,
    pix_code: p.pixCode,
    card_last4: p.cardLast4,
    created_at: p.createdAt,
    expires_at: p.expiresAt,
    confirmed_at: p.confirmedAt,
    boost_ends_at: p.boostEndsAt
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
  applicationEvents: TableRow<'application_events'>[];
  /** The logged-in worker's saved jobs, in the order they were saved. */
  savedJobs: Pick<TableRow<'saved_jobs'>, 'job_id'>[];
  /** In the order each list shows them. */
  reviews: ReviewRow[];
  workerPosts: TableRow<'worker_posts'>[];
  notifications: TableRow<'notifications'>[];
  boostPayments: TableRow<'boost_payments'>[];
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
    applications: rows.applications.map((row) => applicationFromRow(row, rows.applicationEvents)),
    savedJobIds: rows.savedJobs.map((s) => s.job_id),
    deletedJobIds: rows.jobs
      .filter((j) => j.deleted_at !== null)
      .sort((a, b) => (a.deleted_at ?? '').localeCompare(b.deleted_at ?? ''))
      .map((j) => j.id),
    workerPosts: rows.workerPosts.map(postFromRow),
    notifications: rows.notifications.map(notificationFromRow),
    boostPayments: rows.boostPayments.map(boostPaymentFromRow)
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
    application_events: db.applications.flatMap(applicationEventsToRows),
    saved_jobs: db.savedJobIds.map((job_id): TableInsert<'saved_jobs'> => ({ worker_id: savedBy, job_id })),
    reviews: [
      ...Object.values(db.companies).flatMap(companyReviewsToRows),
      ...Object.values(db.workers).flatMap(workerReviewsToRows)
    ],
    worker_posts: db.workerPosts.map(postToRow),
    notifications: db.notifications.map(notificationToRow),
    boost_payments: db.boostPayments.map(boostPaymentToRow)
  };
}
