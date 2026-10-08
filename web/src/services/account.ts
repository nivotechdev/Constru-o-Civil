// The logged-in account's privacy operations (LGPD). Simulated like the rest of the mock backend.
import { mockLatency } from './mockLatency';

/** Sends a copy of the account's data to its e-mail. */
export async function exportMyData(): Promise<void> {
  await mockLatency(900);
}
