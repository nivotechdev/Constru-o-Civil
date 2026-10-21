// Putting rows read from Supabase into the store. Each read loads a slice (the mural, one job, my
// candidacies…), so these merge that slice into what is already there instead of replacing the whole
// snapshot. Pure functions of a Database (tested in src/__tests__/remoteMerge.test.ts); `apply` swaps
// the result into the store in one change.
import type { Account, Application, Database, HomeAddress, JobStats } from '../../types/models';
import type { JobAddressRow, JobStatsRow, TableRow } from '../../types/supabase';
import {
  accountFromRow,
  addressFromRow,
  applicationFromRow,
  boostPaymentFromRow,
  companyFromRow,
  jobFromReadRow,
  type JobRowRead,
  notificationFromRow,
  postFromRow,
  workerFromRow
} from '../supabaseMappers';
import { transact } from '../store';

/** The columns the app may read (the WhatsApp columns are private: see get_contact). */
export const ACCOUNT_COLUMNS =
  'id, email, role, document, whatsapp, whatsapp_verified_at, email_confirmed_at, profile_completed_at, terms_version, terms_accepted_at, worker_id, company_id, created_at';
export const WORKER_COLUMNS =
  'id, name, initials, city, neighborhood, lat, lon, rating, review_count, jobs_done, novo, verified, facts, photo_url, cover_url, identity_status, bio, experiences, created_at';
/** What anyone may read of a job (Z06): the exact address comes from get_job_addresses. */
export const JOB_COLUMNS =
  'id, company_id, oficio_id, title, pay, neighborhood, city, uf, area_lat, area_lon, date_to_arrange, start_date, end_date, start_time, end_time, diarias, dias, urgent, boost_ends_at, photos, slots, closed, sem_contratacao, description, requirements, payment_method, payment_note, public_slug, created_at, updated_at, deleted_at';
/** U51: the session's own address (RLS: only its own row). */
export const ADDRESS_COLUMNS = 'account_id, cep, street, neighborhood, city, uf, lat, lon, precision, updated_at';
export const COMPANY_COLUMNS =
  'id, name, cnpj, location, rating, review_count, verified, verified_since, verification_status, verified_at, contact_name, since_label, respond_time, paid_count, logo_url, cover_url, about, created_at';

export type AccountRow = TableRow<'accounts'>;
export type WorkerRowRead = Omit<TableRow<'workers'>, 'whatsapp'>;
export type CompanyRowRead = Omit<TableRow<'companies'>, 'whatsapp'>;
export type ReviewRow = TableRow<'reviews'>;

export type Recipe = (db: Database) => Database;

/** Applies several recipes as one store change. */
export function apply(...recipes: Recipe[]): void {
  transact((db) => recipes.reduce((d, r) => r(d), db));
}

/** The session's own WhatsApp lives on its account row (the profile column isn't readable). */
function ownWhatsapp(db: Database, accountId: string | null, profileId: string): string {
  const account = accountId ? db.accounts[accountId] : undefined;
  return account && (account.workerId === profileId || account.companyId === profileId) ? account.whatsapp : '';
}

export const putAccount =
  (row: AccountRow, theme?: Account['theme']): Recipe =>
  (db) => ({
    ...db,
    // U30: the theme comes from account_prefs; re-reading the account row keeps the one already known.
    accounts: {
      ...db.accounts,
      [row.id]: { ...accountFromRow(row), theme: theme ?? db.accounts[row.id]?.theme ?? 'claro' }
    }
  });

/**
 * Worker profiles. `reviews` given: they replace the worker's reviews; left out (a list that doesn't
 * load reviews), the ones already loaded stay.
 */
export const putWorkers =
  (rows: WorkerRowRead[], reviews?: ReviewRow[], accountId: string | null = null): Recipe =>
  (db) => {
    if (!rows.length) return db;
    const workers = { ...db.workers };
    for (const row of rows) {
      const worker = workerFromRow({ ...row, whatsapp: ownWhatsapp(db, accountId, row.id) }, reviews ?? []);
      workers[row.id] = reviews ? worker : { ...worker, reviews: db.workers[row.id]?.reviews ?? [] };
    }
    return { ...db, workers };
  };

