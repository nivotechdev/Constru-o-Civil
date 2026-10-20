// Paying for a boost: PIX (QR code and "copia e cola", a waiting state that updates by itself) or card.
// Real mode: the PIX comes from the payment provider and the card form is the provider's own (the card
// number never touches the app). Demo: a fictitious QR, a button that stands in for the bank, and a
// card form whose number ending in 0000 is declined. The job goes to the top only once paid.
import { useEffect, useMemo, useRef, useState } from 'react';
import { BackBar } from '../../components/BackBar';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { FieldError } from '../../components/FieldError';
import { Icon } from '../../components/icons/Icon';
import { Input } from '../../components/Input';
import { MercadoPagoCardForm } from '../../components/MercadoPagoCardForm';
import { ScreenLoading } from '../../components/QueryView';
import { ResultIcon } from '../../components/ResultIcon';
import { PageSkeleton } from '../../components/Skeleton';
import { useAction } from '../../hooks/useAction';
import { useQuery } from '../../hooks/useQuery';
import { useDb, useUI } from '../../hooks/useStore';
import { BOOST_PLANS, jobTitle } from '../../services/catalog';
import { loadJob } from '../../services/jobs';
import {
  boostBlocker,
  getPayment,
  type ProviderCardToken,
  payWithCard,
  PIX_MINUTES,
  simulatePixPaid,
  startPixPayment
} from '../../services/payments';
import { FEATURES } from '../../services/features';
import { IS_DEMO } from '../../services/mode';
import { goBack, navigate } from '../../services/router';
import { showToast } from '../../services/toast';
import type { PaymentMethod } from '../../types/models';
import type { ScreenProps } from '../../types/screen';
import { maskCardNumber, maskExpiry, validateCard, type CardErrors, type CardInput } from '../../utils/card';
import { cx } from '../../utils/cx';
import { dateTimeLabel } from '../../utils/dates';

interface PayUI {
  method: PaymentMethod;
  paymentId: string | null;
}

const EMPTY_CARD: CardInput = { number: '', name: '', expiry: '', cvv: '' };

/** Seconds until `iso`, ticking. */
function useSecondsLeft(iso: string | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  return iso ? Math.max(0, Math.floor((new Date(iso).getTime() - now) / 1000)) : 0;
}

