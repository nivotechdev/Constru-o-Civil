// "Resumo do bico" (Y09): what happened to a job — the team and where each one stands, the total and
// what is left to do (confirm, review). Opened when the company closes the job, from Gerenciar vaga and
// from the history. A job closed without anyone hired says so and offers to publish it again (F03).
import { BackBar } from '../../components/BackBar';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { Icon } from '../../components/icons/Icon';
import { KeyValue } from '../../components/KeyValue';
import { JobNotFound } from '../../components/NotFound';
import { ScreenLoading } from '../../components/QueryView';
import { PageSkeleton } from '../../components/Skeleton';
import { useQuery } from '../../hooks/useQuery';
import { loadJobCandidates } from '../../services/applications';
import { useDb } from '../../hooks/useStore';
import type { ScreenProps } from '../../types/screen';
import { goBack, navigate } from '../../services/router';
import { applicationsForJob, currentCompanyId, getJob, getWorker, jobState } from '../../services/selectors';
import type { Application, Worker } from '../../types/models';
import { formatPay } from '../../utils/format';
import { jobTitle } from '../../services/catalog';
import { workerPlace } from '../../utils/workerInfo';
import { ContactButton } from '../../components/ContactButton';
import { contactOpen, occupiesSlot } from '../../services/applicationMachine';
import { candidateBadge } from '../../utils/applicationStatus';
import { dateText, jobTotal, placeText } from '../../utils/jobInfo';
import { WorkerAvatar } from '../../components/Avatar';

function headline(team: { app: Application; worker: Worker }[]): string {
  if (!team.length) return 'Vaga encerrada sem contratação';
  const done = team.every((t) => t.app.status === 'concluida');
  if (done) return team.length === 1 ? `${team[0].worker.name} concluiu a diária` : 'Bico concluído';
  if (team.length === 1) {
    const { app, worker } = team[0];
    return app.status === 'pre_selecionado'
      ? `${worker.name} foi pré-selecionado`
      : app.status === 'contratado'
        ? `${worker.name} está contratado`
        : `${worker.name} concluiu a diária`;
  }
  const hired = team.filter((t) => t.app.status !== 'pre_selecionado').length;
  return hired === team.length ? `${team.length} trabalhadores contratados` : `${team.length} na equipe`;
}

