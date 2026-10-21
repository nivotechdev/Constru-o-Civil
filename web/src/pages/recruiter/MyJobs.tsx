// "Minhas vagas" (F01) and the history by job (L07): the company's jobs in three tabs — Todas, Abertas, Cheias
// (the closed ones are in Todas) — each as a photo with the title and who has applied. The mural stays in "Início".
import { HISTORY_PAGE } from '../../services/paging';
import { usePaging } from '../../hooks/usePaging';
import { LoadMore } from '../../components/LoadMore';
import { useState } from 'react';
import { EmptyState } from '../../components/EmptyState';
import { IconButton } from '../../components/IconButton';
import { JobTile, TileGrid } from '../../components/JobTile';
import { QueryView } from '../../components/QueryView';
import { ListSkeleton } from '../../components/Skeleton';
import { WorkerAvatar } from '../../components/Avatar';
import { useQuery } from '../../hooks/useQuery';
import { useDb } from '../../hooks/useStore';
import { loadHistory, loadMoreHistory } from '../../services/applications';
import { holdsSlot, isPending } from '../../services/applicationMachine';
import { navigate } from '../../services/router';
import {
  allJobs,
  applicationsForJob,
  currentCompanyId,
  getWorker,
  jobOutcome,
  jobState
} from '../../services/selectors';
import type { Database, Job, Worker } from '../../types/models';
import type { ScreenProps } from '../../types/screen';
import { cx } from '../../utils/cx';

type Tab = 'todas' | 'abertas' | 'cheias';
const TABS: { id: Tab; label: string }[] = [
  { id: 'todas', label: 'Todas' },
  { id: 'abertas', label: 'Abertas' },
  { id: 'cheias', label: 'Cheias' }
];

/** Where a job sits among the tabs (the closed ones only show under Todas). */
function tabOf(db: Database, job: Job): Tab | 'encerradas' {
  const state = jobState(db, job);
  return state === 'aberta' ? 'abertas' : state === 'cheia' ? 'cheias' : 'encerradas';
}

const inTab = (db: Database, job: Job, tab: Tab) => tab === 'todas' || tabOf(db, job) === tab;

export default function MyJobs({ params }: ScreenProps) {
  const db = useDb();
  const query = useQuery('history', loadHistory);
  const paging = usePaging(HISTORY_PAGE, loadMoreHistory);
  const [tab, setTab] = useState<Tab>(
    params.tab === 'cheias' ? 'cheias' : params.tab === 'todas' ? 'todas' : 'abertas'
  );
  const companyId = currentCompanyId();
  const mine = allJobs(db)
    .filter((j) => j.companyId === companyId)
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '') || b.id.localeCompare(a.id));
  const counts: Record<Tab, number> = {
    todas: mine.length,
    abertas: mine.filter((j) => tabOf(db, j) === 'abertas').length,
    cheias: mine.filter((j) => tabOf(db, j) === 'cheias').length
  };
  const list = mine.filter((j) => inTab(db, j, tab));

  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-20 flex items-center justify-between min-h-14 px-4 sm:px-0 bg-concrete-0 border-b border-concrete-200 lg:static lg:bg-transparent lg:border-0 lg:pb-2">
        <h1 className="font-display font-semibold text-xl lg:text-[1.75rem] text-concrete-900">Minhas vagas</h1>
      </div>
      <div className="flex flex-col gap-4 px-4 sm:px-0 py-4">
        <div className="flex bg-concrete-100 rounded-full p-1 gap-1" role="tablist" aria-label="Situação das vagas">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={cx(
                'flex-1 h-10 rounded-full text-sm font-bold transition-colors',
                tab === t.id ? 'bg-concrete-0 text-brand-600 shadow-card' : 'text-concrete-500'
              )}
              onClick={() => setTab(t.id)}
            >
              {`${t.label} · ${counts[t.id]}`}
            </button>
          ))}
        </div>
        <QueryView query={query} skeleton={<ListSkeleton />}>
          {() =>
            list.length === 0 && !(tab === 'todas' && paging.hasMore) ? (
              <EmptyState
                icon="briefcase"
                title={
                  tab === 'abertas'
                    ? 'Nenhuma vaga aberta'
                    : tab === 'cheias'
                      ? 'Nenhuma vaga cheia'
                      : 'Nenhuma vaga publicada'
                }
                description="Publique um bico e acompanhe os candidatos por aqui."
                actionLabel="Publicar vaga"
                onAction={() => navigate('/criar-vaga')}
              />
            ) : (
              <div className="flex flex-col gap-4">
                <TileGrid>
                  {list.map((job) => (
                    <JobCard key={job.id} db={db} job={job} />
                  ))}
                </TileGrid>
                {/* X01: older closed jobs come in pages. */}
                {tab === 'todas' ? <LoadMore paging={paging} /> : null}
              </div>
            )
          }
        </QueryView>
      </div>
    </div>
  );
}

/**
 * The candidates still in the running (waiting for an answer, or picked): up to three photos, and
 * "e mais N" when there are more than three.
 */
function Candidates({ people }: { people: Worker[] }) {
  // Always the same height, so every card in the grid is the same size.
  if (!people.length)
    return <span className="flex min-h-10 items-center text-sm text-concrete-500">Nenhum candidato ainda</span>;
  const shown = people.slice(0, 3);
  const rest = people.length - shown.length;
  return (
    <div className="flex min-h-10 items-center gap-2 min-w-0">
      <span className="sr-only">{`${people.length} ${people.length === 1 ? 'candidato' : 'candidatos'}`}</span>
      <div className="flex shrink-0 items-center" aria-hidden="true">
        {shown.map((w, i) => (
          <WorkerAvatar key={w.id} worker={w} size="xs" ring className={cx(i > 0 && '-ml-2')} />
        ))}
      </div>
      {rest > 0 ? (
        <span className="text-sm font-medium text-concrete-500 whitespace-nowrap" aria-hidden="true">
          {`e mais ${rest}`}
        </span>
      ) : null}
    </div>
  );
}

function JobCard({ db, job }: { db: Database; job: Job }) {
  const closed = jobOutcome(db, job) !== null;
  const people = applicationsForJob(db, job.id)
    .filter((a) => isPending(a.status) || holdsSlot(a.status))
    .flatMap((a) => {
      const worker = getWorker(db, a.workerId);
      return worker ? [worker] : [];
    });
  const open = () => navigate(closed ? '/fechado/' + job.id : '/vaga-gerenciar/' + job.id);
  return (
    <JobTile
      job={job}
      footer={<Candidates people={people} />}
      onClick={open}
      corner={
        closed ? (
          <IconButton
            icon="refresh-cw"
            label="Publicar de novo"
            variant="solid"
            size="sm"
            onClick={() => navigate('/publicar-de-novo/' + job.id)}
          />
        ) : null
      }
    />
  );
}
