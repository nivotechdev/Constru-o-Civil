// The company's actions on one candidate of one of its jobs (bottom of the candidate's profile): what
// can be done depends on where the candidacy stands (see services/applicationMachine.ts).
import { useEffect, useState } from 'react';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { FieldError } from '../../components/FieldError';
import { Dialog } from '../../components/Modal';
import { ReasonDialog } from '../../components/ReasonDialog';
import { useAction } from '../../hooks/useAction';
import { useDb } from '../../hooks/useStore';
import {
  approve,
  cancelHire,
  completeWorkday,
  jobStarted,
  confirmHire,
  markInReview,
  markNoShow,
  reject,
  undoApproval
} from '../../services/applications';
import { isPending } from '../../services/applicationMachine';
import { navigate } from '../../services/router';
import { applicationFor, approvedCount, jobState } from '../../services/selectors';
import { getDb } from '../../services/store';
import { showToast } from '../../services/toast';
import type { Job, Worker } from '../../types/models';
import { ContactButton } from '../../components/ContactButton';
import { candidateBadge } from '../../utils/applicationStatus';
import { dateText } from '../../utils/jobInfo';
import { toastApproved, toastRejected } from './decisionToasts';

type Confirm = 'contratar' | 'cancelar' | 'concluir' | 'falta' | null;

const CANCEL_REASONS = ['A obra foi adiada', 'O serviço foi cancelado', 'Já resolvi com outra pessoa'];

