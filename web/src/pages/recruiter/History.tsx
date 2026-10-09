import { BackBar } from '../../components/BackBar';
import { Badge } from '../../components/Badge';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { QueryView } from '../../components/QueryView';
import { ListSkeleton } from '../../components/Skeleton';
import { useQuery } from '../../hooks/useQuery';
import { loadHistory } from '../../services/applications';
import { Icon } from '../../components/icons/Icon';
import { useDb } from '../../hooks/useStore';
import { goBack, navigate } from '../../services/router';
import { allJobs, applicationsForJob, currentCompanyId, getWorker } from '../../services/selectors';
import type { ApplicationStatus } from '../../types/models';
import { candidateBadge } from '../../utils/applicationStatus';
import { formatPay } from '../../utils/format';
import { jobTitle } from '../../services/catalog';
import { dateText } from '../../utils/jobInfo';
import { WorkerAvatar } from '../../components/Avatar';

// Who worked (or was picked) on the company's closed jobs; pending and turned-down candidates aren't listed.
const LISTED = new Set<ApplicationStatus>([
  'pre_selecionado',
  'contratado',
  'concluida',
  'desistiu',
  'cancelado_pela_construtora',
  'nao_compareceu'
]);

export default function History() {
  const db = useDb();
  const query = useQuery('history', loadHistory);
  const companyId = currentCompanyId();
  const items = allJobs(db)
    .filter((j) => j.companyId === companyId && j.closed)
    .flatMap((job) =>
      applicationsForJob(db, job.id).flatMap((app) => {
        const worker = getWorker(db, app.workerId);
        if (!worker || !LISTED.has(app.status)) return [];
        const toReview = app.status === 'concluida' && !app.companyReviewed;
        const status = {
          ...candidateBadge(app),
          hint: toReview ? 'Avaliar' : 'Ver o bico',
          to: toReview ? `/avaliar-trabalhador/${job.id}/${worker.id}` : '/vaga-gerenciar/' + job.id
        };
        return [{ job, app, worker, status }];
      })
    );

  return (
    <div className="flex flex-col">
      <BackBar title="Bicos fechados" onBack={() => goBack('/empresa')} />
      <div className="flex flex-col gap-3 px-4 sm:px-0 py-4">
        <QueryView query={query} skeleton={<ListSkeleton />}>
          {() =>
            items.length === 0 ? (
              <EmptyState
                icon="file-check"
                title="Nenhuma vaga encerrada"
                description="Quando você fechar ou encerrar um bico, ele fica guardado aqui."
                actionLabel="Ver vagas abertas"
                onAction={() => navigate('/mural')}
              />
            ) : (
              <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-5">
                {items.map(({ job, app, worker, status }) => (
                  <Card key={app.id} padding="sm" onClick={() => navigate(status.to)}>
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-3">
                        <WorkerAvatar worker={worker} size="sm" />
                        <div className="flex-1 min-w-0 flex flex-col">
                          <span className="font-semibold text-concrete-900 truncate">{worker.name}</span>
                          <span className="text-sm text-concrete-500 truncate">{`${jobTitle(job)} · ${dateText(job)}`}</span>
                        </div>
                        <span className="font-mono font-bold text-lg text-concrete-900 shrink-0">
                          {formatPay(job.pay)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 pt-3 border-t border-concrete-200">
                        <Badge label={status.label} tone={status.tone} icon={status.icon} />
                        <span className="inline-flex items-center gap-0.5 text-sm font-semibold text-brand-600">
                          {status.hint}
                          <Icon name="chevron-right" size={16} color="var(--text-brand)" />
                        </span>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )
          }
        </QueryView>
      </div>
    </div>
  );
}
