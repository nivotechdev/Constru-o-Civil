import { useState } from 'react';
import { Button } from '../../components/Button';
import { FieldError } from '../../components/FieldError';
import { GoogleIcon, Icon } from '../../components/icons/Icon';
import { Input, PasswordInput } from '../../components/Input';
import { useUI } from '../../hooks/useStore';
import { DEMO_ACCOUNTS, resendConfirmationEmail, signIn, type SignInError } from '../../services/auth';
import { errorMessage, ServiceError } from '../../services/errors';
import { RETURN_TO_DEFAULTS, RETURN_TO_KEY, type ReturnToUI } from '../../services/guards';
import { navigate } from '../../services/router';
import { getUI, resetUI, type UIPatch } from '../../services/store';
import { useCaptcha } from '../../components/Captcha';
import { FEATURES } from '../../services/features';
import { Card } from '../../components/Card';

interface LoginUI {
  identifier: string;
  visible: boolean;
  submitting: boolean;
  /** Field-level problems (empty field). */
  identifierError: string | null;
  passwordError: string | null;
  /** What went wrong with the attempt (wrong password, no connection…). */
  error: string | null;
  /** A line above the form ("Se já confirmou, entre com sua senha", from "Confirme seu e-mail"). */
  notice: string | null;
  /** Y19: the e-mail whose confirmation link was never opened (the right password was typed). */
  unconfirmed: string | null;
  resending: boolean;
  resent: boolean;
}

const LOGIN_DEFAULTS: LoginUI = {
  identifier: '',
  visible: false,
  submitting: false,
  identifierError: null,
  passwordError: null,
  error: null,
  notice: null,
  unconfirmed: null,
  resending: false,
  resent: false
};

const SIGN_IN_ERRORS: Record<Exclude<SignInError, 'email-nao-confirmado'>, string> = {
  credenciais: 'E-mail, CPF/CNPJ ou senha incorretos. Confira e tente de novo, ou toque em "Esqueci minha senha".'
};

const UNAVAILABLE = DEMO_ACCOUNTS.length
  ? 'Na demonstração, entre com e-mail e senha. Use uma das contas de teste abaixo.'
  : 'Por enquanto, entre com seu e-mail (ou CPF/CNPJ) e senha.';