export default function BoostPayment({ params }: ScreenProps) {
  const db = useDb();
  const query = useQuery('job:' + params.id, () => loadJob(params.id));
  const key = `boost-pay:${params.id}:${params.plan}`;
  // Only the method and the payment in progress survive navigation; the card never goes to the store (Y14).
  const [ui, setUi] = useUI<PayUI>(key, { method: 'pix', paymentId: null });
  const back = () => goBack('/impulsionar/' + params.id);
  const pix = useAction(startPixPayment, (p) => setUi({ paymentId: p.id }));
  const paid = useAction(simulatePixPaid);
  const card = useAction(payWithCard, (p) => setUi({ paymentId: p.id }));
  const payment = ui.paymentId ? db.boostPayments.find((p) => p.id === ui.paymentId) : undefined;
  const seconds = useSecondsLeft(payment?.status === 'aguardando' ? payment.expiresAt : null);

  // When the PIX code runs out, ask for the payment again: it comes back expired.
  const expiredNow = payment?.status === 'aguardando' && payment.expiresAt !== null && seconds === 0;
  useEffect(() => {
    if (expiredNow && ui.paymentId) getPayment(ui.paymentId).catch(() => undefined);
  }, [expiredNow, ui.paymentId]);

  // X08: a PIX waiting for the bank updates by itself (the webhook confirms it on the server).
  const waiting = payment?.status === 'aguardando';
  useEffect(() => {
    if (!waiting || !ui.paymentId) return;
    const id = ui.paymentId;
    const t = window.setInterval(() => getPayment(id).catch(() => undefined), 5000);
    return () => window.clearInterval(t);
  }, [waiting, ui.paymentId]);

  // X08: a finished payment (confirmed or not) doesn't stay on this screen for the next boost.
  const finished = payment !== undefined && payment.status !== 'aguardando';
  const finishedRef = useRef(finished);
  useEffect(() => {
    finishedRef.current = finished;
  });
  useEffect(
    () => () => {
      if (finishedRef.current) setUi({ paymentId: null });
    },
    [setUi]
  );

  if (!FEATURES.payments) return <BoostUnavailable onBack={() => navigate('/vaga-gerenciar/' + params.id)} />;

  if (query.status !== 'ready')
    return <ScreenLoading title="Pagamento" onBack={back} query={query} skeleton={<PageSkeleton />} />;
  const job = db.jobs[params.id];
  const plan = BOOST_PLANS.find((p) => p.id === params.plan);

  if (payment?.status === 'reembolso_pendente') {
    return (
      <div className="flex flex-col">
        <BackBar title="Pagamento" onBack={() => navigate('/vaga-gerenciar/' + params.id)} />
        <EmptyState
          icon="refresh-cw"
          title="Pagamento será devolvido"
          description="Recebemos o pagamento, mas a vaga não está mais aberta. Vamos devolver o valor pela mesma forma de pagamento."
          actionLabel="Voltar para a vaga"
          onAction={() => navigate('/vaga-gerenciar/' + params.id)}
        />
      </div>
    );
  }

  if (payment?.status === 'confirmado' && payment.boostEndsAt) {
    return (
      <div className="flex flex-col">
        <BackBar title="Pagamento" onBack={() => navigate('/vaga-gerenciar/' + params.id)} />
        <div className="flex flex-col items-center text-center gap-5 px-6 py-12">
          <ResultIcon icon="rocket" tone="success" />
          <div className="flex flex-col gap-2">
            <h1 className="font-display font-bold text-2xl text-concrete-900">Pagamento confirmado</h1>
            <p className="text-concrete-700">{`Sua vaga está no topo do mural até ${dateTimeLabel(payment.boostEndsAt)}.`}</p>
          </div>
          <Button label="Ver sua vaga" size="lg" fullWidth onClick={() => navigate('/vaga-gerenciar/' + params.id)} />
        </div>
      </div>
    );
  }

  const blocker = job ? boostBlocker(db, job) : 'Essa vaga não existe mais.';
  if (!job || !plan || blocker) {
    return (
      <div className="flex flex-col">
        <BackBar title="Pagamento" onBack={back} />
        <EmptyState
          icon="rocket"
          title={blocker ?? 'Plano não encontrado'}
          actionLabel="Voltar para a vaga"
          onAction={() => navigate('/vaga-gerenciar/' + params.id)}
        />
      </div>
    );
  }

  const payWithToken = async (token: ProviderCardToken) => {
    if (!(await card.run(job.id, plan.id, { token }))) throw new Error('recusado');
  };

  return (
    <div className="flex flex-col">
      <BackBar title="Pagamento" onBack={back} />
      <div className="flex flex-col gap-5 px-4 sm:px-0 py-4">
        <Card tone="brand" padding="md">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="font-semibold text-concrete-900">{plan.label}</span>
              <span className="text-sm text-concrete-700 truncate">{jobTitle(job)}</span>
            </div>
            <span className="font-mono font-bold text-2xl text-concrete-900">{plan.price}</span>
          </div>
        </Card>

        <div className="flex bg-concrete-100 rounded-full p-1 gap-1" role="tablist" aria-label="Forma de pagamento">
          {(['pix', 'cartao'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={ui.method === m ? 'true' : 'false'}
              className={cx(
                'flex-1 h-11 rounded-full text-sm font-bold transition-colors',
                ui.method === m ? 'bg-concrete-0 text-brand-600 shadow-card' : 'text-concrete-500'
              )}
              onClick={() => setUi({ method: m })}
            >
              {m === 'pix' ? 'PIX' : 'Cartão de crédito'}
            </button>
          ))}
        </div>

        {ui.method === 'pix' ? (
          !payment || payment.method !== 'pix' ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-concrete-700">
                {`Geramos um código PIX para você pagar no app do seu banco. Ele vale por ${PIX_MINUTES} minutos.`}
              </p>
              {pix.error ? <FieldError message={pix.error} /> : null}
              <Button
                label="Gerar código PIX"
                size="lg"
                fullWidth
                iconLeft="qr-code"
                loading={pix.loading}
                onClick={() => void pix.run(job.id, plan.id)}
              />
            </div>
          ) : payment.status === 'expirado' ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-2.5 p-3 rounded-card bg-warning-50 border border-warning-100 text-sm">
                <Icon name="clock" size={18} color="var(--amber-500)" />
                <span>Esse código venceu sem pagamento. Gere um novo para continuar.</span>
              </div>
              {pix.error ? <FieldError message={pix.error} /> : null}
              <Button
                label="Gerar novo código"
                size="lg"
                fullWidth
                iconLeft="refresh-cw"
                loading={pix.loading}
                onClick={() => void pix.run(job.id, plan.id)}
              />
            </div>
          ) : (
            <PixWaiting
              code={payment.pixCode ?? ''}
              qrBase64={payment.pixQrBase64 ?? null}
              seconds={seconds}
              loading={paid.loading}
              error={paid.error}
              onPaid={() => void paid.run(payment.id)}
            />
          )
        ) : IS_DEMO ? (
          <DemoCardForm
            price={plan.price}
            loading={card.loading}
            error={card.error}
            onPay={(c) => void card.run(job.id, plan.id, { card: c })}
          />
        ) : (
          <div className="flex flex-col gap-3">
            <MercadoPagoCardForm amount={plan.priceCents / 100} onToken={payWithToken} />
            {card.error ? <FieldError message={card.error} /> : null}
          </div>
        )}
        <span className="text-sm text-concrete-500">
          Pagamento único, sem renovação automática. O destaque começa assim que o pagamento é confirmado.
        </span>
      </div>
    </div>
  );
}

