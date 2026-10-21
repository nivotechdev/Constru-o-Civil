import { BackBar } from '../../components/BackBar';
import { showToast } from '../../services/toast';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { FieldError } from '../../components/FieldError';
import { JobNotFound } from '../../components/NotFound';
import { ScreenLoading } from '../../components/QueryView';
import { PageSkeleton } from '../../components/Skeleton';
import { useAction } from '../../hooks/useAction';
import { useQuery } from '../../hooks/useQuery';
import { useDb } from '../../hooks/useStore';
import { submitApplication } from '../../services/applications';
import { loadJob } from '../../services/jobs';
import type { ScreenProps } from '../../types/screen';
import { goBack, navigate } from '../../services/router';
import { applicationFor, companyOf, currentWorker, getJob, jobState, unavailableText } from '../../services/selectors';
import { formatPay } from '../../utils/format';
import { jobTitle } from '../../services/catalog';
import { workerPlace } from '../../utils/workerInfo';
import { dateText, totalText } from '../../utils/jobInfo';
import { WorkerAvatar } from '../../components/Avatar';
import { EmptyState } from '../../components/EmptyState';
import { Rating } from '../../components/Rating';

export default function ConfirmApplication({ params }: ScreenProps) {
  const db = useDb();
  const query = useQuery('job:' + params.id, () => loadJob(params.id));
  const submit = useAction(submitApplication, (result) => {
    if (result === 'enviada') navigate('/enviado/' + params.id, { replace: true });
    else {
      showToast('Você já se candidatou a essa vaga.');
      navigate('/vaga/' + params.id, { replace: true });
    }
  });
  if (query.status !== 'ready')
    return (
      <ScreenLoading
        title="Confirmar candidatura"
        onBack={() => goBack('/vaga/' + params.id)}
        query={query}
        skeleton={<PageSkeleton />}
      />
    );
  const job = getJob(db, params.id);
  if (!job) return <JobNotFound />;
  const company = companyOf(db, job);
  const worker = currentWorker(db);
  // Y07: the same check as the job page and the server (a stale link or a job that just filled up).
  const unavailable = unavailableText(jobState(db, job));
  if (unavailable && !applicationFor(db, job.id, worker.id)) {
    return (
      <div className="flex flex-col">
        <BackBar title="Confirmar candidatura" onBack={() => goBack('/vaga/' + job.id)} />
        <EmptyState
          icon="circle-alert"
          title={unavailable.title}
          description={unavailable.text}
          actionLabel="Ver outros bicos"
          onAction={() => navigate('/mural')}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <BackBar title="Confirmar candidatura" onBack={() => goBack('/vaga/' + job.id)} />
      <div className="flex flex-col gap-4 px-4 sm:px-0 py-4">
        <div className="text-xs font-bold tracking-[0.08em] uppercase text-concrete-500">Confira antes de enviar</div>
        <Card padding="md">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-0.5">
              <span className="font-display font-semibold text-xl text-concrete-900">{jobTitle(job)}</span>
              <span className="text-sm text-concrete-700">{company.name}</span>
            </div>
            <div className="flex gap-3">
              <div className="flex-1 bg-concrete-100 rounded-control p-3 flex flex-col gap-0.5">
                <span className="text-xs text-concrete-500">Diária</span>
                <span className="font-mono font-bold text-2xl text-concrete-900">{formatPay(job.pay)}</span>
                {totalText(job) ? <span className="text-xs text-concrete-700">{`Total ${totalText(job)}`}</span> : null}
              </div>
              <div className="flex-1 bg-concrete-100 rounded-control p-3 flex flex-col gap-0.5">
                <span className="text-xs text-concrete-500">Data</span>
                <span className="font-semibold text-concrete-900">{dateText(job)}</span>
              </div>
            </div>
            <div className="flex items-center gap-2.5 pt-4 border-t border-concrete-200">
              <WorkerAvatar worker={worker} size="sm" />
              <div className="flex flex-col">
                <span className="font-semibold text-concrete-900">{worker.name}</span>
                <span className="text-sm text-concrete-500">{workerPlace(worker)}</span>
                <Rating value={worker.rating} count={worker.reviewCount} />
              </div>
            </div>
          </div>
        </Card>
        <span className="text-sm text-concrete-500">
          A empresa vai ver seu perfil, suas especialidades e suas avaliações. O contato por WhatsApp só abre se ela te
          escolher.
        </span>
      </div>
      <div className="px-4 sm:px-0 py-3 flex flex-col gap-2">
        {submit.error ? <FieldError message={submit.error} /> : null}
        <Button
          label="Sim, quero esse bico"
          size="lg"
          fullWidth
          loading={submit.loading}
          onClick={() => void submit.run(job.id)}
        />
        <Button label="Voltar para a vaga" variant="ghost" fullWidth onClick={() => navigate('/vaga/' + job.id)} />
      </div>
    </div>
  );
}
