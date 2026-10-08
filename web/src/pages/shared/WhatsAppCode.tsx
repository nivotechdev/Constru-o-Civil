// Sign-up step that confirms the WhatsApp number: six code boxes, the number the code went to (with a
// way to fix it) and a resend that unlocks every WHATSAPP_RESEND_SECONDS seconds.
import { useEffect, useState, type KeyboardEvent } from 'react';
import { FieldError } from '../../components/FieldError';
import { Icon } from '../../components/icons/Icon';
import { WHATSAPP_RESEND_SECONDS } from '../../services/auth';
import { cx } from '../../utils/cx';

const LENGTH = 6;

interface WhatsAppCodeProps {
  /** id of the (visually hidden) input, so the step can focus it. */
  id: string;
  phone: string;
  code: string;
  error?: string | null;
  /** When the last code was sent (ms). */
  sentAt: number;
  resending: boolean;
  /** A new code went out after the first one. */
  resent: boolean;
  onCode: (code: string) => void;
  onEnter: () => void;
  onResend: () => void;
  onEditNumber: () => void;
}

/** Seconds left before "Reenviar código" unlocks, re-read a few times a second. */
function useCountdown(sentAt: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);
  const elapsed = Math.max(0, Math.floor((now - sentAt) / 1000));
  return Math.max(0, WHATSAPP_RESEND_SECONDS - elapsed);
}

export function WhatsAppCode({
  id,
  phone,
  code,
  error,
  sentAt,
  resending,
  resent,
  onCode,
  onEnter,
  onResend,
  onEditNumber
}: WhatsAppCodeProps) {
  const [focused, setFocused] = useState(false);
  const seconds = useCountdown(sentAt);
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault();
      onEnter();
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3 p-3.5 rounded-card bg-white border border-concrete-200">
        <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[#128C4A]/10 shrink-0">
          <Icon name="message-circle" size={20} color="#128C4A" />
        </span>
        <span className="flex-1 min-w-0 flex flex-col">
          <span className="text-xs text-concrete-500">Código enviado para</span>
          <span className="font-mono font-bold text-concrete-900 truncate">{phone}</span>
        </span>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-sm font-semibold text-brand-600 hover:bg-brand-50 shrink-0"
          onClick={onEditNumber}
        >
          <Icon name="pencil" size={15} />
          Corrigir
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={id} className="text-sm font-semibold text-concrete-900">
          Código de confirmação
        </label>
        {/* One real input (typing, paste, backspace and SMS/WhatsApp autofill work natively) laid over
            six boxes that show the digits. */}
        <div className="relative">
          <div className="grid grid-cols-6 gap-2 sm:gap-2.5" aria-hidden="true">
            {Array.from({ length: LENGTH }, (_, i) => {
              const current = focused && (i === code.length || (i === LENGTH - 1 && code.length === LENGTH));
              return (
                <span
                  key={i}
                  className={cx(
                    'flex items-center justify-center h-14 sm:h-16 rounded-control border-2 bg-white font-mono font-bold text-2xl text-concrete-900 transition-colors',
                    error
                      ? 'border-danger-500'
                      : current
                        ? 'border-brand-500 ring-4 ring-brand-100'
                        : code[i]
                          ? 'border-concrete-400'
                          : 'border-concrete-300'
                  )}
                >
                  {code[i] || ''}
                </span>
              );
            })}
          </div>
          <input
            id={id}
            data-focus-id={id}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={LENGTH}
            value={code}
            aria-label="Código de 6 números"
            className="absolute inset-0 w-full h-full opacity-0 cursor-text"
            onChange={(e) => onCode(e.target.value.replace(/\D/g, '').slice(0, LENGTH))}
            onKeyDown={onKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
          />
        </div>
        {error ? <FieldError message={error} /> : null}
      </div>

      <div className="flex flex-col items-center gap-1.5 text-center">
        {resent ? (
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-success-500">
            <Icon name="circle-check" size={16} />
            Enviamos um novo código.
          </span>
        ) : null}
        {seconds > 0 ? (
          <span className="text-sm text-concrete-500">
            Não chegou? Você pode pedir outro código em{' '}
            <span className="font-mono font-bold text-concrete-700">{`0:${String(seconds).padStart(2, '0')}`}</span>
          </span>
        ) : (
          <button
            type="button"
            disabled={resending}
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full text-sm font-semibold text-brand-600 hover:bg-brand-50 disabled:opacity-60"
            onClick={onResend}
          >
            <Icon name="message-circle" size={16} />
            {resending ? 'Reenviando…' : 'Reenviar código pelo WhatsApp'}
          </button>
        )}
        <span className="text-xs text-concrete-400">Demonstração: qualquer código de 6 números confirma.</span>
      </div>
    </div>
  );
}
