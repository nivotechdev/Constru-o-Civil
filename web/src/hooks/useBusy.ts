// U45: a screen's own loading (a button with its spinner) also locks the app while it lasts — see services/busy.ts.
import { useEffect } from 'react';
import { startBusy } from '../services/busy';

/** Locks the app while `active` is true (the invisible layer: the screen shows its own spinner). */
export function useBusyWhile(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const lock = startBusy();
    return lock.end;
  }, [active]);
}
