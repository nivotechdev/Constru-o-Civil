import { Button } from '../../components/Button';
import { FieldError } from '../../components/FieldError';
import { GoogleIcon, Icon } from '../../components/icons/Icon';
import { Input, PasswordInput } from '../../components/Input';
import { useUI } from '../../hooks/useStore';
import { DEMO_ACCOUNTS, signIn, type SignInError } from '../../services/auth';
import { RETURN_TO_DEFAULTS, RETURN_TO_KEY, type ReturnToUI } from '../../services/guards';
import { navigate } from '../../services/router';
import { getUI, resetUI } from '../../services/store';

interface LoginUI {
  identifier: string;
  password: string;
  visible: boolean;
  submitting: boolean;
  /** Field-level problems (empty field). */
  identifierError: string | null;
  passwordError: string | null;
  /** What went wrong with the attempt (wrong password, no connection…). */
  error: string | null;
}

const LOGIN_DEFAULTS: LoginUI = {
  identifier: '',
  password: '',
  visible: false,
  submitting: false,
  identifierError: null,
  passwordError: null,
  error: null
};

const SIGN_IN_ERRORS: Record<SignInError, string> = {
  'conta-inexistente': 'Não achamos uma conta com esse e-mail, CPF ou CNPJ. Confira ou crie sua conta.',
  'senha-errada': 'Senha incorreta. Confira e tente de novo, ou toque em "Esqueci minha senha".'
};

const UNAVAILABLE = 'Na demonstração, entre com e-mail e senha. Use uma das contas de teste abaixo.';

export default function Login() {
  const [ui, setUi] = useUI<LoginUI>('login', LOGIN_DEFAULTS);

  function submit() {
    if (ui.submitting) return;
    const identifierError = ui.identifier.trim() ? null : 'Digite seu e-mail, CPF ou CNPJ.';
    const passwordError = ui.password ? null : 'Digite sua senha.';
    if (identifierError || passwordError) {
      setUi({ identifierError, passwordError, error: null });
      return;
    }
    setUi({ submitting: true, error: null });
    signIn(ui.identifier, ui.password)
      .then((result) => {
        if (!result.ok) {
          setUi({ submitting: false, error: SIGN_IN_ERRORS[result.reason] });
          return;
        }
        // Back to the deep link that sent the user here, if any.
        const back = getUI<ReturnToUI>(RETURN_TO_KEY, RETURN_TO_DEFAULTS).path;
        resetUI(RETURN_TO_KEY);
        resetUI('login');
        navigate(back || '/mural', { replace: true });
      })
      .catch(() =>
        setUi({ submitting: false, error: 'Não deu para entrar agora. Confira sua internet e tente de novo.' })
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
            value={ui.password}
            error={ui.passwordError}
            visible={ui.visible}
            onToggleVisible={() => setUi({ visible: !ui.visible })}
            onInput={(v) => setUi({ password: v, passwordError: null, error: null })}
            onEnter={submit}
          />
          {ui.error ? <FieldError message={ui.error} /> : null}
          <Button label="Entrar" size="lg" fullWidth loading={ui.submitting} onClick={submit} />
          <div className="flex items-center gap-3 py-1">
            <span className="flex-1 h-px bg-concrete-200" />
            <span className="text-xs text-concrete-500">ou</span>
            <span className="flex-1 h-px bg-concrete-200" />
          </div>
          <Button
            label="Continuar com o Google"
            variant="secondary"
            fullWidth
            iconLeftNode={<GoogleIcon size={20} />}
            onClick={() => setUi({ error: UNAVAILABLE })}
          />
          <Button
            label="Continuar com o celular"
            variant="secondary"
            fullWidth
            iconLeft="phone-call"
            onClick={() => setUi({ error: UNAVAILABLE })}
          />
        </div>
        <div className="flex flex-col items-center gap-1">
          <Button label="Esqueci minha senha" variant="ghost" onClick={() => navigate('/esqueci-senha')} />
          <Button label="Criar minha conta" variant="ghost" onClick={() => navigate('/escolha-perfil')} />
        </div>
        <div className="flex flex-col gap-2 p-4 rounded-card bg-concrete-50 border border-concrete-200 text-sm text-concrete-600">
          <span className="font-semibold text-concrete-800">Contas de demonstração</span>
          {DEMO_ACCOUNTS.map((a) => (
            <button
              key={a.email}
              type="button"
              className="flex flex-wrap items-baseline gap-x-2 text-left hover:text-brand-600"
              onClick={() =>
                setUi({
                  identifier: a.email,
                  password: a.password,
                  identifierError: null,
                  passwordError: null,
                  error: null
                })
              }
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
      </div>
    </div>
  );
}
