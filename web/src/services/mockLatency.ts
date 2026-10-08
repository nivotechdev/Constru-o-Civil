/**
 * The mock backend answers after a fixed delay — the same waits the legacy app simulated, during which
 * the buttons show their loading state. With a real backend these waits become the requests themselves.
 */
export function mockLatency(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
