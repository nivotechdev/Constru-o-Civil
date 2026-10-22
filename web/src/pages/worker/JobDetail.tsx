import type { ReactNode } from 'react';
import { ApplicationStatusCard } from './ApplicationStatusCard';
import { BackBar } from '../../components/BackBar';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Icon, type IconName } from '../../components/icons/Icon';
import { JobMap } from '../../components/JobMap';
import { Dialog } from '../../components/Modal';
import { NotFound } from '../../components/NotFound';
import { PhotoCarousel } from '../../components/PhotoCarousel';
import { ScreenLoading } from '../../components/QueryView';
import { PageSkeleton } from '../../components/Skeleton';
import { Rating } from '../../components/Rating';
import { useAction } from '../../hooks/useAction';
import { useQuery } from '../../hooks/useQuery';
import { useDb, useRole, useScreenUI } from '../../hooks/useStore';
import { withdrawApplication } from '../../services/applications';
import { loadJob } from '../../services/jobs';
import { showToast } from '../../services/toast';
import type { ScreenProps } from '../../types/screen';
import type { Job } from '../../types/models';
import { goBack, navigate } from '../../services/router';
import {
  applicationFor,
  canSeeExactAddress,
  companyOf,
  currentWorker,
  getJob,
  jobState,
  unavailableText,
  workerHome
} from '../../services/selectors';
import { formatPay } from '../../utils/format';
import { jobTitle } from '../../services/catalog';
import {
  daysListText,
  fullAddressText,
  daysText,
  durationText,
  jobPayTotal,
  paymentText,
  placeText,
  placeTypeText,
  whenText
} from '../../utils/jobInfo';
import { formatBRL } from '../../utils/format';
import { AVATAR_FRAME, CompanyAvatar } from '../../components/Avatar';
import { cx } from '../../utils/cx';
import { shareJob } from '../../utils/share';
import { IconButton } from '../../components/IconButton';
import { answerInvite, inviteFor, loadInvites } from '../../services/invites';
import { FieldError } from '../../components/FieldError';
import { SafetyMenu } from '../../components/SafetyMenu';

/** The days under the date: the list when it says more than the word ("Segunda, quarta e sexta"). */
function daysSub(days: { word: string; list: string }): string {
  return days.list !== days.word ? days.list : days.word;
}