export default function JobClosed({ params }: ScreenProps) {
  const db = useDb();
  const query = useQuery('candidates:' + params.id, () => loadJobCandidates(params.id));
  const back = () => goBack('/vaga-gerenciar/' + params.id);
  if (query.status !== 'ready')
    return <ScreenLoading title="Resumo do bico" onBack={back} query={query} skeleton={<PageSkeleton />} />;
  const job = getJob(db, params.id);
  if (!job) return <JobNotFound />;
  if (job.companyId !== currentCompanyId())
    return (
      <div className="flex flex-col">
        <BackBar title="Resumo do bico" onBack={() => goBack('/mural')} />
        <EmptyState icon="lock" title="Essa vaga não é sua" description="Só a empresa que publicou vê o resumo." />
      </div>
    );
  const team = applicationsForJob(db, job.id)
    .filter((a) => occupiesSlot(a.status))
    .map((a) => ({ app: a, worker: getWorker(db, a.workerId) as Worker }))
    .filter((t) => t.worker);
  const state = jobState(db, job);
  const toConfirm = team.filter((t) => t.app.status === 'pre_selecionado').length;
  const toReview = team.filter((t) => t.app.status === 'concluida' && !t.app.companyReviewed).length;

  return (
    <div className="flex flex-col">
      <BackBar title="Resumo do bico" onBack={back} />
      <div
        className={
          'px-4 sm:px-6 py-7 flex flex-col gap-3 lg:rounded-card ' +
          (team.length ? 'bg-brand-500 text-white' : 'bg-concrete-100 text-concrete-900')
        }
      >
        <Badge
          label={state === 'encerrada' ? 'Vaga encerrada' : state === 'excluida' ? 'Vaga excluída' : 'Equipe do bico'}
          tone={team.length ? 'inverse' : 'neutral'}
          icon={team.length ? 'circle-check' : 'circle-x'}
        />
        <h1 className={'font-display font-bold text-3xl leading-tight ' + (team.length ? 'text-white' : '')}>
          {headline(team)}
        </h1>
        <p className={team.length ? 'text-white/85' : 'text-concrete-700'}>{`${jobTitle(job)} · ${dateText(job)}`}</p>
      </div>
      <div className="flex flex-col gap-4 px-4 sm:px-0 py-4">
        <Card tone="sunken" padding="sm">
          <div className="flex items-center gap-3">
            <Icon name="info" size={20} color="var(--text-subtle)" />
            <span className="flex-1 text-sm text-concrete-700">
              {state === 'encerrada' || state === 'excluida'
                ? 'A vaga saiu do mural. Quem ainda esperava recebeu o aviso.'
                : 'Essa vaga continua no ar.'}
              {toConfirm
                ? ` Falta confirmar ${toConfirm === 1 ? 'uma contratação' : `${toConfirm} contratações`}.`
                : ''}
              {toReview ? ` Falta avaliar ${toReview === 1 ? 'uma pessoa' : `${toReview} pessoas`}.` : ''}
            </span>
          </div>
        </Card>
        {team.length ? (
          <>
            <div className="text-xs font-bold tracking-[0.08em] uppercase text-concrete-500">Equipe</div>
            <div className="flex flex-col gap-3">
              {team.map(({ app, worker }) => {
                const badge = candidateBadge(app);
                return (
                  <Card key={worker.id} padding="md">
                    <div className="flex flex-col gap-3.5">
                      <div className="flex items-center gap-3">
                        <WorkerAvatar worker={worker} />
                        <div className="flex-1 min-w-0 flex flex-col">
                          <span className="font-semibold text-concrete-900">{worker.name}</span>
                          <span className="text-sm text-concrete-500">{workerPlace(worker)}</span>
                        </div>
                        <Badge label={badge.label} tone={badge.tone} icon={badge.icon} />
                      </div>
                      {contactOpen(app.status) ? (
                        <div className="flex flex-col gap-2">
                          <ContactButton applicationId={app.id} fullWidth />
                          {app.status === 'pre_selecionado' ? (
                            <Button
                              label="Confirmar contratação"
                              variant="secondary"
                              fullWidth
                              onClick={() => navigate(`/trabalhador/${worker.id}/${job.id}`)}
                            />
                          ) : null}
                        </div>
                      ) : !app.companyReviewed ? (
                        <Button
                          label={`Avaliar ${worker.name.split(' ')[0]}`}
                          fullWidth
                          iconLeft="star"
                          onClick={() => navigate(`/avaliar-trabalhador/${job.id}/${worker.id}`)}
                        />
                      ) : (
                        <span className="text-sm text-concrete-500">Diária concluída e avaliada.</span>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </>
        ) : null}
        <Card tone="sunken" padding="md">
          <div className="flex flex-col gap-3">
            <KeyValue label="Diária" value={formatPay(job.pay)} />
            <KeyValue label="Diárias" value={String(job.diarias || 1)} />
            <KeyValue label="Pessoas" value={String(team.length || job.slots || 1)} />
            <KeyValue label="Local" value={placeText(job)} />
            <KeyValue label="Total do bico" value={jobTotal(job, team.length || job.slots || 1)} />
          </div>
        </Card>
        {state === 'encerrada' || state === 'excluida' || state === 'vencida' ? (
          <Button
            label="Publicar de novo"
            iconLeft="refresh-cw"
            fullWidth
            onClick={() => navigate('/publicar-de-novo/' + job.id)}
          />
        ) : null}
        <Button label="Voltar ao início" variant="secondary" fullWidth onClick={() => navigate('/mural')} />
      </div>
    </div>
  );
}
