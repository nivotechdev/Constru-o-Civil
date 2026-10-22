// "Completar perfil" (U12, U51): two steps, the same for both sides — first the address (CEP, city, street and
// neighbourhood: the CEP fills the rest, or fills itself from the street), then the cover and the profile photo (logo,
// for a company). The address stays the account's own: the profile shows only the city. It is where distances to the
// jobs are measured from, where the mural opens and the city a new job starts in (U13); it changes later only in
// "Editar perfil".
import { AddressFields } from '../../components/AddressFields';
import { AVATAR_FRAME } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { FieldError } from '../../components/FieldError';
import { FlowBar, FlowHeading, FlowLayout, FlowSignOut } from '../../components/FlowLayout';
import { PhotoSlot } from '../../components/PhotoSlot';
import { useBusyWhile } from '../../hooks/useBusy';
import { useInnerBack } from '../../hooks/useInnerBack';
import { useUI } from '../../hooks/useStore';
import {
  emptyAddress,
  resolveAddress,
  type AddressDraft,
  type AddressErrors,
  type ResolvedAddress
} from '../../services/address';
import { finishSignUp } from '../../services/auth';
import { errorMessage } from '../../services/errors';
import { checkMyCompany, saveMyProfileImages } from '../../services/profiles';
import { navigate } from '../../services/router';
import { askSignOut } from '../../services/sharedUI';
import { showToast } from '../../services/toast';
import type { ScreenProps } from '../../types/screen';
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
  step: 'endereco' | 'fotos';
  address: AddressDraft;
  addressErrors: AddressErrors;
  /** The address as found on the map (step 1's "Continuar"); saved with "Concluir perfil". */
  resolved: ResolvedAddress | null;
  checking: boolean;
  capa: string | null;
  photo: string | null;
  saving: boolean;
  error: string | null;
}

const DEFAULTS = (): CompleteProfileUI => ({
  step: 'endereco',
  address: emptyAddress(),
  addressErrors: {},
  resolved: null,
  checking: false,
  capa: null,
  photo: null,
  saving: false,
  error: null
});

export default function CompleteProfile({ params }: ScreenProps) {
  const company = params.role === 'recrutador';
  const [ui, setUi] = useUI<CompleteProfileUI>(
    'completar-perfil-' + (company ? 'recrutador' : 'trabalhador'),
    DEFAULTS
  );
  // U45: while the address is checked or the profile saved, nothing else takes a tap.
  useBusyWhile(ui.checking || ui.saving);
  // U62: the company has no fixed address (each job has its own): it goes straight to the pictures.
  const step = company ? 'fotos' : ui.step;
  // The phone's back button on the photos goes back to the address.
  useInnerBack(!company && step === 'fotos', () => setUi({ step: 'endereco', error: null }), step);

  function checkAddress() {
    if (ui.checking) return;
    setUi({ checking: true, error: null });
    resolveAddress(ui.address)
      .then((r) => {
        if (r.ok) setUi({ checking: false, resolved: r.address, address: r.draft, addressErrors: {}, step: 'fotos' });
        else setUi({ checking: false, addressErrors: r.errors });
      })
      .catch((e: unknown) => setUi({ checking: false, error: errorMessage(e) }));
  }

  function finish() {
    if (ui.saving || (!company && !ui.resolved)) return;
    setUi({ saving: true, error: null });
    finishSignUp(company ? null : ui.resolved)
      .then(() => savePictures(company ? { logo: ui.photo, capa: ui.capa } : { foto: ui.photo, capa: ui.capa }))
      .then(() => {
        setUi({ saving: false });
        // L10: the automatic CNPJ check runs in the background (the profile shows the result).
        if (company) void checkMyCompany().catch(() => undefined);
        navigate('/mural', { replace: true });
      })
      .catch((e: unknown) => setUi({ saving: false, error: errorMessage(e) }));
  }

  const header = (
    <FlowBar
      title="Criar minha conta"
      onBack={!company && step === 'fotos' ? () => setUi({ step: 'endereco', error: null }) : undefined}
      // Y26/U41: the way out for whoever entered the wrong account, on top ("Sair").
      action={<FlowSignOut onClick={askSignOut} />}
    />
  );

  if (step === 'endereco')
    return (
      <FlowLayout
        header={header}
        footer={
          <>
            {ui.error ? <FieldError message={ui.error} /> : null}
            <Button label="Continuar" size="lg" fullWidth loading={ui.checking} onClick={checkAddress} />
          </>
        }
      >
        <FlowHeading
          overline="Completar perfil"
          title="Seu endereço"
          help="Só você vê. Mostra a distância até cada bico."
        />
        <AddressFields
          idPrefix="completar-endereco"
          value={ui.address}
          errors={ui.addressErrors}
          onChange={(patch, clear) =>
            setUi((s) => ({
              address: { ...s.address, ...patch },
              addressErrors: { ...s.addressErrors, ...Object.fromEntries(clear.map((k) => [k, null])) },
              error: null
            }))
          }
        />
      </FlowLayout>
    );

  return (
    <FlowLayout
      header={header}
      footer={
        <>
          {ui.error ? <FieldError message={ui.error} /> : null}
          <Button label="Concluir perfil" size="lg" fullWidth loading={ui.saving} onClick={finish} />
        </>
      }
    >
      <FlowHeading
        overline="Completar perfil"
        title={company ? 'O perfil da sua empresa' : 'Seu perfil'}
        help={
          company
            ? 'Capa e logo aparecem para os candidatos. As fotos são opcionais.'
            : 'Capa e foto aparecem para as empresas. As fotos são opcionais.'
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
    </FlowLayout>
  );
}
