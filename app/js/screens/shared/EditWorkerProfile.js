import { h } from '../../dom.js';
import { BackBar } from '../../components/TopBar.js';
import { Input } from '../../components/Input.js';
import { Select } from '../../components/Select.js';
import { Tag } from '../../components/Tag.js';
import { PhotoSlot } from '../../components/PhotoSlot.js';
import { Button } from '../../components/Button.js';
import { getUI, setUI, currentWorker, updateProfile, uploadImage, signOut } from '../../store.js';
import { goBack } from '../../router.js';
import { traduzirErroSupabase } from '../../utils/erros.js';
import { CARGOS_TRABALHADOR, REGIOES_TRABALHADOR, ESPECIALIDADES } from '../../data/seed.js';

const KEY = 'edit-worker-profile';

export default function renderEditWorkerProfile(navigate) {
  const worker = currentWorker();
  const ui = getUI(KEY, () => ({
    name: worker.name, role: worker.role, region: worker.region, specialties: [...worker.specialties],
    photo: worker.foto_url || null, photoFile: null, saving: false, error: null
  }));

  async function save() {
    setUI(KEY, { saving: true, error: null });
    try {
      let foto_url;
      if (ui.photoFile) foto_url = await uploadImage(ui.photoFile, 'avatar');
      await updateProfile(Object.assign(
        { nome: ui.name, cargo: ui.role, regiao: ui.region, especialidades: ui.specialties },
        foto_url ? { foto_url } : {}
      ));
      setUI(KEY, { saving: false, photoFile: null });
      navigate('/perfil');
    } catch (error) {
      setUI(KEY, { saving: false, error: traduzirErroSupabase(error) });
    }
  }

  return h('div', { class: 'min-h-screen flex flex-col bg-concrete-50 lg:bg-transparent lg:min-h-0' },
    BackBar({ title: 'Editar perfil', onBack: () => goBack('/perfil') }),
    h('div', { class: 'flex-1 flex flex-col gap-5 px-4 sm:px-6 py-4' },
      h('div', { class: 'flex flex-col items-center gap-2' },
        PhotoSlot({
          shape: 'circle', value: ui.photo, className: 'w-24 h-24', placeholder: 'Sua foto',
          onChange: (url, file) => setUI(KEY, { photo: url, photoFile: file })
        })
      ),
      ui.error ? h('span', { class: 'text-sm text-danger-500' }, ui.error) : null,
      Input({ id: 'edit-worker-name', label: 'Nome completo', icon: 'user', value: ui.name, onInput: (v) => setUI(KEY, { name: v }) }),
      Select({ label: 'Cargo ou especialidade principal', options: CARGOS_TRABALHADOR, value: ui.role, onChange: (v) => setUI(KEY, { role: v }) }),
      Select({ label: 'Região de atuação', options: REGIOES_TRABALHADOR, value: ui.region, onChange: (v) => setUI(KEY, { region: v }) }),
      h('div', { class: 'flex flex-col gap-2.5' },
        h('span', { class: 'text-sm font-semibold text-concrete-900' }, 'Especialidades'),
        h('div', { class: 'flex flex-wrap gap-2' }, ...ESPECIALIDADES.map((e) => Tag({
          label: e, selected: ui.specialties.includes(e),
          onClick: () => setUI(KEY, { specialties: ui.specialties.includes(e) ? ui.specialties.filter((x) => x !== e) : ui.specialties.concat([e]) })
        })))
      ),
      h('div', { class: 'pt-2 border-t border-concrete-200' }, Button({ label: 'Sair da conta', variant: 'danger', fullWidth: true, iconLeft: 'log-out', onClick: async () => { await signOut(); navigate('/login', { replace: true }); } }))
    ),
    h('div', { class: 'px-4 sm:px-6 py-3 bg-white shadow-bar flex gap-3 lg:static lg:bg-transparent lg:shadow-none' },
      Button({ label: 'Cancelar', variant: 'secondary', className: 'flex-1', onClick: () => navigate('/perfil') }),
      Button({ label: 'Salvar alterações', className: 'flex-[1.4]', loading: ui.saving, onClick: save })
    )
  );
}
