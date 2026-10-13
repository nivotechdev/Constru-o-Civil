// L01 / L22: after approving or refusing a candidate, the toast offers "Desfazer" for a few seconds.
// Undoing an approval or refusal takes back the notice if the worker hasn't seen it yet (otherwise
// they hear that the candidacy went back to review).
import { undoApproval, undoReject } from '../../services/applications';
import { errorMessage } from '../../services/errors';
import { getDb } from '../../services/store';
import { jobState } from '../../services/selectors';
import { showToast } from '../../services/toast';

const UNDO_MS = 7000;
const firstName = (name: string) => name.split(' ')[0];
const failed = (e: unknown) => showToast(errorMessage(e), { tone: 'error' });

export function toastApproved(jobId: string, worker: { id: string; name: string }): void {
  const db = getDb();
  const job = db.jobs[jobId];
  const full = job && jobState(db, job) === 'cheia';
  showToast(
    full
      ? `${firstName(worker.name)} aprovado. Todas as vagas foram preenchidas.`
      : `${firstName(worker.name)} aprovado. O WhatsApp está liberado.`,
    {
      duration: UNDO_MS,
      action: {
        label: 'Desfazer',
        onClick: () =>
          undoApproval(jobId, worker.id)
            .then(() => showToast('Aprovação desfeita'))
            .catch(failed)
      }
    }
  );
}

export function toastRejected(jobId: string, worker: { id: string; name: string }): void {
  showToast(`${firstName(worker.name)} recusado`, {
    duration: UNDO_MS,
    action: {
      label: 'Desfazer',
      onClick: () =>
        undoReject(jobId, worker.id)
          .then(() => showToast('Recusa desfeita'))
          .catch(failed)
    }
  });
}
