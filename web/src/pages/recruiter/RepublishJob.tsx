// "Publicar de novo" (F03): a new job from a closed (or past) one — the same trade, address, pay, people,
// requirements, description and photos, with the dates left blank to choose again.
import { JobNotFound } from '../../components/NotFound';
import { ScreenLoading } from '../../components/QueryView';
import { PageSkeleton } from '../../components/Skeleton';
import { useQuery } from '../../hooks/useQuery';
import { useDb } from '../../hooks/useStore';
import { loadJobCandidates } from '../../services/applications';
import { goBack } from '../../services/router';
import { currentCompanyId, getJob } from '../../services/selectors';
import type { ScreenProps } from '../../types/screen';
import { JobFormScreen } from './CreateJob';
import { formFromJob } from './jobForm';

export default function RepublishJob({ params }: ScreenProps) {
  const db = useDb();
  const query = useQuery('candidates:' + params.id, () => loadJobCandidates(params.id));
  if (query.status !== 'ready')
    return (
      <ScreenLoading
        title="Publicar de novo"
        onBack={() => goBack('/historico')}
        query={query}
        skeleton={<PageSkeleton />}
      />
    );
  const job = getJob(db, params.id);
  if (!job || job.companyId !== currentCompanyId()) return <JobNotFound />;
  const form = { ...formFromJob(job), startDate: '', endDate: '', urgente: false };
  return <JobFormScreen template={form} templateId={job.id} />;
}
