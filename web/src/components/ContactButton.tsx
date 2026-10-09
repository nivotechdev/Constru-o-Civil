import { useEffect, useState } from 'react';
import { getContact, type Contact } from '../services/contacts';
import { errorMessage } from '../services/errors';
import { cx } from '../utils/cx';
import { Icon } from './icons/Icon';
import { WhatsAppButton } from './WhatsAppButton';

type State = { status: 'loading' } | { status: 'ready'; contact: Contact } | { status: 'error'; message: string };

/**
 * "Falar no WhatsApp" for one candidacy: asks contacts.getContact() for the other side's number (it is
 * never on screen before that) and shows the link once it arrives, or "Tentar de novo" if it failed.
 */
export function ContactButton({
  applicationId,
  size = 'sm',
  fullWidth = false,
  round = false
}: {
  applicationId: string;
  size?: 'sm' | 'lg';
  fullWidth?: boolean;
  round?: boolean;
}) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    getContact(applicationId).then(
      (contact) => alive && setState({ status: 'ready', contact }),
      (e: unknown) => alive && setState({ status: 'error', message: errorMessage(e) })
    );
    return () => {
      alive = false;
    };
  }, [applicationId, attempt]);

  if (state.status === 'ready') {
    return <WhatsAppButton href={state.contact.url} size={size} fullWidth={fullWidth} round={round} />;
  }
  const retry = () => {
    setState({ status: 'loading' });
    setAttempt((n) => n + 1);
  };
  const loading = state.status === 'loading';
  const label = loading ? 'Carregando contato…' : 'Tentar de novo';
  if (round) {
    return (
      <button
        type="button"
        aria-label={loading ? label : `Contato não carregou. ${label}`}
        title={loading ? label : state.message}
        disabled={loading}
        className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-white text-concrete-500 shadow-raised ring-2 ring-white"
        onClick={(e) => {
          e.stopPropagation();
          retry();
        }}
      >
        <Icon name={loading ? 'message-circle' : 'refresh-cw'} size={18} />
      </button>
    );
  }
  return (
    <div className={cx('flex flex-col gap-1', fullWidth ? 'w-full' : '')}>
      <button
        type="button"
        disabled={loading}
        className={cx(
          'inline-flex items-center justify-center gap-2 rounded-full font-semibold border border-concrete-300 bg-white text-concrete-700 disabled:opacity-70',
          size === 'lg' ? 'h-14 px-5 text-base' : 'h-9 px-3.5 text-sm',
          fullWidth ? 'w-full' : ''
        )}
        onClick={(e) => {
          e.stopPropagation();
          retry();
        }}
      >
        <Icon name={loading ? 'message-circle' : 'refresh-cw'} size={size === 'lg' ? 20 : 16} />
        {label}
      </button>
      {state.status === 'error' ? <span className="text-xs text-danger-500">{state.message}</span> : null}
    </div>
  );
}
