import { h } from '../../dom.js';
import { BackBar } from '../../components/TopBar.js';
import { Input } from '../../components/Input.js';
import { Select } from '../../components/Select.js';
import { Button } from '../../components/Button.js';
import { PhotoSlot } from '../../components/PhotoSlot.js';
import { Icon } from '../../utils/icons.js';
import { getUI, setUI, currentCompany } from '../../store.js';
import { goBack } from '../../router.js';
import { TIPOS_OBRA } from '../../data/seed.js';

const KEY = 'edit-company-profile';
const BANNER_KEY = 'company-profile';

export default function renderEditCompanyProfile(navigate) {
  const company = currentCompany();
  const ui = getUI(KEY, () => ({ name: company.name, tipoObra: company.tipoObra, location: company.location, whatsapp: company.whatsapp }));
  const banner = getUI(BANNER_KEY, { capa: null, logo: null, deleteId: null });

  return h('div', { class: 'min-h-screen flex flex-col bg-concrete-50 lg:bg-transparent lg:min-h-0' },
    BackBar({ title: 'Editar empresa', onBack: () => goBack('/empresa') }),
    h('div', { class: 'flex-1 flex flex-col gap-5 px-4 sm:px-6 lg:px-0 py-4' },
      h('div', { class: 'flex flex-col gap-1.5' },
        h('span', { class: 'text-sm font-semibold text-concrete-900' }, 'Foto de capa'),
        PhotoSlot({ shape: 'rect', height: '9rem', placeholder: 'Capa da construtora', value: banner.capa, onChange: (v) => setUI(BANNER_KEY, { capa: v }) })
      ),
      h('div', { class: 'flex flex-col items-center gap-2' },
        PhotoSlot({ shape: 'circle', value: banner.logo, onChange: (v) => setUI(BANNER_KEY, { logo: v }), className: 'w-24 h-24', placeholder: 'Logo' })
      ),
      Input({ id: 'edit-company-name', label: 'Nome da empresa', icon: 'building-2', hint: 'É esse nome que aparece no seu perfil e nas vagas que você publicar.', value: ui.name, onInput: (v) => setUI(KEY, { name: v }) }),
      h('div', { class: 'flex flex-col gap-1.5 w-full' },
        h('span', { class: 'text-sm font-semibold text-concrete-900' }, 'CNPJ'),
        h('div', { class: 'flex items-center gap-2 min-h-12 px-3 bg-concrete-100 rounded-control border border-concrete-200' },
          Icon('lock', { size: 18, color: 'var(--text-subtle)' }),
          h('span', { class: 'flex-1 min-w-0 font-mono text-base text-concrete-500 truncate' }, company.cnpj)
        ),
        h('span', { class: 'text-sm text-concrete-500' }, 'O CNPJ é conferido na Bicos e não pode ser alterado. Fale com o suporte se precisar corrigi-lo.')
      ),
      Select({ label: 'Tipo de obra', options: TIPOS_OBRA, value: ui.tipoObra, onChange: (v) => setUI(KEY, { tipoObra: v }) }),
      Input({ id: 'edit-company-location', label: 'Região onde você contrata', icon: 'map-pin', value: ui.location, onInput: (v) => setUI(KEY, { location: v }) }),
      Input({ id: 'edit-company-whatsapp', label: 'WhatsApp de contato', icon: 'phone', value: ui.whatsapp, onInput: (v) => setUI(KEY, { whatsapp: v }) }),
      h('div', { class: 'pt-2 border-t border-concrete-200' }, Button({ label: 'Sair da conta', variant: 'danger', fullWidth: true, iconLeft: 'log-out', onClick: () => navigate('/login') }))
    ),
    h('div', { class: 'px-4 sm:px-6 lg:px-0 py-3 bg-white shadow-bar flex gap-3 lg:static lg:bg-transparent lg:shadow-none' },
      Button({ label: 'Cancelar', variant: 'secondary', className: 'flex-1', onClick: () => navigate('/empresa') }),
      Button({ label: 'Salvar alterações', className: 'flex-[1.4]', onClick: () => { Object.assign(company, ui); navigate('/empresa'); } })
    )
  );
}
