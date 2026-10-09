import { useCallback, useSyncExternalStore } from 'react';
import { getDb, getRole, getSession, getUI, setUI, subscribe, type UIDefaults, type UIPatch } from '../services/store';
import type { Database, Role, Session } from '../types/models';

/** The mock database snapshot; re-renders only when data changes. */
export function useDb(): Database {
  return useSyncExternalStore(subscribe, getDb);
}

/** Who is logged in (`null` = nobody). */
export function useSession(): Session | null {
  return useSyncExternalStore(subscribe, getSession);
}

/** Which side of the marketplace is logged in. */
export function useRole(): Role {
  return useSyncExternalStore(subscribe, getRole);
}

/**
 * A screen's UI state bag (form values, open sheets, wizard step…), kept in the store so it
 * survives navigation exactly like the legacy app's `getUI(key, defaults)`. Re-renders only when
 * this key changes.
 */
export function useUI<T extends object>(key: string, defaults: UIDefaults<T>): [T, (patch: UIPatch<T>) => void] {
  const ui = useSyncExternalStore(subscribe, () => getUI(key, defaults));
  const set = useCallback((patch: UIPatch<T>) => setUI<T>(key, patch), [key]);
  return [ui, set];
}
