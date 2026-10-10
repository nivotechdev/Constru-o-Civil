// "Minhas vagas" (F01) and the history by job (L07): the company's jobs in tabs — Abertas, Cheias,
// Encerradas — each with its situation, the new candidates and the next step. The mural stays in "Início".
import { useState } from 'react';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { QueryView } from '../../components/QueryView';
import { ListSkeleton } from '../../components/Skeleton';
import { WorkerAvatar } from '../../components/Avatar';
import { useQuery } from '../../hooks/useQuery';
import { useDb } from '../../hooks/useStore';
import { loadHistory } from '../../services/applications';
import { jobTitle } from '../../services/catalog';
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
import type { ScreenProps } from '../../types/screen';
import { cx } from '../../utils/cx';
import { formatPay } from '../../utils/format';
import { dateText } from '../../utils/jobInfo';

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
        <Button label="Publicar" size="sm" iconLeft="plus" onClick={() => navigate('/criar-vaga')} />
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
            list.length === 0 ? (
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
              <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-5">
                {list.map((job) => (
                  <JobCard key={job.id} db={db} job={job} />
                ))}
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
  const slots = job.slots || 1;
  const closed = outcome !== null;
  const todo = [
    fresh ? `${fresh} ${fresh === 1 ? 'candidato novo' : 'candidatos novos'}` : null,
    !fresh && waiting && !closed ? `${waiting} esperando resposta` : null,
    toConfirm ? `Falta confirmar ${toConfirm === 1 ? '1 contratação' : `${toConfirm} contratações`}` : null,
    toReview ? `Falta avaliar ${toReview === 1 ? '1 pessoa' : `${toReview} pessoas`}` : null
  ].filter(Boolean);
  const open = () => navigate(closed ? '/fechado/' + job.id : '/vaga-gerenciar/' + job.id);

  return (
    <Card padding="sm" onClick={open}>
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0 flex flex-col">
            <span className="font-semibold text-concrete-900 truncate">{jobTitle(job)}</span>
            <span className="text-sm text-concrete-500 truncate">{`${job.id} · ${dateText(job)}`}</span>
          </div>
          <span className="font-mono font-bold text-lg text-concrete-900 shrink-0">{formatPay(job.pay)}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {closed ? (
            <Badge label={outcome} tone={outcome === 'Concluída' ? 'success' : 'neutral'} icon="history" />
          ) : (
            <Badge
              label={`${approvedCount(db, job.id)} de ${slots} ${slots === 1 ? 'vaga preenchida' : 'vagas preenchidas'}`}
              tone={approvedCount(db, job.id) >= slots ? 'success' : 'brand'}
              icon="users"
            />
          )}
          {fresh ? <Badge label={`${fresh} novo${fresh === 1 ? '' : 's'}`} tone="accent" icon="bell" /> : null}
        </div>
        {team.length ? (
          <div className="flex items-center gap-1.5">
            {team.slice(0, 5).map(({ app, worker }) => (
              <WorkerAvatar key={app.id} worker={worker!} size="sm" />
            ))}
            {team.length > 5 ? <span className="text-sm text-concrete-500">{`+${team.length - 5}`}</span> : null}
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-2 pt-3 border-t border-concrete-200">
          <span className="text-sm text-concrete-700 min-w-0 truncate">
            {todo.length ? todo.join(' · ') : closed ? 'Nada pendente' : 'Nenhum candidato ainda'}
          </span>
          {closed ? (
            <Button
              label="Publicar de novo"
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                navigate('/publicar-de-novo/' + job.id);
              }}
            />
          ) : null}
        </div>
      </div>
    </Card>
  );
}
