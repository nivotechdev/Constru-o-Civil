// Editing the worker's own profile. The draft is this screen's own: it starts from the saved profile
// every time the screen opens, and "Cancelar" (or leaving) throws it away — pictures included (Y21/Z12).
import { useEffect, useRef, useState } from 'react';
import { BackBar } from '../../components/BackBar';
import { Button } from '../../components/Button';
import { ProfileLocationField } from '../../components/ProfileLocationField';
import type { SavedLocation } from '../../services/location';
import { FieldError } from '../../components/FieldError';
import { Input } from '../../components/Input';
import { PhotoSlot } from '../../components/PhotoSlot';
import { useAction } from '../../hooks/useAction';
import { useDb } from '../../hooks/useStore';
import { profileErrors, saveMyProfileImages, updateMyWorkerProfile, type ProfileImages } from '../../services/profiles';
import { goBack, navigate } from '../../services/router';
import { FEED_KEY } from '../worker/feed/feedUI';
import { resetUI } from '../../services/store';
import { currentWorker } from '../../services/selectors';
import { showToast } from '../../services/toast';
import { WhatsAppRow } from '../../components/WhatsAppRow';
import { serviceError } from '../../services/errors';
import { AboutField } from '../../components/AboutField';
import { cleanExperiences } from '../../utils/profileText';
import { ExperiencesField } from './ExperiencesField';

/** Frees the local copies of pictures that were picked and then dropped. */
function revoke(urls: (string | null | undefined)[]) {
  for (const u of urls) if (u?.startsWith('blob:')) URL.revokeObjectURL(u);
}

export default function EditWorkerProfile() {
  const worker = currentWorker(useDb());
  const [draft, setDraft] = useState(() => ({
    name: worker.name,
    // U13/U22: the saved place (city + point): any city from the list, or the phone's location.
    location: { city: worker.city, lat: worker.lat, lon: worker.lon } as SavedLocation,
    bio: worker.bio ?? '',
    // U38: the experiences as pills.
    experiences: worker.experiences ?? []
  }));
  const experiences = cleanExperiences(draft.experiences);
  const [images, setImages] = useState<ProfileImages>({});
  const [progress, setProgress] = useState<number | null>(null);
  const picked = useRef<ProfileImages>({});
  useEffect(() => {
    picked.current = images;
  }, [images]);
  // Leaving without saving drops the pictures picked here.
  useEffect(() => () => revoke(Object.values(picked.current)), []);

  // L11: only what changed is checked and sent; each field shows its own problem.
  const [errors, setErrors] = useState<ReturnType<typeof profileErrors>>({});
  const changes = {
    ...(draft.name !== worker.name ? { name: draft.name } : {}),
    ...(draft.location.city !== worker.city || draft.location.lat !== worker.lat || draft.location.lon !== worker.lon
      ? { city: draft.location.city, point: { lat: draft.location.lat, lon: draft.location.lon } }
      : {}),
    ...(draft.bio.trim() !== (worker.bio ?? '') ? { bio: draft.bio } : {}),
    ...(experiences.join('\n') !== (worker.experiences ?? []).join('\n') ? { experiences } : {})
  };
  const save = useAction(
    async () => {
      const found = profileErrors(changes, 'trabalhador');
      setErrors(found);
      if (Object.keys(found).length) throw serviceError('validacao', 'Confira os campos marcados.');
      await updateMyWorkerProfile(changes);
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
      // U22: the mural opens again on the place just saved.
      resetUI(FEED_KEY);
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
            error={errors.name}
            onInput={(v) => {
              setDraft((d) => ({ ...d, name: v }));
              setErrors((e) => ({ ...e, name: undefined }));
            }}
          />
          <ProfileLocationField
            title="Sua cidade"
            help="O mural sempre abre com os bicos dessa cidade."
            city={draft.location.city}
            error={errors.city}
            stateKey="edit-worker-city"
            onChange={(location) => {
              setDraft((d) => ({ ...d, location }));
              setErrors((e) => ({ ...e, city: undefined }));
            }}
          />
          <WhatsAppRow label="Seu WhatsApp" />
          <AboutField
            id="edit-worker-bio"
            label="Sobre você"
            hint="Conte quem você é e como trabalha. É a primeira coisa que a empresa lê."
            placeholder="Ex.: Sou caprichoso e pontual, tenho experiência com atendimento e limpeza e moro perto do centro."
            value={draft.bio}
            error={errors.bio}
            onInput={(v) => {
              setDraft((d) => ({ ...d, bio: v }));
              setErrors((e) => ({ ...e, bio: undefined }));
            }}
          />
          <ExperiencesField
            value={draft.experiences}
            error={errors.experiences}
            onChange={(list) => {
              setDraft((d) => ({ ...d, experiences: list }));
              setErrors((e) => ({ ...e, experiences: undefined }));
            }}
          />
        </div>
        <div className="sticky bottom-0 px-4 sm:px-6 lg:px-0 py-3 bg-concrete-0 shadow-bar flex flex-col gap-2 lg:static lg:bg-transparent lg:shadow-none">
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
    </div>
  );
}
