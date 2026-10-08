import { h } from '../../dom.js';
import { BackBar } from '../../components/TopBar.js';
import { Icon } from '../../utils/icons.js';
import { getRole } from '../../store.js';
import { goBack } from '../../router.js';

function Row({ icon, label, description, onClick, danger = false }) {
  return h('button', {
    type: 'button', onClick,
    class: 'flex items-center gap-3.5 w-full min-h-14 px-4 py-3 bg-white text-left hover:bg-concrete-50 transition-colors'
  },
    h('span', { class: `shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-full ${danger ? 'bg-danger-50' : 'bg-concrete-100'}` }, Icon(icon, { size: 18, color: danger ? 'var(--red-500)' : 'var(--gray-600)' })),
    h('span', { class: 'flex-1 min-w-0 flex flex-col' },
      h('span', { class: `font-semibold ${danger ? 'text-danger-500' : 'text-concrete-900'}` }, label),
      description ? h('span', { class: 'text-sm text-concrete-500' }, description) : null
    ),
    Icon('chevron-right', { size: 18, color: 'var(--gray-400)' })
  );
}

function Section(title, rowsEl) {
  return h('div', { class: 'flex flex-col gap-2' },
    title ? h('div', { class: 'px-4 text-xs font-bold tracking-[0.08em] uppercase text-concrete-500' }, title) : null,
    h('div', { class: 'flex flex-col divide-y divide-concrete-200 bg-white border border-concrete-200 rounded-card overflow-hidden mx-4 sm:mx-0' }, ...rowsEl)
  );
}

export default function renderSettings(navigate) {
  const role = getRole();
  return h('div', { class: 'min-h-screen flex flex-col bg-concrete-50 gap-6 pb-8 lg:bg-transparent lg:min-h-0' },
    BackBar({ title: 'Configurações', onBack: () => goBack(role === 'recrutador' ? '/empresa' : '/perfil') }),
    h('div', { class: 'flex flex-col gap-6 sm:px-0' },
      Section('Conta', [
        Row({ icon: 'user', label: 'Editar perfil', onClick: () => navigate(role === 'recrutador' ? '/empresa/editar' : '/perfil/editar') }),
        Row({ icon: 'lock', label: 'Trocar senha', onClick: () => navigate('/esqueci-senha') })
      ]),
      Section('Preferências', [
        Row({ icon: 'bell', label: 'Notificações', description: 'Bicos urgentes, candidaturas e mensagens', onClick: () => navigate('/notificacoes') }),
        Row({ icon: 'shield-check', label: 'Privacidade e dados', description: 'Exportar ou excluir sua conta', onClick: () => navigate('/configuracoes/privacidade') })
      ]),
      Section('Sobre', [
        Row({ icon: 'file-check', label: 'Termos de uso', onClick: () => {} }),
        Row({ icon: 'shield-check', label: 'Política de privacidade', onClick: () => {} })
      ]),
      Section('', [
        Row({ icon: 'log-out', label: 'Sair da conta', danger: true, onClick: () => navigate('/login') })
      ])
    )
  );
}
