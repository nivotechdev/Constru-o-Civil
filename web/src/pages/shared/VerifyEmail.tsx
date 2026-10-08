import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { FieldError } from '../../components/FieldError';
import { Icon } from '../../components/icons/Icon';
import { ResultIcon } from '../../components/ResultIcon';
import { useSession, useUI } from '../../hooks/useStore';
import { confirmEmail, resendConfirmationEmail } from '../../services/auth';
import { homeFor } from '../../services/guards';
import { navigate } from '../../services/router';
import { askSignOut } from '../../services/sharedUI';
import { getSession } from '../../services/store';

interface VerifyEmailUI {
  confirming: boolean;
  resending: boolean;
  resent: boolean;
  error: string | null;
}

const DEFAULTS: VerifyEmailUI = { confirming: false, resending: false, resent: false, error: null };
const NETWORK_ERROR = 'Não deu para continuar agora. Confira sua internet e tente de novo.';

export default function VerifyEmail() {
  const session = useSession();
  const [ui, setUi] = useUI<VerifyEmailUI>('verificar-email', DEFAULTS);

  // Demo: there is no inbox, so "Abrir meu e-mail" stands for opening the link that was sent.
  function open() {
    if (ui.confirming) return;
    setUi({ confirming: true, error: null });
    confirmEmail()
      .then(() => {
        setUi({ confirming: false });
        const next = getSession();
        if (next) navigate(homeFor(next), { replace: true });
      })
      .catch(() => setUi({ confirming: false, error: NETWORK_ERROR }));
  }

  function resend() {
    if (ui.resending) return;
    setUi({ resending: true, resent: false, error: null });
    resendConfirmationEmail()
      .then(() => setUi({ resending: false, resent: true }))
      .catch(() => setUi({ resending: false, error: NETWORK_ERROR }));
  }

  return (
    <div className="min-h-screen flex flex-col bg-concrete-50 lg:max-w-app lg:mx-auto">
      <div className="flex-1 flex flex-col items-center text-center gap-6 px-6 pt-16 pb-8">
        <ResultIcon icon="mail-check" tone="brand" />
        <div className="flex flex-col gap-2">
          <h1 className="font-display font-bold text-2xl text-concrete-900">Conta criada. Confirme seu e-mail</h1>
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
              <span className="text-sm text-concrete-700">O link vale por 24 horas.</span>
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
        <Button label="Abrir meu e-mail" size="lg" fullWidth iconLeft="mail" loading={ui.confirming} onClick={open} />
        <span className="text-xs text-center text-concrete-400">
          Demonstração: este botão faz o papel do link enviado por e-mail.
        </span>
        <Button label="Reenviar o link" variant="ghost" fullWidth loading={ui.resending} onClick={resend} />
        <Button label="Sair e entrar com outra conta" variant="ghost" fullWidth onClick={askSignOut} />
      </div>
    </div>
  );
}
