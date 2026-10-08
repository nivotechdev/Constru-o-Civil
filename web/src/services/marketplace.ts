// The two marketplace actions that go "to the server" and back: publishing a job and sending an
// application. The mock backend answers after the same delay the legacy app simulated, then records
// the change in the store; every other change (approve, close, save, edit…) is applied at once, as
// before. With a real backend these become requests (docs/SUPABASE.md).
import type { Job } from '../types/models';
import { mockLatency } from './mockLatency';
import { currentCompanyId } from './selectors';
import { applyToJob, createJob } from './store';

/** What the publish form sends; the backend fills in the id, the company and where the job is. */
export type JobDraft = Omit<Job, 'id' | 'companyId' | 'location' | 'distance'>;

// Demo ids: "BC-" + a number, like the seed jobs'.
function nextJobId(): string {
  return 'BC-' + (5100 + Math.floor(Math.random() * 800));
}

/** Publishes the recruiter's job; resolves to its id. */
export async function publishJob(draft: JobDraft): Promise<string> {
  await mockLatency(700);
  const id = nextJobId();
  // Demo: every job the logged-in company publishes is in Tatuapé, where it is.
  createJob({ ...draft, id, companyId: currentCompanyId(), location: 'Tatuapé, SP', distance: '0 km' });
  return id;
}

/** Sends the worker's application to the job. */
export async function submitApplication(jobId: string, workerId: string): Promise<void> {
  await mockLatency(600);
  applyToJob(jobId, workerId);
}
