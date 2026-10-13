import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { getQuery, runQuery, subscribeQueries, type QueryState } from '../services/queries';

export interface Query extends QueryState {
  /** Loads again ("Tentar de novo"). */
  retry: () => void;
}

/**
 * Loads what a screen shows through its service (see services/queries.ts) and tracks loading/error.
 * `key` names the data; `null` skips loading (e.g. no id yet). The loader runs again only when the key
 * changes, so pass a stable function (a service function, or one built from the key).
 */
export function useQuery(key: string | null, loader: () => Promise<void>): Query {
  const state = useSyncExternalStore(subscribeQueries, () => (key ? getQuery(key) : READY_STATE));
  useEffect(() => {
    if (key) void runQuery(key, loader);
    // The loader is tied to the key: a new key means a new loader.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const retry = useCallback(() => {
    if (key) void runQuery(key, loader, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return { ...state, retry };
}

const READY_STATE: QueryState = { status: 'ready', error: null, offline: false };
