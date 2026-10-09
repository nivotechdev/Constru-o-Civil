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
import { contactOpen, isPending } from '../../services/applicationMachine';
import { candidateBadge } from '../../utils/applicationStatus';
import { errorMessage } from '../../services/errors';
import { closeJob, updateJobPhotos } from '../../services/jobs';
import { showToast } from '../../services/toast';
import { useDb, useUI } from '../../hooks/useStore';
import type { ScreenProps } from '../../types/screen';
import { goBack, navigate } from '../../services/router';
import {
  applicationsForJob,
  approvedCount,
  currentCompanyId,
  getJob,
  isJobClosed,
  pendingCount,
  workerOf
} from '../../services/selectors';
import { getDb } from '../../services/store';
import type { Database, Job } from '../../types/models';
import type { StatusBadge } from '../../types/ui';
import { formatPay } from '../../utils/format';
import { diasInfo, durationText, hoursText, placeText, streetText, whenText } from '../../utils/jobInfo';
import { jobTitle, oficioNome } from '../../services/catalog';
import { workerDistance, workerPlace } from '../../utils/workerInfo';
import { ContactButton } from '../../components/ContactButton';
import { boostBlocker, isBoosted } from '../../services/payments';
import { dateTimeLabel } from '../../utils/dates';
import { jobPhotos } from '../../utils/jobPhotos';

export default function JobManage({ params }: ScreenProps) {
  const db = useDb();
  const [ui, setUi] = useUI<{ confirmClose: boolean; hireId: string | null }>('job-manage', {
    confirmClose: false,
    hireId: null
  });
  const query = useQuery('candidates:' + params.id, () => loadJobCandidates(params.id));
  const hire = useAction(confirmHire, () => {
    setUi({ hireId: null });
    showToast('Contratação confirmada. Avisamos o trabalhador.');
  });
  const close = useAction(closeJob, () => {
    setUi({ confirmClose: false });
    showToast('Vaga encerrada');
    navigate('/mural');
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
  const closed = isJobClosed(db, job);
  const status = jobStatus(db, job, approved, pending);
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
        <span className={`text-sm ${closed ? 'text-success-500' : 'text-concrete-500'}`}>
          {closed
            ? 'Bico fechado. A vaga saiu do mural e não recebe mais candidatura.'
            : 'Aprove candidatos até preencher todas as vagas. Aí o bico fecha sozinho.'}
        </span>
      </div>
    </Card>
  );
  const actions = () => (
    <>
      <Button
        label="Editar vaga"
        variant="secondary"
        iconLeft="pencil"
        className="flex-1"
        onClick={() => navigate('/vaga-editar/' + job.id)}
      />
      <Button label="Encerrar vaga" variant="ghost" className="flex-1" onClick={() => setUi({ confirmClose: true })} />
    </>
  );
  // Boosting is offered whenever the job is open and not boosted already.
  const canBoost = !boostBlocker(db, job);
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
                <InfoRow
                  icon="hand-coins"
                  main="Pagamento em PIX no fim da diária"
                  sub="Combinado direto com o trabalhador"
                />
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
                  const quiet = ['nao_selecionado', 'desistiu', 'cancelado_pela_construtora', 'nao_compareceu'];
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
                                .then(() => {
                                  if (isJobClosed(getDb(), job)) navigate('/fechado/' + job.id);
                                  else showToast(`${worker.name.split(' ')[0]} aprovado. O WhatsApp está liberado.`);
                                })
                                .catch((err: unknown) => showToast(errorMessage(err), { tone: 'error' }));
                            }
                          : null
                      }
                      onReject={
                        pending && !closed
                          ? (e) => {
                              e.stopPropagation();
                              reject(job.id, worker.id)
                                .then(() => showToast('Candidato recusado'))
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
                description="Vagas com valor acima da média da região costumam receber candidato no mesmo dia. Você também pode impulsionar."
                actionLabel="Impulsionar vaga"
                onAction={() => navigate('/impulsionar/' + job.id)}
              />
            )}
          </div>
        </div>
        <aside className="hidden lg:flex lg:flex-col lg:gap-4 lg:sticky lg:top-28">
          {payCard()}
          {slotsCard()}
          {boostButton()}
          {!closed ? <div className="flex gap-3">{actions()}</div> : null}
        </aside>
      </div>
      {!closed ? (
        <div className="sticky bottom-0 px-4 sm:px-0 py-3 bg-white shadow-bar flex gap-3 lg:hidden">{actions()}</div>
      ) : null}
      <Dialog
        open={ui.confirmClose}
        tone="danger"
        title="Encerrar essa vaga?"
        description="A vaga sai do mural imediatamente e para de receber candidaturas. Isso não pode ser desfeito."
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

function jobStatus(db: Database, job: Job, approved: number, pending: number): StatusBadge {
  if (job.closed && job.semContratacao) return { label: 'Encerrada sem contratação', tone: 'danger', icon: 'circle-x' };
  if (isJobClosed(db, job))
    return { label: `Bico fechado · ${approved} de ${job.slots || 1}`, tone: 'success', icon: 'circle-check' };
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
