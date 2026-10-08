import { BackBar } from '../../components/BackBar';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { JobNotFound } from '../../components/NotFound';
import { ResultIcon } from '../../components/ResultIcon';
import { useDb } from '../../hooks/useStore';
import type { ScreenProps } from '../../types/screen';
import { goBack, navigate } from '../../services/router';
import { getJob } from '../../services/selectors';
import { formatPay } from '../../utils/format';
import { dateText } from '../../utils/jobInfo';

export default function JobPublished({ params }: ScreenProps) {
  const job = getJob(useDb(), params.id);
  if (!job) return <JobNotFound />;

  return (
    <div className="flex flex-col">
      <BackBar title="Vaga publicada" onBack={() => goBack('/mural')} />
      <div className="flex flex-col items-center text-center gap-5 px-6 pt-10 pb-8 lg:max-w-app lg:mx-auto">
        <ResultIcon icon="circle-check" tone="success" />
        <div className="flex flex-col gap-2">
          <h1 className="font-display font-bold text-2xl text-concrete-900">Vaga publicada</h1>
          <p className="text-base text-concrete-700">
            Ela já está no mural de quem trabalha perto da obra. Avisamos quando chegar o primeiro candidato.
          </p>
        </div>
        <Card tone="sunken" padding="md" className="w-full">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="font-semibold text-concrete-900">{job.role}</span>
              <span className="text-sm text-concrete-500">{`${job.address} · ${dateText(job)}`}</span>
            </div>
            <span className="font-mono font-bold text-xl text-concrete-900">{formatPay(job.pay)}</span>
          </div>
        </Card>
        <div className="w-full flex flex-col gap-2 pt-2">
          <Button
            label="Impulsionar essa vaga"
            iconLeft="zap"
            fullWidth
            onClick={() => navigate('/impulsionar/' + job.id)}
          />
          <Button label="Voltar ao início" variant="ghost" fullWidth onClick={() => navigate('/mural')} />
        </div>
      </div>
    </div>
  );
}
