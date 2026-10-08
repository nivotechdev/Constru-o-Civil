import type { ReactNode } from 'react';
import { BackBar } from '../../components/BackBar';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Icon, type IconName } from '../../components/icons/Icon';
import { InfoRow } from '../../components/InfoRow';
import { Dialog } from '../../components/Modal';
import { NotFound } from '../../components/NotFound';
import { PhotoCarousel } from '../../components/PhotoCarousel';
import { Rating } from '../../components/Rating';
import { useDb, useRole, useUI } from '../../hooks/useStore';
import type { ScreenProps } from '../../types/screen';
import { goBack, navigate } from '../../services/router';
import { applicationFor, companyOf, currentWorker, getJob } from '../../services/selectors';
import { cancelApplication } from '../../services/store';
import { formatPay } from '../../utils/format';
import { diasInfo, hoursText, whenText } from '../../utils/jobInfo';

export default function JobDetail({ params }: ScreenProps) {
  const db = useDb();
  const role = useRole();
  const [ui, setUi] = useUI<{ confirmCancel: boolean }>('job-detail', { confirmCancel: false });
  const job = getJob(db, params.id);
  if (!job) return <NotFound message="Vaga não encontrada ou encerrada." />;
  const company = companyOf(db, job);
  const worker = currentWorker(db);
  const application = role === 'trabalhador' ? applicationFor(db, job.id, worker.id) : null;
  const canCancel = application && (application.status === 'enviada' || application.status === 'em_analise');
  const dias = diasInfo(job);

  // Built fresh for each placement: the phone's sticky bottom bar and the desktop summary card.
  const actions = () =>
    role === 'trabalhador' ? (
      <>
        {application ? (
          canCancel ? (
            <Button
              label="Cancelar candidatura"
              size="lg"
              fullWidth
              variant="secondary"
              onClick={() => setUi({ confirmCancel: true })}
            />
          ) : (
            <Button
              label="Ver minhas candidaturas"
              size="lg"
              fullWidth
              variant="secondary"
              onClick={() => navigate('/minhas-candidaturas')}
            />
          )
        ) : (
          <Button label="Quero esse bico" size="lg" fullWidth onClick={() => navigate('/confirmar/' + job.id)} />
        )}
        {!application ? (
          <span className="text-center text-xs text-concrete-500">Você não paga nada para se candidatar</span>
        ) : null}
      </>
    ) : null;

  return (
    <div className="flex flex-col">
      <BackBar title="Detalhe da vaga" onBack={() => goBack('/mural')} />
      <div className="flex flex-col gap-4 px-4 sm:px-0 py-4 pb-28 lg:pb-4 lg:grid lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start lg:gap-10">
        <div className="flex flex-col gap-4 lg:gap-6">
          <Card padding="none">
            <div className="relative">
              <PhotoCarousel job={job} className="h-72 sm:h-80 lg:h-[26rem] rounded-t-card" />
              <div className="absolute z-10 left-4 -bottom-6 w-[3.75rem] h-[3.75rem] rounded-full bg-white p-0.5 shadow-raised">
                <div className="w-full h-full rounded-full bg-brand-50 flex items-center justify-center">
                  <Icon name="building-2" size={24} color="var(--brand)" />
                </div>
              </div>
            </div>
            <div className="flex items-end justify-between gap-3 pt-9 pb-4 px-4">
              <div className="flex flex-col gap-1 min-w-0">
                <span className="font-semibold text-concrete-900 truncate">{company.name}</span>
                <Rating value={company.rating} count={company.reviewCount} />
              </div>
              <Button
                label="Ver perfil"
                variant="secondary"
                size="sm"
                iconLeft="building-2"
                onClick={() => navigate('/construtora/' + company.id)}
              />
            </div>
          </Card>

          <div className="flex flex-col gap-1.5">
            <h1 className="font-display font-bold text-2xl text-concrete-900">{job.role}</h1>
            {job.description ? <p className="text-sm text-concrete-700 leading-relaxed">{job.description}</p> : null}
          </div>

          <Card tone="brand" padding="md" className="lg:hidden">
            <div className="flex flex-col gap-4">
              <div className="flex items-end justify-between gap-3">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-bold tracking-[0.08em] uppercase text-brand-600">Diária</span>
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

          <Section title="Onde e como">
            <Card padding="md">
              <div className="flex flex-col gap-3.5">
                <InfoRow icon="map-pin" main={job.address} sub={`${job.location} · ${job.distance} de você`} />
                {dias ? <InfoRow icon="calendar-days" main={dias.label} sub={dias.hint} /> : null}
                <InfoRow icon="clock" main={hoursText(job)} sub={job.duration} />
                <InfoRow
                  icon="hand-coins"
                  main="Pagamento em PIX no fim da diária"
                  sub="Combinado direto com a construtora"
                />
              </div>
            </Card>
          </Section>

          <Section title="O que precisa levar">
            <Card padding="md">
              <div className="flex flex-col gap-3">
                {job.requirements.map((r) => (
                  <div key={r} className="flex gap-2.5 items-center">
                    <Icon name="circle-check" size={20} color="var(--green-500)" />
                    <span className="text-concrete-700">{r}</span>
                  </div>
                ))}
              </div>
            </Card>
          </Section>
        </div>

        <aside className="hidden lg:block lg:sticky lg:top-28">
          <div className="flex flex-col gap-5 p-6 bg-white rounded-2xl border border-concrete-200 shadow-float">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold tracking-[0.08em] uppercase text-brand-600">Diária</span>
              <div className="flex items-baseline gap-2">
                <span className="font-mono font-bold text-3xl text-concrete-900">{formatPay(job.pay)}</span>
                {job.pay == null ? null : <span className="text-concrete-500">por dia</span>}
              </div>
            </div>
            <div className="flex flex-col rounded-xl border border-concrete-200 divide-y divide-concrete-200">
              <SummaryRow icon="calendar" label="Quando" value={whenText(job)} />
              {dias ? <SummaryRow icon="calendar-days" label="Dias" value={dias.label} /> : null}
              <SummaryRow icon="clock" label="Duração" value={job.duration} />
              <SummaryRow icon="map-pin" label="Onde" value={`${job.location} · ${job.distance}`} />
            </div>
            {actions()}
            <div className="flex items-start gap-2 text-sm text-concrete-500">
              <Icon name="hand-coins" size={18} color="var(--text-subtle)" />
              <span>Pagamento em PIX no fim da diária, combinado direto com a construtora.</span>
            </div>
          </div>
        </aside>
      </div>

      {role === 'trabalhador' ? (
        <div className="sticky bottom-0 px-4 sm:px-0 py-3 bg-white shadow-bar flex flex-col gap-1.5 lg:hidden">
          {actions()}
        </div>
      ) : null}

      <Dialog
        open={ui.confirmCancel}
        tone="danger"
        title="Cancelar essa candidatura?"
        description="Você sai da lista de candidatos dessa vaga. Se quiser, pode se candidatar de novo depois."
        confirmLabel="Cancelar candidatura"
        onConfirm={() => {
          cancelApplication(job.id, worker.id);
          setUi({ confirmCancel: false });
          navigate('/minhas-candidaturas');
        }}
        cancelLabel="Voltar"
        onCancel={() => setUi({ confirmCancel: false })}
      />
    </div>
  );
}

function SummaryRow({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Icon name={icon} size={18} color="var(--text-subtle)" />
      <div className="flex flex-col min-w-0">
        <span className="text-xs font-bold uppercase tracking-[0.06em] text-concrete-500">{label}</span>
        <span className="text-sm font-semibold text-concrete-900 truncate">{value}</span>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs font-bold tracking-[0.08em] uppercase text-concrete-500">{title}</div>
      {children}
    </div>
  );
}
