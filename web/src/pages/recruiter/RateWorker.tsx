import { BackBar } from '../../components/BackBar';
import { ScreenLoading } from '../../components/QueryView';
import { ReviewForm, ReviewUnavailable } from '../../components/ReviewForm';
import { PageSkeleton } from '../../components/Skeleton';
import { useAction } from '../../hooks/useAction';
import { useQuery } from '../../hooks/useQuery';
import { useDb } from '../../hooks/useStore';
import { loadHistory } from '../../services/applications';
import { jobTitle } from '../../services/catalog';
import { MAX_COMMENT, reviewableApplication, submitReview, WORKER_TAGS } from '../../services/reviews';
import { goBack, navigate } from '../../services/router';
import { showToast } from '../../services/toast';
import type { ScreenProps } from '../../types/screen';
import { dateText } from '../../utils/jobInfo';

/** The company reviews the worker of a concluded diária (mirror of the worker's "Avaliar a diária"). */
export default function RateWorker({ params }: ScreenProps) {
  const db = useDb();
  const query = useQuery('history', loadHistory);
  const send = useAction(submitReview, () => {
    showToast('Avaliação enviada. Obrigado!');
    navigate('/historico');
  });
  const back = () => goBack('/historico');
  if (query.status !== 'ready')
    return <ScreenLoading title="Avaliar trabalhador" onBack={back} query={query} skeleton={<PageSkeleton />} />;

  const job = db.jobs[params.jobId];
  const worker = db.workers[params.workerId];
  const app = reviewableApplication(params.jobId, params.workerId, 'construtora');
  // After sending, the toast and the navigation take over; until then a used-up review isn't offered.
  if (!job || !worker || (!app && !send.loading)) {
    return (
      <div className="flex flex-col">
        <BackBar title="Avaliar trabalhador" onBack={back} />
        <ReviewUnavailable onBack={back} />
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <BackBar title="Avaliar trabalhador" onBack={back} />
      <div className="flex flex-col gap-5 px-4 sm:px-0 py-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-display font-bold text-2xl text-concrete-900">{`Como foi o trabalho de ${worker.name.split(' ')[0]}?`}</h1>
          <span className="text-sm text-concrete-500">{`${worker.name} · ${jobTitle(job)} · ${dateText(job)}`}</span>
        </div>
        <ReviewForm
          question="Sua nota para o trabalhador"
          tags={WORKER_TAGS}
          commentHint="Sua avaliação aparece no perfil do trabalhador."
          maxComment={MAX_COMMENT}
          loading={send.loading}
          error={send.error}
          onSubmit={(v) =>
            app &&
            void send.run({
              applicationId: app.id,
              direction: 'para_trabalhador',
              value: v.value,
              tags: v.tags,
              comment: v.comment
            })
          }
        />
      </div>
    </div>
  );
}
