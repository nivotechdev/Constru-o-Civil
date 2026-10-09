import { useState } from 'react';
import { BackBar } from '../../components/BackBar';
import { EmptyState } from '../../components/EmptyState';
import { ReasonDialog } from '../../components/ReasonDialog';
import { useAction } from '../../hooks/useAction';
import { contactOpen, lastEventAt } from '../../services/applicationMachine';
import { showToast } from '../../services/toast';
import { dateTimeLabel } from '../../utils/dates';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Icon } from '../../components/icons/Icon';
import { KeyValue } from '../../components/KeyValue';
import { JobNotFound } from '../../components/NotFound';
import { ScreenLoading } from '../../components/QueryView';
import { PageSkeleton } from '../../components/Skeleton';
import { useQuery } from '../../hooks/useQuery';
import { useDb } from '../../hooks/useStore';
import { giveUp, loadMyApplications } from '../../services/applications';
import type { ScreenProps } from '../../types/screen';
import { goBack, navigate } from '../../services/router';
import { applicationFor, companyOf, currentWorkerId, getJob } from '../../services/selectors';
import { formatPay } from '../../utils/format';
import { dateText, placeText } from '../../utils/jobInfo';
import { ContactButton } from '../../components/ContactButton';
import { jobTitle } from '../../services/catalog';

const GIVE_UP_REASONS = ['Fiquei doente', 'Peguei outro serviço', 'Problema de transporte', 'Imprevisto na família'];

export default function Selected({ params }: ScreenProps) {
  const db = useDb();
  const query = useQuery('my-applications', loadMyApplications);
  const [asking, setAsking] = useState(false);
  const quit = useAction(giveUp, () => {
    setAsking(false);
    showToast('Avisamos a construtora. Obrigado por avisar com antecedência.');
    navigate('/minhas-candidaturas');
  });
  if (query.status !== 'ready')
    return (
      <ScreenLoading
        title="Você avançou"
        onBack={() => goBack('/minhas-candidaturas')}
        query={query}
        skeleton={<PageSkeleton />}
      />
    );
  const job = getJob(db, params.id);
  if (!job) return <JobNotFound />;
  const company = companyOf(db, job);
  const hired = applicationFor(db, job.id, currentWorkerId());
  // Only a picked or hired worker has a contact to show here.
  if (!hired || !contactOpen(hired.status)) {
    return (
      <div className="flex flex-col">
        <BackBar title="Você avançou" onBack={() => goBack('/minhas-candidaturas')} />
        <EmptyState
          icon="lock"
          title="Essa tela não está disponível"
          description="O contato com a construtora aparece aqui quando ela aprova sua candidatura."
          actionLabel="Ver minhas candidaturas"
          onAction={() => navigate('/minhas-candidaturas')}
        />
      </div>
    );
  }
  const isHired = hired.status === 'contratado';
  const openedAt = lastEventAt(hired, 'pre_selecionado');
  const title = isHired ? `Você foi contratado pela ${company.name}` : `A ${company.name} quer falar com você`;

  return (
    <div className="flex flex-col">
      <BackBar title="Você avançou" onBack={() => goBack('/minhas-candidaturas')} />
      <div className="bg-brand-500 text-white px-4 sm:px-6 py-7 flex flex-col gap-3 lg:rounded-card">
        <Badge label={isHired ? 'Contratado' : 'Pré-selecionado'} tone="inverse" icon="circle-check" />
        <h1 className="font-display font-bold text-3xl leading-tight text-white">{title}</h1>
        <p className="text-white/85">{`${jobTitle(job)} · ${dateText(job)}`}</p>
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
            <ContactButton applicationId={hired.id} size="lg" fullWidth />
            <span className="text-sm text-concrete-700">
              Combine ponto de encontro, horário e pagamento direto com a construtora. A Bicos não cobra taxa e não
              entra na negociação.
            </span>
          </div>
        </Card>
        <Card tone="sunken" padding="md">
          <div className="flex flex-col gap-3">
            <KeyValue label="Diária combinada" value={formatPay(job.pay)} />
            <KeyValue label="Local" value={placeText(job)} />
            {openedAt ? <KeyValue label="Contato liberado" value={dateTimeLabel(openedAt)} /> : null}
          </div>
        </Card>
        <Button label="Ver a vaga de novo" variant="secondary" fullWidth onClick={() => navigate('/vaga/' + job.id)} />
        <Button label="Não vou poder ir" variant="ghost" fullWidth onClick={() => setAsking(true)} />
      </div>
      <ReasonDialog
        open={asking}
        title="Não vai poder ir?"
        description={`Avisamos a ${company.name} na hora, e sua vaga volta a ficar aberta para outra pessoa.`}
        reasons={GIVE_UP_REASONS}
        confirmLabel="Avisar que não vou"
        loading={quit.loading}
        error={quit.error}
        onConfirm={(reason) => void quit.run(job.id, reason)}
        onCancel={() => {
          quit.reset();
          setAsking(false);
        }}
      />
    </div>
  );
}
