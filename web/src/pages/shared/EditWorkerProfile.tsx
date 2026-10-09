// Editing the worker's own profile. The draft is this screen's own: it starts from the saved profile
// every time the screen opens, and "Cancelar" (or leaving) throws it away — pictures included (Y21/Z12).
import { useEffect, useRef, useState } from 'react';
import { BackBar } from '../../components/BackBar';
import { Button } from '../../components/Button';
import { CityPicker, LocationButton } from '../../components/CityPicker';
import { FieldError } from '../../components/FieldError';
import { Input } from '../../components/Input';
import { PhotoSlot } from '../../components/PhotoSlot';
import { Select } from '../../components/Select';
import { Tag } from '../../components/Tag';
import { useAction } from '../../hooks/useAction';
import { useDb } from '../../hooks/useStore';
import { ESPECIALIDADES, OFICIO_OPTIONS } from '../../services/catalog';
import { saveMyProfileImages, updateMyWorkerProfile, type ProfileImages } from '../../services/profiles';
import { goBack, navigate } from '../../services/router';
import { currentWorker } from '../../services/selectors';
import { showToast } from '../../services/toast';
import { toggleItem } from '../../utils/list';

/** Frees the local copies of pictures that were picked and then dropped. */
function revoke(urls: (string | null | undefined)[]) {
  for (const u of urls) if (u?.startsWith('blob:')) URL.revokeObjectURL(u);
}

export default function EditWorkerProfile() {
  const worker = currentWorker(useDb());
  const [draft, setDraft] = useState(() => ({
    name: worker.name,
    oficioId: worker.oficioId,
    city: worker.city,
    specialties: [...worker.specialties]
  }));
  const [images, setImages] = useState<ProfileImages>({});
  const [pickerOpen, setPickerOpen] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const picked = useRef<ProfileImages>({});
  useEffect(() => {
    picked.current = images;
  }, [images]);
  // Leaving without saving drops the pictures picked here.
  useEffect(() => () => revoke(Object.values(picked.current)), []);

  const save = useAction(
    async () => {
      await updateMyWorkerProfile(draft);
      setProgress(Object.keys(images).length ? 0 : null);
      try {
        await saveMyProfileImages(images, setProgress);
      } finally {
        setProgress(null);
      }
    },
    () => {
      picked.current = {}; // saved: the local copies now show the saved pictures until they reload
      showToast('Perfil atualizado');
      navigate('/perfil', { replace: true });
    }
  );
  const cancel = () => goBack('/perfil');
  const setImage = (slot: 'foto' | 'capa', url: string) => {
    revoke([images[slot]]);
    setImages((s) => ({ ...s, [slot]: url }));
  };

  return (
    <div className="min-h-screen flex flex-col bg-concrete-50 lg:bg-transparent lg:min-h-0">
      <BackBar title="Editar perfil" onBack={cancel} />
      <form
        className="flex-1 flex flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          void save.run();
        }}
      >
        <div className="flex-1 flex flex-col gap-5 px-4 sm:px-6 lg:px-0 py-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-concrete-900">Foto de capa</span>
            <PhotoSlot
              shape="rect"
              height="9rem"
              placeholder="Toque para escolher uma foto de capa"
              value={images.capa !== undefined ? images.capa : worker.coverUrl}
              progress={images.capa ? progress : null}
              onChange={(v) => setImage('capa', v)}
            />
          </div>
          <div className="flex flex-col items-center gap-2">
            <PhotoSlot
              shape="circle"
              value={images.foto !== undefined ? images.foto : worker.photoUrl}
              progress={images.foto ? progress : null}
              onChange={(v) => setImage('foto', v)}
              className="w-24 h-24"
              placeholder="Sua foto"
            />
          </div>
          <Input
            id="edit-worker-name"
            label="Nome completo"
            icon="user"
            autoComplete="name"
            value={draft.name}
            onInput={(v) => setDraft((d) => ({ ...d, name: v }))}
          />
          <Select
            label="Seu ofício principal"
            placeholder="Escolha seu ofício"
            options={OFICIO_OPTIONS}
            value={draft.oficioId}
            onChange={(v) => setDraft((d) => ({ ...d, oficioId: v }))}
          />
          <LocationButton title="Onde você quer trabalhar" location={draft.city} onClick={() => setPickerOpen(true)} />
          <div className="flex flex-col gap-2.5">
            <span className="text-sm font-semibold text-concrete-900">Especialidades</span>
            <div className="flex flex-wrap gap-2">
              {ESPECIALIDADES.map((e) => (
                <Tag
                  key={e}
                  label={e}
                  selected={draft.specialties.includes(e)}
                  onClick={() => setDraft((d) => ({ ...d, specialties: toggleItem(d.specialties, e) }))}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="sticky bottom-0 px-4 sm:px-6 lg:px-0 py-3 bg-white shadow-bar flex flex-col gap-2 lg:static lg:bg-transparent lg:shadow-none">
          {save.error ? <FieldError message={save.error} /> : null}
          <div className="flex gap-3">
            <Button label="Cancelar" variant="secondary" className="flex-1" onClick={cancel} />
            <Button
              label={progress !== null ? `Enviando fotos… ${Math.round(progress * 100)}%` : 'Salvar alterações'}
              type="submit"
              className="flex-[1.4]"
              loading={save.loading && progress === null}
              disabled={save.loading}
            />
          </div>
        </div>
      </form>
      {/* Outside the form: Enter in its search box must not save the profile. */}
      <CityPicker
        open={pickerOpen}
        title="Onde você quer trabalhar"
        value={draft.city}
        stateKey="edit-worker-city"
        onChoose={(city) => {
          setDraft((d) => ({ ...d, city }));
          setPickerOpen(false);
        }}
        onClose={() => setPickerOpen(false)}
      />
    </div>
  );
}
