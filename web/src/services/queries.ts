// Reads go through services too. Each screen asks for what it shows with a key ("feed", "job:BC-4821"…)
// and a loader (e.g. jobs.loadFeed). With the real backend the loader fetches the rows and puts them in
// the store; the mock store already has them, so the loader only waits — and can fail like a request.
// A key loads once (later visits open straight away; with the real backend they also refresh it in the
// background, see STALE_MS); a failed one can be retried.
import { errorMessage, isOfflineError } from './errors';
import { IS_DEMO } from './mode';

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

/**
 * With the real backend other people change the data too: a screen opened again shows what it has at
 * once and reads it again in the background when it is older than this. (The demo's data only changes
 * here, so it is read once.)
 */
const STALE_MS = 20_000;
const loadedAt = new Map<string, number>();

/** Loads `key` unless it is already loaded or loading. `force` reloads it (pull to refresh, retry). */
export function runQuery(key: string, loader: () => Promise<void>, force = false): Promise<void> {
  const current = states.get(key);
  const pending = inFlight.get(key);
  if (!force && current?.status === 'ready') {
    if (!IS_DEMO && !pending && Date.now() - (loadedAt.get(key) ?? 0) > STALE_MS) {
      // Quietly: the screen keeps what it shows; a failure leaves it as it was.
      const refresh = loader()
        .then(() => {
          loadedAt.set(key, Date.now());
        })
        .catch(() => undefined)
        .finally(() => inFlight.delete(key));
      inFlight.set(key, refresh);
    }
    return Promise.resolve();
  }
  if (pending) return pending;
  if (current?.status !== 'loading') set(key, LOADING);
  const run = loader()
    .then(() => {
      loadedAt.set(key, Date.now());
      set(key, READY);
    })
    .catch((e: unknown) => set(key, { status: 'error', error: errorMessage(e), offline: isOfflineError(e) }))
    .finally(() => inFlight.delete(key));
  inFlight.set(key, run);
  return run;
}

/** Forgets every loaded key (after signing out, the next account loads its own data). */
export function clearQueries(): void {
  states = new Map();
  inFlight.clear();
  loadedAt.clear();
  listeners.forEach((fn) => fn());
}
