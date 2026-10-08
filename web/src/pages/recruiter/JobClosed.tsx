import { BackBar } from '../../components/BackBar';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Icon } from '../../components/icons/Icon';
import { KeyValue } from '../../components/KeyValue';
import { useDb } from '../../hooks/useStore';
import type { ScreenProps } from '../../types/screen';
import { goBack, navigate } from '../../services/router';
import { applicationsForJob, getJob, getWorker } from '../../services/selectors';
import type { Worker } from '../../types/models';
import { formatBRL, formatPay } from '../../utils/format';
import { dateText } from '../../utils/jobInfo';

export default function JobClosed({ params }: ScreenProps) {
  const db = useDb();
  const job = getJob(db, params.id);
  const team = job
    ? applicationsForJob(db, job.id)
        .filter((a) => a.status === 'pre_selecionado' || a.status === 'contratado')
        .map((a) => getWorker(db, a.workerId) as Worker)
    : [];
  if (!job || team.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3">
        <p className="text-concrete-500">Esse bico ainda não foi fechado.</p>
        <Button label="Voltar ao início" variant="secondary" onClick={() => navigate('/mural')} />
      </div>
    );
  }
  const title = team.length === 1 ? `${team[0].name} está contratado` : `${team.length} trabalhadores contratados`;
  const total = (job.pay || 0) * Math.max(team.length, 1);

  return (
    <div className="flex flex-col">
      <BackBar title="Bico fechado" onBack={() => goBack('/mural')} />
      <div className="bg-brand-500 text-white px-4 sm:px-6 py-7 flex flex-col gap-3 lg:rounded-card">
        <Badge label="Bico fechado" tone="inverse" icon="circle-check" />
        <h1 className="font-display font-bold text-3xl leading-tight text-white">{title}</h1>
        <p className="text-white/85">{`${job.role} · ${dateText(job)}`}</p>
      </div>
      <div className="flex flex-col gap-4 px-4 sm:px-0 py-4">
        <Card tone="sunken" padding="sm">
          <div className="flex items-center gap-3">
            <Icon name="circle-check" size={20} color="var(--green-500)" />
            <span className="flex-1 text-sm text-concrete-700">
              A vaga saiu do mural. Quem não foi aprovado recebeu o aviso de que o bico foi fechado.
            </span>
          </div>
        </Card>
        <div className="text-xs font-bold tracking-[0.08em] uppercase text-concrete-500">Equipe contratada</div>
        <div className="flex flex-col gap-3">
          {team.map((worker) => (
            <Card key={worker.id} padding="md">
              <div className="flex flex-col gap-3.5">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent-50 text-accent-600 font-bold shrink-0">
                    {worker.initials}
                  </span>
                  <div className="flex-1 min-w-0 flex flex-col">
                    <span className="font-semibold text-concrete-900">{worker.name}</span>
                    <span className="text-sm text-concrete-500">{`${worker.role} · ${worker.region}`}</span>
                  </div>
                </div>
                <Button
                  label="Falar no WhatsApp"
                  variant="accent"
                  fullWidth
                  iconLeft="message-circle"
                  onClick={() => {}}
                />
              </div>
            </Card>
          ))}
        </div>
        <Card tone="sunken" padding="md">
          <div className="flex flex-col gap-3">
            <KeyValue label="Diária combinada" value={formatPay(job.pay)} />
            <KeyValue label="Local" value={job.location} />
            <KeyValue label="Total do bico" value={formatBRL(total)} />
          </div>
        </Card>
        <Button label="Voltar ao início" variant="secondary" fullWidth onClick={() => navigate('/mural')} />
      </div>
    </div>
  );
}
