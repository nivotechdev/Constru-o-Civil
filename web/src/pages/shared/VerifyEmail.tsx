import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { FieldError } from '../../components/FieldError';
import { Icon } from '../../components/icons/Icon';
import { ResultIcon } from '../../components/ResultIcon';
import { useSession, useScreenUI } from '../../hooks/useStore';
import { confirmEmail, resendConfirmationEmail, signOut } from '../../services/auth';
import { errorMessage } from '../../services/errors';
import { IS_DEMO } from '../../services/mode';
import { homeFor } from '../../services/guards';
import { navigate } from '../../services/router';
import { askSignOut } from '../../services/sharedUI';
import { getSession, resetUI, setUI } from '../../services/store';

interface VerifyEmailUI {
  /** Came straight from the sign-up (the title says the account was created). */
  fromSignup: boolean;
  confirming: boolean;
  resending: boolean;
  resent: boolean;
  /** When the link was last sent (ms): "Reenviar" unlocks 60 s later (L15). */
  sentAt: number;
  error: string | null;
}

const DEFAULTS: VerifyEmailUI = {
  fromSignup: false,
  confirming: false,
  resending: false,
  resent: false,
  sentAt: 0,
  error: null
};
const RESEND_SECONDS = 60;
const NETWORK_ERROR = 'Não deu para continuar agora. Confira sua internet e tente de novo.';

export default function VerifyEmail() {
  const session = useSession();
  const [ui, setUi] = useScreenUI<VerifyEmailUI>('verificar-email', DEFAULTS);
  const [mountedAt] = useState(() => Date.now());

  // Demo: there is no inbox, so "Abrir meu e-mail" stands for opening the link that was sent. With the
  // real backend the link confirms the account; the button checks it (opened in another tab or device).
  function open() {
    if (ui.confirming) return;
    setUi({ confirming: true, error: null });
    confirmEmail()
      .then(async (outcome) => {
        if (outcome === 'entrar-com-senha') {
          // Y19: no session on this device to check — signing in tells (and enters if confirmed).
          const email = getSession()?.email ?? '';
          await signOut().catch(() => undefined);
          resetUI('verificar-email');
          setUI<{ identifier: string; notice: string }>('login', {
            identifier: email,
            notice: 'Se já confirmou o e-mail, entre com sua senha.'
          });
          navigate('/login', { replace: true });
          return;
        }
        resetUI('verificar-email');
        const next = getSession();
        if (next) navigate(homeFor(next), { replace: true });
      })
      .catch((e: unknown) => setUi({ confirming: false, error: IS_DEMO ? NETWORK_ERROR : errorMessage(e) }));
  }

  // Counted from the sign-up (the first link) or the last resend.
  const wait = useSecondsLeft(ui.sentAt || (ui.fromSignup ? mountedAt : 0), RESEND_SECONDS);

  /** L15: a typo in the e-mail — start the sign-up again (the unconfirmed one is cleaned up later). */
  function fixEmail() {
    const role = session?.role ?? 'trabalhador';
    void signOut()
      .catch(() => undefined)
      .then(() => navigate('/cadastro/' + role, { replace: true }));
  }

  function resend() {
    if (ui.resending) return;
    setUi({ resending: true, resent: false, error: null });
    resendConfirmationEmail()
      .then(() => setUi({ resending: false, resent: true, sentAt: Date.now() }))
      .catch((e: unknown) => setUi({ resending: false, error: IS_DEMO ? NETWORK_ERROR : errorMessage(e) }));
  }

  return (
    <div className="min-h-screen flex flex-col bg-concrete-50 lg:max-w-app lg:mx-auto">
      <div className="flex-1 flex flex-col items-center text-center gap-6 px-6 pt-16 pb-8">
        <ResultIcon icon="mail-check" tone="brand" />
        <div className="flex flex-col gap-2">
          <h1 className="font-display font-bold text-2xl text-concrete-900">
            {ui.fromSignup ? 'Conta criada. Confirme seu e-mail' : 'Confirme seu e-mail'}
          </h1>
          <p className="text-base text-concrete-700">
            Enviamos um link de confirmação para{' '}
            <strong className="text-concrete-900">{session?.email ?? 'seu e-mail'}</strong>. Abra o link para ativar sua
            conta.
          </p>
        </div>
        <Card tone="sunken" padding="md" className="w-full text-left">
          <div className="flex flex-col gap-3">
            <div className="flex gap-2.5 items-center">
              <Icon name="clock" size={20} color="var(--text-subtle)" />
              <span className="text-sm text-concrete-700">
                O link vence depois de um tempo. Se vencer, peça outro aqui.
              </span>
            </div>
            <div className="flex gap-2.5 items-center">
              <Icon name="search-x" size={20} color="var(--text-subtle)" />
              <span className="text-sm text-concrete-700">Não chegou? Confira a caixa de spam.</span>
            </div>
          </div>
        </Card>
        {ui.resent ? (
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-success-500">
            <Icon name="circle-check" size={16} />
            Enviamos o link de novo.
          </span>
        ) : null}
        {ui.error ? <FieldError message={ui.error} /> : null}
      </div>
      <div className="px-6 pb-8 flex flex-col gap-2">
        <Button
          label={IS_DEMO ? 'Abrir meu e-mail' : 'Já confirmei meu e-mail'}
          size="lg"
          fullWidth
          iconLeft="mail"
          loading={ui.confirming}
          onClick={open}
        />
        {IS_DEMO ? (
          <span className="text-xs text-center text-concrete-500">
            Demonstração: este botão faz o papel do link enviado por e-mail.
          </span>
        ) : null}
        <Button
          label={wait > 0 ? `Reenviar o link em 0:${String(wait).padStart(2, '0')}` : 'Reenviar o link'}
          variant="ghost"
          fullWidth
          loading={ui.resending}
          disabled={wait > 0}
          onClick={resend}
        />
        <Button label="Corrigir e-mail" variant="ghost" fullWidth onClick={fixEmail} />
        <Button label="Sair e entrar com outra conta" variant="ghost" fullWidth onClick={askSignOut} />
      </div>
    </div>
  );
}

/** Seconds left until `from + seconds`, re-read every second. */
function useSecondsLeft(from: number, seconds: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return from ? Math.max(0, seconds - Math.floor((now - from) / 1000)) : 0;
}
