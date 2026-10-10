import { BackBar } from '../../components/BackBar';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { CandidateRow } from '../../components/CandidateRow';
import { EmptyState } from '../../components/EmptyState';
import { Icon } from '../../components/icons/Icon';
import { InfoRow } from '../../components/InfoRow';
import { Dialog } from '../../components/Modal';
import { JobNotFound } from '../../components/NotFound';
import { PhotoManager } from '../../components/PhotoManager';
import { ScreenLoading } from '../../components/QueryView';
import { PageSkeleton } from '../../components/Skeleton';
import { useAction } from '../../hooks/useAction';
import { useQuery } from '../../hooks/useQuery';
import { approve, confirmHire, loadJobCandidates, reject } from '../../services/applications';
import { contactOpen, holdsSlot, isPending } from '../../services/applicationMachine';
import { candidateBadge } from '../../utils/applicationStatus';
import { errorMessage } from '../../services/errors';
import { closeJob, deleteJob, updateJobPhotos } from '../../services/jobs';
import { showToast } from '../../services/toast';
import { useDb, useScreenUI } from '../../hooks/useStore';
import type { ScreenProps } from '../../types/screen';
import { goBack, navigate } from '../../services/router';
import {
  applicationsForJob,
  approvedCount,
  currentCompanyId,
  getJob,
  jobState,
  pendingCount,
  workerOf,
  type JobState
} from '../../services/selectors';
import type { Database, Job } from '../../types/models';
import type { StatusBadge } from '../../types/ui';
import { formatPay } from '../../utils/format';
import { diasInfo, durationText, hoursText, paymentText, placeText, streetText, whenText } from '../../utils/jobInfo';
import { jobTitle, oficioNome } from '../../services/catalog';
import { workerDistance, workerPlace } from '../../utils/workerInfo';
import { ContactButton } from '../../components/ContactButton';
import { boostBlocker, isBoosted } from '../../services/payments';
import { dateTimeLabel } from '../../utils/dates';
import { jobPhotos } from '../../utils/jobPhotos';
import { FEATURES } from '../../services/features';
import { toastApproved, toastRejected } from './decisionToasts';

