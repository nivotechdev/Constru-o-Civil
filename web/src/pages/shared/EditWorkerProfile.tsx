import { BackBar } from '../../components/BackBar';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { PhotoSlot } from '../../components/PhotoSlot';
import { Select } from '../../components/Select';
import { Tag } from '../../components/Tag';
import { useDb, useUI } from '../../hooks/useStore';
import { CARGOS_TRABALHADOR, ESPECIALIDADES, REGIOES_TRABALHADOR } from '../../services/catalog';
import { goBack, navigate } from '../../services/router';
import { currentWorker } from '../../services/selectors';
import { WORKER_PHOTO_DEFAULTS, WORKER_PHOTO_KEY, type WorkerPhotoUI } from '../../services/sharedUI';
import { updateWorker } from '../../services/store';
import { toggleItem } from '../../utils/list';

interface EditWorkerUI {
  name: string;
  role: string;
  region: string;
  specialties: string[];
  photo: string | null;
}

export default function EditWorkerProfile() {
  const worker = currentWorker(useDb());
  // Seeded from the profile the first time only; the draft then survives navigation (legacy behaviour).
  const [ui, setUi] = useUI<EditWorkerUI>('edit-worker-profile', () => ({
    name: worker.name,
    role: worker.role,
    region: worker.region,
    specialties: [...worker.specialties],
    photo: null
  }));
  const [banner, setBanner] = useUI<WorkerPhotoUI>(WORKER_PHOTO_KEY, WORKER_PHOTO_DEFAULTS);

  return (
    <div className="min-h-screen flex flex-col bg-concrete-50 lg:bg-transparent lg:min-h-0">
      <BackBar title="Editar perfil" onBack={() => goBack('/perfil')} />
      <div className="flex-1 flex flex-col gap-5 px-4 sm:px-6 lg:px-0 py-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-concrete-900">Foto de capa</span>
          <PhotoSlot
            shape="rect"
            height="9rem"
            placeholder="Toque para escolher uma foto de capa"
            value={banner.photo}
            onChange={(v) => setBanner({ photo: v })}
          />
        </div>
        <div className="flex flex-col items-center gap-2">
          <PhotoSlot
            shape="circle"
            value={ui.photo}
            onChange={(v) => setUi({ photo: v })}
            className="w-24 h-24"
            placeholder="Sua foto"
          />
        </div>
        <Input
          id="edit-worker-name"
          label="Nome completo"
          icon="user"
          value={ui.name}
          onInput={(v) => setUi({ name: v })}
        />
        <Select
          label="Cargo ou especialidade principal"
          options={CARGOS_TRABALHADOR}
          value={ui.role}
          onChange={(v) => setUi({ role: v })}
        />
        <Select
          label="Região de atuação"
          options={REGIOES_TRABALHADOR}
          value={ui.region}
          onChange={(v) => setUi({ region: v })}
        />
        <div className="flex flex-col gap-2.5">
          <span className="text-sm font-semibold text-concrete-900">Especialidades</span>
          <div className="flex flex-wrap gap-2">
            {ESPECIALIDADES.map((e) => (
              <Tag
                key={e}
                label={e}
                selected={ui.specialties.includes(e)}
                onClick={() =>
                  setUi({
                    specialties: toggleItem(ui.specialties, e)
                  })
                }
              />
            ))}
          </div>
        </div>
        <div className="pt-2 border-t border-concrete-200">
          <Button
            label="Sair da conta"
            variant="danger"
            fullWidth
            iconLeft="log-out"
            onClick={() => navigate('/login')}
          />
        </div>
      </div>
      <div className="px-4 sm:px-6 lg:px-0 py-3 bg-white shadow-bar flex gap-3 lg:static lg:bg-transparent lg:shadow-none">
        <Button label="Cancelar" variant="secondary" className="flex-1" onClick={() => navigate('/perfil')} />
        <Button
          label="Salvar alterações"
          className="flex-[1.4]"
          onClick={() => {
            updateWorker(worker.id, { name: ui.name, role: ui.role, region: ui.region, specialties: ui.specialties });
            navigate('/perfil');
          }}
        />
      </div>
    </div>
  );
}
