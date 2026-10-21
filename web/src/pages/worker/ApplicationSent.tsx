import { BackBar } from '../../components/BackBar';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { JobNotFound } from '../../components/NotFound';
import { ResultIcon } from '../../components/ResultIcon';
import { useDb } from '../../hooks/useStore';
import type { ScreenProps } from '../../types/screen';
import { goBack, navigate } from '../../services/router';
import { applicationFor, companyOf, currentWorker, getJob } from '../../services/selectors';
import { useEffect } from 'react';
import { useQuery } from '../../hooks/useQuery';
import { loadJob } from '../../services/jobs';
import { ScreenLoading } from '../../components/QueryView';
import { PageSkeleton } from '../../components/Skeleton';
import { formatPay } from '../../utils/format';
import { jobTitle } from '../../services/catalog';
import { dateText } from '../../utils/jobInfo';

export default function ApplicationSent({ params }: ScreenProps) {
  const db = useDb();
  // X07: opened straight (reload, old link) the job and the candidacy are read first; without a candidacy
  // this screen doesn't claim one was sent — it goes back to the job.
  const query = useQuery('job:' + params.id, () => loadJob(params.id));
  const job = getJob(db, params.id);
  const sent = job ? applicationFor(db, job.id, currentWorker(db).id) : null;
  const missing = query.status === 'ready' && job && !sent;
  useEffect(() => {
    if (missing) navigate('/vaga/' + params.id, { replace: true });
  }, [missing, params.id]);
  if (query.status !== 'ready' || missing)
    return <ScreenLoading title="Bicos" onBack={() => goBack('/mural')} query={query} skeleton={<PageSkeleton />} />;
  if (!job) return <JobNotFound />;
  const company = companyOf(db, job);

  return (
    <div className="flex flex-col">
      <BackBar title="Bicos" onBack={() => goBack('/mural')} />
      <div className="flex flex-col items-center text-center gap-5 px-6 pt-10 pb-8 lg:max-w-app lg:mx-auto">
        <ResultIcon icon="circle-check" tone="success" />
        <div className="flex flex-col gap-2">
          <h1 className="font-display font-bold text-2xl text-concrete-900">Candidatura enviada</h1>
          <p className="text-base text-concrete-700">
            A empresa recebeu seu perfil. Avisamos quando você avançar de etapa.
          </p>
        </div>
        <Card tone="sunken" padding="md" className="w-full">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="font-semibold text-concrete-900">{jobTitle(job)}</span>
              <span className="text-sm text-concrete-500">{`${company.name} · ${dateText(job)}`}</span>
            </div>
            <span className="font-mono font-bold text-xl text-concrete-900">{formatPay(job.pay)}</span>
          </div>
        </Card>
        <div className="w-full flex flex-col gap-2 pt-2">
          <Button label="Ver minhas candidaturas" fullWidth onClick={() => navigate('/minhas-candidaturas')} />
          <Button label="Voltar ao mural" variant="ghost" fullWidth onClick={() => navigate('/mural')} />
        </div>
      </div>
    </div>
  );
}
