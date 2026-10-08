import { h } from '../../dom.js';
import { Button } from '../../components/Button.js';
import { Card } from '../../components/Card.js';
import { Icon } from '../../utils/icons.js';
import { getUI } from '../../store.js';

export default function renderVerifyEmail(navigate) {
  const flow = getUI('authFlow', { role: 'trabalhador', email: 'voce@email.com' });

  return h('div', { class: 'min-h-screen flex flex-col bg-concrete-50 lg:max-w-app lg:mx-auto' },
    h('div', { class: 'flex-1 flex flex-col items-center text-center gap-6 px-6 pt-16 pb-8' },
      h('span', { class: 'inline-flex items-center justify-center w-[4.5rem] h-[4.5rem] rounded-full bg-brand-50' }, Icon('mail-check', { size: 34, color: 'var(--brand)' })),
      h('div', { class: 'flex flex-col gap-2' },
        h('h1', { class: 'font-display font-bold text-2xl text-concrete-900' }, 'Conta criada. Confirme seu e-mail'),
        h('p', { class: 'text-base text-concrete-700' }, 'Enviamos um link de confirmação para ', h('strong', { class: 'text-concrete-900' }, flow.email), '. Abra o link para ativar sua conta.')
      ),
      Card({ tone: 'sunken', padding: 'md', className: 'w-full text-left' },
        h('div', { class: 'flex flex-col gap-3' },
          h('div', { class: 'flex gap-2.5 items-center' }, Icon('clock', { size: 20, color: 'var(--text-subtle)' }), h('span', { class: 'text-sm text-concrete-700' }, 'O link vale por 24 horas.')),
          h('div', { class: 'flex gap-2.5 items-center' }, Icon('search-x', { size: 20, color: 'var(--text-subtle)' }), h('span', { class: 'text-sm text-concrete-700' }, 'Não chegou? Confira a caixa de spam.'))
        )
      )
    ),
    h('div', { class: 'px-6 pb-8 flex flex-col gap-2' },
      Button({ label: 'Abrir meu e-mail', size: 'lg', fullWidth: true, iconLeft: 'mail', onClick: () => navigate('/completar-perfil/' + flow.role) }),
      Button({ label: 'Reenviar o link', variant: 'ghost', fullWidth: true, onClick: () => {} })
    )
  );
}
