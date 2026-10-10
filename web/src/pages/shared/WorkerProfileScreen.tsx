import { useState } from 'react';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Icon } from '../../components/icons/Icon';
import { IconButton } from '../../components/IconButton';
import { NotFound } from '../../components/NotFound';
import { ScreenLoading } from '../../components/QueryView';
import { PageSkeleton } from '../../components/Skeleton';
import { useQuery } from '../../hooks/useQuery';
import { loadWorkerProfile } from '../../services/profiles';
import { Rating } from '../../components/Rating';
import { useDb, useRole } from '../../hooks/useStore';
import type { ScreenProps } from '../../types/screen';
import { goBack, navigate } from '../../services/router';
import {
  applicationFor,
  currentCompanyId,
  currentWorker,
  getJob,
  getWorker,
  trackRecord
} from '../../services/selectors';
import { contactOpen } from '../../services/applicationMachine';
import { CandidateActions } from '../recruiter/CandidateActions';
import { oficioNome } from '../../services/catalog';
import { workerFacts, workerPlace } from '../../utils/workerInfo';
import { WorkerPosts } from './WorkerPosts';
import { AccountMenuButton } from '../../components/AccountMenuSheet';
import { WorkerAvatar } from '../../components/Avatar';
import { InviteSheet } from '../recruiter/InviteSheet';
import { SafetyMenu } from '../../components/SafetyMenu';
import { identityOf } from '../../services/identity';
import type { Worker } from '../../types/models';

