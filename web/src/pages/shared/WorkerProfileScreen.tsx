import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Icon } from '../../components/icons/Icon';
import { IconButton } from '../../components/IconButton';
import { NotFound } from '../../components/NotFound';
import { Rating } from '../../components/Rating';
import { useDb, useRole, useUI } from '../../hooks/useStore';
import { WORKER_PHOTO_DEFAULTS, WORKER_PHOTO_KEY, type WorkerPhotoUI } from '../../services/sharedUI';
import type { ScreenProps } from '../../types/screen';
import { goBack, navigate } from '../../services/router';
import {
  applicationFor,
  approvedCount,
  currentCompanyId,
  currentWorker,
  getJob,
  getWorker,
  isJobClosed
} from '../../services/selectors';
import { decideApplication, getDb } from '../../services/store';
import { WorkerPosts } from './WorkerPosts';

export default function WorkerProfileScreen({ params }: ScreenProps) {
  const db = useDb();
  const role = useRole();
  const [ui] = useUI<WorkerPhotoUI>(WORKER_PHOTO_KEY, WORKER_PHOTO_DEFAULTS);

  const isOwn = !params.id;
  const worker = isOwn ? currentWorker(db) : getWorker(db, params.id);
  if (!worker) return <NotFound message="Trabalhador não encontrado." />;

  const jobIdRaw = params.jobId;
  const jobForCtx = jobIdRaw ? getJob(db, jobIdRaw) : null;
  // Only the recruiter who owns this job may see candidate-review context (approve/reject, slots left).
  const jobId = jobForCtx && role === 'recrutador' && jobForCtx.companyId === currentCompanyId() ? jobIdRaw : null;
  const job = jobId ? getJob(db, jobId) : undefined;
  const decision = jobId ? (applicationFor(db, jobId, worker.id) || { status: undefined }).status : null;
  const decidedForJob = jobId && (decision === 'pre_selecionado' || decision === 'nao_selecionado');
  const jobFull = job ? isJobClosed(db, job) : false;

  return (
    <div className="min-h-screen flex flex-col bg-concrete-50 lg:bg-transparent lg:min-h-0">
      <div className="relative">
        {isOwn && ui.photo ? (
          <img src={ui.photo} alt="" className="w-full h-60 object-cover lg:rounded-card" />
        ) : (
          <div className="h-60 bg-concrete-200 lg:rounded-card" />
        )}
        {!isOwn ? (
          <div className="absolute top-2 left-2">
            <IconButton
              icon="arrow-left"
              label="Voltar"
              variant="solid"
              onClick={() => goBack(jobId ? '/vaga-gerenciar/' + jobId : '/mural')}
            />
          </div>
        ) : null}
        <div className="absolute left-4 sm:left-6 -bottom-10 w-24 h-24 rounded-full bg-white p-1 shadow-raised">
          <div className="relative w-full h-full">
            <div className="w-full h-full rounded-full bg-accent-50 text-accent-600 flex items-center justify-center font-bold text-2xl overflow-hidden">
              {worker.initials}
            </div>
            {worker.verified ? (
              <span className="absolute -right-0.5 -bottom-0.5 inline-flex items-center justify-center w-7 h-7 rounded-full bg-brand-500 border-[3px] border-white">
                <Icon name="check" size={14} color="#fff" />
              </span>
            ) : null}
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-5 pt-12 px-4 sm:px-6 pb-40 lg:pb-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1.5 min-w-0">
            <span className="font-display font-bold text-2xl text-concrete-900">{worker.name}</span>
            <span className="text-sm text-concrete-700">{`${worker.role} · ${worker.region}`}</span>
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-concrete-700">
              <Icon name="hammer" size={15} color="var(--text-subtle)" />
              {`${worker.jobsDone} ${worker.jobsDone === 1 ? 'bico realizado' : 'bicos realizados'}`}
            </span>
            <div className="flex items-center gap-3">
              <Rating value={worker.rating} count={worker.jobsDone} />
              {!isOwn ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-0.5 text-sm font-semibold text-brand-600"
                  onClick={() => navigate('/avaliacoes/trabalhador/' + worker.id)}
                >
                  Ver avaliações
                  <Icon name="chevron-right" size={16} color="var(--text-brand)" />
                </button>
              ) : null}
            </div>
          </div>
          {isOwn ? (
            <Button
              label="Editar"
              variant="secondary"
              size="sm"
              iconLeft="pencil"
              onClick={() => navigate('/perfil/editar')}
            />
          ) : worker.novo ? (
            <Badge label="Novo na plataforma" tone="accent" />
          ) : worker.verified ? (
            <Badge label="Verificado" tone="success" icon="shield-check" />
          ) : null}
        </div>

        <div className="flex flex-col gap-2.5">
          <span className="text-xs font-bold tracking-[0.08em] uppercase text-concrete-500">Especialidades</span>
          <div className="flex flex-wrap gap-2">
            {worker.specialties.map((s) => (
              <span
                key={s}
                className="inline-flex items-center h-9 px-3 rounded-full bg-white border border-concrete-300 text-sm font-semibold text-concrete-700"
              >
                {s}
              </span>
            ))}
          </div>
        </div>

        {!isOwn && worker.facts && worker.facts.length ? (
          <Card padding="md">
            <div className="flex flex-col gap-3.5">
              {worker.facts.map((f) => (
                <div key={f} className="flex gap-2.5 items-center">
                  <Icon name="circle-check" size={18} color="var(--text-subtle)" />
                  <span className="text-sm text-concrete-700">{f}</span>
                </div>
              ))}
            </div>
          </Card>
        ) : null}

        <WorkerPosts worker={worker} isOwn={isOwn} />

        {!isOwn && jobId ? (
          <p className="text-sm text-concrete-500">
            O contato por WhatsApp abre depois que você aprovar esse trabalhador para a vaga.
          </p>
        ) : null}
      </div>

      {!isOwn && jobId && job ? (
        <div className="sticky bottom-0 px-4 sm:px-6 py-3 bg-white shadow-bar flex flex-col gap-2 lg:static lg:bg-transparent lg:shadow-none lg:pt-0 lg:pb-6">
          {!decidedForJob && !jobFull ? (
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-3">
              <Button
                label={`Aprovar para a vaga · ${approvedCount(db, jobId) + 1} de ${job.slots || 1}`}
                size="lg"
                fullWidth
                iconLeft="circle-check"
                className="lg:w-auto lg:px-8"
                onClick={() => {
                  decideApplication(jobId, worker.id, 'aprovado');
                  const fresh = getDb();
                  const freshJob = getJob(fresh, jobId);
                  navigate(freshJob && isJobClosed(fresh, freshJob) ? '/fechado/' + jobId : '/vaga-gerenciar/' + jobId);
                }}
              />
              <Button
                label="Recusar candidato"
                variant="ghost"
                fullWidth
                className="lg:w-auto"
                onClick={() => {
                  decideApplication(jobId, worker.id, 'recusado');
                  navigate('/vaga-gerenciar/' + jobId);
                }}
              />
            </div>
          ) : decidedForJob ? (
            <div className="flex items-center gap-2.5">
              <Badge
                label={decision === 'pre_selecionado' ? 'Aprovado' : 'Recusado'}
                tone={decision === 'pre_selecionado' ? 'success' : 'danger'}
                icon={decision === 'pre_selecionado' ? 'circle-check' : 'circle-x'}
              />
              <span className="flex-1 text-sm text-concrete-500">
                {decision === 'pre_selecionado'
                  ? 'Contato por WhatsApp liberado para os dois lados.'
                  : 'Avisamos que dessa vez não deu certo.'}
              </span>
              <Button
                label="Desfazer"
                variant="secondary"
                size="sm"
                onClick={() => decideApplication(jobId, worker.id, null)}
              />
            </div>
          ) : (
            <span className="text-center text-xs text-concrete-500">As vagas desse bico já foram preenchidas.</span>
          )}
        </div>
      ) : null}
    </div>
  );
}
