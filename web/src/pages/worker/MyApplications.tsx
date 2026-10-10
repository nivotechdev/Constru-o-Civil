import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { Icon } from '../../components/icons/Icon';
import { JobTile, TileGrid } from '../../components/JobTile';
import { QueryView } from '../../components/QueryView';
import { TileGridSkeleton } from '../../components/Skeleton';
import { useQuery } from '../../hooks/useQuery';
import { useDb } from '../../hooks/useStore';
import { loadMyApplications } from '../../services/applications';
import { navigate } from '../../services/router';
import { applicationsForWorker, companyOf, currentWorker, getJob, savedJobs } from '../../services/selectors';
import type { Application } from '../../types/models';
import { ContactButton } from '../../components/ContactButton';
import { contactOpen } from '../../services/applicationMachine';
import { isInProgress, needsWorker, statusInfo } from '../../utils/applicationStatus';

export default function MyApplications() {
  const db = useDb();
  const query = useQuery('my-applications', loadMyApplications);
  const worker = currentWorker(db);
  const apps = applicationsForWorker(db, worker.id);
  const needs = apps.filter((a) => needsWorker(a, getJob(db, a.jobId)));
  const inProgress = apps.filter((a) => isInProgress(a) && !needsWorker(a, getJob(db, a.jobId)));
  const closed = apps.filter((a) => !isInProgress(a));
  const savedCount = savedJobs(db).length;

  function appCard(app: Application, muted: boolean) {
    const job = getJob(db, app.jobId);
    if (!job) return null;
    const company = companyOf(db, job);
    const info = statusInfo(app);
    return (
      <JobTile
        key={app.id}
        job={job}
        company={company}
        muted={muted}
        onClick={() => navigate(info.to)}
        badge={{ label: info.label, icon: info.icon, tone: muted ? 'neutral' : info.tone }}
        // Picked for the job: the WhatsApp chat with the company is open.
        corner={contactOpen(app.status) ? <ContactButton applicationId={app.id} round /> : null}
      />
    );
  }

  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-20 flex items-center justify-between min-h-14 px-4 sm:px-0 bg-white border-b border-concrete-200 lg:static lg:bg-transparent lg:border-0 lg:pb-2">
        <h1 className="font-display font-semibold text-xl lg:text-[1.75rem] text-concrete-900">Minhas candidaturas</h1>
        {query.status === 'ready' ? (
          <span className="text-sm text-concrete-500">
            {apps.length === 1 ? '1 no total' : `${apps.length} no total`}
          </span>
        ) : null}
      </div>
      <div className="flex flex-col gap-3 px-4 sm:px-0 py-4">
        <Card padding="sm" onClick={() => navigate('/vagas-salvas')}>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-brand-50 shrink-0">
              <Icon name="bookmark" size={20} color="var(--brand)" />
            </span>
            <div className="flex-1 min-w-0 flex flex-col">
              <span className="font-semibold text-concrete-900">Vagas salvas</span>
              <span className="text-sm text-concrete-500">
                {savedCount === 0
                  ? 'Nenhum bico guardado'
                  : savedCount === 1
                    ? '1 bico guardado'
                    : `${savedCount} bicos guardados`}
              </span>
            </div>
            <Icon name="chevron-right" size={20} color="var(--gray-400)" />
          </div>
        </Card>

        <QueryView query={query} skeleton={<TileGridSkeleton count={4} />}>
          {() =>
            apps.length === 0 ? (
              <EmptyState
                icon="file-check"
                title="Você ainda não se candidatou"
                description="Escolha um bico no mural e toque em quero esse bico. Fica tudo registrado aqui."
                actionLabel="Ver o mural"
                onAction={() => navigate('/mural')}
              />
            ) : (
              <div className="flex flex-col gap-8 pt-2">
                {needs.length ? (
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-2 text-xs font-bold tracking-[0.08em] uppercase text-brand-600">
                      <Icon name="bell" size={14} color="var(--text-brand)" />
                      Precisa de você
                    </div>
                    <TileGrid>{needs.map((a) => appCard(a, false))}</TileGrid>
                  </div>
                ) : null}
                {inProgress.length ? (
                  <div className="flex flex-col gap-4">
                    <div className="text-xs font-bold tracking-[0.08em] uppercase text-concrete-500">Em andamento</div>
                    <TileGrid>{inProgress.map((a) => appCard(a, false))}</TileGrid>
                  </div>
                ) : null}
                {closed.length ? (
                  <div className="flex flex-col gap-4">
                    <div className="text-xs font-bold tracking-[0.08em] uppercase text-concrete-500">Encerradas</div>
                    <TileGrid>{closed.map((a) => appCard(a, true))}</TileGrid>
                  </div>
                ) : null}
              </div>
            )
          }
        </QueryView>
      </div>
    </div>
  );
}
