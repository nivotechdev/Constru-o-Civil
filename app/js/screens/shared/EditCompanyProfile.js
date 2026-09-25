import { h } from '../../dom.js';
import { BackBar } from '../../components/TopBar.js';
import { Input } from '../../components/Input.js';
import { Select } from '../../components/Select.js';
import { Button } from '../../components/Button.js';
import { PhotoSlot } from '../../components/PhotoSlot.js';
import { Icon } from '../../utils/icons.js';
import { getUI, setUI, currentCompany, updateProfile, uploadImage, signOut, ensureMyDocumentoLoaded } from '../../store.js';
import { goBack } from '../../router.js';
import { traduzirErroSupabase } from '../../utils/erros.js';
import { TIPOS_OBRA } from '../../data/seed.js';

const KEY = 'edit-company-profile';

export default function renderEditCompanyProfile(navigate) {
  ensureMyDocumentoLoaded();
  const company = currentCompany();
  const ui = getUI(KEY, () => ({
    name: company.name, tipoObra: company.tipoObra, location: company.location, whatsapp: company.whatsapp,
    capa: company.capa_url || null, capaFile: null, logo: company.foto_url || null, logoFile: null,
    saving: false, error: null
  }));

  async function save() {
    setUI(KEY, { saving: true, error: null });
    try {
      const patch = { nome: ui.name, tipo_obra: ui.tipoObra, regiao_atuacao: ui.location, whatsapp: ui.whatsapp };
      if (ui.capaFile) patch.capa_url = await uploadImage(ui.capaFile, 'capa');
      if (ui.logoFile) patch.foto_url = await uploadImage(ui.logoFile, 'avatar');
      await updateProfile(patch);
      setUI(KEY, { saving: false, capaFile: null, logoFile: null });
      navigate('/empresa');
    } catch (error) {
      setUI(KEY, { saving: false, error: traduzirErroSupabase(error) });
    }
  }

  return h('div', { class: 'min-h-screen flex flex-col bg-concrete-50 lg:bg-transparent lg:min-h-0' },
    BackBar({ title: 'Editar empresa', onBack: () => goBack('/empresa') }),
    h('div', { class: 'flex-1 flex flex-col gap-5 px-4 sm:px-6 py-4' },
      h('div', { class: 'flex flex-col gap-1.5' },
        h('span', { class: 'text-sm font-semibold text-concrete-900' }, 'Foto de capa'),
        PhotoSlot({ shape: 'rect', height: '9rem', placeholder: 'Capa da construtora', value: ui.capa, onChange: (url, file) => setUI(KEY, { capa: url, capaFile: file }) })
      ),
      h('div', { class: 'flex flex-col items-center gap-2' },
        PhotoSlot({ shape: 'circle', value: ui.logo, onChange: (url, file) => setUI(KEY, { logo: url, logoFile: file }), className: 'w-24 h-24', placeholder: 'Logo' })
      ),
      ui.error ? h('span', { class: 'text-sm text-danger-500' }, ui.error) : null,
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
      h('div', { class: 'pt-2 border-t border-concrete-200' }, Button({ label: 'Sair da conta', variant: 'danger', fullWidth: true, iconLeft: 'log-out', onClick: async () => { await signOut(); navigate('/login', { replace: true }); } }))
    ),
    h('div', { class: 'px-4 sm:px-6 py-3 bg-white shadow-bar flex gap-3 lg:static lg:bg-transparent lg:shadow-none' },
      Button({ label: 'Cancelar', variant: 'secondary', className: 'flex-1', onClick: () => navigate('/empresa') }),
      Button({ label: 'Salvar alterações', className: 'flex-[1.4]', loading: ui.saving, onClick: save })
    )
  );
}
