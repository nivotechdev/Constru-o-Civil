import { h } from '../../dom.js';
import { Button } from '../../components/Button.js';
import { RadioCard } from '../../components/Radio.js';
import { BackBar } from '../../components/TopBar.js';
import { getUI, setUI } from '../../store.js';
import { goBack } from '../../router.js';

const KEY = 'escolhaPerfil';

export default function renderChooseProfile(navigate) {
  const ui = getUI(KEY, { role: 'trabalhador' });

  return h('div', { class: 'min-h-screen flex flex-col bg-concrete-50' },
    BackBar({ title: 'Criar minha conta', onBack: () => goBack('/login') }),
    h('div', { class: 'flex-1 max-w-app w-full mx-auto px-5 sm:px-8 pt-6 sm:pt-10 pb-8 flex flex-col gap-7' },
      h('div', { class: 'flex flex-col gap-2.5' },
        h('span', { class: 'text-xs font-bold tracking-[0.08em] uppercase text-concrete-500' }, 'Criar conta'),
        h('h1', { class: 'font-display font-bold text-3xl text-concrete-900' }, 'Como você vai usar o Bicos?'),
        h('p', { class: 'text-base text-concrete-700' }, 'Dá para trocar depois no seu perfil.')
      ),
      h('div', { class: 'flex flex-col gap-3' },
        RadioCard({
          name: 'perfil-cadastro', icon: 'hard-hat', label: 'Quero pegar bico',
          description: 'Sou pedreiro, servente, pintor ou eletricista',
          checked: ui.role === 'trabalhador', onChange: () => setUI(KEY, { role: 'trabalhador' })
        }),
        RadioCard({
          name: 'perfil-cadastro', icon: 'building-2', label: 'Quero contratar',
          description: 'Represento uma construtora ou uma obra',
          checked: ui.role === 'recrutador', onChange: () => setUI(KEY, { role: 'recrutador' })
        })
      )
    ),
    h('div', { class: 'max-w-app w-full mx-auto px-5 sm:px-8 py-3 sticky bottom-0 bg-white shadow-bar sm:static sm:bg-transparent sm:shadow-none' },
      Button({ label: 'Continuar', size: 'lg', fullWidth: true, iconRight: 'arrow-right', onClick: () => navigate('/cadastro/' + ui.role) })
    )
  );
}
