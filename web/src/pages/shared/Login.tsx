import { Button } from '../../components/Button';
import { GoogleIcon, Icon } from '../../components/icons/Icon';
import { Input, PasswordInput } from '../../components/Input';
import { Tag } from '../../components/Tag';
import { useUI } from '../../hooks/useStore';
import { emailNaoConfirmado, signIn, traduzirErroSupabase } from '../../services/auth';
import { isSupabaseConfigured } from '../../services/supabase';
import { navigate } from '../../services/router';
import { getProfile, getRole, profileNeedsCompleting, refreshSession } from '../../services/store';
import type { Role } from '../../types/models';

interface LoginUI {
  identifier: string;
  password: string;
  visible: boolean;
  role: Role;
  submitting: boolean;
  error: string | null;
}

const REAL = isSupabaseConfigured();

export default function Login() {
  const [ui, setUi] = useUI<LoginUI>('login', {
    identifier: '',
    password: '',
    visible: false,
    role: 'trabalhador',
    submitting: false,
    error: null
  });

  function submit() {
    if (REAL && (!ui.identifier.trim() || !ui.password)) {
      setUi({ error: 'Preencha e-mail e senha para entrar.' });
      return;
    }
    setUi({ submitting: true, error: null });
    signIn({ role: ui.role, email: ui.identifier, password: ui.password })
      .then(() => REAL ? refreshSession() : undefined)
      .then(() => {
        setUi({ submitting: false });
        if (REAL && !getProfile()) {
          // O gatilho que cria o profile pode não ter terminado ainda logo após o cadastro; segue
          // para completar o perfil mesmo assim (a tela recarrega o profile ao salvar).
          navigate('/completar-perfil/' + ui.role, { replace: true });
          return;
        }
        if (REAL && profileNeedsCompleting()) {
          navigate('/completar-perfil/' + getRole(), { replace: true });
          return;
        }
        navigate('/mural', { replace: true });
      })
      .catch((error: unknown) => {
        setUi({
          submitting: false,
          error: emailNaoConfirmado(error as { code?: string })
            ? 'E-mail não verificado. Acesse sua caixa de entrada e clique no link de ativação.'
            : traduzirErroSupabase(error as { code?: string; message?: string })
        });
      });
  }

  function indisponivel(recurso: string) {
    setUi({ error: `${recurso} ainda não está disponível nesta versão.` });
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
          {ui.error ? (
            <div className="flex gap-2.5 items-start p-3.5 bg-danger-50 border border-danger-500 rounded-card">
              <Icon name="circle-alert" size={18} color="var(--red-500)" />
              <span className="text-sm text-danger-500">{ui.error}</span>
            </div>
          ) : null}
          <Input
            id="login-identifier"
            label={REAL ? 'E-mail' : 'E-mail, CPF ou CNPJ'}
            placeholder="voce@email.com"
            icon="mail"
            type="email"
            value={ui.identifier}
            onInput={(v) => setUi({ identifier: v, error: null })}
          />
          <PasswordInput
            id="login-password"
            value={ui.password}
            visible={ui.visible}
            onToggleVisible={() => setUi({ visible: !ui.visible })}
            onInput={(v) => setUi({ password: v, error: null })}
          />
          {REAL ? null : (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-concrete-900">Entrar como (demonstração)</span>
              <div className="flex gap-2">
                <Tag
                  label="Trabalhador"
                  selected={ui.role === 'trabalhador'}
                  onClick={() => setUi({ role: 'trabalhador' })}
                />
                <Tag
                  label="Recrutador"
                  selected={ui.role === 'recrutador'}
                  onClick={() => setUi({ role: 'recrutador' })}
                />
              </div>
            </div>
          )}
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
            onClick={REAL ? () => indisponivel('Login com Google') : submit}
          />
          <Button
            label="Continuar com o celular"
            variant="secondary"
            fullWidth
            iconLeft="phone-call"
            onClick={REAL ? () => indisponivel('Login com celular') : submit}
          />
        </div>
        <div className="flex flex-col items-center gap-1">
          <Button label="Esqueci minha senha" variant="ghost" onClick={() => navigate('/esqueci-senha')} />
          <Button label="Criar minha conta" variant="ghost" onClick={() => navigate('/escolha-perfil')} />
        </div>
      </div>
    </div>
  );
}
