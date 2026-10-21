// "Completar perfil" (U12): one screen, the same for both sides — the cover, the profile photo (logo, for a
// company) and the place, saved with "Usar minha localização atual". The place is where the mural opens and the
// city a new job starts in (U13); it changes later only in "Editar perfil".
import { Button } from '../../components/Button';
import { CurrentLocationField } from '../../components/CurrentLocationField';
import { FieldError } from '../../components/FieldError';
import { FlowBar, FlowHeading, FlowLayout, FlowSignOut } from '../../components/FlowLayout';
import { PhotoSlot } from '../../components/PhotoSlot';
import { useBusyWhile } from '../../hooks/useBusy';
import { useUI } from '../../hooks/useStore';
import { finishSignUp } from '../../services/auth';
import { errorMessage } from '../../services/errors';
import type { SavedLocation } from '../../services/location';
import { checkMyCompany, saveMyProfileImages } from '../../services/profiles';
import { navigate } from '../../services/router';
import { askSignOut } from '../../services/sharedUI';
import { showToast } from '../../services/toast';
import type { ScreenProps } from '../../types/screen';
import { AVATAR_FRAME } from '../../components/Avatar';
import { cx } from '../../utils/cx';

/**
 * The pictures chosen while completing the profile, saved once the profile is (Z12). The profile is
 * already done at this point: if the upload fails, the app goes on and says where to try again.
 */
async function savePictures(pictures: { foto?: string | null; capa?: string | null; logo?: string | null }) {
  const chosen = Object.fromEntries(Object.entries(pictures).filter(([, v]) => v));
  if (!Object.keys(chosen).length) return;
  await saveMyProfileImages(chosen).catch(() =>
    showToast('Não deu para enviar suas fotos agora. Tente de novo em Editar perfil.', { tone: 'error' })
  );
}

interface CompleteProfileUI {
  capa: string | null;
  photo: string | null;
  location: SavedLocation | null;
  locationError: string | null;
  saving: boolean;
  saveError: string | null;
}

const DEFAULTS: CompleteProfileUI = {
  capa: null,
  photo: null,
  location: null,
  locationError: null,
  saving: false,
  saveError: null
};

export default function CompleteProfile({ params }: ScreenProps) {
  const company = params.role === 'recrutador';
  const [ui, setUi] = useUI<CompleteProfileUI>(
    'completar-perfil-' + (company ? 'recrutador' : 'trabalhador'),
    DEFAULTS
  );
  // U45: while the profile is saved, nothing else takes a tap.
  useBusyWhile(ui.saving);

  function finish() {
    if (ui.saving) return;
    if (!ui.location) {
      setUi({ locationError: 'Toque em "Usar minha localização atual" para continuar.' });
      return;
    }
    setUi({ saving: true, saveError: null });
    finishSignUp(ui.location)
      .then(() => savePictures(company ? { logo: ui.photo, capa: ui.capa } : { foto: ui.photo, capa: ui.capa }))
      .then(() => {
        setUi({ saving: false });
        // L10: the automatic CNPJ check runs in the background (the profile shows the result).
        if (company) void checkMyCompany().catch(() => undefined);
        navigate('/mural', { replace: true });
      })
      .catch((e: unknown) => setUi({ saving: false, saveError: errorMessage(e) }));
  }

  return (
    <FlowLayout
      // Y26/U41: the way out for whoever entered the wrong account, on top ("Sair").
      header={<FlowBar title="Criar minha conta" action={<FlowSignOut onClick={askSignOut} />} />}
      footer={
        <>
          {ui.saveError ? <FieldError message={ui.saveError} /> : null}
          <Button label="Concluir perfil" size="lg" fullWidth loading={ui.saving} onClick={finish} />
        </>
      }
    >
      <FlowHeading
        overline="Completar perfil"
        title={company ? 'O perfil da sua construtora' : 'Seu perfil'}
        help={
          company
            ? 'Capa e logo aparecem para os candidatos. As fotos são opcionais.'
            : 'Capa e foto aparecem para as construtoras. As fotos são opcionais.'
        }
      />

      {/* The cover with the photo over its corner, the way the profile shows them. */}
      <div className="flex flex-col gap-2">
        <div className="relative pb-12 short:pb-10">
          <PhotoSlot
            shape="rect"
            value={ui.capa}
            onChange={(v) => setUi({ capa: v })}
            height="var(--capa-altura)"
            className="[--capa-altura:8.5rem] short:[--capa-altura:6rem]"
            placeholder="Escolher capa"
          />
          <div className={cx('absolute left-4 bottom-0 w-24 h-24 short:w-20 short:h-20 shadow-raised', AVATAR_FRAME)}>
            <PhotoSlot
              shape="circle"
              value={ui.photo}
              onChange={(v) => setUi({ photo: v })}
              className="w-full h-full"
              placeholder={company ? 'Logo' : 'Sua foto'}
            />
          </div>
        </div>
        <span className="text-sm text-concrete-500">
          {company
            ? 'Toque na capa ou no círculo para escolher. Logo bem visível passa mais confiança.'
            : 'Toque na capa ou no círculo para escolher. Rosto bem visível passa mais confiança.'}
        </span>
      </div>

      <CurrentLocationField
        title={company ? 'Onde ficam suas obras' : 'Onde você está'}
        help={company ? 'Suas vagas novas já começam nessa cidade.' : 'O mural sempre abre com os bicos perto daqui.'}
        value={ui.location}
        error={ui.locationError}
        stateKey="completar-perfil-cidade"
        onChange={(location) => setUi({ location, locationError: null, saveError: null })}
      />
    </FlowLayout>
  );
}
