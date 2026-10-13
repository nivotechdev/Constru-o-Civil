// The card form of the payment provider (Mercado Pago "Card Payment Brick"), for real mode. The fields
// live in the provider's own frames: the card number, expiry and code never touch the app's code or
// state. What comes back is a one-time token, which the Edge Function criar-cobranca charges.
// Loaded only when shown (the SDK script is ~100 kB); without the public key it is never rendered
// (services/features.ts hides "Impulsionar").
import { useEffect, useId, useRef, useState } from 'react';
import { FieldError } from './FieldError';
import { Skeleton } from './Skeleton';
import { MP_PUBLIC_KEY } from '../services/features';
import type { ProviderCardToken } from '../services/payments';

interface BrickController {
  unmount: () => void;
}
interface MercadoPagoInstance {
  bricks: () => {
    create: (kind: 'cardPayment', containerId: string, settings: unknown) => Promise<BrickController>;
  };
}
type MercadoPagoCtor = new (key: string, options: { locale: string }) => MercadoPagoInstance;

let sdk: Promise<MercadoPagoCtor> | null = null;

function loadSdk(): Promise<MercadoPagoCtor> {
  const existing = (window as unknown as { MercadoPago?: MercadoPagoCtor }).MercadoPago;
  if (existing) return Promise.resolve(existing);
  if (!sdk) {
    sdk = new Promise<MercadoPagoCtor>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://sdk.mercadopago.com/js/v2';
      script.async = true;
      script.onload = () => {
        const ctor = (window as unknown as { MercadoPago?: MercadoPagoCtor }).MercadoPago;
        if (ctor) resolve(ctor);
        else reject(new Error('sdk'));
      };
      script.onerror = () => {
        sdk = null; // try again next time
        reject(new Error('sdk'));
      };
      document.head.appendChild(script);
    });
  }
  return sdk;
}

interface Props {
  /** In reais. */
  amount: number;
  /** Resolves when the charge is done (the form shows its own spinner meanwhile); rejects to let them retry. */
  onToken: (token: ProviderCardToken) => Promise<unknown>;
}

export function MercadoPagoCardForm({ amount, onToken }: Props) {
  const id = 'mp-card-' + useId().replace(/:/g, '');
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const latest = useRef(onToken);
  useEffect(() => {
    latest.current = onToken;
  });

  useEffect(() => {
    let controller: BrickController | null = null;
    let cancelled = false;
    loadSdk()
      .then((MercadoPago) =>
        new MercadoPago(MP_PUBLIC_KEY, { locale: 'pt-BR' }).bricks().create('cardPayment', id, {
          initialization: { amount },
          customization: {
            paymentMethods: { maxInstallments: 1, types: { excluded: ['debit_card'] } },
            visual: { style: { theme: 'default' }, hideFormTitle: true }
          },
          callbacks: {
            onReady: () => !cancelled && setState('ready'),
            onError: () => !cancelled && setState('error'),
            onSubmit: (data: {
              token: string;
              payment_method_id: string;
              issuer_id?: string;
              payer?: { identification?: { type?: string; number?: string } };
            }) =>
              latest.current({
                token: data.token,
                paymentMethodId: data.payment_method_id,
                issuerId: data.issuer_id,
                identification: data.payer?.identification
              })
          }
        })
      )
      .then((c) => {
        if (cancelled) c.unmount();
        else controller = c;
      })
      .catch(() => !cancelled && setState('error'));
    return () => {
      cancelled = true;
      controller?.unmount();
    };
  }, [id, amount]);

  return (
    <div className="flex flex-col gap-3">
      {state === 'loading' ? <Skeleton height="16rem" radius="1rem" /> : null}
      {state === 'error' ? (
        <FieldError message="Não deu para abrir o pagamento com cartão. Confira sua internet ou pague com PIX." />
      ) : null}
      <div id={id} />
    </div>
  );
}
