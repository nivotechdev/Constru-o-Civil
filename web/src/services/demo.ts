// The demo's failure switch: when it is on, every mock service call rejects, so the loading/error
// states of each screen can be seen. Turned on by opening the app with `?falhar=1` in the address
// (before the #), or in Configurações › Demonstração. It is not part of the real app.

let failing = readFromUrl();
const listeners = new Set<() => void>();

function readFromUrl(): boolean {
  try {
    return new URLSearchParams(globalThis.location?.search ?? '').get('falhar') === '1';
  } catch {
    return false;
  }
}

export function isFailureMode(): boolean {
  return failing;
}

export function setFailureMode(on: boolean): void {
  failing = on;
  listeners.forEach((fn) => fn());
}

export function subscribeFailureMode(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
