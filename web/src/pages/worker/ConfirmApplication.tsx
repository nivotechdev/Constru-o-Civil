import { BackBar } from '../../components/BackBar';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { JobNotFound } from '../../components/NotFound';
import { useDb, useUI } from '../../hooks/useStore';
import { submitApplication } from '../../services/marketplace';
import type { ScreenProps } from '../../types/screen';
import { goBack, navigate } from '../../services/router';
import { companyOf, currentWorker, getJob } from '../../services/selectors';
import { formatPay } from '../../utils/format';
import { dateText } from '../../utils/jobInfo';

export default function ConfirmApplication({ params }: ScreenProps) {
  const db = useDb();
  const [ui, setUi] = useUI<{ submitting: boolean }>('confirm-application', { submitting: false });
  const job = getJob(db, params.id);
  if (!job) return <JobNotFound />;
  const company = companyOf(db, job);
  const worker = currentWorker(db);

  return (
    <div className="flex flex-col">
      <BackBar title="Confirmar candidatura" onBack={() => goBack('/vaga/' + job.id)} />
      <div className="flex flex-col gap-4 px-4 sm:px-0 py-4">
        <div className="text-xs font-bold tracking-[0.08em] uppercase text-concrete-500">Confira antes de enviar</div>
        <Card padding="md">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-0.5">
              <span className="font-display font-semibold text-xl text-concrete-900">{job.role}</span>
              <span className="text-sm text-concrete-700">{company.name}</span>
            </div>
            <div className="flex gap-3">
              <div className="flex-1 bg-concrete-100 rounded-control p-3 flex flex-col gap-0.5">
                <span className="text-xs text-concrete-500">Diária</span>
                <span className="font-mono font-bold text-2xl text-concrete-900">{formatPay(job.pay)}</span>
              </div>
              <div className="flex-1 bg-concrete-100 rounded-control p-3 flex flex-col gap-0.5">
                <span className="text-xs text-concrete-500">Data</span>
                <span className="font-semibold text-concrete-900">{dateText(job)}</span>
              </div>
            </div>
            <div className="flex items-center gap-2.5 pt-4 border-t border-concrete-200">
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-accent-50 text-accent-600 font-bold text-sm shrink-0">
                {worker.initials}
              </span>
              <div className="flex flex-col">
                <span className="font-semibold text-concrete-900">{worker.name}</span>
                <span className="text-sm text-concrete-500">{`${worker.role} · ${worker.rating}`}</span>
              </div>
            </div>
          </div>
        </Card>
        <span className="text-sm text-concrete-500">
          A construtora vai ver seu perfil, suas especialidades e suas avaliações. O contato por WhatsApp só abre se ela
          te escolher.
        </span>
      </div>
      <div className="px-4 sm:px-0 py-3 flex flex-col gap-2">
        <Button
          label="Sim, quero esse bico"
          size="lg"
          fullWidth
          loading={ui.submitting}
          onClick={() => {
            setUi({ submitting: true });
            submitApplication(job.id, worker.id).then(() => {
              setUi({ submitting: false });
              navigate('/enviado/' + job.id);
            });
          }}
        />
        <Button label="Voltar para a vaga" variant="ghost" fullWidth onClick={() => navigate('/vaga/' + job.id)} />
      </div>
    </div>
  );
}
