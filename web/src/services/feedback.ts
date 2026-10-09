// Small actions started from many places (a tile's save flag…) whose only feedback is a toast. The
// service call itself lives in its module; this only adds the message.
import { errorMessage } from './errors';
import { toggleSavedJob } from './jobs';
import { showToast } from './toast';

/** Saves or un-saves a job; says what happened, or why it didn't. */
export function toggleSaved(jobId: string): void {
  toggleSavedJob(jobId)
    .then((saved) => showToast(saved ? 'Vaga salva' : 'Vaga tirada das salvas'))
    .catch((e: unknown) => showToast(errorMessage(e), { tone: 'error' }));
}
