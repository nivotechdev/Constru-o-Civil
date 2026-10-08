// Reads go through services too. Each screen asks for what it shows with a key ("feed", "job:BC-4821"…)
// and a loader (e.g. jobs.loadFeed). With the real backend the loader fetches the rows and puts them in
// the store; the mock store already has them, so the loader only waits — and can fail like a request.
// A key loads once per session (later visits open straight away); a failed one can be retried.
import { errorMessage, isOfflineError } from './errors';

export type QueryStatus = 'loading' | 'ready' | 'error';

export interface QueryState {
  status: QueryStatus;
  /** Set when `status` is "error". */
  error: string | null;
  offline: boolean;
}

const READY: QueryState = { status: 'ready', error: null, offline: false };
const LOADING: QueryState = { status: 'loading', error: null, offline: false };

let states = new Map<string, QueryState>();
const inFlight = new Map<string, Promise<void>>();
const listeners = new Set<() => void>();

function set(key: string, state: QueryState): void {
  states = new Map(states).set(key, state);
  listeners.forEach((fn) => fn());
}

export function subscribeQueries(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** The key's state; a key nobody asked for yet reads as loading. */
export function getQuery(key: string): QueryState {
  return states.get(key) ?? LOADING;
}

/** Loads `key` unless it is already loaded or loading. `force` reloads it (pull to refresh, retry). */
export function runQuery(key: string, loader: () => Promise<void>, force = false): Promise<void> {
  const current = states.get(key);
  if (!force && current?.status === 'ready') return Promise.resolve();
  const pending = inFlight.get(key);
  if (pending) return pending;
  if (current?.status !== 'loading') set(key, LOADING);
  const run = loader()
    .then(() => set(key, READY))
    .catch((e: unknown) => set(key, { status: 'error', error: errorMessage(e), offline: isOfflineError(e) }))
    .finally(() => inFlight.delete(key));
  inFlight.set(key, run);
  return run;
}

/** Forgets every loaded key (after signing out, the next account loads its own data). */
export function clearQueries(): void {
  states = new Map();
  inFlight.clear();
  listeners.forEach((fn) => fn());
}
