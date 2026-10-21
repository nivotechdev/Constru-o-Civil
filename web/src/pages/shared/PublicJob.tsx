// F09: the page a shared job link opens (/v/:slug), without signing in. Someone signed in goes straight to
// the job; anyone else sees the summary and "Entrar para me candidatar" (the login comes back to the job).
// L10: the link carries the job's random slug. A link from before (/v/BC-12) only opens after signing in —
// the sequential ids would let anyone list every job.
import { useEffect, useState } from 'react';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { Icon } from '../../components/icons/Icon';
import { Logo } from '../../components/Logo';
import { Rating } from '../../components/Rating';
import { PageSkeleton } from '../../components/Skeleton';
import { useSession } from '../../hooks/useStore';
import { jobTitle } from '../../services/catalog';
import { errorMessage } from '../../services/errors';
import { homeFor, RETURN_TO_KEY, type ReturnToUI } from '../../services/guards';
import { loadPublicJob, type PublicJob as PublicJobCard } from '../../services/jobs';
import { IS_DEMO } from '../../services/mode';
import { navigate } from '../../services/router';
import { setUI } from '../../services/store';
import type { ScreenProps } from '../../types/screen';
import { formatPay } from '../../utils/format';
import { dateText, hoursText, paymentText, placeText } from '../../utils/jobInfo';
import { isLegacyJobLink } from '../../utils/share';

type State =
  { status: 'loading' } | { status: 'ready'; card: PublicJobCard | null } | { status: 'error'; message: string };

export default function PublicJob({ params }: ScreenProps) {
  const session = useSession();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const key = params.id;
  // The demo's jobs have no slug: their link carries the id and opens like any other.
  const legacy = !IS_DEMO && isLegacyJobLink(key);

  useEffect(() => {
    if (legacy) {
      if (session) navigate('/vaga/' + key.toUpperCase(), { replace: true });
      return;
    }
    let alive = true;
    loadPublicJob(key).then(
      (card) => {
        if (!alive) return;
        if (card && session) navigate('/vaga/' + card.job.id, { replace: true });
        else setState({ status: 'ready', card });
      },
      (e: unknown) => alive && setState({ status: 'error', message: errorMessage(e) })
    );
    return () => {
      alive = false;
    };
  }, [session, key, legacy, attempt]);

  /** Sign in (or up) and come back to the job. */
  const enter = (path: string, jobId?: string) => {
    if (jobId) setUI<ReturnToUI>(RETURN_TO_KEY, { path: '/vaga/' + jobId });
    navigate(path);
  };
  const elsewhere = () => (session ? navigate(homeFor(session)) : enter('/login'));
  const card = state.status === 'ready' ? state.card : null;

  return (
    <div className="min-h-screen bg-concrete-50">
      <header className="flex items-center justify-between min-h-14 px-4 bg-concrete-0 border-b border-concrete-200">
        <Logo compact />
        {session ? null : <Button label="Entrar" variant="ghost" size="sm" onClick={() => enter('/login')} />}
      </header>
      <div className="max-w-app mx-auto flex flex-col gap-4 px-4 py-5">
        {legacy && !session ? (
          <EmptyState
            icon="log-in"
            title={`Entre para ver a vaga ${key.toUpperCase()}`}
            description="Esse link é antigo e só abre para quem tem conta. Depois de entrar, a vaga aparece."
            actionLabel="Entrar"
            onAction={() => enter('/login', key.toUpperCase())}
          />
        ) : state.status === 'loading' ? (
          <PageSkeleton />
        ) : state.status === 'error' ? (
          <EmptyState
            icon="wifi-off"
            title="Não deu para abrir a vaga"
            description={state.message}
            actionLabel="Tentar de novo"
            onAction={() => {
              setState({ status: 'loading' });
              setAttempt((n) => n + 1);
            }}
          />
        ) : !card ? (
          <EmptyState
            icon="search-x"
            title="Essa vaga não existe mais"
            description="A empresa pode ter removido. Entre para ver outros bicos perto de você."
            actionLabel="Ver bicos"
            onAction={elsewhere}
          />
        ) : (
          <JobSummary
            card={card}
            onApply={() => enter('/login', card.job.id)}
            onSignUp={() => enter('/escolha-perfil', card.job.id)}
          />
        )}
      </div>
    </div>
  );
}

function JobSummary({ card, onApply, onSignUp }: { card: PublicJobCard; onApply: () => void; onSignUp: () => void }) {
  const { job, company, open } = card;
  return (
    <>
      <Card padding="md">
        <div className="flex flex-col gap-3">
          {!open || job.urgent ? (
            <div className="flex flex-wrap gap-2">
              {!open ? <Badge label="Essa vaga não recebe mais candidatos" tone="neutral" icon="circle-x" /> : null}
              {job.urgent && open ? <Badge label="Urgente" tone="danger" icon="zap" /> : null}
            </div>
          ) : null}
          <h1 className="font-display font-bold text-2xl text-concrete-900">{jobTitle(job)}</h1>
          <span className="text-xs text-concrete-500">Vaga {job.id}</span>
          <span className="font-mono font-bold text-2xl text-concrete-900">
            {formatPay(job.pay)}
            {job.pay ? <span className="font-sans font-normal text-base text-concrete-500"> por diária</span> : null}
          </span>
          <div className="flex flex-col gap-2 text-sm text-concrete-700">
            <span className="flex items-center gap-2">
              <Icon name="map-pin" size={16} color="var(--text-subtle)" />
              {placeText(job)}
            </span>
            <span className="flex items-center gap-2">
              <Icon name="calendar-days" size={16} color="var(--text-subtle)" />
              {dateText(job)}
            </span>
            <span className="flex items-center gap-2">
              <Icon name="clock" size={16} color="var(--text-subtle)" />
              {hoursText(job)}
            </span>
            <span className="flex items-center gap-2">
              <Icon name="hand-coins" size={16} color="var(--text-subtle)" />
              {paymentText(job)}
            </span>
          </div>
        </div>
      </Card>
      <Card padding="md">
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0 flex flex-col">
            <span className="font-semibold text-concrete-900 truncate">{company.name}</span>
            <Rating value={company.rating} count={company.reviewCount} />
          </div>
          {company.verified ? <Badge label="Verificada" tone="success" icon="shield-check" /> : null}
        </div>
      </Card>
      {job.description ? (
        <Card padding="md">
          <p className="text-concrete-700 whitespace-pre-line">{job.description}</p>
        </Card>
      ) : null}
      {open ? (
        <div className="flex flex-col gap-2">
          <Button label="Entrar para me candidatar" size="lg" fullWidth onClick={onApply} />
          <Button label="Criar minha conta" variant="secondary" fullWidth onClick={onSignUp} />
          <span className="text-xs text-center text-concrete-500">
            O endereço exato e o contato aparecem só para quem a empresa aprovar.
          </span>
        </div>
      ) : (
        <Button label="Ver outros bicos" size="lg" fullWidth onClick={onApply} />
      )}
    </>
  );
}
