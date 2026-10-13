import { h } from '../../dom.js';
import { BackBar } from '../../components/TopBar.js';
import { Input } from '../../components/Input.js';
import { Select } from '../../components/Select.js';
import { Tag } from '../../components/Tag.js';
import { PhotoSlot } from '../../components/PhotoSlot.js';
import { Button } from '../../components/Button.js';
import { getUI, setUI, currentWorker } from '../../store.js';
import { goBack } from '../../router.js';
import { CARGOS_TRABALHADOR, REGIOES_TRABALHADOR, ESPECIALIDADES } from '../../data/seed.js';

const KEY = 'edit-worker-profile';
const BANNER_KEY = 'worker-profile-photo';

export default function renderEditWorkerProfile(navigate) {
  const worker = currentWorker();
  const ui = getUI(KEY, () => ({ name: worker.name, role: worker.role, region: worker.region, specialties: [...worker.specialties], photo: null }));
  const banner = getUI(BANNER_KEY, { photo: null });

  return h('div', { class: 'min-h-screen flex flex-col bg-concrete-50 lg:bg-transparent lg:min-h-0' },
    BackBar({ title: 'Editar perfil', onBack: () => goBack('/perfil') }),
    h('div', { class: 'flex-1 flex flex-col gap-5 px-4 sm:px-6 lg:px-0 py-4' },
      h('div', { class: 'flex flex-col gap-1.5' },
        h('span', { class: 'text-sm font-semibold text-concrete-900' }, 'Foto de capa'),
        PhotoSlot({ shape: 'rect', height: '9rem', placeholder: 'Toque para escolher uma foto de capa', value: banner.photo, onChange: (v) => setUI(BANNER_KEY, { photo: v }) })
      ),
      h('div', { class: 'flex flex-col items-center gap-2' },
        PhotoSlot({ shape: 'circle', value: ui.photo, onChange: (v) => setUI(KEY, { photo: v }), className: 'w-24 h-24', placeholder: 'Sua foto' })
      ),
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
      h('div', { class: 'pt-2 border-t border-concrete-200' }, Button({ label: 'Sair da conta', variant: 'danger', fullWidth: true, iconLeft: 'log-out', onClick: () => navigate('/login') }))
    ),
    h('div', { class: 'px-4 sm:px-6 lg:px-0 py-3 bg-white shadow-bar flex gap-3 lg:static lg:bg-transparent lg:shadow-none' },
      Button({ label: 'Cancelar', variant: 'secondary', className: 'flex-1', onClick: () => navigate('/perfil') }),
      Button({ label: 'Salvar alterações', className: 'flex-[1.4]', onClick: () => { Object.assign(worker, { name: ui.name, role: ui.role, region: ui.region, specialties: ui.specialties }); navigate('/perfil'); } })
    )
  );
}
