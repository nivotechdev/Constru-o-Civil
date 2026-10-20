import { Card } from '../../components/Card';
import { MY_APPLICATIONS_PAGE } from '../../services/paging';
import { usePaging } from '../../hooks/usePaging';
import { LoadMore } from '../../components/LoadMore';
import { EmptyState } from '../../components/EmptyState';
import { Icon } from '../../components/icons/Icon';
import { cx } from '../../utils/cx';
import { JobTile, TileGrid } from '../../components/JobTile';
import { QueryView } from '../../components/QueryView';
import { TileGridSkeleton } from '../../components/Skeleton';
import { useQuery } from '../../hooks/useQuery';
import { useDb } from '../../hooks/useStore';
import { loadMoreMyApplications, loadMyApplications } from '../../services/applications';
import { navigate } from '../../services/router';
import { applicationsForWorker, companyOf, currentWorker, getJob, savedJobs } from '../../services/selectors';
import type { Application, Job } from '../../types/models';
import { formatBRL } from '../../utils/format';
import { whenText } from '../../utils/jobInfo';
import { ContactButton } from '../../components/ContactButton';
import { contactOpen } from '../../services/applicationMachine';
import { isInProgress, needsWorker, statusInfo } from '../../utils/applicationStatus';

export default function MyApplications() {
  const db = useDb();
  const query = useQuery('my-applications', loadMyApplications);
  const paging = usePaging(MY_APPLICATIONS_PAGE, loadMoreMyApplications);
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
        // U35: the status on the photo (grey once closed) and the job's description under the title.
        badge={{ label: info.label, icon: info.icon, tone: muted ? 'neutral' : info.tone }}
        footer={<AppDetails job={job} muted={muted} />}
        // Picked for the job: the WhatsApp chat with the company is open.
        corner={contactOpen(app.status) ? <ContactButton applicationId={app.id} round /> : null}
      />
    );
  }

  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-20 flex items-center justify-between min-h-14 px-4 sm:px-0 bg-concrete-0 border-b border-concrete-200 lg:static lg:bg-transparent lg:border-0 lg:pb-2">
        <h1 className="font-display font-semibold text-xl lg:text-[1.75rem] text-concrete-900">Minhas candidaturas</h1>
        {query.status === 'ready' && !paging.hasMore ? (
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
                <LoadMore paging={paging} />
              </div>
            )
          }
        </QueryView>
      </div>
    </div>
  );
}

/** U35: the job's description (two lines; when, for an old job without one) and the diária. */
function AppDetails({ job, muted }: { job: Job; muted: boolean }) {
  const text = job.description.trim() || [job.address.neighborhood, whenText(job)].filter(Boolean).join(' · ');
  return (
    <div className="flex flex-col gap-1">
      <p className="line-clamp-2 min-h-[2.7em] break-words text-concrete-500">{text}</p>
      <span className={cx('truncate', muted ? 'text-concrete-500' : 'text-concrete-900')}>
        {job.pay == null ? (
          <span className="font-semibold">A combinar</span>
        ) : (
          <>
            <span className="font-semibold">{formatBRL(job.pay)}</span>
            <span className="text-concrete-500"> por diária</span>
          </>
        )}
      </span>
    </div>
  );
}