export function CandidateActions({ job, worker }: { job: Job; worker: Worker }) {
  const db = useDb();
  const app = applicationFor(db, job.id, worker.id);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const first = worker.name.split(' ')[0];

  // Opening a new candidate's profile puts the candidacy "em análise" (and tells the worker).
  const status = app?.status;
  useEffect(() => {
    if (status === 'enviada') markInReview(job.id, worker.id).catch(() => undefined);
  }, [status, job.id, worker.id]);

  const done = (message: string) => () => {
    setConfirm(null);
    showToast(message);
  };
  const doApprove = useAction(approve, () => toastApproved(job.id, worker));
  const doReject = useAction(reject, () => {
    toastRejected(job.id, worker);
    navigate('/vaga-gerenciar/' + job.id);
  });
  const doUndo = useAction(undoApproval, done('Aprovação desfeita'));
  const doHire = useAction(confirmHire, done('Contratação confirmada. Avisamos o trabalhador.'));
  const doCancel = useAction(cancelHire, () => {
    setConfirm(null);
    const fresh = getDb();
    showToast(
      jobState(fresh, fresh.jobs[job.id]) === 'aberta'
        ? 'Contratação cancelada. A vaga voltou a ficar aberta.'
        : 'Contratação cancelada.'
    );
  });
  const doConclude = useAction(completeWorkday, done('Diária concluída. Pedimos as avaliações.'));
  const doNoShow = useAction(markNoShow, done('Falta registrada'));

  if (!app) return null;
  const busy =
    doApprove.loading || doReject.loading || doUndo.loading || doHire.loading || doConclude.loading || doNoShow.loading;
  const error = doApprove.error || doReject.error || doUndo.error;
  const full = jobState(db, job) !== 'aberta';
  const badge = candidateBadge(app);

  let body;
  if (isPending(app.status)) {
    body = full ? (
      <span className="text-center text-xs text-concrete-500">As vagas desse bico já foram preenchidas.</span>
    ) : (
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-3">
        <Button
          label={`Aprovar para a vaga · ${approvedCount(db, job.id) + 1} de ${job.slots || 1}`}
          size="lg"
          fullWidth
          iconLeft="circle-check"
          className="lg:w-auto lg:px-8"
          loading={doApprove.loading}
          disabled={busy}
          onClick={() => void doApprove.run(job.id, worker.id)}
        />
        <Button
          label="Recusar candidato"
          variant="ghost"
          fullWidth
          className="lg:w-auto"
          loading={doReject.loading}
          disabled={busy}
          onClick={() => void doReject.run(job.id, worker.id)}
        />
      </div>
    );
  } else if (app.status === 'pre_selecionado') {
    body = (
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center gap-2.5">
          <Badge label={badge.label} tone={badge.tone} icon={badge.icon} />
          <span className="flex-1 text-sm text-concrete-500">Contato por WhatsApp liberado para os dois lados.</span>
        </div>
        <ContactButton applicationId={app.id} size="lg" fullWidth />
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-3">
          <Button
            label="Confirmar contratação"
            size="lg"
            fullWidth
            iconLeft="handshake"
            className="lg:w-auto lg:px-8"
            disabled={busy}
            onClick={() => setConfirm('contratar')}
          />
          <Button
            label="Desfazer aprovação"
            variant="secondary"
            fullWidth
            className="lg:w-auto"
            loading={doUndo.loading}
            disabled={busy}
            onClick={() => void doUndo.run(job.id, worker.id)}
          />
          <Button
            label="Cancelar"
            variant="ghost"
            fullWidth
            className="lg:w-auto"
            disabled={busy}
            onClick={() => setConfirm('cancelar')}
          />
        </div>
      </div>
    );
  } else if (app.status === 'contratado') {
    // Y02: "concluída" and "não compareceu" only from the first day of the job.
    const started = jobStarted(job);
    body = (
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center gap-2.5">
          <Badge label={badge.label} tone={badge.tone} icon={badge.icon} />
          <span className="flex-1 text-sm text-concrete-500">
            {started
              ? 'Depois da diária, marque como concluída.'
              : `A partir de ${dateText(job).toLowerCase()} você marca a diária como concluída (ou a falta).`}
          </span>
        </div>
        <ContactButton applicationId={app.id} size="lg" fullWidth />
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-3">
          {started ? (
            <>
              <Button
                label="Marcar diária como concluída"
                size="lg"
                fullWidth
                iconLeft="circle-check"
                className="lg:w-auto lg:px-8"
                disabled={busy}
                onClick={() => setConfirm('concluir')}
              />
              <Button
                label="Não compareceu"
                variant="secondary"
                fullWidth
                className="lg:w-auto"
                disabled={busy}
                onClick={() => setConfirm('falta')}
              />
            </>
          ) : null}
          <Button
            label="Cancelar contratação"
            variant="ghost"
            fullWidth
            className="lg:w-auto"
            disabled={busy}
            onClick={() => setConfirm('cancelar')}
          />
        </div>
      </div>
    );
  } else if (app.status === 'concluida' && !app.companyReviewed) {
    body = (
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center gap-2.5">
          <Badge label="Diária concluída" tone="neutral" icon="circle-check" />
          <span className="flex-1 text-sm text-concrete-500">Falta a sua avaliação.</span>
        </div>
        <Button
          label={`Avaliar ${first}`}
          size="lg"
          fullWidth
          iconLeft="star"
          className="lg:w-auto lg:px-8"
          onClick={() => navigate(`/avaliar-trabalhador/${job.id}/${worker.id}`)}
        />
      </div>
    );
  } else {
    body = (
      <div className="flex items-center gap-2.5">
        <Badge label={badge.label} tone={badge.tone} icon={badge.icon} />
        <span className="flex-1 text-sm text-concrete-500">
          {app.status === 'concluida'
            ? app.companyReviewed
              ? 'Diária concluída e avaliada.'
              : 'Diária concluída. Falta a sua avaliação.'
            : app.status === 'nao_selecionado'
              ? 'Avisamos que dessa vez não deu certo.'
              : app.status === 'desistiu'
                ? `${first} avisou que não vai poder ir.`
                : app.status === 'nao_compareceu'
                  ? 'Falta registrada.'
                  : app.status === 'expirada'
                    ? 'A vaga venceu sem a contratação ser confirmada.'
                    : app.status === 'cancelado_pela_equipe'
                      ? 'Cancelado pela equipe da Bicos: a conta foi suspensa.'
                      : 'Contratação cancelada.'}
        </span>
      </div>
    );
  }

  return (
    <div className="sticky bottom-0 px-4 sm:px-6 py-3 bg-white shadow-bar flex flex-col gap-2 lg:static lg:bg-transparent lg:shadow-none lg:pt-0 lg:pb-6">
      {error ? <FieldError message={error} /> : null}
      {body}
      <Dialog
        open={confirm === 'contratar'}
        title="Confirmar contratação?"
        description={`${first} fica confirmado para essa diária e recebe um aviso. Combine os detalhes pelo WhatsApp.`}
        confirmLabel="Confirmar"
        loading={doHire.loading}
        error={doHire.error}
        onConfirm={() => void doHire.run(job.id, worker.id)}
        cancelLabel="Voltar"
        onCancel={() => {
          doHire.reset();
          setConfirm(null);
        }}
      />
      <Dialog
        open={confirm === 'concluir'}
        title="A diária foi concluída?"
        description={`Confirme que ${first} fez o serviço. Depois, vocês dois podem se avaliar.`}
        confirmLabel="Sim, foi concluída"
        loading={doConclude.loading}
        error={doConclude.error}
        onConfirm={() => void doConclude.run(job.id, worker.id)}
        cancelLabel="Voltar"
        onCancel={() => {
          doConclude.reset();
          setConfirm(null);
        }}
      />
      <Dialog
        open={confirm === 'falta'}
        tone="danger"
        title={`${first} não compareceu?`}
        description="A falta fica registrada no perfil dele. Use só se ele não apareceu e não avisou."
        confirmLabel="Registrar falta"
        loading={doNoShow.loading}
        error={doNoShow.error}
        onConfirm={() => void doNoShow.run(job.id, worker.id)}
        cancelLabel="Voltar"
        onCancel={() => {
          doNoShow.reset();
          setConfirm(null);
        }}
      />
      <ReasonDialog
        open={confirm === 'cancelar'}
        title="Cancelar a contratação?"
        description={`${first} recebe um aviso com o motivo, e a vaga volta a ficar aberta.`}
        reasons={CANCEL_REASONS}
        confirmLabel="Cancelar contratação"
        loading={doCancel.loading}
        error={doCancel.error}
        onConfirm={(reason) => void doCancel.run(job.id, worker.id, reason)}
        onCancel={() => {
          doCancel.reset();
          setConfirm(null);
        }}
      />
    </div>
  );
}
