import { isFailureMode } from './demo';
import { serviceError } from './errors';

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * The mock backend answers after a fixed delay, during which the screens show their loading state. Like
 * a real request it can fail: without a connection (`offline`) and while the demo's failure switch is
 * on (`falha_demo`, see services/demo.ts). With a real backend these waits become the requests.
 */
export async function mockLatency(ms: number): Promise<void> {
  await wait(ms);
  if (globalThis.navigator?.onLine === false) throw serviceError('offline');
  if (isFailureMode()) throw serviceError('falha_demo');
}

/** A delay that never fails: for what works without the server too (e.g. signing out on the device). */
export function localLatency(ms: number): Promise<void> {
  return wait(ms);
}