export default function JobDetail({ params }: ScreenProps) {
  const db = useDb();
  const role = useRole();
  const [ui, setUi] = useScreenUI<{ confirmCancel: boolean }>('job-detail:' + params.id, { confirmCancel: false });
  const query = useQuery('job:' + params.id, () => loadJob(params.id));
  // F13: an invitation from the company to this worker.
  useQuery(role === 'trabalhador' ? 'invites:' + params.id : null, () => loadInvites({ jobId: params.id }));
  const answer = useAction(answerInvite, (_r) => undefined);
  const withdraw = useAction(withdrawApplication, () => {
    setUi({ confirmCancel: false });
    showToast('Candidatura cancelada');
    navigate('/minhas-candidaturas');
  });
  if (query.status !== 'ready')
    return (
      <ScreenLoading
        title="Detalhe da vaga"
        onBack={() => goBack('/mural')}
        query={query}
        skeleton={<PageSkeleton />}
      />
    );
  const job = getJob(db, params.id);
  if (!job) return <NotFound message="Vaga não encontrada ou encerrada." />;
  const company = companyOf(db, job);
  const worker = currentWorker(db);
  const application = role === 'trabalhador' ? applicationFor(db, job.id, worker.id) : null;
  const canCancel = application && (application.status === 'enviada' || application.status === 'em_analise');
  const invite = role === 'trabalhador' ? inviteFor(db, job.id, worker.id) : null;
  // Y07: a job that doesn't take candidates says why, with no "Quero esse bico".
  const unavailable = unavailableText(jobState(db, job));
  // U52: the days in a word ("Durante a semana") and one by one ("Segunda, quarta e sexta").
  const days = job.dias || job.weekdays?.length ? { word: daysText(job), list: daysListText(job) } : null;
  const placeType = placeTypeText(job);
  const total = jobPayTotal(job);
  // Z06: the street and number only for the company and the worker it picked or hired.
  const exact = canSeeExactAddress(db, job) && Boolean(job.address.street);

  // Built fresh for each placement: the phone's sticky bottom bar and the desktop summary card.
  const actions = () =>
    role === 'trabalhador' ? (
      <>
        {application ? (
          canCancel ? (
            <Button
              label="Cancelar candidatura"
              size="lg"
              fullWidth
              variant="secondary"
              onClick={() => setUi({ confirmCancel: true })}
            />
          ) : (
            <Button
              label="Ver minhas candidaturas"
              size="lg"
              fullWidth
              variant="secondary"
              onClick={() => navigate('/minhas-candidaturas')}
            />
          )
        ) : unavailable ? (
          <Button label="Ver outros bicos" size="lg" fullWidth variant="secondary" onClick={() => navigate('/mural')} />
        ) : (
          <Button label="Quero esse bico" size="lg" fullWidth onClick={() => navigate('/confirmar/' + job.id)} />
        )}
        {!application && !unavailable ? (
          <span className="text-center text-xs text-concrete-500">Você não paga nada para se candidatar</span>
        ) : null}
      </>
    ) : null;

  return (
    <div className="flex flex-col">
      <BackBar
        title="Detalhe da vaga"
        onBack={() => goBack('/mural')}
        actions={
          <>
            <IconButton
              icon="share-2"
              label="Compartilhar vaga"
              onClick={() => void shareJob(job).catch(() => undefined)}
            />
            {role === 'trabalhador' ? (
              <SafetyMenu
                target="vaga"
                targetId={job.id}
                what="a vaga"
                block={{ id: company.id, name: company.name, onBlocked: () => navigate('/mural', { replace: true }) }}
              />
            ) : null}
          </>
        }
      />
      <div className="flex flex-col gap-4 px-4 sm:px-0 py-4 pb-28 lg:pb-4 lg:grid lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start lg:gap-10">
        <div className="flex flex-col gap-4 lg:gap-6">
          {invite && invite.status === 'pendente' && !application && !unavailable ? (
            <Card padding="md" className="border-brand-200">
              <div className="flex flex-col gap-3">
                <div className="flex gap-2.5 items-start">
                  <Icon name="mail" size={20} color="var(--text-brand)" />
                  <span className="text-concrete-900">
                    <strong>{company.name}</strong> convidou você para essa vaga.
                  </span>
                </div>
                {answer.error ? <FieldError message={answer.error} /> : null}
                <div className="flex gap-2">
                  <Button
                    label="Recusar"
                    variant="secondary"
                    className="flex-1"
                    loading={answer.loading}
                    onClick={() =>
                      void answer
                        .run(job.id, false)
                        .then((ok) => ok && showToast('Convite recusado. Avisamos a empresa.'))
                    }
                  />
                  <Button
                    label="Aceitar convite"
                    className="flex-[1.4]"
                    loading={answer.loading}
                    onClick={() => void answer.run(job.id, true).then((ok) => ok && navigate('/enviado/' + job.id))}
                  />
                </div>
              </div>
            </Card>
          ) : null}
          {application ? <ApplicationStatusCard app={application} /> : null}

          {/* U58: the photo on its own, then plain sections split by thin lines — nothing said twice. */}
          <PhotoCarousel job={job} className="h-72 sm:h-80 lg:h-[26rem] rounded-2xl overflow-hidden" />

          <header className="flex flex-col gap-1">
            <h1 className="font-display font-bold text-[1.625rem] leading-tight text-concrete-900">{jobTitle(job)}</h1>
            <p className="text-concrete-600">{placeText(job)}</p>
          </header>

          {unavailable && role === 'trabalhador' ? (
            <div
              role="status"
              className="flex items-start gap-2.5 p-3.5 rounded-card bg-warning-50 border border-warning-100"
            >
              <Icon name="circle-alert" size={20} color="var(--amber-500)" />
              <div className="flex flex-col gap-0.5">
                <span className="font-semibold text-concrete-900">{unavailable.title}</span>
                <span className="text-sm text-concrete-700">{unavailable.text}</span>
              </div>
            </div>
          ) : null}

          <Divider />
          <button
            type="button"
            className="group flex items-center gap-3 text-left rounded-xl outline-none focus-visible:ring-4 focus-visible:ring-brand-100"
            onClick={() => navigate('/construtora/' + company.id)}
          >
            <span className={cx('w-12 h-12 shrink-0', AVATAR_FRAME)}>
              <CompanyAvatar company={company} className="w-full h-full" />
            </span>
            <span className="flex-1 min-w-0 flex flex-col gap-0.5">
              <span className="font-semibold text-concrete-900 truncate">{company.name}</span>
              <Rating value={company.rating} count={company.reviewCount} />
            </span>
            <span className="shrink-0 inline-flex items-center gap-0.5 text-sm font-semibold text-concrete-700 group-hover:text-concrete-900">
              Ver perfil
              <Icon name="chevron-right" size={18} />
            </span>
          </button>

          <Divider />
          <div className="flex flex-col gap-5">
            <Highlight
              icon="wallet"
              main={total == null ? 'Valor a combinar' : `${formatBRL(total)} no total`}
              sub={job.pay == null ? undefined : `${durationText(job)} de ${formatBRL(job.pay)}`}
            />
            <Highlight icon="calendar" main={whenText(job)} sub={days ? daysSub(days) : undefined} />
            {placeType ? <Highlight icon="house" main={placeType} sub="Tipo do local" /> : null}
            <Highlight icon="hand-coins" main={paymentText(job)} sub="Combinado direto com a empresa" />
          </div>

          {job.description ? (
            <>
              <Divider />
              <Section title="Sobre o bico">
                <p className="text-concrete-700 leading-relaxed whitespace-pre-line">{job.description}</p>
              </Section>
            </>
          ) : null}

          {/* W04: nothing to bring, no empty section. */}
          {job.requirements.length ? (
            <>
              <Divider />
              <Section title="O que levar">
                <ul className="flex flex-col gap-3">
                  {job.requirements.map((r) => (
                    <li key={r} className="flex gap-3 items-start text-concrete-700">
                      <Icon name="check" size={20} color="var(--text-brand)" />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </Section>
            </>
          ) : null}

          <Divider />
          {/* U53/U57: the map — the job's place and the worker's saved address, with the road between them. */}
          <Section title="Onde vai ser">
            <JobMap
              job={{ lat: job.address.lat, lon: job.address.lon }}
              place={exact ? fullAddressText(job) : placeText(job)}
              home={role === 'trabalhador' ? workerHome(db) : null}
              askHome={role === 'trabalhador'}
            />
          </Section>
        </div>

        <aside className="hidden lg:block lg:sticky lg:top-28">
          <div className="flex flex-col gap-5 p-6 bg-concrete-0 rounded-2xl border border-concrete-200 shadow-float">
            <Price job={job} total={total} large />
            {actions()}
          </div>
        </aside>
      </div>

      {/* The phone's bottom bar: the price and the one action; once applied, the action alone. */}
      <div className="sticky bottom-0 px-4 sm:px-0 py-3 bg-concrete-0 border-t border-concrete-200 lg:hidden">
        {role !== 'trabalhador' ? (
          <Price job={job} total={total} />
        ) : application || unavailable ? (
          <div className="flex flex-col gap-1.5">{actions()}</div>
        ) : (
          <div className="flex items-center gap-4">
            <Price job={job} total={total} />
            <div className="flex-1 min-w-0">
              <Button label="Quero esse bico" size="lg" fullWidth onClick={() => navigate('/confirmar/' + job.id)} />
            </div>
          </div>
        )}
      </div>

      <Dialog
        open={ui.confirmCancel}
        tone="danger"
        title="Cancelar essa candidatura?"
        description="Você sai da lista de candidatos dessa vaga. Se quiser, pode se candidatar de novo depois."
        confirmLabel="Cancelar candidatura"
        onConfirm={() => void withdraw.run(job.id)}
        loading={withdraw.loading}
        error={withdraw.error}
        cancelLabel="Voltar"
        onCancel={() => {
          withdraw.reset();
          setUi({ confirmCancel: false });
        }}
      />
    </div>
  );
}

function Divider() {
  return <hr className="border-0 border-t border-concrete-200" />;
}

/** One fact of the job: a line icon, the fact in bold and a quiet line under it. */
function Highlight({ icon, main, sub }: { icon: IconName; main: string; sub?: string }) {
  return (
    <div className="flex items-start gap-4">
      <span className="pt-0.5 shrink-0">
        <Icon name={icon} size={24} color="var(--text-strong)" />
      </span>
      <span className="flex flex-col min-w-0">
        <span className="font-semibold text-concrete-900">{main}</span>
        {sub ? <span className="text-sm text-concrete-600">{sub}</span> : null}
      </span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display font-bold text-xl text-concrete-900">{title}</h2>
      {children}
    </section>
  );
}

/**
 * The price as it reads at a glance: the diária big, and under it what the whole job pays (U52: the total, only inside
 * the job). "A combinar" when the company left it open.
 */
function Price({
  job,
  total,
  large = false
}: {
  job: Pick<Job, 'pay' | 'diarias'>;
  total: number | null;
  large?: boolean;
}) {
  return (
    <div className="flex flex-col min-w-0">
      <span className="whitespace-nowrap text-concrete-900">
        <span className={cx('font-bold', large ? 'text-3xl' : 'text-xl')}>{formatPay(job.pay)}</span>
        {job.pay == null ? null : <span className="text-concrete-600"> / diária</span>}
      </span>
      {total != null && job.diarias > 1 ? (
        <span className="text-sm text-concrete-600 whitespace-nowrap">
          <strong className="font-semibold text-concrete-900">{formatBRL(total)}</strong> no total
        </span>
      ) : null}
    </div>
  );
}
