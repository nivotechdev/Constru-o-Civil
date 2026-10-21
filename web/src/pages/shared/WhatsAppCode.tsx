// Sign-up step that confirms the WhatsApp number: six code boxes, the number the code went to (with a
// way to fix it) and a resend that unlocks every WHATSAPP_RESEND_SECONDS seconds.
import { useEffect, useState } from 'react';
import { CodeInput } from '../../components/CodeInput';
import { Icon } from '../../components/icons/Icon';
import { WHATSAPP_RESEND_SECONDS } from '../../services/auth';
import { IS_DEMO } from '../../services/mode';

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
  const seconds = useCountdown(sentAt);

  return (
    <div className="flex flex-col gap-6 short:gap-3.5">
      <div className="flex items-center gap-3 p-3.5 short:p-3 rounded-card bg-concrete-0 border border-concrete-200">
        <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[#128C4A]/10 shrink-0">
          <Icon name="message-circle" size={20} color="#128C4A" />
        </span>
        <span className="flex-1 min-w-0 flex flex-col">
          <span className="text-xs text-concrete-500">Código enviado para</span>
          <span className="font-mono font-bold text-sm sm:text-base text-concrete-900 truncate">{phone}</span>
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

      <CodeInput id={id} label="Código de confirmação" code={code} error={error} onCode={onCode} onEnter={onEnter} />

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
            <span className="font-mono font-bold text-concrete-700">{clock(seconds)}</span>
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
        {IS_DEMO ? (
          <span className="text-xs text-concrete-500">Demonstração: qualquer código de 6 números confirma.</span>
        ) : null}
      </div>
    </div>
  );
}

/** 60 → "1:00", 45 → "0:45". */
function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
