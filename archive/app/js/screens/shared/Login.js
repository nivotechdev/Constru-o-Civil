import { h } from '../../dom.js';
import { Button } from '../../components/Button.js';
import { Input, PasswordInput } from '../../components/Input.js';
import { Tag } from '../../components/Tag.js';
import { Icon, GoogleIcon } from '../../utils/icons.js';
import { getUI, setUI, setRole } from '../../store.js';

const KEY = 'login';

export default function renderLogin(navigate) {
  const ui = getUI(KEY, { identifier: '', password: '', visible: false, role: 'trabalhador', submitting: false });

  function submit() {
    setUI(KEY, { submitting: true });
    setTimeout(() => {
      setRole(ui.role);
      setUI(KEY, { submitting: false });
      navigate('/mural');
    }, 500);
  }

  return h('div', { class: 'min-h-screen bg-white' },
    h('div', { class: 'max-w-app mx-auto px-6 sm:px-8 pt-14 pb-10 flex flex-col gap-8' },
      h('div', { class: 'flex flex-col items-center gap-5 text-center' },
        h('span', { class: 'inline-flex items-center justify-center w-11 h-11 rounded-xl bg-brand-500' }, Icon('hammer', { size: 22, color: '#fff' })),
        h('h1', { class: 'font-display font-bold text-3xl text-concrete-900' }, 'Olá de novo')
      ),
      h('div', { class: 'flex flex-col gap-5' },
        Input({
          id: 'login-identifier', label: 'E-mail, CPF ou CNPJ', placeholder: 'voce@email.com', icon: 'mail',
          value: ui.identifier,
          onInput: (v) => setUI(KEY, { identifier: v })
        }),
        PasswordInput({
          id: 'login-password', value: ui.password, visible: ui.visible,
          onToggleVisible: () => setUI(KEY, { visible: !ui.visible }), onInput: (v) => setUI(KEY, { password: v })
        }),
        h('div', { class: 'flex flex-col gap-2' },
          h('span', { class: 'text-sm font-semibold text-concrete-900' }, 'Entrar como (demonstração)'),
          h('div', { class: 'flex gap-2' },
            Tag({ label: 'Trabalhador', selected: ui.role === 'trabalhador', onClick: () => setUI(KEY, { role: 'trabalhador' }) }),
            Tag({ label: 'Recrutador', selected: ui.role === 'recrutador', onClick: () => setUI(KEY, { role: 'recrutador' }) })
          )
        ),
        Button({ label: 'Entrar', size: 'lg', fullWidth: true, loading: ui.submitting, onClick: submit }),
        h('div', { class: 'flex items-center gap-3 py-1' },
          h('span', { class: 'flex-1 h-px bg-concrete-200' }), h('span', { class: 'text-xs text-concrete-500' }, 'ou'), h('span', { class: 'flex-1 h-px bg-concrete-200' })
        ),
        Button({ label: 'Continuar com o Google', variant: 'secondary', fullWidth: true, iconLeftEl: GoogleIcon({ size: 20 }), onClick: submit }),
        Button({ label: 'Continuar com o celular', variant: 'secondary', fullWidth: true, iconLeft: 'phone-call', onClick: submit })
      ),
      h('div', { class: 'flex flex-col items-center gap-1' },
        Button({ label: 'Esqueci minha senha', variant: 'ghost', onClick: () => navigate('/esqueci-senha') }),
        Button({ label: 'Criar minha conta', variant: 'ghost', onClick: () => navigate('/escolha-perfil') })
      )
    )
  );
}
