// "Carregar mais" (X01): how far each paged list got. The rows themselves go to the store as always;
// this only keeps, per list key, whether the server has more and where the next page starts.
export interface Paging {
  hasMore: boolean;
  /** Where the next page starts (opaque to the screens). */
  cursor: unknown;
  loadingMore: boolean;
  error: string | null;
}

/** The paged lists besides the mural (X01). */
export const MY_APPLICATIONS_PAGE = 'my-applications';
export const HISTORY_PAGE = 'history';
export const NOTIFICATIONS_PAGE = 'notifications';

const EMPTY: Paging = { hasMore: false, cursor: null, loadingMore: false, error: null };
let pages = new Map<string, Paging>();
const listeners = new Set<() => void>();

export function getPaging(key: string): Paging {
  return pages.get(key) ?? EMPTY;
}

export function setPaging(key: string, patch: Partial<Paging>): void {
  pages = new Map(pages).set(key, { ...getPaging(key), ...patch });
  listeners.forEach((l) => l());
}

export function subscribePaging(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** After signing out: the next account starts from the first pages. */
export function clearPaging(): void {
  pages = new Map();
  listeners.forEach((l) => l());
}
