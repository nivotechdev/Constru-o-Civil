// The app's single source of truth — a typed port of the legacy in-memory store (app/js/store.js).
//
// There is no backend: the "database" is seeded from data/seed.ts and lives only in memory, exactly
// like the legacy app (a reload brings the seed back). Unlike the legacy store, every update here is
// immutable, so React components subscribe to just the slice they read (see hooks/useStore.ts) and
// re-render only when that slice changes.
import * as seed from '../data/seed';
import type { Account, Database, Job, Role, Session, WorkerPost } from '../types/models';

function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}

interface State {
  /** The logged-in account (`null` = nobody); see services/auth.ts. */
  accountId: string | null;
  db: Database;
  /** Screen-local UI state, keyed per screen. It survives navigation, like the legacy `ui` bag. */
  ui: Record<string, object>;
}

// The session survives a reload (the mock data does not: a reload brings the seed back, so only the
// demo accounts can be restored). Storage can be missing or blocked — then the session lasts the tab.
const SESSION_STORAGE_KEY = 'bicos.sessao';

function readStoredAccountId(): string | null {
  try {
    return globalThis.localStorage?.getItem(SESSION_STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

function storeAccountId(id: string | null): void {
  try {
    if (id) globalThis.localStorage?.setItem(SESSION_STORAGE_KEY, id);
    else globalThis.localStorage?.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // Private mode / blocked storage: the session just won't outlive the tab.
  }
}

const storedAccountId = readStoredAccountId();

let state: State = {
  accountId: storedAccountId && storedAccountId in seed.ACCOUNTS ? storedAccountId : null,
  db: {
    accounts: clone(seed.ACCOUNTS),
    companies: clone(seed.COMPANIES),
    workers: clone(seed.WORKERS),
    jobs: clone(seed.JOBS),
    applications: clone(seed.APPLICATIONS),
    savedJobIds: [...seed.SAVED_JOB_IDS],
    deletedJobIds: [],
    workerPosts: clone(seed.WORKER_POSTS),
    notifications: clone(seed.NOTIFICATIONS),
    boostPayments: clone(seed.BOOST_PAYMENTS)
  },
  ui: {}
};

const listeners = new Set<() => void>();
let version = 0;

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function notify(): void {
  version++;
  listeners.forEach((fn) => fn());
}

/** Increments on every store change (see components/LegacyRerender.tsx and layouts/AppShell.tsx). */
export function getVersion(): number {
  return version;
}

export function getDb(): Database {
  return state.db;
}

// ---- session ----

let sessionCache: { account: Account | undefined; session: Session | null } = { account: undefined, session: null };

/** Who is logged in; the same object until the account changes (safe for useSyncExternalStore). */
export function getSession(): Session | null {
  const account = state.accountId ? state.db.accounts[state.accountId] : undefined;
  if (account !== sessionCache.account) {
    sessionCache = {
      account,
      session: account
        ? {
            accountId: account.id,
            email: account.email,
            role: account.role,
            workerId: account.workerId,
            companyId: account.companyId,
            emailConfirmed: Boolean(account.emailConfirmedAt),
            profileComplete: Boolean(account.profileCompletedAt)
          }
        : null
    };
  }
  return sessionCache.session;
}

/** The logged-in side; screens outside the session (splash, login…) read it as "trabalhador". */
export function getRole(): Role {
  return getSession()?.role ?? 'trabalhador';
}

/** Starts (`id`) or ends (`null`) the session. Ending it also forgets every screen's UI state. */
export function setSessionAccount(id: string | null): void {
  storeAccountId(id);
  state = { ...state, accountId: id, ui: id ? state.ui : {} };
  notify();
}

export function upsertAccount(account: Account): void {
  updateDb((db) => ({ ...db, accounts: { ...db.accounts, [account.id]: account } }));
}

export function updateAccount(id: string, patch: Partial<Account>): void {
  const account = state.db.accounts[id];
  if (account) updateDb((db) => ({ ...db, accounts: { ...db.accounts, [id]: { ...account, ...patch } } }));
}

// ---- screen UI state ----

export type UIDefaults<T extends object> = T | (() => T);

/** Returns the UI bag for `key`, creating it from `defaults` the first time (without notifying). */
export function getUI<T extends object>(key: string, defaults: UIDefaults<T>): T {
  if (!(key in state.ui)) {
    state.ui[key] = typeof defaults === 'function' ? (defaults as () => T)() : Object.assign({}, defaults);
  }
  return state.ui[key] as T;
}

export type UIPatch<T> = Partial<T> | ((current: T) => Partial<T>);

export function setUI<T extends object>(key: string, patch: UIPatch<T>): void {
  const cur = (state.ui[key] || {}) as T;
  const next = Object.assign({}, cur, typeof patch === 'function' ? patch(cur) : patch);
  state = { ...state, ui: { ...state.ui, [key]: next } };
  notify();
}

export function resetUI(key: string): void {
  const ui = { ...state.ui };
  delete ui[key];
  state = { ...state, ui };
  notify();
}

// ---- data mutations ----

function updateDb(recipe: (db: Database) => Database): void {
  state = { ...state, db: recipe(state.db) };
  notify();
}

export function createJob(job: Job): string {
  updateDb((db) => ({ ...db, jobs: { ...db.jobs, [job.id]: job } }));
  return job.id;
}

export function deleteJobPost(jobId: string): void {
  updateDb((db) => ({ ...db, deletedJobIds: [...db.deletedJobIds, jobId] }));
}

export function updateJob(jobId: string, patch: Partial<Job>): void {
  const job = state.db.jobs[jobId];
  if (job) updateDb((db) => ({ ...db, jobs: { ...db.jobs, [jobId]: { ...job, ...patch } } }));
}

export function upsertCompany(company: Database['companies'][string]): void {
  updateDb((db) => ({ ...db, companies: { ...db.companies, [company.id]: company } }));
}

export function upsertWorker(worker: Database['workers'][string]): void {
  updateDb((db) => ({ ...db, workers: { ...db.workers, [worker.id]: worker } }));
}

export function updateCompany(companyId: string, patch: Partial<Database['companies'][string]>): void {
  const company = state.db.companies[companyId];
  if (company) updateDb((db) => ({ ...db, companies: { ...db.companies, [companyId]: { ...company, ...patch } } }));
}

export function updateWorker(workerId: string, patch: Partial<Database['workers'][string]>): void {
  const worker = state.db.workers[workerId];
  if (worker) updateDb((db) => ({ ...db, workers: { ...db.workers, [workerId]: { ...worker, ...patch } } }));
}

/**
 * Applies several changes at once (a status change, the candidacies it affects and the notifications
 * it sends): the services build the next snapshot, the store swaps it in and notifies once.
 */
export function transact(recipe: (db: Database) => Database): void {
  updateDb(recipe);
}

export function toggleSavedJob(jobId: string): void {
  updateDb((db) => ({
    ...db,
    savedJobIds: db.savedJobIds.includes(jobId)
      ? db.savedJobIds.filter((id) => id !== jobId)
      : [...db.savedJobIds, jobId]
  }));
}

export function addWorkerPost(
  workerId: string,
  { mediaUrl, mediaType, caption }: Pick<WorkerPost, 'mediaUrl' | 'mediaType' | 'caption'>
): void {
  const post: WorkerPost = {
    id: 'wp' + Date.now(),
    workerId,
    mediaUrl,
    mediaType,
    caption,
    date: new Date().toISOString().slice(0, 10)
  };
  updateDb((db) => ({ ...db, workerPosts: [post, ...db.workerPosts] }));
}

export function deleteWorkerPost(postId: string): void {
  const i = state.db.workerPosts.findIndex((p) => p.id === postId);
  if (i >= 0) updateDb((db) => ({ ...db, workerPosts: db.workerPosts.filter((_, k) => k !== i) }));
}
