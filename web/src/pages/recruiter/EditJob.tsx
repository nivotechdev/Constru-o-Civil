import { BackBar } from '../../components/BackBar';
import { EmptyState } from '../../components/EmptyState';
import { ScreenLoading } from '../../components/QueryView';
import { PageSkeleton } from '../../components/Skeleton';
import { useQuery } from '../../hooks/useQuery';
import { useDb } from '../../hooks/useStore';
import { loadJobCandidates } from '../../services/applications';
import { goBack, navigate } from '../../services/router';
import { currentCompanyId, getJob } from '../../services/selectors';
import type { ScreenProps } from '../../types/screen';
import { JobFormScreen } from './CreateJob';

/** "Editar vaga": the publish form filled in with the job. Only the owner, only while the job is open. */
export default function EditJob({ params }: ScreenProps) {
  const db = useDb();
  const query = useQuery('candidates:' + params.id, () => loadJobCandidates(params.id));
  const back = () => goBack('/vaga-gerenciar/' + params.id);
  if (query.status !== 'ready')
    return <ScreenLoading title="Editar vaga" onBack={back} query={query} skeleton={<PageSkeleton />} />;

  const job = getJob(db, params.id);
  const blocked = !job
    ? { title: 'Vaga não encontrada', text: 'Essa vaga não existe mais.' }
    : job.companyId !== currentCompanyId()
      ? { title: 'Essa vaga não é sua', text: 'Só a construtora que publicou o bico pode editar.' }
      : job.closed || db.deletedJobIds.includes(job.id)
        ? { title: 'Essa vaga já foi encerrada', text: 'Vaga encerrada ou excluída não pode mais ser editada.' }
        : null;
  if (!job || blocked) {
    return (
      <div className="flex flex-col">
        <BackBar title="Editar vaga" onBack={back} />
        <EmptyState
          icon="lock"
          title={blocked?.title ?? ''}
          description={blocked?.text}
          actionLabel="Voltar ao início"
          onAction={() => navigate('/mural')}
        />
      </div>
    );
  }
  return <JobFormScreen job={job} />;
}
