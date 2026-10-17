import { h } from '../../dom.js';
import { Button } from '../../components/Button.js';

export default function renderSplash(navigate) {
  return h('div', { class: 'min-h-screen flex flex-col bg-brand-500' },
    h('div', { class: 'flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center' },
      h('span', { class: 'font-display font-bold text-5xl sm:text-6xl text-white tracking-tight' }, 'Bicos'),
      h('p', { class: 'max-w-xs sm:max-w-sm text-base sm:text-lg text-white/85' }, 'Diárias de obra perto de você. Sem taxa para o trabalhador.')
    ),
    h('div', { class: 'flex flex-col gap-3 px-6 pb-10 sm:pb-14 w-full max-w-app mx-auto' },
      Button({ label: 'Entrar', size: 'lg', fullWidth: true, variant: 'secondary', onClick: () => navigate('/login') }),
      Button({ label: 'Criar minha conta', size: 'lg', fullWidth: true, variant: 'inverse', onClick: () => navigate('/escolha-perfil') })
    )
  );
}
