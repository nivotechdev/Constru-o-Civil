import type { ReactNode } from 'react';
import { ApplicationStatusCard } from './ApplicationStatusCard';
import { BackBar } from '../../components/BackBar';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Icon, type IconName } from '../../components/icons/Icon';
import { InfoRow } from '../../components/InfoRow';
import { MapLinks } from '../../components/MapLinks';
import { Dialog } from '../../components/Modal';
import { NotFound } from '../../components/NotFound';
import { PhotoCarousel } from '../../components/PhotoCarousel';
import { ScreenLoading } from '../../components/QueryView';
import { PageSkeleton } from '../../components/Skeleton';
import { Rating } from '../../components/Rating';
import { useAction } from '../../hooks/useAction';
import { useQuery } from '../../hooks/useQuery';
import { useDb, useRole, useUI, useScreenUI } from '../../hooks/useStore';
import { withdrawApplication } from '../../services/applications';
import { loadJob } from '../../services/jobs';
import { showToast } from '../../services/toast';
import type { ScreenProps } from '../../types/screen';
import { goBack, navigate } from '../../services/router';
import {
  applicationFor,
  canSeeExactAddress,
  companyOf,
  currentWorker,
  getJob,
  homeDistanceKm,
  jobState,
  myAddress,
  unavailableText
} from '../../services/selectors';
import { formatPay } from '../../utils/format';
import { jobTitle } from '../../services/catalog';
import { FEED_KEY, feedDefaults, feedOrigin, jobDistance, originText, type FeedUI } from './feed/feedUI';
import { formatKm } from '../../utils/geo';
import {
  diasInfo,
  durationText,
  hoursText,
  paymentText,
  placeText,
  streetText,
  totalText,
  whenText
} from '../../utils/jobInfo';
import { AVATAR_FRAME, CompanyAvatar } from '../../components/Avatar';
import { cx } from '../../utils/cx';
import { shareJob } from '../../utils/share';
import { IconButton } from '../../components/IconButton';
import { answerInvite, inviteFor, loadInvites } from '../../services/invites';
import { FieldError } from '../../components/FieldError';
import { SafetyMenu } from '../../components/SafetyMenu';