export default function JobManage({ params }: ScreenProps) {
  const db = useDb();
  // Y21: the dialogs belong to this job (a dialog opened on one job never shows up on another).
  const [ui, setUi] = useScreenUI<{ confirmClose: boolean; confirmDelete: boolean; hireId: string | null }>(
    'job-manage:' + params.id,
    { confirmClose: false, confirmDelete: false, hireId: null }
  );
  const query = useQuery('candidates:' + params.id, () => loadJobCandidates(params.id));
  const hire = useAction(confirmHire, () => {
    setUi({ hireId: null });
    showToast('Contratação confirmada. Avisamos o trabalhador.');
  });
  const close = useAction(closeJob, () => {
    setUi({ confirmClose: false });
    showToast('Vaga encerrada');
    // Y09: closing shows the summary of the bico (team, total, what is left to do).
    navigate('/fechado/' + params.id, { replace: true });
  });
  const remove = useAction(deleteJob, () => {
    setUi({ confirmDelete: false });
    showToast('Vaga excluída');
    navigate('/empresa', { replace: true });
  });
  if (query.status !== 'ready')
    return <ScreenLoading title="Sua vaga" onBack={() => goBack('/mural')} query={query} skeleton={<PageSkeleton />} />;
  const job = getJob(db, params.id);
  if (!job) return <JobNotFound />;

  if (job.companyId !== currentCompanyId()) {
    return (
      <div className="flex flex-col">
        <BackBar title="Sua vaga" onBack={() => goBack('/mural')} />
        <EmptyState
          icon="lock"
          title="Essa vaga não é sua"
          description="Só a construtora que publicou o bico pode ver os candidatos e a quantidade de vagas."
        />
      </div>
    );
  }

  const applications = applicationsForJob(db, job.id);
  const hireName = ui.hireId ? (db.workers[ui.hireId]?.name ?? 'O trabalhador') : '';
  const slots = job.slots || 1;
  const approved = approvedCount(db, job.id);
  const pending = pendingCount(db, job.id);
  // Y01: open, full, closed, deleted or past — a full job is still editable and closable.
  const state = jobState(db, job);
  const closed = state !== 'aberta';
  const editable = state === 'aberta' || state === 'cheia';
  const closable = editable || state === 'vencida';
  const hasTeam = applications.some((a) => holdsSlot(a.status));
  const status = jobStatus(db, job, state, approved, pending);
  const dias = diasInfo(job);
  const boosted = isBoosted(job);

  // Pay, headcount and actions are built fresh for each placement: in the page flow on phones, and in
  // the sticky side card on tablet/desktop.
  const payCard = (className?: string) => (
    <Card tone="brand" padding="md" className={className}>
      <div className="flex flex-col gap-4">
        <div className="flex items-end justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-bold tracking-[0.08em] uppercase text-brand-600">
              Diária que você ofereceu
            </span>
            <span className="font-mono font-bold text-4xl text-concrete-900">{formatPay(job.pay)}</span>
          </div>
          <span className="text-sm text-concrete-700 text-right">
            Pago no fim
            <br />
            da diária
          </span>
        </div>
        <div className="flex items-center gap-2 pt-4 border-t border-brand-200">
          <Icon name="calendar" size={20} color="var(--text-brand)" />
          <span className="font-display font-semibold text-lg text-concrete-900">{whenText(job)}</span>
        </div>
      </div>
    </Card>
  );
  const slotsCard = (className?: string) => (
    <Card padding="md" className={className}>
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-semibold text-concrete-900">{`${approved} de ${slots} ${slots === 1 ? 'vaga preenchida' : 'vagas preenchidas'}`}</span>
          <span className="font-mono text-sm text-concrete-500">{`${slots} no total`}</span>
        </div>
        <div className="flex gap-1.5">
          {Array.from({ length: slots }).map((_, i) => (
            <span key={i} className={`flex-1 h-2 rounded-full ${i < approved ? 'bg-brand-500' : 'bg-concrete-200'}`} />
          ))}
        </div>
        <span className={`text-sm ${state === 'cheia' ? 'text-success-500' : 'text-concrete-500'}`}>
          {STATE_TEXT[state]}
        </span>
      </div>
    </Card>
  );
  const actions = () => (
    <>
      {editable ? (
        <Button
          label="Editar vaga"
          variant="secondary"
          iconLeft="pencil"
          className="flex-1"
          onClick={() => navigate('/vaga-editar/' + job.id)}
        />
      ) : null}
      {closable ? (
        <Button
          label="Encerrar vaga"
          variant="ghost"
          className="flex-1"
          onClick={() => setUi({ confirmClose: true })}
        />
      ) : (
        <Button
          label="Ver resumo do bico"
          variant="secondary"
          iconLeft="file-check"
          className="flex-1"
          onClick={() => navigate('/fechado/' + job.id)}
        />
      )}
    </>
  );
  // Boosting is offered whenever the job is open and not boosted already.
  const canBoost = FEATURES.payments && !boostBlocker(db, job);
  // Y08: deleting is for a post without a team; with people picked or hired, closing is the way.
  const deleteLink = () =>
    editable && !hasTeam ? (
      <Button
        label="Excluir vaga"
        variant="ghost"
        size="sm"
        className="text-danger-500 self-center"
        onClick={() => setUi({ confirmDelete: true })}
      />
    ) : null;
  const boostButton = (className?: string) =>
    canBoost ? (
      <Button
        label="Impulsionar vaga"
        variant="accent"
        iconLeft="rocket"
        fullWidth
        className={className}
        onClick={() => navigate('/impulsionar/' + job.id)}
      />
    ) : null;

  return (
    <div className="flex flex-col">
      <BackBar title="Sua vaga" onBack={() => goBack('/mural')} />
      <div className="flex flex-col gap-4 px-4 sm:px-0 py-4 pb-28 lg:pb-4 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-10">
        <div className="flex flex-col gap-4 lg:gap-6">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-bold tracking-[0.08em] uppercase text-concrete-500">Fotos da vaga</span>
            <PhotoManager
              photos={jobPhotos(job)}
              onChange={(photos) =>
                updateJobPhotos(job.id, photos).catch((e: unknown) => showToast(errorMessage(e), { tone: 'error' }))
              }
            />
            <span className="text-xs text-concrete-500">Até 6 fotos. A primeira é a capa do bico no mural.</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge label={status.label} tone={status.tone} icon={status.icon} />
              {boosted && job.boostEndsAt ? (
                <Badge label={`Impulsionada até ${dateTimeLabel(job.boostEndsAt)}`} tone="brand" icon="rocket" />
              ) : null}
              <span className="font-mono text-xs text-concrete-500">{job.id}</span>
            </div>
            <h1 className="font-display font-bold text-2xl text-concrete-900">{jobTitle(job)}</h1>
            {job.description ? <p className="text-sm text-concrete-700 leading-relaxed">{job.description}</p> : null}
          </div>

          {payCard('lg:hidden')}
          {slotsCard('lg:hidden')}
          {boostButton('lg:hidden')}

          <div className="flex flex-col gap-2">
            <div className="text-xs font-bold tracking-[0.08em] uppercase text-concrete-500">Onde e como</div>
            <Card padding="md">
              <div className="flex flex-col gap-3.5">
                <InfoRow icon="map-pin" main={streetText(job)} sub={`${placeText(job)} · CEP ${job.address.cep}`} />
                {dias ? <InfoRow icon="calendar-days" main={dias.label} sub={dias.hint} /> : null}
                <InfoRow icon="clock" main={hoursText(job)} sub={durationText(job)} />
                <InfoRow icon="hand-coins" main={paymentText(job)} sub="Combinado direto com o trabalhador" />
              </div>
            </Card>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-bold tracking-[0.08em] uppercase text-concrete-500">
                {applications.length === 1 ? '1 candidato' : `${applications.length} candidatos`}
              </div>
              {pending ? (
                <span className="text-xs text-brand-600">{`${pending} ${pending === 1 ? 'novo' : 'novos'}`}</span>
              ) : null}
            </div>
            {applications.length ? (
              <div className="bg-white border border-concrete-200 rounded-card shadow-card overflow-hidden">
                {applications.map((a) => {
                  const worker = workerOf(db, a);
                  const pending = isPending(a.status);
                  const quiet = [
                    'nao_selecionado',
                    'desistiu',
                    'cancelado_pela_construtora',
                    'nao_compareceu',
                    'expirada'
                  ];
                  return (
                    <CandidateRow
                      key={a.id}
                      worker={worker}
                      summary={oficioNome(worker.oficioId) + ' · ' + workerPlace(worker)}
                      distance={workerDistance(worker, job.address)}
                      isNew={worker.novo}
                      badge={pending ? null : candidateBadge(a)}
                      muted={quiet.includes(a.status)}
                      onClick={() => navigate(`/trabalhador/${worker.id}/${job.id}`)}
                      contact={contactOpen(a.status) ? <ContactButton applicationId={a.id} /> : null}
                      action={
                        a.status === 'pre_selecionado'
                          ? { label: 'Confirmar contratação', onClick: () => setUi({ hireId: worker.id }) }
                          : null
                      }
                      onApprove={
                        pending && !closed
                          ? (e) => {
                              e.stopPropagation();
                              approve(job.id, worker.id)
                                .then(() => toastApproved(job.id, worker))
                                .catch((err: unknown) => showToast(errorMessage(err), { tone: 'error' }));
                            }
                          : null
                      }
                      onReject={
                        pending && !closed
                          ? (e) => {
                              e.stopPropagation();
                              reject(job.id, worker.id)
                                .then(() => toastRejected(job.id, worker))
                                .catch((err: unknown) => showToast(errorMessage(err), { tone: 'error' }));
                            }
                          : null
                      }
                    />
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon="users"
                title="Nenhum candidato ainda"
                description={
                  canBoost
                    ? 'Quando alguém se candidatar, aparece aqui e você recebe um aviso. Para mais gente ver a vaga, impulsione.'
                    : 'Quando alguém se candidatar, aparece aqui e você recebe um aviso.'
                }
                actionLabel={canBoost ? 'Impulsionar vaga' : null}
                onAction={canBoost ? () => navigate('/impulsionar/' + job.id) : null}
              />
            )}
          </div>
        </div>
        <aside className="hidden lg:flex lg:flex-col lg:gap-4 lg:sticky lg:top-28">
          {payCard()}
          {slotsCard()}
          {boostButton()}
          <div className="flex gap-3">{actions()}</div>
          {deleteLink()}
        </aside>
      </div>
      <div className="sticky bottom-0 px-4 sm:px-0 py-3 bg-white shadow-bar flex flex-col gap-1 lg:hidden">
        <div className="flex gap-3">{actions()}</div>
        {deleteLink()}
      </div>
      <Dialog
        open={ui.confirmClose}
        tone="danger"
        title="Encerrar essa vaga?"
        description={
          hasTeam
            ? 'A vaga sai do mural e para de receber candidaturas. Quem você já escolheu ou contratou continua no bico. Quem ainda esperava é avisado.'
            : 'A vaga sai do mural e para de receber candidaturas. Quem ainda esperava é avisado. Isso não pode ser desfeito.'
        }
        confirmLabel="Encerrar vaga"
        onConfirm={() => void close.run(job.id)}
        loading={close.loading}
        error={close.error}
        cancelLabel="Cancelar"
        onCancel={() => {
          close.reset();
          setUi({ confirmClose: false });
        }}
      />
      <Dialog
        open={ui.confirmDelete}
        tone="danger"
        title="Excluir essa vaga?"
        description="O anúncio some do mural e do seu perfil. Quem ainda esperava resposta é avisado de que a vaga foi removida."
        confirmLabel="Excluir vaga"
        onConfirm={() => void remove.run(job.id)}
        loading={remove.loading}
        error={remove.error}
        cancelLabel="Cancelar"
        onCancel={() => {
          remove.reset();
          setUi({ confirmDelete: false });
        }}
      />
      <Dialog
        open={Boolean(ui.hireId)}
        title="Confirmar contratação?"
        description={`${hireName} fica confirmado para essa diária e recebe um aviso. Combine os detalhes pelo WhatsApp.`}
        confirmLabel="Confirmar contratação"
        loading={hire.loading}
        error={hire.error}
        onConfirm={() => {
          if (ui.hireId) void hire.run(job.id, ui.hireId);
        }}
        cancelLabel="Voltar"
        onCancel={() => {
          hire.reset();
          setUi({ hireId: null });
        }}
      />
    </div>
  );
}

/** What the headcount card says for each state of the job (Y01). */
const STATE_TEXT: Record<JobState, string> = {
  aberta: 'Aprove candidatos até preencher as vagas. Quando todas estiverem preenchidas, a vaga sai do mural.',
  cheia: 'Todas as vagas preenchidas: a vaga saiu do mural. Você ainda pode editar ou encerrar.',
  encerrada: 'Vaga encerrada. Ela saiu do mural e não recebe mais candidatura.',
  excluida: 'Vaga excluída.',
  vencida: 'O prazo da vaga passou e ela saiu do mural.'
};

function jobStatus(db: Database, job: Job, state: JobState, approved: number, pending: number): StatusBadge {
  if (state === 'excluida') return { label: 'Excluída', tone: 'danger', icon: 'circle-x' };
  if (state === 'encerrada' && job.semContratacao)
    return { label: 'Encerrada sem contratação', tone: 'danger', icon: 'circle-x' };
  if (state === 'encerrada') return { label: 'Bico encerrado', tone: 'neutral', icon: 'circle-check' };
  if (state === 'vencida') return { label: 'Prazo vencido', tone: 'warning', icon: 'clock' };
  if (state === 'cheia')
    return { label: `Vagas preenchidas · ${approved} de ${job.slots || 1}`, tone: 'success', icon: 'circle-check' };
  if (pending)
    return {
      label: pending === 1 ? '1 aguardando análise' : `${pending} aguardando análise`,
      tone: 'warning',
      icon: 'clock'
    };
  const total = applicationsForJob(db, job.id).length;
  if (total) return { label: total === 1 ? '1 candidato' : `${total} candidatos`, tone: 'brand', icon: 'users' };
  return { label: 'Sem candidatos ainda', tone: 'neutral', icon: 'search-x' };
}
