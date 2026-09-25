import { h } from '../../dom.js';
import { Button } from '../../components/Button.js';
import { PasswordInput } from '../../components/Input.js';
import { IconButton } from '../../components/IconButton.js';
import { Icon } from '../../utils/icons.js';
import { getUI, setUI, updatePassword, isSignedIn, signOut } from '../../store.js';
import { passwordStrength, STRENGTH_LABEL } from '../../utils/format.js';
import { goBack } from '../../router.js';
import { traduzirErroSupabase } from '../../utils/erros.js';

const KEY = 'reset-password';

export default function renderResetPassword(navigate) {
  const ui = getUI(KEY, { senha: '', confirm: '', visible: false, error: null, done: false, submitting: false });
  const strength = passwordStrength(ui.senha);
  const strengthColor = strength === 3 ? 'bg-success-500' : strength ? 'bg-warning-500' : 'bg-concrete-200';

  if (ui.done) {
    return h('div', { class: 'min-h-screen flex flex-col items-center justify-center text-center gap-5 px-6 bg-white lg:max-w-app lg:mx-auto' },
      h('span', { class: 'inline-flex items-center justify-center w-[4.5rem] h-[4.5rem] rounded-full bg-success-50' }, Icon('circle-check', { size: 34, color: 'var(--green-500)' })),
      h('h1', { class: 'font-display font-bold text-2xl text-concrete-900' }, 'Senha redefinida'),
      h('p', { class: 'text-base text-concrete-700' }, 'Use sua nova senha para entrar na sua conta.'),
      Button({ label: 'Ir para o login', size: 'lg', onClick: () => navigate('/login') })
    );
  }

  // Sem sessão de recovery ativa (link expirado, já usado, ou a tela foi
  // aberta direto sem vir de um e-mail de redefinição).
  if (!isSignedIn()) {
    return h('div', { class: 'min-h-screen flex flex-col items-center justify-center text-center gap-5 px-6 bg-white lg:max-w-app lg:mx-auto' },
      h('span', { class: 'inline-flex items-center justify-center w-[4.5rem] h-[4.5rem] rounded-full bg-danger-50' }, Icon('triangle-alert', { size: 34, color: 'var(--red-500)' })),
      h('h1', { class: 'font-display font-bold text-2xl text-concrete-900' }, 'Link inválido ou expirado'),
      h('p', { class: 'text-base text-concrete-700' }, 'Peça um novo link de redefinição de senha.'),
      Button({ label: 'Pedir novo link', size: 'lg', onClick: () => navigate('/esqueci-senha', { replace: true }) })
    );
  }

  return h('div', { class: 'min-h-screen flex flex-col bg-white lg:max-w-app lg:mx-auto' },
    h('div', { class: 'flex items-center gap-1.5 min-h-14 px-2 border-b border-concrete-200' },
      IconButton({ icon: 'arrow-left', label: 'Voltar', onClick: () => goBack('/login') }),
      h('span', { class: 'font-display font-semibold text-xl text-concrete-900' }, 'Criar nova senha')
    ),
    h('div', { class: 'flex-1 flex flex-col gap-7 px-5 sm:px-8 py-8' },
      h('div', { class: 'flex flex-col gap-2.5' },
        h('h1', { class: 'font-display font-bold text-3xl text-concrete-900' }, 'Escolha uma senha nova'),
        h('p', { class: 'text-base text-concrete-700' }, 'Use 8 caracteres ou mais, misturando letras e números.')
      ),
      PasswordInput({ id: 'reset-senha', value: ui.senha, visible: ui.visible, onToggleVisible: () => setUI(KEY, { visible: !ui.visible }), onInput: (v) => setUI(KEY, { senha: v, error: null }) }),
      h('div', { class: 'flex items-center gap-3' },
        h('span', { class: 'flex-1 h-1 rounded-full bg-concrete-200 overflow-hidden' }, h('span', { class: `block h-full rounded-full ${strengthColor}`, style: { width: (strength / 3 * 100) + '%' } })),
        h('span', { class: 'text-sm text-concrete-500 whitespace-nowrap' }, STRENGTH_LABEL[strength] || 'Senha fraca')
      ),
      PasswordInput({ id: 'reset-confirm', label: 'Confirme a senha nova', value: ui.confirm, visible: ui.visible, onToggleVisible: () => setUI(KEY, { visible: !ui.visible }), error: ui.error, onInput: (v) => setUI(KEY, { confirm: v, error: null }) })
    ),
    h('div', { class: 'px-5 sm:px-8 py-3' },
      Button({
        label: 'Salvar nova senha', size: 'lg', fullWidth: true, loading: ui.submitting,
        onClick: async () => {
          if (ui.senha.length < 8) { setUI(KEY, { error: 'Senha curta. Use 8 caracteres ou mais.' }); return; }
          if (ui.senha !== ui.confirm) { setUI(KEY, { error: 'As senhas não são iguais. Confira os dois campos.' }); return; }
          setUI(KEY, { submitting: true, error: null });
          try {
            await updatePassword(ui.senha);
            await signOut();
            setUI(KEY, { submitting: false, done: true });
          } catch (error) {
            setUI(KEY, { submitting: false, error: traduzirErroSupabase(error) });
          }
        }
      })
    )
  );
}