export default function Login() {
  const [ui, setUi] = useUI<LoginUI>('login', LOGIN_DEFAULTS);
  // Y22: the password stays in this screen only (never in the shared store).
  const [password, setPassword] = useState('');
  const captcha = useCaptcha();

  function submit() {
    if (ui.submitting) return;
    const identifierError = ui.identifier.trim() ? null : 'Digite seu e-mail, CPF ou CNPJ.';
    const passwordError = password ? null : 'Digite sua senha.';
    if (identifierError || passwordError) {
      setUi({ identifierError, passwordError, error: null });
      return;
    }
    setUi({ submitting: true, error: null, notice: null, unconfirmed: null, resent: false });
    // The deep link that sent the user here (read before: signing in starts a clean screen state).
    const back = getUI<ReturnToUI>(RETURN_TO_KEY, RETURN_TO_DEFAULTS).path;
    signIn(ui.identifier, password, captcha.getToken)
      .then((result) => {
        if (!result.ok) {
          if (result.reason === 'email-nao-confirmado')
            setUi({ submitting: false, notice: null, unconfirmed: result.email ?? ui.identifier.trim() });
          else setUi({ submitting: false, error: SIGN_IN_ERRORS[result.reason] });
          return;
        }
        resetUI(RETURN_TO_KEY);
        resetUI('login');
        navigate(back || '/mural', { replace: true });
      })
      .catch((e: unknown) =>
        setUi({
          submitting: false,
          // A refusal the server explains (e.g. too many attempts) is shown as it is; anything else is the
          // connection.
          error:
            e instanceof ServiceError && e.code !== 'offline' && e.code !== 'falha_demo'
              ? e.message
              : 'Não deu para entrar agora. Confira sua internet e tente de novo.'
        })
      );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-app mx-auto px-6 sm:px-8 pt-14 pb-10 flex flex-col gap-8">
        <div className="flex flex-col items-center gap-5 text-center">
          <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-brand-500">
            <Icon name="hammer" size={22} color="#fff" />
          </span>
          <h1 className="font-display font-bold text-3xl text-concrete-900">Olá de novo</h1>
        </div>
        <div className="flex flex-col gap-5">
          {ui.notice ? (
            <Card tone="sunken" padding="sm">
              <div className="flex gap-2.5 items-center" role="status">
                <Icon name="info" size={20} color="var(--text-subtle)" />
                <span className="text-sm text-concrete-700">{ui.notice}</span>
              </div>
            </Card>
          ) : null}
          <Input
            id="login-identifier"
            label="E-mail, CPF ou CNPJ"
            placeholder="voce@email.com"
            icon="mail"
            inputMode="email"
            value={ui.identifier}
            error={ui.identifierError}
            onInput={(v) => setUi({ identifier: v, identifierError: null, error: null })}
            onEnter={submit}
          />
          <PasswordInput
            id="login-password"
            value={password}
            error={ui.passwordError}
            visible={ui.visible}
            onToggleVisible={() => setUi({ visible: !ui.visible })}
            onInput={(v) => {
              setPassword(v);
              setUi({ passwordError: null, error: null });
            }}
            onEnter={submit}
          />
          {captcha.widget}
          {ui.error ? <FieldError message={ui.error} /> : null}
          {ui.unconfirmed ? <Unconfirmed ui={ui} setUi={setUi} /> : null}
          <Button label="Entrar" size="lg" fullWidth loading={ui.submitting} onClick={submit} />
          {FEATURES.googleLogin || FEATURES.phoneLogin ? (
            <div className="flex items-center gap-3 py-1">
              <span className="flex-1 h-px bg-concrete-200" />
              <span className="text-xs text-concrete-500">ou</span>
              <span className="flex-1 h-px bg-concrete-200" />
            </div>
          ) : null}
          {FEATURES.googleLogin ? (
            <Button
              label="Continuar com o Google"
              variant="secondary"
              fullWidth
              iconLeftNode={<GoogleIcon size={20} />}
              onClick={() => setUi({ error: UNAVAILABLE })}
            />
          ) : null}
          {FEATURES.phoneLogin ? (
            <Button
              label="Continuar com o celular"
              variant="secondary"
              fullWidth
              iconLeft="phone-call"
              onClick={() => setUi({ error: UNAVAILABLE })}
            />
          ) : null}
        </div>
        <div className="flex flex-col items-center gap-1">
          <Button label="Esqueci minha senha" variant="ghost" onClick={() => navigate('/esqueci-senha')} />
          <Button label="Criar minha conta" variant="ghost" onClick={() => navigate('/escolha-perfil')} />
        </div>
        {DEMO_ACCOUNTS.length ? (
          <div className="flex flex-col gap-2 p-4 rounded-card bg-concrete-50 border border-concrete-200 text-sm text-concrete-600">
            <span className="font-semibold text-concrete-800">Contas de demonstração</span>
            {DEMO_ACCOUNTS.map((a) => (
              <button
                key={a.email}
                type="button"
                className="flex flex-wrap items-baseline gap-x-2 text-left hover:text-brand-600"
                onClick={() => {
                  setPassword(a.password);
                  setUi({ identifier: a.email, identifierError: null, passwordError: null, error: null });
                }}
              >
                <span className="font-semibold">{a.role === 'recrutador' ? 'Construtora:' : 'Trabalhador:'}</span>
                <span className="font-mono">{a.email}</span>
              </button>
            ))}
            <span>
              Senha das duas: <span className="font-mono">{DEMO_ACCOUNTS[0]?.password}</span>. Toque numa conta para
              preencher.
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// Y19: the password was right but the e-mail was never confirmed — say so and offer the link again.
function Unconfirmed({ ui, setUi }: { ui: LoginUI; setUi: (patch: UIPatch<LoginUI>) => void }) {
  function resend() {
    if (ui.resending || !ui.unconfirmed) return;
    setUi({ resending: true, resent: false, error: null });
    resendConfirmationEmail(ui.unconfirmed)
      .then(() => setUi({ resending: false, resent: true }))
      .catch((e: unknown) => setUi({ resending: false, error: errorMessage(e) }));
  }
  return (
    <Card tone="sunken" padding="md">
      <div className="flex flex-col gap-3" role="status">
        <div className="flex gap-2.5 items-start">
          <Icon name="mail" size={20} color="var(--text-subtle)" />
          <span className="text-sm text-concrete-700">
            Falta confirmar seu e-mail. Abra o link que enviamos para{' '}
            <strong className="text-concrete-900">{ui.unconfirmed}</strong> e depois entre de novo.
          </span>
        </div>
        {ui.resent ? (
          <span className="text-sm font-semibold text-success-500">Enviamos o link de novo.</span>
        ) : (
          <Button label="Reenviar o link" variant="secondary" fullWidth loading={ui.resending} onClick={resend} />
        )}
      </div>
    </Card>
  );
}
