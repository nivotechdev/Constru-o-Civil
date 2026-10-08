import { BackBar } from '../../components/BackBar';
import { Badge } from '../../components/Badge';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { Icon } from '../../components/icons/Icon';
import { useDb } from '../../hooks/useStore';
import { goBack, navigate } from '../../services/router';
import { allJobs, applicationsForJob, currentCompanyId, getWorker } from '../../services/selectors';
import type { ApplicationStatus } from '../../types/models';
import type { StatusBadge } from '../../types/ui';
import { formatPay } from '../../utils/format';
import { dateText } from '../../utils/jobInfo';

const STATUS: Partial<Record<ApplicationStatus, StatusBadge & { hint: string }>> = {
  concluida: { label: 'Avaliar o trabalhador', tone: 'accent', icon: 'star', hint: 'Avaliar' },
  avaliada: { label: 'Diária concluída', tone: 'success', icon: 'circle-check', hint: 'Ver o bico' },
  contratado: { label: 'Diária concluída', tone: 'success', icon: 'circle-check', hint: 'Ver o bico' }
};

export default function History() {
  const db = useDb();
  const companyId = currentCompanyId();
  const items = allJobs(db)
    .filter((j) => j.companyId === companyId && j.closed)
    .flatMap((job) =>
      applicationsForJob(db, job.id).flatMap((app) => {
        const status = STATUS[app.status];
        const worker = getWorker(db, app.workerId);
        return status && worker ? [{ job, app, worker, status }] : [];
      })
    );

  return (
    <div className="flex flex-col">
      <BackBar title="Bicos fechados" onBack={() => goBack('/empresa')} />
      <div className="flex flex-col gap-3 px-4 sm:px-0 py-4">
        {items.length === 0 ? (
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
              <Card key={app.id} padding="sm" onClick={() => navigate('/vaga-gerenciar/' + job.id)}>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-accent-50 text-accent-600 font-bold text-sm shrink-0">
                      {worker.initials}
                    </span>
                    <div className="flex-1 min-w-0 flex flex-col">
                      <span className="font-semibold text-concrete-900 truncate">{worker.name}</span>
                      <span className="text-sm text-concrete-500 truncate">{`${job.role} · ${dateText(job)}`}</span>
                    </div>
                    <span className="font-mono font-bold text-lg text-concrete-900 shrink-0">{formatPay(job.pay)}</span>
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
        )}
      </div>
    </div>
  );
}