/** "Impulsionar" is off until the payment provider is configured (services/features.ts). */
export function BoostUnavailable({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col">
      <BackBar title="Impulsionar vaga" onBack={onBack} />
      <EmptyState
        icon="rocket"
        title="Impulsionar ainda não está disponível"
        description="Sua vaga já aparece no mural de graça. Por enquanto, não dá para colocá-la no topo."
        actionLabel="Voltar para a vaga"
        onAction={onBack}
      />
    </div>
  );
}

/** The card typed in the demo. Local state only: it disappears when the screen closes (Y14). */
function DemoCardForm({
  price,
  loading,
  error,
  onPay
}: {
  price: string;
  loading: boolean;
  error: string | null;
  onPay: (card: CardInput) => void;
}) {
  const [card, setCardState] = useState<CardInput>(EMPTY_CARD);
  const [errors, setErrors] = useState<CardErrors>({});
  const setCard = (patch: Partial<CardInput>, field: keyof CardInput) => {
    setCardState((c) => ({ ...c, ...patch }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  };
  const pay = () => {
    const found = validateCard(card);
    if (Object.keys(found).length) {
      setErrors(found);
      return;
    }
    onPay(card);
  };
  return (
    <form
      className="flex flex-col gap-4"
      autoComplete="on"
      onSubmit={(e) => {
        e.preventDefault();
        pay();
      }}
    >
      <Input
        id="card-number"
        label="Número do cartão"
        placeholder="0000 0000 0000 0000"
        icon="credit-card"
        inputMode="numeric"
        autoComplete="cc-number"
        mono
        value={card.number}
        error={errors.number}
        onInput={(v) => setCard({ number: maskCardNumber(v) }, 'number')}
      />
      <Input
        id="card-name"
        label="Nome no cartão"
        placeholder="Como está escrito no cartão"
        autoComplete="cc-name"
        value={card.name}
        error={errors.name}
        maxLength={60}
        onInput={(v) => setCard({ name: v.toUpperCase() }, 'name')}
      />
      <div className="grid grid-cols-2 gap-3">
        <Input
          id="card-expiry"
          label="Validade"
          placeholder="MM/AA"
          inputMode="numeric"
          autoComplete="cc-exp"
          mono
          value={card.expiry}
          error={errors.expiry}
          onInput={(v) => setCard({ expiry: maskExpiry(v) }, 'expiry')}
        />
        <Input
          id="card-cvv"
          label="Código de segurança"
          placeholder="123"
          inputMode="numeric"
          autoComplete="cc-csc"
          mono
          value={card.cvv}
          error={errors.cvv}
          onInput={(v) => setCard({ cvv: v.replace(/\D/g, '').slice(0, 4) }, 'cvv')}
        />
      </div>
      <span className="text-xs text-concrete-500">
        Demonstração: qualquer cartão válido é aprovado; um número terminado em 0000 é recusado.
      </span>
      {error ? <FieldError message={error} /> : null}
      <Button label={`Pagar ${price}`} type="submit" size="lg" fullWidth iconLeft="lock" loading={loading} />
    </form>
  );
}

function PixWaiting({
  code,
  qrBase64,
  seconds,
  loading,
  error,
  onPaid
}: {
  code: string;
  qrBase64: string | null;
  seconds: number;
  loading: boolean;
  error: string | null;
  onPaid: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard
      ?.writeText(code)
      .then(() => {
        setCopied(true);
        showToast('Código copiado');
      })
      .catch(() => showToast('Não deu para copiar. Selecione o código e copie.', { tone: 'error' }));
  };
  const mm = Math.floor(seconds / 60);
  const ss = String(seconds % 60).padStart(2, '0');
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 p-3 rounded-card bg-warning-50 border border-warning-100 text-sm font-semibold text-warning-600">
        <span className="w-2 h-2 rounded-full bg-warning-500 animate-pulse" />
        {`Aguardando pagamento · vence em ${mm}:${ss}`}
      </div>
      <div className="flex flex-col items-center gap-2">
        {qrBase64 ? (
          <img
            src={`data:image/png;base64,${qrBase64}`}
            alt="QR code do PIX"
            className="w-48 h-48 bg-white rounded-card border border-concrete-200"
          />
        ) : IS_DEMO ? (
          <>
            <FakeQr seed={code} />
            <span className="text-xs text-concrete-500">QR code de demonstração</span>
          </>
        ) : null}
        <span className="text-sm text-concrete-700 text-center">
          Abra o app do seu banco, escolha pagar com PIX e leia o QR code ou cole o código.
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-concrete-900">PIX copia e cola</span>
        <div className="flex items-center gap-2 p-3 rounded-control border border-concrete-300 bg-concrete-0">
          <span className="flex-1 min-w-0 font-mono text-xs text-concrete-700 break-all line-clamp-2">{code}</span>
          <Button label={copied ? 'Copiado' : 'Copiar'} variant="secondary" size="sm" iconLeft="copy" onClick={copy} />
        </div>
      </div>
      {IS_DEMO ? (
        <>
          {error ? <FieldError message={error} /> : null}
          <Button
            label="Simular pagamento confirmado"
            variant="secondary"
            size="lg"
            fullWidth
            iconLeft="circle-check"
            loading={loading}
            onClick={onPaid}
          />
          <span className="text-xs text-center text-concrete-500">
            Demonstração: este botão faz o papel do banco confirmando o PIX.
          </span>
        </>
      ) : (
        <span className="text-xs text-center text-concrete-500">
          Assim que o banco confirmar, esta tela muda sozinha. Pode levar alguns segundos.
        </span>
      )}
    </div>
  );
}

/** A QR-looking pattern from the code (not scannable): finder squares plus pseudo-random modules. */
function FakeQr({ seed }: { seed: string }) {
  const cells = useMemo(() => {
    const n = 25;
    let h = 2166136261;
    const out: [number, number][] = [];
    const finder = (x: number, y: number) =>
      [
        [0, 0],
        [n - 7, 0],
        [0, n - 7]
      ].some(([fx, fy]) => x >= fx && x < fx + 7 && y >= fy && y < fy + 7);
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        if (finder(x, y)) continue;
        h ^= seed.charCodeAt((x * 31 + y * 17) % Math.max(1, seed.length)) + x * 7 + y;
        h = Math.imul(h, 16777619);
        if ((h >>> 0) % 2 === 0) out.push([x, y]);
      }
    return out;
  }, [seed]);
  const finderAt = (x: number, y: number) => (
    <g key={`${x}-${y}`}>
      <rect x={x} y={y} width={7} height={7} fill="#101418" />
      <rect x={x + 1} y={y + 1} width={5} height={5} fill="#fff" />
      <rect x={x + 2} y={y + 2} width={3} height={3} fill="#101418" />
    </g>
  );
  return (
    <svg
      viewBox="-2 -2 29 29"
      className="w-48 h-48 bg-white rounded-card border border-concrete-200"
      aria-hidden="true"
    >
      {cells.map(([x, y]) => (
        <rect key={`${x}:${y}`} x={x} y={y} width={1} height={1} fill="#101418" />
      ))}
      {finderAt(0, 0)}
      {finderAt(18, 0)}
      {finderAt(0, 18)}
    </svg>
  );
}
