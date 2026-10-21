// U45: "loading — wait". While something the person started is on its way (entering with Google, checking a CPF,
// creating the account…) the whole app is locked: no tap, no key, no back button reaches it, so nothing can be done
// twice or half-way. Two looks (components/BusyOverlay.tsx):
//   * with a message: a card over the dimmed screen, with a spinner — the Google sign-in, which leaves the app for
//     a while (the Google window) and then takes a few seconds to open the account;
//   * without one: an invisible layer — a button that already shows its own spinner.
// A lock never lasts forever: each one ends by itself after `maxMs` (the screens show their own error or result).
// The router asks `isBusy()` before following the phone's back button (services/router.ts).

export interface BusyView {
  /** Shown on the card; none = only the invisible layer. */
  message?: string;
  /** A smaller line under the message. */
  detail?: string;
  /** A way out while waiting on someone else (the Google window): the button's label and what it does. */
  cancel?: { label: string; onCancel: () => void };
}

export interface BusyHandle {
  /** Changes what the card says (e.g. the Google window closed, now entering the account). */
  update(view: BusyView): void;
  /** Unlocks (idempotent). */
  end(): void;
}

interface Lock {
  id: number;
  view: BusyView;
  timer: ReturnType<typeof setTimeout>;
}

/** How long a lock lasts at most, unless the caller says otherwise. */
const DEFAULT_MAX_MS = 30_000;

let locks: Lock[] = [];
let nextId = 1;
let snapshot: BusyView | null = null;
const listeners = new Set<() => void>();

function publish(): void {
  const top = locks[locks.length - 1];
  // The newest lock speaks; one with a message wins over invisible ones started after it.
  const shown = [...locks].reverse().find((l) => l.view.message) ?? top;
  snapshot = shown ? { ...shown.view } : null;
  listeners.forEach((fn) => fn());
}

/** Locks the app until the returned handle's `end()` (or `maxMs`). */
export function startBusy(view: BusyView = {}, { maxMs = DEFAULT_MAX_MS }: { maxMs?: number } = {}): BusyHandle {
  const id = nextId++;
  const end = () => {
    const lock = locks.find((l) => l.id === id);
    if (!lock) return;
    clearTimeout(lock.timer);
    locks = locks.filter((l) => l.id !== id);
    publish();
  };
  locks = [...locks, { id, view, timer: setTimeout(end, maxMs) }];
  publish();
  return {
    update(next) {
      const lock = locks.find((l) => l.id === id);
      if (!lock) return;
      lock.view = next;
      publish();
    },
    end
  };
}

/** Whether anything is loading right now (read synchronously: a second tap in the same instant sees it). */
export function isBusy(): boolean {
  return locks.length > 0;
}

/** What the lock shows (`null` = unlocked), for useSyncExternalStore. */
export function getBusy(): BusyView | null {
  return snapshot;
}

export function subscribeBusy(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Tests: unlocks everything. */
export function resetBusy(): void {
  locks.forEach((l) => clearTimeout(l.timer));
  locks = [];
  publish();
}
