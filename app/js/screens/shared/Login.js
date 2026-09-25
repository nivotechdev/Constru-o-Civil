import { h } from '../../dom.js';
import { Button } from '../../components/Button.js';
import { Input, PasswordInput } from '../../components/Input.js';
import { Icon, GoogleIcon } from '../../utils/icons.js';
import { getUI, setUI, signIn } from '../../store.js';
import { traduzirErroSupabase, emailNaoConfirmado } from '../../utils/erros.js';

const KEY = 'login';

function ErrorBanner(message) {
  if (!message) return null;
  return h('div', { class: 'flex gap-2.5 items-start p-3.5 bg-danger-50 border border-danger-500 rounded-card' },
    Icon('circle-alert', { size: 18, color: 'var(--red-500)' }),
    h('span', { class: 'text-sm text-danger-500' }, message)
  );
}

export default function renderLogin(navigate) {
  const ui = getUI(KEY, { identifier: '', password: '', visible: false, submitting: false, error: null });

  async function submit() {
    if (!ui.identifier.trim() || !ui.password) {
      setUI(KEY, { error: 'Preencha e-mail e senha para entrar.' });
      return;
    }
    setUI(KEY, { submitting: true, error: null });
    try {
      await signIn({ email: ui.identifier.trim().toLowerCase(), senha: ui.password });
      setUI(KEY, { submitting: false, identifier: '', password: '' });
      navigate('/mural', { replace: true });
    } catch (error) {
      setUI(KEY, {
        submitting: false,
        error: emailNaoConfirmado(error)
          ? 'E-mail não verificado. Acesse sua caixa de entrada e clique no link de ativação.'
          : traduzirErroSupabase(error)
      });
    }
  }

  function indisponivel(recurso) {
    setUI(KEY, { error: `${recurso} ainda não está disponível nesta versão.` });
  }

  return h('div', { class: 'min-h-screen bg-white' },
    h('div', { class: 'max-w-app mx-auto px-6 sm:px-8 pt-14 pb-10 flex flex-col gap-8' },
      h('div', { class: 'flex flex-col items-center gap-5 text-center' },
        h('span', { class: 'inline-flex items-center justify-center w-11 h-11 rounded-xl bg-brand-500' }, Icon('hammer', { size: 22, color: '#fff' })),
        h('h1', { class: 'font-display font-bold text-3xl text-concrete-900' }, 'Olá de novo')
      ),
      h('div', { class: 'flex flex-col gap-5' },
        ErrorBanner(ui.error),
        Input({
          id: 'login-identifier', label: 'E-mail', placeholder: 'voce@email.com', icon: 'mail',
          type: 'email', value: ui.identifier,
          onInput: (v) => setUI(KEY, { identifier: v, error: null })
        }),
        PasswordInput({
          id: 'login-password', value: ui.password, visible: ui.visible,
          onToggleVisible: () => setUI(KEY, { visible: !ui.visible }), onInput: (v) => setUI(KEY, { password: v, error: null })
        }),
        Button({ label: 'Entrar', size: 'lg', fullWidth: true, loading: ui.submitting, onClick: submit }),
        h('div', { class: 'flex items-center gap-3 py-1' },
          h('span', { class: 'flex-1 h-px bg-concrete-200' }), h('span', { class: 'text-xs text-concrete-500' }, 'ou'), h('span', { class: 'flex-1 h-px bg-concrete-200' })
        ),
        Button({ label: 'Continuar com o Google', variant: 'secondary', fullWidth: true, iconLeftEl: GoogleIcon({ size: 20 }), onClick: () => indisponivel('Login com Google') }),
        Button({ label: 'Continuar com o celular', variant: 'secondary', fullWidth: true, iconLeft: 'phone-call', onClick: () => indisponivel('Login com celular') })
      ),
      h('div', { class: 'flex flex-col items-center gap-1' },
        Button({ label: 'Esqueci minha senha', variant: 'ghost', onClick: () => navigate('/esqueci-senha') }),
        Button({ label: 'Criar minha conta', variant: 'ghost', onClick: () => navigate('/escolha-perfil') })
      )
    )
  );
}