/** Company profiles; `reviews` as in putWorkers. */
export const putCompanies =
  (rows: CompanyRowRead[], reviews?: ReviewRow[], accountId: string | null = null): Recipe =>
  (db) => {
    if (!rows.length) return db;
    const companies = { ...db.companies };
    for (const row of rows) {
      const company = companyFromRow({ ...row, whatsapp: ownWhatsapp(db, accountId, row.id) }, reviews ?? []);
      companies[row.id] = reviews ? company : { ...company, reviews: db.companies[row.id]?.reviews ?? [] };
    }
    return { ...db, companies };
  };

const round2 = (n: number) => Math.round(n * 100) / 100;

/** U51: the session's own address (`null`: it has none yet — an account from before the address step). */
export const putAddress =
  (accountId: string, row: TableRow<'addresses'> | HomeAddress | null): Recipe =>
  (db) => {
    const addresses = { ...db.addresses };
    if (row) addresses[accountId] = 'account_id' in row ? addressFromRow(row) : row;
    else delete addresses[accountId];
    return { ...db, addresses };
  };

/**
 * Jobs, as anyone may read them; a deleted one (deleted_at) is kept for its candidates' history and listed
 * as deleted. An exact address already in the store (from get_job_addresses) stays while the job's area is
 * the same — a re-read of the mural doesn't blank the address the person is allowed to see.
 */
export const putJobs =
  (rows: JobRowRead[]): Recipe =>
  (db) => {
    if (!rows.length) return db;
    const jobs = { ...db.jobs };
    const deleted = new Set(db.deletedJobIds);
    for (const row of rows) {
      const fresh = jobFromReadRow(row);
      const old = db.jobs[row.id]?.address;
      // U51: the public point is the exact one moved 100–200 m (no longer rounded): the one known with the exact
      // address tells whether the address is still the same.
      const sameArea =
        old &&
        old.exact !== false &&
        old.neighborhood === row.neighborhood &&
        old.city === row.city &&
        old.uf === row.uf &&
        (old.area
          ? old.area.lat === row.area_lat && old.area.lon === row.area_lon
          : round2(old.lat) === row.area_lat && round2(old.lon) === row.area_lon);
      // The mural (feed_jobs) doesn't bring the payment (L18): keep what the job's own read brought.
      const prev = db.jobs[row.id];
      const payment =
        !('payment_method' in row) && prev?.payment
          ? { payment: prev.payment, ...(prev.paymentNote ? { paymentNote: prev.paymentNote } : {}) }
          : {};
      // L10: a read without the public link's slug keeps the one already known (the share button uses it).
      const slug = !fresh.publicSlug && prev?.publicSlug ? { publicSlug: prev.publicSlug } : {};
      jobs[row.id] = {
        ...(sameArea ? { ...fresh, address: { ...old, area: fresh.address.area } } : fresh),
        ...payment,
        ...slug
      };
      if (row.deleted_at) deleted.add(row.id);
      else deleted.delete(row.id);
    }
    return { ...db, jobs, deletedJobIds: [...deleted] };
  };

/** The exact addresses the session may see (its own jobs; the jobs it was picked or hired for). */
export const putJobAddresses =
  (rows: JobAddressRow[]): Recipe =>
  (db) => {
    if (!rows.length) return db;
    const jobs = { ...db.jobs };
    for (const r of rows) {
      const job = jobs[r.job_id];
      if (!job) continue;
      jobs[r.job_id] = {
        ...job,
        address: {
          cep: r.cep,
          street: r.street,
          number: r.number,
          complement: r.complement,
          neighborhood: r.neighborhood,
          city: r.city,
          uf: r.uf,
          lat: r.lat,
          lon: r.lon,
          exact: true,
          ...(job.address.area ? { area: job.address.area } : {})
        }
      };
    }
    return { ...db, jobs };
  };

