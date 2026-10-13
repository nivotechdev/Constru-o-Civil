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
import { useAction } from '../../hooks/useAction';
import { useDb } from '../../hooks/useStore';
import { OFICIO_OPTIONS } from '../../services/catalog';
import { profileErrors, saveMyProfileImages, updateMyWorkerProfile, type ProfileImages } from '../../services/profiles';
import { goBack, navigate } from '../../services/router';
import { currentWorker } from '../../services/selectors';
import { showToast } from '../../services/toast';
import { SpecialtiesField } from '../../components/SpecialtiesField';
import { WhatsAppRow } from '../../components/WhatsAppRow';
import { serviceError } from '../../services/errors';
import { TextArea } from '../../components/TextArea';
import { AVAILABILITY_OPTIONS } from '../../utils/workerInfo';
import { Tag } from '../../components/Tag';

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
    specialties: [...worker.specialties],
    // F10: the professional profile (numbers as typed).
    availability: worker.availability ?? null,
    years: worker.yearsExperience != null ? String(worker.yearsExperience) : '',
    pay: worker.desiredPay != null ? String(worker.desiredPay) : '',
    travelKm: worker.travelKm ?? null,
    bio: worker.bio ?? ''
  }));
  const num = (v: string) => (v.trim() === '' ? null : Number(v));
  const [images, setImages] = useState<ProfileImages>({});
  const [pickerOpen, setPickerOpen] = useState(false);
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
    ...(draft.oficioId !== worker.oficioId ? { oficioId: draft.oficioId } : {}),
    ...(draft.city !== worker.city ? { city: draft.city } : {}),
    ...(draft.specialties.join('|') !== worker.specialties.join('|') ? { specialties: draft.specialties } : {}),
    ...(draft.availability && draft.availability !== worker.availability ? { availability: draft.availability } : {}),
    ...(num(draft.years) !== (worker.yearsExperience ?? null) ? { yearsExperience: num(draft.years) } : {}),
    ...(num(draft.pay) !== (worker.desiredPay ?? null) ? { desiredPay: num(draft.pay) } : {}),
    ...(draft.travelKm !== (worker.travelKm ?? null) ? { travelKm: draft.travelKm } : {}),
    ...(draft.bio !== (worker.bio ?? '') ? { bio: draft.bio } : {})
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
          <Select
            label="Seu ofício principal"
            placeholder="Escolha seu ofício"
            options={OFICIO_OPTIONS}
            value={draft.oficioId}
            error={errors.oficioId}
            onChange={(v) => {
              setDraft((d) => ({ ...d, oficioId: v }));
              setErrors((e) => ({ ...e, oficioId: undefined }));
            }}
          />
          <LocationButton title="Onde você quer trabalhar" location={draft.city} onClick={() => setPickerOpen(true)} />
          <WhatsAppRow label="Seu WhatsApp" />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="edit-worker-bio" className="text-sm font-semibold text-concrete-900">
              Sobre você
            </label>
            <TextArea
              id="edit-worker-bio"
              rows={3}
              placeholder="Ex.: Faço reboco, contrapiso e acabamento há 12 anos. Tenho ferramenta própria."
              value={draft.bio}
              className="w-full px-3 py-2.5 bg-white rounded-control border border-concrete-300 outline-none text-base text-concrete-900 placeholder:text-concrete-400 resize-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
              onInput={(v) => setDraft((d) => ({ ...d, bio: v.slice(0, 280) }))}
            />
            <span className="text-xs text-concrete-500 self-end">{`${draft.bio.length}/280`}</span>
            {errors.bio ? <FieldError message={errors.bio} /> : null}
          </div>
          <div className="flex flex-col gap-2.5">
            <span className="text-sm font-semibold text-concrete-900">Dias que você pode</span>
            <div className="flex flex-wrap gap-2">
              {AVAILABILITY_OPTIONS.map((o) => (
                <Tag
                  key={o.id}
                  label={o.label}
                  selected={draft.availability === o.id}
                  onClick={() => setDraft((d) => ({ ...d, availability: o.id }))}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-1 min-w-0">
              <Input
                id="edit-worker-years"
                label="Anos de experiência"
                inputMode="numeric"
                value={draft.years}
                error={errors.yearsExperience}
                onInput={(v) => setDraft((d) => ({ ...d, years: v.replace(/\D/g, '').slice(0, 2) }))}
              />
            </div>
            <div className="flex-1 min-w-0">
              <Input
                id="edit-worker-pay"
                label="Diária que você pede"
                suffix="reais"
                inputMode="numeric"
                value={draft.pay}
                error={errors.desiredPay}
                onInput={(v) => setDraft((d) => ({ ...d, pay: v.replace(/\D/g, '').slice(0, 4) }))}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2.5">
            <span className="text-sm font-semibold text-concrete-900">Até onde você vai</span>
            <div className="flex flex-wrap gap-2">
              {[5, 10, 20, 50].map((km) => (
                <Tag
                  key={km}
                  label={`Até ${km} km`}
                  selected={draft.travelKm === km}
                  onClick={() => setDraft((d) => ({ ...d, travelKm: d.travelKm === km ? null : km }))}
                />
              ))}
            </div>
          </div>
          <SpecialtiesField
            id="editar-especialidade"
            value={draft.specialties}
            onChange={(list) => setDraft((d) => ({ ...d, specialties: list }))}
          />
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
