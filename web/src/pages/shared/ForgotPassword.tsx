import { Button } from '../../components/Button';
import { IconButton } from '../../components/IconButton';
import { Input } from '../../components/Input';
import { ResultIcon } from '../../components/ResultIcon';
import { useUI } from '../../hooks/useStore';
import { requestPasswordReset } from '../../services/auth';
import { goBack, navigate } from '../../services/router';
import { isValidEmail } from '../../utils/format';

interface ForgotUI {
  email: string;
  error: string | null;
  sent: boolean;
  submitting: boolean;
}

export default function ForgotPassword() {
  const [ui, setUi] = useUI<ForgotUI>('forgot-password', { email: '', error: null, sent: false, submitting: false });

  return (
    <div className="min-h-screen flex flex-col bg-white lg:max-w-app lg:mx-auto">
      <div className="flex items-center gap-1.5 min-h-14 px-2 border-b border-concrete-200">
        <IconButton icon="arrow-left" label="Voltar" onClick={() => goBack('/login')} />
        <span className="font-display font-semibold text-xl text-concrete-900">Recuperar senha</span>
      </div>
      {ui.sent ? (
        <div className="flex-1 flex flex-col items-center text-center gap-5 px-6 pt-16">
          <ResultIcon icon="mail-check" tone="brand" />
          <h1 className="font-display font-bold text-2xl text-concrete-900">Link enviado</h1>
          <p className="text-base text-concrete-700">
            Mandamos um link de redefinição para <strong className="text-concrete-900">{ui.email}</strong>. Abra o link
            para criar uma senha nova.
          </p>
          <Button label="Já abri o link" variant="secondary" onClick={() => navigate('/redefinir-senha')} />
        </div>
      ) : (
        <div className="flex-1 flex flex-col gap-7 px-5 sm:px-8 py-8">
          <div className="flex flex-col gap-2.5">
            <h1 className="font-display font-bold text-3xl text-concrete-900">Esqueceu sua senha?</h1>
            <p className="text-base text-concrete-700">
              Informe o e-mail da sua conta. Enviamos um link para você criar uma senha nova.
            </p>
          </div>
          <Input
            id="forgot-email"
            label="E-mail"
            placeholder="voce@email.com"
            icon="mail"
            value={ui.email}
            error={ui.error}
            onInput={(v) => setUi({ email: v, error: null })}
          />
        </div>
      )}
      {!ui.sent ? (
        <div className="px-5 sm:px-8 py-3">
          <Button
            label="Enviar link"
            size="lg"
            fullWidth
            loading={ui.submitting}
            onClick={() => {
              if (!isValidEmail(ui.email)) {
                setUi({ error: 'E-mail inválido. Confira se tem @ e o domínio.' });
                return;
              }
              setUi({ submitting: true });
              requestPasswordReset(ui.email).then(() => setUi({ submitting: false, sent: true }));
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
