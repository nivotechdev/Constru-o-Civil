// "Pagamentos" (F11): the company's boosts — what was paid, the status, the receipt and the refunds.
import { BackBar } from '../../components/BackBar';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { QueryView } from '../../components/QueryView';
import { ListSkeleton } from '../../components/Skeleton';
import { useQuery } from '../../hooks/useQuery';
import { useDb } from '../../hooks/useStore';
import { BOOST_PLANS, jobTitle } from '../../services/catalog';
import { loadMyPayments, myPayments, receiptText } from '../../services/payments';
import { goBack, navigate } from '../../services/router';
import { currentCompany } from '../../services/selectors';
import type { BoostPayment, PaymentStatus } from '../../types/models';
import type { StatusBadge } from '../../types/ui';
import { dateTimeLabel } from '../../utils/dates';

const STATUS: Record<PaymentStatus, StatusBadge> = {
  aguardando: { label: 'Aguardando pagamento', tone: 'warning', icon: 'clock' },
  confirmado: { label: 'Pago', tone: 'success', icon: 'circle-check' },
  recusado: { label: 'Recusado', tone: 'danger', icon: 'circle-x' },
  expirado: { label: 'PIX venceu', tone: 'neutral', icon: 'clock' },
  cancelado: { label: 'Cancelado', tone: 'neutral', icon: 'circle-x' },
  reembolso_pendente: { label: 'Reembolso em análise', tone: 'warning', icon: 'refresh-cw' }
};

function download(payment: BoostPayment, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `recibo-bicos-${payment.id}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export default function Payments() {
  const db = useDb();
  const query = useQuery('my-payments', loadMyPayments);
  const company = currentCompany(db);
  const list = myPayments(db, company.id);

  return (
    <div className="flex flex-col">
      <BackBar title="Pagamentos" onBack={() => goBack('/configuracoes')} />
      <div className="flex flex-col gap-3 px-4 sm:px-0 py-4">
        <QueryView query={query} skeleton={<ListSkeleton />}>
          {() =>
            list.length === 0 ? (
              <EmptyState
                icon="receipt"
                title="Nenhum pagamento ainda"
                description="Quando você impulsionar uma vaga, o pagamento e o recibo ficam aqui."
              />
            ) : (
              <div className="flex flex-col gap-3">
                {list.map((p) => {
                  const job = db.jobs[p.jobId];
                  const plan = BOOST_PLANS.find((x) => x.id === p.plan);
                  const status = STATUS[p.status];
                  return (
                    <Card key={p.id} padding="sm">
                      <div className="flex flex-col gap-3">
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0 flex flex-col">
                            <span className="font-semibold text-concrete-900 truncate">
                              {job ? jobTitle(job) : p.jobId}
                            </span>
                            <span className="text-sm text-concrete-500">
                              {`${plan?.label ?? p.plan} · ${dateTimeLabel(p.createdAt)}`}
                            </span>
                          </div>
                          <span className="font-mono font-bold text-lg text-concrete-900 shrink-0">
                            {`R$ ${(p.amountCents / 100).toFixed(2).replace('.', ',')}`}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-concrete-200">
                          <Badge label={status.label} tone={status.tone} icon={status.icon} />
                          {p.status === 'confirmado' ? (
                            <Button
                              label="Baixar recibo"
                              size="sm"
                              variant="ghost"
                              iconLeft="download"
                              onClick={() => download(p, receiptText(p, job, company.name))}
                            />
                          ) : p.status === 'reembolso_pendente' ? (
                            <Button
                              label="Falar com a gente"
                              size="sm"
                              variant="ghost"
                              onClick={() => navigate('/ajuda')}
                            />
                          ) : p.status === 'aguardando' && job ? (
                            <Button
                              label="Ver pagamento"
                              size="sm"
                              variant="ghost"
                              onClick={() => navigate(`/impulsionar/${job.id}/${p.plan}`)}
                            />
                          ) : null}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )
          }
        </QueryView>
        <span className="text-xs text-concrete-500">
          Os recibos não substituem nota fiscal. Dúvidas sobre cobrança ou reembolso: fale com a gente pela Ajuda.
        </span>
      </div>
    </div>
  );
}
