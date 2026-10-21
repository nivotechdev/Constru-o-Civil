// F13: "Convidar para uma vaga" from a worker's profile — the company's open jobs, each with "Convidar",
// "Convidado" or "Já se candidatou".
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { Sheet } from '../../components/Modal';
import { QueryView } from '../../components/QueryView';
import { ListSkeleton } from '../../components/Skeleton';
import { useAction } from '../../hooks/useAction';
import { useQuery } from '../../hooks/useQuery';
import { useDb } from '../../hooks/useStore';
import { loadHistory } from '../../services/applications';
import { jobTitle } from '../../services/catalog';
import { inviteFor, inviteWorker, loadInvites } from '../../services/invites';
import { navigate } from '../../services/router';
import { allJobs, applicationFor, currentCompanyId, jobState } from '../../services/selectors';
import { showToast } from '../../services/toast';
import type { Worker } from '../../types/models';
import { dateText } from '../../utils/jobInfo';
import { FieldError } from '../../components/FieldError';

export function InviteSheet({ worker, open, onClose }: { worker: Worker; open: boolean; onClose: () => void }) {
  const db = useDb();
  const jobs = useQuery(open ? 'history' : null, loadHistory);
  useQuery(open ? 'invites-w:' + worker.id : null, () => loadInvites({ workerId: worker.id }));
  const invite = useAction(inviteWorker, () => showToast(`Convite enviado para ${worker.name.split(' ')[0]}`));
  const mine = allJobs(db).filter((j) => j.companyId === currentCompanyId() && jobState(db, j) === 'aberta');

  return (
    <Sheet open={open} title={`Convidar ${worker.name.split(' ')[0]}`} onClose={onClose}>
      <QueryView query={jobs} skeleton={<ListSkeleton />}>
        {() =>
          mine.length === 0 ? (
            <EmptyState
              icon="briefcase"
              title="Nenhuma vaga aberta"
              description="Publique uma vaga para convidar quem você encontrou."
              actionLabel="Publicar vaga"
              onAction={() => navigate('/criar-vaga')}
            />
          ) : (
            <div className="flex flex-col divide-y divide-concrete-200">
              {mine.map((job) => {
                const applied = applicationFor(db, job.id, worker.id);
                const invited = inviteFor(db, job.id, worker.id);
                return (
                  <div key={job.id} className="flex items-center gap-3 py-3">
                    <div className="flex-1 min-w-0 flex flex-col">
                      <span className="font-semibold text-concrete-900 truncate">{jobTitle(job)}</span>
                      <span className="text-sm text-concrete-500 truncate">{dateText(job)}</span>
                    </div>
                    {applied ? (
                      <span className="text-sm text-concrete-500">Já se candidatou</span>
                    ) : invited ? (
                      <span className="text-sm text-concrete-500">
                        {invited.status === 'pendente'
                          ? 'Convidado'
                          : invited.status === 'aceito'
                            ? 'Aceitou'
                            : 'Recusou'}
                      </span>
                    ) : (
                      <Button
                        label="Convidar"
                        size="sm"
                        loading={invite.loading}
                        onClick={() => void invite.run(job.id, worker.id)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )
        }
      </QueryView>
      {invite.error ? <FieldError message={invite.error} /> : null}
    </Sheet>
  );
}
