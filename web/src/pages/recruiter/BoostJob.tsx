import { BackBar } from '../../components/BackBar';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Icon, type IconName } from '../../components/icons/Icon';
import { JobNotFound } from '../../components/NotFound';
import { ScreenLoading } from '../../components/QueryView';
import { PageSkeleton } from '../../components/Skeleton';
import { useQuery } from '../../hooks/useQuery';
import { loadJob } from '../../services/jobs';
import { boostBlocker, isBoosted } from '../../services/payments';
import { EmptyState } from '../../components/EmptyState';
import { dateTimeLabel } from '../../utils/dates';
import { useDb, useScreenUI } from '../../hooks/useStore';
import { BOOST_PLANS, jobTitle } from '../../services/catalog';
import type { BoostPlanId } from '../../types/models';
import type { ScreenProps } from '../../types/screen';
import { goBack, navigate } from '../../services/router';
import { placeText } from '../../utils/jobInfo';
import { getJob } from '../../services/selectors';
import { FEATURES } from '../../services/features';
import { BoostUnavailable } from './BoostPayment';

export default function BoostJob({ params }: ScreenProps) {
  const db = useDb();
  const [ui, setUi] = useScreenUI<{ plan: BoostPlanId }>('boost-job:' + params.id, { plan: '24h' });
  const query = useQuery('job:' + params.id, () => loadJob(params.id));
  if (query.status !== 'ready')
    return (
      <ScreenLoading
        title="Impulsionar vaga"
        onBack={() => goBack('/vaga-gerenciar/' + params.id)}
        query={query}
        skeleton={<PageSkeleton />}
      />
    );
  const job = getJob(db, params.id);
  if (!job) return <JobNotFound />;
  if (!FEATURES.payments) return <BoostUnavailable onBack={() => navigate('/vaga-gerenciar/' + job.id)} />;
  const chosen = BOOST_PLANS.find((p) => p.id === ui.plan) ?? BOOST_PLANS[0];
  const blocker = boostBlocker(db, job);
  if (blocker) {
    return (
      <div className="flex flex-col">
        <BackBar title="Impulsionar vaga" onBack={() => goBack('/vaga-gerenciar/' + job.id)} />
        <EmptyState
          icon="rocket"
          title={blocker}
          description={
            job.boostEndsAt && isBoosted(job)
              ? `Ela fica no topo do mural até ${dateTimeLabel(job.boostEndsAt)}.`
              : 'Vagas encerradas, cheias ou vencidas não aparecem no mural.'
          }
          actionLabel="Voltar para a vaga"
          onAction={() => navigate('/vaga-gerenciar/' + job.id)}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <BackBar title="Impulsionar vaga" onBack={() => goBack('/vaga-gerenciar/' + job.id)} />
      <div className="flex flex-col gap-5 px-4 sm:px-0 py-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-display font-bold text-2xl text-concrete-900">Sua vaga no topo do mural</h1>
          <span className="text-sm text-concrete-700">{`${jobTitle(job)} · ${placeText(job)}`}</span>
        </div>
        <Card padding="md">
          <div className="flex flex-col gap-3.5">
            <Fact
              icon="zap"
              color="var(--brand)"
              text="A vaga aparece no bloco de cima do mural, antes das outras da mesma região."
            />
            <Fact
              icon="users"
              color="var(--text-subtle)"
              text="O destaque vale pelo tempo do plano e acaba sozinho, sem renovação."
            />
            <Fact
              icon="triangle-alert"
              color="var(--amber-500)"
              text="Impulsionar não garante candidato: aumenta quantas pessoas veem a vaga."
            />
          </div>
        </Card>
        <div className="flex flex-col gap-2.5">
          <div className="text-xs font-bold tracking-[0.08em] uppercase text-concrete-500">Por quanto tempo</div>
          <div className="flex flex-col gap-2">
            {BOOST_PLANS.map((p) => {
              const active = ui.plan === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setUi({ plan: p.id })}
                  className={`flex items-center gap-3 w-full min-h-[4.5rem] px-4 py-3.5 rounded-card border transition-colors text-left ${active ? 'bg-brand-50 border-brand-500' : 'bg-concrete-0 border-concrete-300 shadow-card'}`}
                >
                  <span
                    className={`shrink-0 w-5 h-5 rounded-full border-2 ${active ? 'border-brand-500 bg-brand-500' : 'border-concrete-400'}`}
                  />
                  <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <span className={`font-semibold ${active ? 'text-brand-600' : 'text-concrete-900'}`}>
                      {p.label}
                    </span>
                    <span className="text-sm text-concrete-500">{p.desc}</span>
                  </span>
                  <span className="font-mono font-bold text-lg text-concrete-900">{p.price}</span>
                </button>
              );
            })}
          </div>
        </div>
        <span className="text-sm text-concrete-500">
          Pagamento único, por PIX ou cartão. Sem renovação automática. O trabalhador nunca paga nada.
        </span>
      </div>
      <div className="px-4 sm:px-0 py-3 flex flex-col gap-2">
        <Button
          label={`Continuar · ${chosen.price}`}
          size="lg"
          fullWidth
          iconRight="arrow-right"
          onClick={() => navigate(`/impulsionar/${job.id}/${chosen.id}`)}
        />
        <Button label="Agora não" variant="ghost" fullWidth onClick={() => navigate('/vaga-gerenciar/' + job.id)} />
      </div>
    </div>
  );
}

function Fact({ icon, text, color }: { icon: IconName; text: string; color: string }) {
  return (
    <div className="flex gap-2.5 items-start">
      <Icon name={icon} size={20} color={color} />
      <span className="text-sm text-concrete-700">{text}</span>
    </div>
  );
}
