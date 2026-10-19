// "Minhas vagas" (F01) and the history by job (L07): the company's jobs in tabs — Abertas, Cheias,
// Encerradas — each with its situation, the new candidates and the next step. The mural stays in "Início".
import { HISTORY_PAGE } from '../../services/paging';
import { usePaging } from '../../hooks/usePaging';
import { LoadMore } from '../../components/LoadMore';
import { useState } from 'react';
import { IconButton } from '../../components/IconButton';
import { JobTile, TileGrid } from '../../components/JobTile';
import { EmptyState } from '../../components/EmptyState';
import { QueryView } from '../../components/QueryView';
import { ListSkeleton } from '../../components/Skeleton';
import { WorkerAvatar } from '../../components/Avatar';
import { useQuery } from '../../hooks/useQuery';
import { useDb } from '../../hooks/useStore';
import { loadHistory, loadMoreHistory } from '../../services/applications';
import { navigate } from '../../services/router';
import {
  allJobs,
  applicationsForJob,
  approvedCount,
  currentCompanyId,
  getWorker,
  jobOutcome,
  jobState
} from '../../services/selectors';
import type { Database, Job } from '../../types/models';
import type { StatusBadge } from '../../types/ui';
import type { ScreenProps } from '../../types/screen';
import { cx } from '../../utils/cx';

type Tab = 'abertas' | 'cheias' | 'encerradas';
const TABS: { id: Tab; label: string }[] = [
  { id: 'abertas', label: 'Abertas' },
  { id: 'cheias', label: 'Cheias' },
  { id: 'encerradas', label: 'Encerradas' }
];

function tabOf(db: Database, job: Job): Tab {
  const state = jobState(db, job);
  return state === 'aberta' ? 'abertas' : state === 'cheia' ? 'cheias' : 'encerradas';
}

export default function MyJobs({ params }: ScreenProps) {
  const db = useDb();
  const query = useQuery('history', loadHistory);
  const paging = usePaging(HISTORY_PAGE, loadMoreHistory);
  const [tab, setTab] = useState<Tab>(params.tab === 'encerradas' || params.tab === 'cheias' ? params.tab : 'abertas');
  const companyId = currentCompanyId();
  const mine = allJobs(db)
    .filter((j) => j.companyId === companyId)
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '') || b.id.localeCompare(a.id));
  const counts = { abertas: 0, cheias: 0, encerradas: 0 };
  for (const j of mine) counts[tabOf(db, j)]++;
  const list = mine.filter((j) => tabOf(db, j) === tab);

  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-20 flex items-center justify-between min-h-14 px-4 sm:px-0 bg-white border-b border-concrete-200 lg:static lg:bg-transparent lg:border-0 lg:pb-2">
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
                tab === t.id ? 'bg-white text-brand-600 shadow-card' : 'text-concrete-500'
              )}
              onClick={() => setTab(t.id)}
            >
              {`${t.label} · ${counts[t.id]}`}
            </button>
          ))}
        </div>
        <QueryView query={query} skeleton={<ListSkeleton />}>
          {() =>
            list.length === 0 && !(tab === 'encerradas' && paging.hasMore) ? (
              <EmptyState
                icon="hard-hat"
                title={
                  tab === 'abertas'
                    ? 'Nenhuma vaga aberta'
                    : tab === 'cheias'
                      ? 'Nenhuma vaga cheia'
                      : 'Nenhuma vaga encerrada'
                }
                description={
                  tab === 'encerradas'
                    ? 'Quando um bico sair do mural, o resumo dele fica aqui.'
                    : 'Publique um bico e acompanhe os candidatos por aqui.'
                }
                actionLabel={tab === 'encerradas' ? undefined : 'Publicar vaga'}
                onAction={tab === 'encerradas' ? undefined : () => navigate('/criar-vaga')}
              />
            ) : (
              <div className="flex flex-col gap-4">
                <TileGrid>
                  {list.map((job) => (
                    <JobCard key={job.id} db={db} job={job} />
                  ))}
                </TileGrid>
                {/* X01: older closed jobs come in pages. */}
                {tab === 'encerradas' ? <LoadMore paging={paging} /> : null}
              </div>
            )
          }
        </QueryView>
      </div>
    </div>
  );
}

function JobCard({ db, job }: { db: Database; job: Job }) {
  const apps = applicationsForJob(db, job.id);
  const fresh = apps.filter((a) => a.status === 'enviada').length;
  const waiting = apps.filter((a) => a.status === 'enviada' || a.status === 'em_analise').length;
  const team = apps
    .filter((a) => ['pre_selecionado', 'contratado', 'concluida'].includes(a.status))
    .map((a) => ({ app: a, worker: getWorker(db, a.workerId) }))
    .filter((t) => t.worker);
  const toConfirm = team.filter((t) => t.app.status === 'pre_selecionado').length;
  const toReview = team.filter((t) => t.app.status === 'concluida' && !t.app.companyReviewed).length;
  const outcome = jobOutcome(db, job);
  const approved = approvedCount(db, job.id);
  const slots = job.slots || 1;
  const closed = outcome !== null;
  // The main status on the photo, then what is left to do (the same pills as the rest of the app).
  const status: StatusBadge =
    outcome !== null
      ? { label: outcome, tone: outcome === 'Concluída' ? 'success' : 'neutral', icon: 'history' }
      : {
          label: `${approved} de ${slots} ${slots === 1 ? 'vaga preenchida' : 'vagas preenchidas'}`,
          tone: approved >= slots ? 'success' : 'brand',
          icon: 'users'
        };
  const todo: StatusBadge[] = [
    fresh
      ? { label: `${fresh} ${fresh === 1 ? 'candidato novo' : 'candidatos novos'}`, tone: 'accent', icon: 'bell' }
      : null,
    !fresh && waiting && !closed ? { label: `${waiting} esperando resposta`, tone: 'neutral', icon: 'clock' } : null,
    toConfirm
      ? {
          label: `Falta confirmar ${toConfirm === 1 ? '1 contratação' : `${toConfirm} contratações`}`,
          tone: 'warning',
          icon: 'user-check'
        }
      : null,
    toReview
      ? { label: `Falta avaliar ${toReview === 1 ? '1 pessoa' : `${toReview} pessoas`}`, tone: 'warning', icon: 'star' }
      : null
  ].filter((b): b is StatusBadge => b !== null);
  // The team's photos sit on the price row, like the candidates' circles on the other lists.
  const people = team.length ? (
    <div className="flex items-center">
      {team.slice(0, 3).map(({ app, worker }, i) => (
        <span key={app.id} className={i ? '-ml-2' : undefined}>
          <WorkerAvatar worker={worker!} size="sm" />
        </span>
      ))}
      {team.length > 3 ? (
        <span className="ml-1 text-xs font-bold text-concrete-500">{`+${team.length - 3}`}</span>
      ) : null}
    </div>
  ) : null;
  const open = () => navigate(closed ? '/fechado/' + job.id : '/vaga-gerenciar/' + job.id);
  return (
    <JobTile
      job={job}
      badge={status}
      extraBadges={todo}
      people={people}
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
