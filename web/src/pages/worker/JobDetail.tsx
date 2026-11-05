// U78: the job's page, redone — the photo framed under the header (U81: as it was before U78), the company and the
// facts in clean cards, then "Sobre o bico", "O que levar" and the map. The price and the one action stay at hand:
// a frosted bar on the phone, a sticky card on the computer. Texts and flows are the same as before (U58).
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
  myAddress,
  myAddressKnown,
  unavailableText
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
  const title = jobTitle(job);
  const free = role === 'trabalhador' && !application && !unavailable;
  const people = job.slots ?? 1;

  // Built fresh for each placement: the phone's bottom bar and the desktop summary card.
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
              className="rounded-xl"
              onClick={() => setUi({ confirmCancel: true })}
            />
          ) : (
            <Button
              label="Ver minhas candidaturas"
              size="lg"
              fullWidth
              variant="secondary"
              className="rounded-xl"
              onClick={() => navigate('/minhas-candidaturas')}
            />
          )
        ) : unavailable ? (
          <Button
            label="Ver outros bicos"
            size="lg"
            fullWidth
            variant="secondary"
            className="rounded-xl"
            onClick={() => navigate('/mural')}
          />
        ) : (
          <Button
            label="Quero esse bico"
            size="lg"
            fullWidth
            className="rounded-xl shadow-[0_6px_16px_-6px_rgb(var(--c-brand-500)/0.55)]"
            onClick={() => navigate('/confirmar/' + job.id)}
          />
        )}
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

      <div className="flex flex-col px-4 py-4 sm:px-6 lg:px-0 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-12">
        <div className="flex flex-col min-w-0">
          {/* U81: the photo framed, with rounded corners, under the header — as it was before U78. */}
          <PhotoCarousel job={job} className="h-72 sm:h-80 lg:h-[26rem] rounded-2xl overflow-hidden" />

          <div className="flex flex-col gap-6 pt-5 pb-8 lg:pt-8 lg:pb-4">
            <header className="flex flex-col gap-2.5">
              {job.urgent || people > 1 ? (
                <div className="flex flex-wrap gap-2">
                  {job.urgent ? <Chip icon="zap" label="Urgente" tone="warning" /> : null}
                  {people > 1 ? <Chip icon="users" label={`Precisa de ${people} pessoas`} /> : null}
                </div>
              ) : null}
              <h1 className="font-display font-bold text-[1.75rem] sm:text-[2rem] leading-[1.15] tracking-[-0.01em] text-concrete-900 text-balance">
                {title}
              </h1>
              <p className="flex items-center gap-1.5 text-concrete-600">
                <Icon name="map-pin" size={18} color="var(--text-subtle)" />
                <span className="min-w-0">{placeText(job)}</span>
              </p>
            </header>

            {invite && invite.status === 'pendente' && !application && !unavailable ? (
              <Card padding="md" className="border-brand-200 rounded-2xl">
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

            {unavailable && role === 'trabalhador' ? (
              <div
                role="status"
                className="flex items-start gap-3 p-4 rounded-2xl bg-warning-50 border border-warning-100"
              >
                <Icon name="circle-alert" size={20} color="var(--amber-500)" />
                <div className="flex flex-col gap-0.5">
                  <span className="font-semibold text-concrete-900">{unavailable.title}</span>
                  <span className="text-sm text-concrete-700">{unavailable.text}</span>
                </div>
              </div>
            ) : null}

            <button
              type="button"
              className="group flex items-center gap-3.5 p-3.5 text-left rounded-2xl bg-concrete-0 border border-concrete-200 transition-[border-color,box-shadow] duration-150 hover:border-concrete-300 hover:shadow-raised outline-none focus-visible:ring-4 focus-visible:ring-brand-100"
              onClick={() => navigate('/construtora/' + company.id)}
            >
              <span className={cx('w-12 h-12 shrink-0', AVATAR_FRAME)}>
                <CompanyAvatar company={company} className="w-full h-full" />
              </span>
              <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                <span className="font-semibold text-concrete-900 line-clamp-2 break-words">
                  {company.name}
                  {company.verified ? (
                    <span className="inline-flex align-[-0.2em] ml-1.5" title="Empresa verificada">
                      <Icon name="badge-check" size={18} color="var(--text-brand)" />
                      <span className="sr-only">Empresa verificada</span>
                    </span>
                  ) : null}
                </span>
                <Rating value={company.rating} count={company.reviewCount} />
              </span>
              {/* On a phone the name needs the room: the arrow alone says it opens (the words stay for the reader). */}
              <span className="shrink-0 inline-flex items-center justify-center gap-0.5 w-9 h-9 rounded-full bg-concrete-100 text-concrete-700 group-hover:bg-concrete-200 sm:w-auto sm:h-auto sm:bg-transparent sm:text-sm sm:font-semibold sm:text-brand-600 sm:group-hover:bg-transparent">
                <span className="sr-only sm:not-sr-only">Ver perfil</span>
                <Icon name="chevron-right" size={18} />
              </span>
            </button>

            <ul className="flex flex-col rounded-2xl bg-concrete-0 border border-concrete-200 divide-y divide-concrete-200/70">
              <Fact
                icon="wallet"
                main={total == null ? 'Valor a combinar' : `${formatBRL(total)} no total`}
                sub={job.pay == null ? undefined : `${durationText(job)} de ${formatBRL(job.pay)}`}
              />
              <Fact icon="calendar" main={whenText(job)} sub={days ? daysSub(days) : undefined} />
              {placeType ? <Fact icon="house" main={placeType} sub="Tipo do local" /> : null}
              <Fact icon="hand-coins" main={paymentText(job)} sub="Combinado direto com a empresa" />
            </ul>

            {free ? (
              <p className="flex items-center gap-2 -mt-2 px-1 text-sm text-concrete-600 lg:hidden">
                <Icon name="shield-check" size={18} color="var(--green-500)" />
                Você não paga nada para se candidatar
              </p>
            ) : null}

            {job.description ? (
              <Section title="Sobre o bico">
                <p className="text-concrete-700 text-[1.0625rem] leading-relaxed whitespace-pre-line">
                  {job.description}
                </p>
              </Section>
            ) : null}

            {/* W04: nothing to bring, no empty section. */}
            {job.requirements.length ? (
              <Section title="O que levar">
                <ul className="flex flex-col gap-3">
                  {job.requirements.map((r) => (
                    <li key={r} className="flex gap-3 items-start text-concrete-700">
                      <span className="mt-0.5 shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-full bg-brand-50 text-brand-600">
                        <Icon name="check" size={16} />
                      </span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </Section>
            ) : null}

            {/* U53/U57/U76: the map — the job's place and the worker's saved address, with the road between them. */}
            <Section title="Onde vai ser">
              <JobMap
                jobId={job.id}
                job={{ lat: job.address.lat, lon: job.address.lon }}
                place={exact ? fullAddressText(job) : placeText(job)}
                home={role === 'trabalhador' ? myAddress(db) : null}
                askHome={role === 'trabalhador' && myAddressKnown(db)}
              />
            </Section>
          </div>
        </div>

        <aside className="hidden lg:block lg:sticky lg:top-28">
          <div className="flex flex-col gap-5 p-6 rounded-3xl bg-concrete-0 border border-concrete-200 shadow-float">
            <Price job={job} total={total} large />
            <div className="flex items-start gap-3 py-4 border-y border-concrete-200 text-sm">
              <Icon name="calendar" size={20} color="var(--text-subtle)" />
              <span className="flex flex-col gap-0.5 min-w-0">
                <span className="font-semibold text-concrete-900">{whenText(job)}</span>
                <span className="text-concrete-600">{placeText(job)}</span>
              </span>
            </div>
            <div className="flex flex-col gap-2">{actions()}</div>
            {free ? (
              <span className="flex items-center justify-center gap-1.5 text-xs text-concrete-500">
                <Icon name="shield-check" size={16} color="var(--green-500)" />
                Você não paga nada para se candidatar
              </span>
            ) : null}
          </div>
        </aside>
      </div>

      {/* The phone's bottom bar: the price and the one action; once applied, the action alone. */}
      <div className="sticky bottom-0 z-20 px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] bg-concrete-0/90 backdrop-blur-xl border-t border-concrete-200/80 shadow-[0_-8px_24px_-12px_rgba(16,24,40,0.18)] sm:px-6 lg:hidden">
        {role !== 'trabalhador' ? (
          <Price job={job} total={total} />
        ) : application || unavailable ? (
          <div className="flex flex-col gap-1.5">{actions()}</div>
        ) : (
          <div className="flex items-center gap-4">
            <Price job={job} total={total} />
            <div className="flex-1 min-w-0">{actions()}</div>
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

/** A small label over the title ("Urgente", "Precisa de 2 pessoas"). */
function Chip({ icon, label, tone = 'neutral' }: { icon: IconName; label: string; tone?: 'neutral' | 'warning' }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[0.8125rem] font-semibold',
        tone === 'warning' ? 'bg-warning-50 text-warning-600' : 'bg-concrete-100 text-concrete-700'
      )}
    >
      <Icon name={icon} size={14} />
      {label}
    </span>
  );
}

/** One fact of the job: the icon in a soft tile, the fact in bold and a quiet line under it. */
function Fact({ icon, main, sub }: { icon: IconName; main: string; sub?: string }) {
  return (
    <li className="flex items-center gap-4 px-4 py-3.5">
      <span className="shrink-0 inline-flex items-center justify-center w-11 h-11 rounded-xl bg-brand-50 text-brand-600">
        <Icon name={icon} size={22} />
      </span>
      <span className="flex flex-col min-w-0">
        <span className="font-semibold text-concrete-900">{main}</span>
        {sub ? <span className="text-sm text-concrete-600">{sub}</span> : null}
      </span>
    </li>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3.5 pt-6 border-t border-concrete-200">
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
        <span
          className={cx('font-display font-bold tracking-[-0.01em]', large ? 'text-[2rem] leading-none' : 'text-2xl')}
        >
          {formatPay(job.pay)}
        </span>
        {job.pay == null ? null : <span className="text-concrete-600"> / diária</span>}
      </span>
      {total != null && job.diarias > 1 ? (
        <span className={cx('text-sm text-concrete-600 whitespace-nowrap', large ? 'mt-1.5' : '')}>
          <strong className="font-semibold text-concrete-900">{formatBRL(total)}</strong> no total
        </span>
      ) : null}
    </div>
  );
}
