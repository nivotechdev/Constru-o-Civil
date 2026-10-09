import { useCallback, useSyncExternalStore } from 'react';
import { errorMessage } from '../services/errors';
import { getPaging, setPaging, subscribePaging, type Paging } from '../services/paging';

/** A paged list's state and its "Carregar mais" (X01). `loadMore` runs the next page's service call. */
export function usePaging(key: string, loadMore: () => Promise<void>): Paging & { more: () => void } {
  const paging = useSyncExternalStore(subscribePaging, () => getPaging(key));
  const more = useCallback(() => {
    if (getPaging(key).loadingMore) return;
    setPaging(key, { loadingMore: true, error: null });
    loadMore()
      .then(() => setPaging(key, { loadingMore: false }))
      .catch((e: unknown) => setPaging(key, { loadingMore: false, error: errorMessage(e) }));
    // The loader belongs to the key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return { ...paging, more };
}
