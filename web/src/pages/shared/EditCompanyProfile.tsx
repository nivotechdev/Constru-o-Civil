// Editing the company's own profile. The draft is this screen's own: it starts from the saved profile
// every time the screen opens, and "Cancelar" (or leaving) throws it away — pictures included (Y21/Z12).
import { useEffect, useRef, useState } from 'react';
import { BackBar } from '../../components/BackBar';
import { Button } from '../../components/Button';
import { FieldError } from '../../components/FieldError';
import { Icon } from '../../components/icons/Icon';
import { Input } from '../../components/Input';
import { PhotoSlot } from '../../components/PhotoSlot';
import { useAction } from '../../hooks/useAction';
import { useDb } from '../../hooks/useStore';
import {
  profileErrors,
  saveMyProfileImages,
  updateMyCompanyProfile,
  type ProfileImages
} from '../../services/profiles';
import { goBack, navigate } from '../../services/router';
import { currentCompany } from '../../services/selectors';
import { showToast } from '../../services/toast';
import { WhatsAppRow } from '../../components/WhatsAppRow';
import { serviceError } from '../../services/errors';
import { CityPicker, LocationButton } from '../../components/CityPicker';

function revoke(urls: (string | null | undefined)[]) {
  for (const u of urls) if (u?.startsWith('blob:')) URL.revokeObjectURL(u);
}

export default function EditCompanyProfile() {
  const company = currentCompany(useDb());
  const [draft, setDraft] = useState(() => ({
    name: company.name,
    location: company.location,
    contactName: company.contactName ?? ''
  }));
  const [images, setImages] = useState<ProfileImages>({});
  const [progress, setProgress] = useState<number | null>(null);
  const picked = useRef<ProfileImages>({});
  useEffect(() => {
    picked.current = images;
  }, [images]);
  useEffect(() => () => revoke(Object.values(picked.current)), []);

  const [pickerOpen, setPickerOpen] = useState(false);
  // L11: only what changed is checked and sent; each field shows its own problem.
  const [errors, setErrors] = useState<ReturnType<typeof profileErrors>>({});
  const changes = {
    ...(draft.name !== company.name ? { name: draft.name } : {}),
    ...(draft.location !== company.location ? { location: draft.location } : {}),
    ...(draft.contactName !== (company.contactName ?? '') ? { contactName: draft.contactName } : {})
  };
  const save = useAction(
    async () => {
      const found = profileErrors(changes, 'recrutador');
      setErrors(found);
      if (Object.keys(found).length) throw serviceError('validacao', 'Confira os campos marcados.');
      await updateMyCompanyProfile(changes);
      setProgress(Object.keys(images).length ? 0 : null);
      try {
        await saveMyProfileImages(images, setProgress);
      } finally {
        setProgress(null);
      }
    },
    () => {
      picked.current = {};
      showToast('Dados da empresa atualizados');
      navigate('/empresa', { replace: true });
    }
  );
  const cancel = () => goBack('/empresa');
  const setImage = (slot: 'logo' | 'capa', url: string) => {
    revoke([images[slot]]);
    setImages((s) => ({ ...s, [slot]: url }));
  };

  return (
    <div className="min-h-screen flex flex-col bg-concrete-50 lg:bg-transparent lg:min-h-0">
      <BackBar title="Editar empresa" onBack={cancel} />
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
              placeholder="Capa da construtora"
              value={images.capa !== undefined ? images.capa : company.coverUrl}
              progress={images.capa ? progress : null}
              onChange={(v) => setImage('capa', v)}
            />
          </div>
          <div className="flex flex-col items-center gap-2">
            <PhotoSlot
              shape="circle"
              value={images.logo !== undefined ? images.logo : company.logoUrl}
              progress={images.logo ? progress : null}
              onChange={(v) => setImage('logo', v)}
              className="w-24 h-24"
              placeholder="Logo"
            />
          </div>
          <Input
            id="edit-company-name"
            label="Nome da empresa"
            icon="building-2"
            autoComplete="organization"
            hint="É esse nome que aparece no seu perfil e nas vagas que você publicar."
            value={draft.name}
            error={errors.name}
            onInput={(v) => {
              setDraft((d) => ({ ...d, name: v }));
              setErrors((e) => ({ ...e, name: undefined }));
            }}
          />
          <Input
            id="edit-company-contact"
            label="Quem fala com os candidatos"
            icon="user"
            autoComplete="name"
            hint='Quem você aprovar vê "Fale com" e esse nome.'
            value={draft.contactName}
            error={errors.contactName}
            onInput={(v) => {
              setDraft((d) => ({ ...d, contactName: v }));
              setErrors((e) => ({ ...e, contactName: undefined }));
            }}
          />
          {company.cnpj ? (
            <div className="flex flex-col gap-1.5 w-full">
              <span className="text-sm font-semibold text-concrete-900">CNPJ</span>
              <div className="flex items-center gap-2 min-h-12 px-3 bg-concrete-100 rounded-control border border-concrete-200">
                <Icon name="lock" size={18} color="var(--text-subtle)" />
                <span className="flex-1 min-w-0 font-mono text-base text-concrete-500 truncate">{company.cnpj}</span>
              </div>
              <span className="text-sm text-concrete-500">
                O CNPJ não pode ser alterado aqui. Se precisar corrigir, fale com o suporte em Ajuda.
              </span>
            </div>
          ) : null}
          {/* L12: the city comes from the list, like everywhere else. */}
          <LocationButton title="Onde ficam suas obras" location={draft.location} onClick={() => setPickerOpen(true)} />
          {errors.location ? <FieldError message={errors.location} /> : null}
          <WhatsAppRow label="WhatsApp de contato" />
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
        title="Onde ficam suas obras"
        value={draft.location}
        stateKey="edit-company-city"
        onChoose={(label) => {
          setDraft((d) => ({ ...d, location: label }));
          setErrors((e) => ({ ...e, location: undefined }));
          setPickerOpen(false);
        }}
        onClose={() => setPickerOpen(false)}
      />
    </div>
  );
}
