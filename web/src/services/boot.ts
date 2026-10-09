// How the app is starting (Z11). The demo starts at once. With the real backend:
//   - starting: restoring the saved session (the splash shows, for a few seconds at most);
//   - ready: the app opens (signed in, or not);
//   - offline: there is a saved session but the server can't be reached — the app says so and tries
//     again by itself when the connection comes back, instead of opening the login as if signed out.
import { IS_DEMO } from './mode';

export type BootStatus = 'starting' | 'ready' | 'offline';

let status: BootStatus = IS_DEMO ? 'ready' : 'starting';
const listeners = new Set<() => void>();

export const getBootStatus = (): BootStatus => status;

export function setBootStatus(next: BootStatus): void {
  if (next === status) return;
  status = next;
  listeners.forEach((l) => l());
}

export function subscribeBoot(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Resolves with the promise's value, or rejects with `timeout` after `ms` (the promise keeps running). */
export function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    Promise.resolve(promise).then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e: unknown) => {
        clearTimeout(t);
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    );
  });
}