export default function WorkerProfileScreen({ params }: ScreenProps) {
  const db = useDb();
  const role = useRole();
  const [inviting, setInviting] = useState(false);

  const isOwn = !params.id;
  const workerId = isOwn ? currentWorker(db).id : params.id;
  const query = useQuery('worker:' + workerId, () => loadWorkerProfile(workerId));
  if (query.status !== 'ready')
    return (
      <ScreenLoading
        title={isOwn ? 'Seu perfil' : 'Perfil'}
        onBack={() => goBack(params.jobId ? '/vaga-gerenciar/' + params.jobId : '/mural')}
        query={query}
        skeleton={<PageSkeleton />}
      />
    );
  const worker = isOwn ? currentWorker(db) : getWorker(db, params.id);
  if (!worker) return <NotFound message="Trabalhador não encontrado." />;

  const jobIdRaw = params.jobId;
  const jobForCtx = jobIdRaw ? getJob(db, jobIdRaw) : null;
  // Only the recruiter who owns this job may see candidate-review context (approve/reject, slots left).
  const jobId = jobForCtx && role === 'recrutador' && jobForCtx.companyId === currentCompanyId() ? jobIdRaw : null;
  const job = jobId ? getJob(db, jobId) : undefined;

  const candidacy = jobId ? applicationFor(db, jobId, worker.id) : null;
  const contactOpenFor = Boolean(candidacy && contactOpen(candidacy.status));
  const facts = workerFacts(worker);
  // F10: companies (and the worker) see the no-shows and give-ups.
  const showTrack = isOwn || role === 'recrutador';
  const track = trackRecord(db, worker.id);

  return (
    <div className="min-h-screen flex flex-col bg-concrete-50 lg:bg-transparent lg:min-h-0">
      <div className="relative">
        {worker.coverUrl ? (
          <img src={worker.coverUrl} alt="" className="w-full h-60 object-cover lg:rounded-card" />
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
        {!isOwn ? (
          <div className="absolute top-2 right-2">
            <SafetyMenu
              solid
              target="perfil"
              targetId={worker.id}
              what="o perfil"
              block={
                role === 'recrutador'
                  ? {
                      id: worker.id,
                      name: worker.name.split(' ')[0],
                      onBlocked: () => navigate('/mural', { replace: true })
                    }
                  : undefined
              }
            />
          </div>
        ) : (
          <div className="absolute top-2 right-2">
            <AccountMenuButton role="trabalhador" />
          </div>
        )}
        <div className="absolute left-4 sm:left-6 -bottom-10 w-24 h-24 rounded-full bg-white p-1 shadow-raised">
          <div className="relative w-full h-full">
            <WorkerAvatar worker={worker} size="lg" className="w-full h-full" />
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
            <span className="text-sm text-concrete-700">{`${oficioNome(worker.oficioId) || 'Ofício não informado'} · ${workerPlace(worker)}`}</span>
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-concrete-700">
              <Icon name="hammer" size={15} color="var(--text-subtle)" />
              {`${worker.jobsDone} ${worker.jobsDone === 1 ? 'bico realizado' : 'bicos realizados'}`}
            </span>
            <div className="flex items-center gap-3">
              <Rating value={worker.rating} count={worker.reviewCount} />
              {/* L09: the worker sees their own reviews; companies see a worker's. */}
              {worker.reviewCount > 0 && (isOwn || role === 'recrutador') ? (
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
          ) : worker.novo || worker.verified ? (
            // F07: "Novo" no longer hides "Verificado" — both show.
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              {worker.verified ? <Badge label="Verificado" tone="success" icon="shield-check" /> : null}
              {worker.novo ? <Badge label="Novo na plataforma" tone="accent" /> : null}
            </div>
          ) : null}
        </div>

        {isOwn ? <IdentityCard worker={worker} /> : null}

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

        {worker.bio ? <p className="text-concrete-700 whitespace-pre-line">{worker.bio}</p> : null}

        {facts.length || showTrack ? (
          <Card padding="md">
            <div className="flex flex-col gap-3.5">
              {facts.map((f) => (
                <div key={f} className="flex gap-2.5 items-center">
                  <Icon name="circle-check" size={18} color="var(--text-subtle)" />
                  <span className="text-sm text-concrete-700">{f}</span>
                </div>
              ))}
              {showTrack ? (
                <div className="flex gap-2.5 items-center">
                  <Icon
                    name={track.faltas || track.desistencias ? 'calendar-x' : 'calendar-check'}
                    size={18}
                    color="var(--text-subtle)"
                  />
                  <span className="text-sm text-concrete-700">
                    {`${track.faltas} ${track.faltas === 1 ? 'falta' : 'faltas'} · ${track.desistencias} ${track.desistencias === 1 ? 'desistência' : 'desistências'}`}
                  </span>
                </div>
              ) : null}
            </div>
          </Card>
        ) : isOwn ? (
          <Card tone="sunken" padding="sm" onClick={() => navigate('/perfil/editar')}>
            <div className="flex items-center gap-2.5">
              <Icon name="pencil" size={18} color="var(--text-subtle)" />
              <span className="flex-1 text-sm text-concrete-700">
                Conte sua experiência, os dias que você pode e a diária que pede. As construtoras veem isso.
              </span>
            </div>
          </Card>
        ) : null}

        {!isOwn && !jobId && role === 'recrutador' ? (
          <Button label="Convidar para uma vaga" iconLeft="mail" fullWidth onClick={() => setInviting(true)} />
        ) : null}

        <WorkerPosts worker={worker} isOwn={isOwn} />

        {/* W07: only while the WhatsApp is still closed for this candidacy. */}
        {!isOwn && jobId && !contactOpenFor ? (
          <p className="text-sm text-concrete-500">
            O contato por WhatsApp abre depois que você aprovar esse trabalhador para a vaga.
          </p>
        ) : null}
      </div>

      {!isOwn && job ? <CandidateActions job={job} worker={worker} /> : null}
      {!isOwn && role === 'recrutador' ? (
        <InviteSheet worker={worker} open={inviting} onClose={() => setInviting(false)} />
      ) : null}
    </div>
  );
}

// F07: the worker's own call to verify the identity, with where it stands.
function IdentityCard({ worker }: { worker: Worker }) {
  const status = identityOf(worker);
  if (status === 'verificado') return null;
  const text =
    status === 'em_analise'
      ? 'Sua identidade está em análise. Avisamos quando terminar.'
      : status === 'recusado'
        ? 'A verificação não foi aprovada. Veja o motivo e envie de novo.'
        : 'Verifique sua identidade e ganhe o selo "Verificado". As construtoras confiam mais.';
  return (
    <Card tone="sunken" padding="sm" onClick={() => navigate('/perfil/verificar')}>
      <div className="flex items-center gap-2.5">
        <Icon name="shield-check" size={18} color="var(--text-subtle)" />
        <span className="flex-1 text-sm text-concrete-700">{text}</span>
        <Icon name="chevron-right" size={16} color="var(--text-subtle)" />
      </div>
    </Card>
  );
}