/** Forgets a job (it no longer exists or isn't visible). */
export const dropJob =
  (jobId: string): Recipe =>
  (db) => {
    if (!(jobId in db.jobs)) return db;
    const jobs = { ...db.jobs };
    delete jobs[jobId];
    return { ...db, jobs, applications: db.applications.filter((a) => a.jobId !== jobId) };
  };

/**
 * Candidacies with their history. `scope` says which candidacies this read covers (e.g. "of job X"):
 * those not in `rows` were withdrawn or deleted and leave the store.
 */
export const putApplications =
  (
    rows: TableRow<'applications'>[],
    events: TableRow<'application_events'>[],
    scope?: (app: Application) => boolean
  ): Recipe =>
  (db) => {
    const fresh = new Map(rows.map((row) => [row.id, applicationFromRow(row, events)]));
    const kept = db.applications.filter((a) => !fresh.has(a.id) && !(scope && scope(a)));
    return { ...db, applications: [...kept, ...fresh.values()] };
  };

export const dropApplication =
  (jobId: string, workerId: string): Recipe =>
  (db) => ({ ...db, applications: db.applications.filter((a) => !(a.jobId === jobId && a.workerId === workerId)) });

/** The session's notifications, newest first (the whole list is read at once). */
export const putNotifications =
  (rows: TableRow<'notifications'>[]): Recipe =>
  (db) => ({ ...db, notifications: rows.map(notificationFromRow) });

/** Older notifications ("Carregar mais"), after the ones already there. */
export const appendNotifications =
  (rows: TableRow<'notifications'>[]): Recipe =>
  (db) => {
    const have = new Set(db.notifications.map((n) => n.id));
    return {
      ...db,
      notifications: [...db.notifications, ...rows.filter((r) => !have.has(r.id)).map(notificationFromRow)]
    };
  };

/** One new notification (from the realtime channel), unless it is already there. */
export const addNotification =
  (row: TableRow<'notifications'>): Recipe =>
  (db) =>
    db.notifications.some((n) => n.id === row.id)
      ? db
      : {
          ...db,
          notifications: [notificationFromRow(row), ...db.notifications],
          unreadTotal: db.unreadTotal === undefined || row.read_at ? db.unreadTotal : db.unreadTotal + 1
        };

/** A notice changed elsewhere (read on another device: X03). */
export const updateNotification =
  (row: TableRow<'notifications'>): Recipe =>
  (db) => ({
    ...db,
    notifications: db.notifications.map((n) => (n.id === row.id ? notificationFromRow(row) : n))
  });

/** X03: the unread count from the server; `delta` adjusts what is there (after marking one read). */
export const putUnreadTotal =
  (total: number | ((current: number) => number)): Recipe =>
  (db) => ({
    ...db,
    unreadTotal: Math.max(0, typeof total === 'number' ? total : total(db.unreadTotal ?? 0))
  });

export const putSavedJobIds =
  (ids: string[]): Recipe =>
  (db) => ({ ...db, savedJobIds: ids });

/** A worker's portfolio, newest first (replaces what was loaded for that worker). */
export const putPosts =
  (workerId: string, rows: TableRow<'worker_posts'>[]): Recipe =>
  (db) => ({
    ...db,
    workerPosts: [...db.workerPosts.filter((p) => p.workerId !== workerId), ...rows.map(postFromRow)]
  });

export const putPayments =
  (rows: TableRow<'boost_payments'>[]): Recipe =>
  (db) => {
    const fresh = new Map(rows.map((row) => [row.id, boostPaymentFromRow(row)]));
    return {
      ...db,
      boostPayments: [...fresh.values(), ...db.boostPayments.filter((p) => !fresh.has(p.id))].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt)
      )
    };
  };

/** Candidate counts of `jobIds` (a job missing from `rows` has none). */
export const putStats =
  (jobIds: string[], rows: JobStatsRow[]): Recipe =>
  (db) => {
    const stats: Record<string, JobStats> = { ...(db.jobStats ?? {}) };
    for (const id of jobIds) stats[id] = { holding: 0, pending: 0, total: 0 };
    for (const r of rows) stats[r.job_id] = { holding: r.holding, pending: r.pending, total: r.total };
    return { ...db, jobStats: stats };
  };
