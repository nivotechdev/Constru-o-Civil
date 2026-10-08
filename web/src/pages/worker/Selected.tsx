import { BackBar } from '../../components/BackBar';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Icon } from '../../components/icons/Icon';
import { KeyValue } from '../../components/KeyValue';
import { JobNotFound } from '../../components/NotFound';
import { WhatsAppButton } from '../../components/WhatsAppButton';
import { useDb } from '../../hooks/useStore';
import type { ScreenProps } from '../../types/screen';
import { goBack, navigate } from '../../services/router';
import { applicationFor, companyOf, currentWorkerId, getJob } from '../../services/selectors';
import { formatPay } from '../../utils/format';
import { dateText } from '../../utils/jobInfo';
import { workerToCompanyUrl } from '../../utils/whatsapp';

export default function Selected({ params }: ScreenProps) {
  const db = useDb();
  const job = getJob(db, params.id);
  if (!job) return <JobNotFound />;
  const company = companyOf(db, job);
  const hired = applicationFor(db, job.id, currentWorkerId());
  const isHired = Boolean(hired && hired.status === 'contratado');
  const title = isHired ? `Você foi contratado pela ${company.name}` : `A ${company.name} quer falar com você`;

  return (
    <div className="flex flex-col">
      <BackBar title="Você avançou" onBack={() => goBack('/minhas-candidaturas')} />
      <div className="bg-brand-500 text-white px-4 sm:px-6 py-7 flex flex-col gap-3 lg:rounded-card">
        <Badge label={isHired ? 'Contratado' : 'Pré-selecionado'} tone="inverse" icon="circle-check" />
        <h1 className="font-display font-bold text-3xl leading-tight text-white">{title}</h1>
        <p className="text-white/85">{`${job.role} · ${dateText(job)}`}</p>
      </div>
      <div className="flex flex-col gap-4 px-4 sm:px-0 py-4">
        <Card padding="md">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-brand-50 shrink-0">
                <Icon name="building-2" size={24} color="var(--brand)" />
              </span>
              <div className="flex flex-col gap-0.5">
                <span className="font-semibold text-concrete-900">{company.name}</span>
                <span className="text-sm text-concrete-500">{company.tipoObra || 'Construção civil'}</span>
              </div>
            </div>
            <WhatsAppButton href={workerToCompanyUrl(company, job)} size="lg" fullWidth />
            <span className="text-sm text-concrete-700">
              Combine ponto de encontro, horário e pagamento direto com a construtora. A Bicos não cobra taxa e não
              entra na negociação.
            </span>
          </div>
        </Card>
        <Card tone="sunken" padding="md">
          <div className="flex flex-col gap-3">
            <KeyValue label="Diária combinada" value={formatPay(job.pay)} />
            <KeyValue label="Local" value={job.location} />
            <KeyValue label="Contato liberado" value="Hoje · 9h10" />
          </div>
        </Card>
        <Button label="Ver a vaga de novo" variant="secondary" fullWidth onClick={() => navigate('/vaga/' + job.id)} />
      </div>
    </div>
  );
}
