import { h } from '../../dom.js';
import { Button } from '../../components/Button.js';
import { Input } from '../../components/Input.js';
import { IconButton } from '../../components/IconButton.js';
import { Icon } from '../../utils/icons.js';
import { getUI, setUI } from '../../store.js';
import { isValidEmail } from '../../utils/format.js';
import { goBack } from '../../router.js';

const KEY = 'forgot-password';

export default function renderForgotPassword(navigate) {
  const ui = getUI(KEY, { email: '', error: null, sent: false, submitting: false });

  const content = ui.sent
    ? h('div', { class: 'flex-1 flex flex-col items-center text-center gap-5 px-6 pt-16' },
        h('span', { class: 'inline-flex items-center justify-center w-[4.5rem] h-[4.5rem] rounded-full bg-brand-50' }, Icon('mail-check', { size: 34, color: 'var(--brand)' })),
        h('h1', { class: 'font-display font-bold text-2xl text-concrete-900' }, 'Link enviado'),
        h('p', { class: 'text-base text-concrete-700' }, 'Mandamos um link de redefinição para ', h('strong', { class: 'text-concrete-900' }, ui.email), '. Abra o link para criar uma senha nova.'),
        Button({ label: 'Já abri o link', variant: 'secondary', onClick: () => navigate('/redefinir-senha') })
      )
    : h('div', { class: 'flex-1 flex flex-col gap-7 px-5 sm:px-8 py-8' },
        h('div', { class: 'flex flex-col gap-2.5' },
          h('h1', { class: 'font-display font-bold text-3xl text-concrete-900' }, 'Esqueceu sua senha?'),
          h('p', { class: 'text-base text-concrete-700' }, 'Informe o e-mail da sua conta. Enviamos um link para você criar uma senha nova.')
        ),
        Input({ id: 'forgot-email', label: 'E-mail', placeholder: 'voce@email.com', icon: 'mail', value: ui.email, error: ui.error, onInput: (v) => setUI(KEY, { email: v, error: null }) })
      );

  return h('div', { class: 'min-h-screen flex flex-col bg-white lg:max-w-app lg:mx-auto' },
    h('div', { class: 'flex items-center gap-1.5 min-h-14 px-2 border-b border-concrete-200' },
      IconButton({ icon: 'arrow-left', label: 'Voltar', onClick: () => goBack('/login') }),
      h('span', { class: 'font-display font-semibold text-xl text-concrete-900' }, 'Recuperar senha')
    ),
    content,
    !ui.sent ? h('div', { class: 'px-5 sm:px-8 py-3' },
      Button({
        label: 'Enviar link', size: 'lg', fullWidth: true, loading: ui.submitting,
        onClick: () => {
          if (!isValidEmail(ui.email)) { setUI(KEY, { error: 'E-mail inválido. Confira se tem @ e o domínio.' }); return; }
          setUI(KEY, { submitting: true });
          setTimeout(() => setUI(KEY, { submitting: false, sent: true }), 600);
        }
      })
    ) : null
  );
}
