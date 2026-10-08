import { BackBar } from '../../components/BackBar';
import { ScreenLoading } from '../../components/QueryView';
import { ReviewForm, ReviewUnavailable } from '../../components/ReviewForm';
import { PageSkeleton } from '../../components/Skeleton';
import { useAction } from '../../hooks/useAction';
import { useQuery } from '../../hooks/useQuery';
import { useDb } from '../../hooks/useStore';
import { loadMyApplications } from '../../services/applications';
import { jobTitle } from '../../services/catalog';
import { COMPANY_TAGS, MAX_COMMENT, reviewableApplication, submitReview } from '../../services/reviews';
import { goBack, navigate } from '../../services/router';
import { companyOf, getJob } from '../../services/selectors';
import { showToast } from '../../services/toast';
import type { ScreenProps } from '../../types/screen';
import { dateText } from '../../utils/jobInfo';

/** The worker reviews the company after a concluded diária. */
export default function RateJob({ params }: ScreenProps) {
  const db = useDb();
  const query = useQuery('my-applications', loadMyApplications);
  const send = useAction(submitReview, () => {
    showToast('Avaliação enviada. Obrigado!');
    navigate('/minhas-candidaturas');
  });
  const back = () => goBack('/minhas-candidaturas');
  if (query.status !== 'ready')
    return <ScreenLoading title="Avaliar a diária" onBack={back} query={query} skeleton={<PageSkeleton />} />;

  const job = getJob(db, params.id);
  const app = reviewableApplication(params.id, null, 'trabalhador');
  if (!job || (!app && !send.loading)) {
    return (
      <div className="flex flex-col">
        <BackBar title="Avaliar a diária" onBack={back} />
        <ReviewUnavailable onBack={back} />
      </div>
    );
  }
  const company = companyOf(db, job);

  return (
    <div className="flex flex-col">
      <BackBar title="Avaliar a diária" onBack={back} />
      <div className="flex flex-col gap-5 px-4 sm:px-0 py-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-display font-bold text-2xl text-concrete-900">Como foi a diária?</h1>
          <span className="text-sm text-concrete-500">{`${jobTitle(job)} · ${company.name} · ${dateText(job)}`}</span>
        </div>
        <ReviewForm
          question="Sua nota para a construtora"
          tags={COMPANY_TAGS}
          commentHint="Sua avaliação aparece no perfil da construtora."
          maxComment={MAX_COMMENT}
          loading={send.loading}
          error={send.error}
          onSubmit={(v) =>
            app &&
            void send.run({
              applicationId: app.id,
              direction: 'para_construtora',
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
