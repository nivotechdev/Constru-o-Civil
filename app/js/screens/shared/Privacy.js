import { h } from '../../dom.js';
import { BackBar } from '../../components/TopBar.js';
import { Card } from '../../components/Card.js';
import { Button } from '../../components/Button.js';
import { Dialog } from '../../components/Modal.js';
import { Icon } from '../../utils/icons.js';
import { getUI, setUI } from '../../store.js';
import { goBack } from '../../router.js';

const KEY = 'privacy';

export default function renderPrivacy(navigate) {
  const ui = getUI(KEY, { exporting: false, exported: false, confirmDelete: false });

  return h('div', { class: 'min-h-screen flex flex-col bg-concrete-50 gap-5 pb-8 lg:bg-transparent lg:min-h-0' },
    BackBar({ title: 'Privacidade e dados', onBack: () => goBack('/configuracoes') }),
    h('div', { class: 'flex flex-col gap-5 px-4 sm:px-0' },
      h('p', { class: 'text-sm text-concrete-600' }, 'De acordo com a LGPD, você pode baixar uma cópia de tudo o que a Bicos guarda sobre você, ou excluir sua conta e seus dados por completo.'),

      Card({ padding: 'md' },
        h('div', { class: 'flex flex-col gap-3' },
          h('div', { class: 'flex gap-3 items-start' },
            Icon('download', { size: 20, color: 'var(--text-subtle)' }),
            h('div', { class: 'flex flex-col gap-1' },
              h('span', { class: 'font-semibold text-concrete-900' }, 'Exportar meus dados'),
              h('span', { class: 'text-sm text-concrete-600' }, 'Perfil, candidaturas, avaliações e mensagens em um arquivo único.')
            )
          ),
          ui.exported
            ? h('span', { class: 'flex items-center gap-2 text-sm text-success-500 font-semibold' }, Icon('circle-check', { size: 16, color: 'var(--green-500)' }), 'Arquivo enviado para o seu e-mail.')
            : Button({ label: 'Exportar meus dados', variant: 'secondary', loading: ui.exporting, onClick: () => { setUI(KEY, { exporting: true }); setTimeout(() => setUI(KEY, { exporting: false, exported: true }), 900); } })
        )
      ),

      Card({ padding: 'md', className: 'border-danger-100' },
        h('div', { class: 'flex flex-col gap-3' },
          h('div', { class: 'flex gap-3 items-start' },
            Icon('triangle-alert', { size: 20, color: 'var(--red-500)' }),
            h('div', { class: 'flex flex-col gap-1' },
              h('span', { class: 'font-semibold text-danger-500' }, 'Excluir minha conta'),
              h('span', { class: 'text-sm text-concrete-600' }, 'Remove seu perfil, candidaturas e histórico. Essa ação não pode ser desfeita.')
            )
          ),
          Button({ label: 'Excluir minha conta', variant: 'danger', onClick: () => setUI(KEY, { confirmDelete: true }) })
        )
      )
    ),
    Dialog({
      open: ui.confirmDelete, tone: 'danger', title: 'Excluir sua conta?',
      description: 'Isso apaga seu perfil, candidaturas e histórico da Bicos para sempre. Não dá para desfazer.',
      confirmLabel: 'Sim, excluir conta', onConfirm: () => navigate('/login'),
      cancelLabel: 'Cancelar', onCancel: () => setUI(KEY, { confirmDelete: false })
    })
  );
}