export default function JobDetail({ params }: ScreenProps) {
  const db = useDb();
  const role = useRole();
  const [ui, setUi] = useScreenUI<{ confirmCancel: boolean }>('job-detail:' + params.id, { confirmCancel: false });
  const [feed] = useUI<FeedUI>(FEED_KEY, () => feedDefaults(db, role));
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
  const dias = diasInfo(job);
  // U51: from the worker's home (their address); an account without one measures from the mural's place, as before.
  const fromHome = role === 'trabalhador' && myAddress(db) ? homeDistanceKm(db, job) : null;
  const distance =
    role !== 'trabalhador'
      ? null
      : fromHome !== null
        ? `A ${formatKm(fromHome)} da sua casa`
        : `${formatKm(jobDistance(job, feedOrigin(feed, db, role)))} ${originText(feed, db, role)}`;
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
          <Card padding="none">
            <div className="relative">
              <PhotoCarousel job={job} className="h-72 sm:h-80 lg:h-[26rem] rounded-t-card" />
              <div className={cx('absolute z-10 left-4 -bottom-6 w-[3.75rem] h-[3.75rem] shadow-raised', AVATAR_FRAME)}>
                <CompanyAvatar company={company} className="w-full h-full" />
              </div>
            </div>
            <div className="flex items-end justify-between gap-3 pt-9 pb-4 px-4">
              <div className="flex flex-col gap-1 min-w-0">
                <span className="font-semibold text-concrete-900 truncate">{company.name}</span>
                <Rating value={company.rating} count={company.reviewCount} />
              </div>
              <Button
                label="Ver perfil"
                variant="secondary"
                size="sm"
                iconLeft="building-2"
                onClick={() => navigate('/construtora/' + company.id)}
              />
            </div>
          </Card>

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
          <div className="flex flex-col gap-1.5">
            <h1 className="font-display font-bold text-2xl text-concrete-900">{jobTitle(job)}</h1>
            {job.description ? <p className="text-sm text-concrete-700 leading-relaxed">{job.description}</p> : null}
          </div>

          <Card tone="brand" padding="md" className="lg:hidden">
            <div className="flex flex-col gap-4">
              <div className="flex items-end justify-between gap-3">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-bold tracking-[0.08em] uppercase text-brand-600">Diária</span>
                  <span className="font-mono font-bold text-4xl text-concrete-900">{formatPay(job.pay)}</span>
                </div>
                {/* X12/W03: the job's own payment form, and the total when it has several diárias. */}
                <span className="text-sm text-concrete-700 text-right max-w-[11rem]">
                  {totalText(job) ? (
                    <>
                      <span className="block font-semibold text-concrete-900">{`Total ${totalText(job)}`}</span>
                      {paymentText(job)}
                    </>
                  ) : (
                    paymentText(job)
                  )}
                </span>
              </div>
              <div className="flex items-center gap-2 pt-4 border-t border-brand-200">
                <Icon name="calendar" size={20} color="var(--text-brand)" />
                <span className="font-display font-semibold text-lg text-concrete-900">{whenText(job)}</span>
              </div>
            </div>
          </Card>

          <Section title="Onde e como">
            <Card padding="md">
              <div className="flex flex-col gap-3.5">
                <InfoRow
                  icon="map-pin"
                  main={exact ? streetText(job) : placeText(job)}
                  sub={
                    exact
                      ? [placeText(job), distance].filter(Boolean).join(' · ')
                      : [distance, 'O endereço completo aparece quando a empresa aprovar você']
                          .filter(Boolean)
                          .join(' · ')
                  }
                />
                {exact ? <MapLinks job={job} /> : null}
                {dias ? <InfoRow icon="calendar-days" main={dias.label} sub={dias.hint} /> : null}
                <InfoRow icon="clock" main={hoursText(job)} sub={durationText(job)} />
                <InfoRow icon="hand-coins" main={paymentText(job)} sub="Combinado direto com a empresa" />
              </div>
            </Card>
          </Section>

          {/* W04: nothing to bring, no empty section. */}
          {job.requirements.length ? (
            <Section title="O que precisa levar">
              <Card padding="md">
                <div className="flex flex-col gap-3">
                  {job.requirements.map((r) => (
                    <div key={r} className="flex gap-2.5 items-center">
                      <Icon name="circle-check" size={20} color="var(--green-500)" />
                      <span className="text-concrete-700">{r}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </Section>
          ) : null}
        </div>

        <aside className="hidden lg:block lg:sticky lg:top-28">
          <div className="flex flex-col gap-5 p-6 bg-concrete-0 rounded-2xl border border-concrete-200 shadow-float">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold tracking-[0.08em] uppercase text-brand-600">Diária</span>
              <div className="flex items-baseline gap-2">
                <span className="font-mono font-bold text-3xl text-concrete-900">{formatPay(job.pay)}</span>
                {job.pay == null ? null : <span className="text-concrete-500">por dia</span>}
              </div>
              {totalText(job) ? <span className="text-sm text-concrete-700">{`Total: ${totalText(job)}`}</span> : null}
            </div>
            <div className="flex flex-col rounded-xl border border-concrete-200 divide-y divide-concrete-200">
              <SummaryRow icon="calendar" label="Quando" value={whenText(job)} />
              {dias ? <SummaryRow icon="calendar-days" label="Dias" value={dias.label} /> : null}
              <SummaryRow icon="clock" label="Duração" value={durationText(job)} />
              <SummaryRow icon="map-pin" label="Onde" value={[placeText(job), distance].filter(Boolean).join(' · ')} />
            </div>
            {actions()}
            <div className="flex items-start gap-2 text-sm text-concrete-500">
              <Icon name="hand-coins" size={18} color="var(--text-subtle)" />
              <span>{`${paymentText(job)}, combinado direto com a empresa.`}</span>
            </div>
          </div>
        </aside>
      </div>

      {role === 'trabalhador' ? (
        <div className="sticky bottom-0 px-4 sm:px-0 py-3 bg-concrete-0 shadow-bar flex flex-col gap-1.5 lg:hidden">
          {actions()}
        </div>
      ) : null}

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

function SummaryRow({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Icon name={icon} size={18} color="var(--text-subtle)" />
      <div className="flex flex-col min-w-0">
        <span className="text-xs font-bold uppercase tracking-[0.06em] text-concrete-500">{label}</span>
        <span className="text-sm font-semibold text-concrete-900 truncate">{value}</span>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs font-bold tracking-[0.08em] uppercase text-concrete-500">{title}</div>
      {children}
    </div>
  );
}
