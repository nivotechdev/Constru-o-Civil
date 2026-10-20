import { useState } from 'react';
import { Button } from '../../components/Button';
import { FieldError } from '../../components/FieldError';
import { GoogleButton, OrDivider } from '../../components/GoogleButton';
import { Icon } from '../../components/icons/Icon';
import { Input, PasswordInput } from '../../components/Input';
import { useUI } from '../../hooks/useStore';
import {
  DEMO_ACCOUNTS,
  resendConfirmationEmail,
  signIn,
  signInWithGoogle,
  verifyEmailCode,
  type SignInError
} from '../../services/auth';
import { errorMessage, ServiceError } from '../../services/errors';
import { homeFor, RETURN_TO_DEFAULTS, RETURN_TO_KEY, type ReturnToUI } from '../../services/guards';
import { navigate } from '../../services/router';
import { getSession, getUI, resetUI, type UIPatch } from '../../services/store';
import { useCaptcha } from '../../components/Captcha';
import { FEATURES } from '../../services/features';
import { Card } from '../../components/Card';
import { CodeInput } from '../../components/CodeInput';

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
  /** U11: the e-mail code typed right here. */
  code: string;
  codeError: string | null;
  confirming: boolean;
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
  code: '',
  codeError: null,
  confirming: false,
  resending: false,
  resent: false
};

const SIGN_IN_ERRORS: Record<Exclude<SignInError, 'email-nao-confirmado'>, string> = {
  credenciais: 'E-mail, CPF/CNPJ ou senha incorretos. Confira e tente de novo, ou toque em "Esqueci minha senha".'
};

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
        {/* X04: a real <form>, so password managers recognize the sign-in (Enter is handled by the fields). */}
        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
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
            autoComplete="username"
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
          {FEATURES.googleLogin ? (
            <>
              <OrDivider />
              <GoogleButton
                onClick={() => signInWithGoogle().catch((e: unknown) => setUi({ error: errorMessage(e) }))}
              />
            </>
          ) : null}
        </form>
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

// Y19/U11: the password was right but the e-mail was never confirmed — the code is typed right here (a new
// one can be sent), and the account goes on to the next step.
function Unconfirmed({ ui, setUi }: { ui: LoginUI; setUi: (patch: UIPatch<LoginUI>) => void }) {
  function resend() {
    if (ui.resending || !ui.unconfirmed) return;
    setUi({ resending: true, resent: false, error: null, codeError: null });
    resendConfirmationEmail(ui.unconfirmed)
      .then(() => setUi({ resending: false, resent: true, code: '' }))
      .catch((e: unknown) => setUi({ resending: false, error: errorMessage(e) }));
  }
  function confirm(code = ui.code) {
    if (ui.confirming || !ui.unconfirmed) return;
    if (code.length !== 6) {
      setUi({ codeError: 'Digite os 6 números do código.' });
      return;
    }
    setUi({ confirming: true, codeError: null });
    verifyEmailCode(ui.unconfirmed, code)
      .then(() => {
        resetUI('login');
        const next = getSession();
        navigate(next ? homeFor(next) : '/mural', { replace: true });
      })
      .catch((e: unknown) => setUi({ confirming: false, code: '', codeError: errorMessage(e) }));
  }
  return (
    <Card tone="sunken" padding="md">
      <div className="flex flex-col gap-4" role="status">
        <div className="flex gap-2.5 items-start">
          <Icon name="mail" size={20} color="var(--text-subtle)" />
          <span className="text-sm text-concrete-700">
            Falta confirmar seu e-mail. Digite o código de 6 números que enviamos para{' '}
            <strong className="text-concrete-900">{ui.unconfirmed}</strong>.
          </span>
        </div>
        <CodeInput
          id="login-codigo"
          label="Código do e-mail"
          code={ui.code}
          error={ui.codeError}
          disabled={ui.confirming}
          pasteButton
          onCode={(code) => {
            setUi({ code, codeError: null });
            if (code.length === 6 && code !== ui.code) confirm(code);
          }}
          onEnter={() => confirm()}
        />
        <Button label="Confirmar e-mail" fullWidth loading={ui.confirming} onClick={() => confirm()} />
        {ui.resent ? (
          <span className="text-sm font-semibold text-success-500">Enviamos um novo código.</span>
        ) : (
          <Button
            label="Enviar outro código"
            variant="ghost"
            size="sm"
            fullWidth
            loading={ui.resending}
            onClick={resend}
          />
        )}
      </div>
    </Card>
  );
}
