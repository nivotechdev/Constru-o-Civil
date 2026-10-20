import type { ReactNode } from 'react';
import { Button } from '../../components/Button';
import { CityPicker, LocationButton } from '../../components/CityPicker';
import { FieldError } from '../../components/FieldError';
import { FlowLayout, FlowProgress } from '../../components/FlowLayout';
import { PhotoSlot } from '../../components/PhotoSlot';
import { Select } from '../../components/Select';
import { useUI } from '../../hooks/useStore';
import { DEFAULT_CITY } from '../../services/cities';
import { finishSignUp } from '../../services/auth';
import { OFICIO_OPTIONS, TIPOS_OBRA } from '../../services/catalog';
import type { ScreenProps } from '../../types/screen';
import { navigate } from '../../services/router';
import { saveMyProfileImages } from '../../services/profiles';
import { showToast } from '../../services/toast';
import { SpecialtiesField } from '../../components/SpecialtiesField';
import { askSignOut } from '../../services/sharedUI';
import { errorMessage } from '../../services/errors';
import { checkMyCompany } from '../../services/profiles';

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

export default function CompleteProfile({ params }: ScreenProps) {
  return params.role === 'recrutador' ? <RecruiterFlow /> : <WorkerFlow />;
}

interface ShellProps {
  step: number;
  total: number;
  /** The first step has no way back (the account already exists). */
  onBack?: () => void;
  children: ReactNode;
  onContinue: () => void;
  label: string;
  loading?: boolean;
  /** Why saving failed (shown above the button; what was filled in stays). */
  error?: string | null;
}

function Shell({ step, total, onBack, children, onContinue, label, loading = false, error = null }: ShellProps) {
  return (
    <FlowLayout
      header={<FlowProgress step={step} total={total} onBack={onBack} />}
      footer={
        <>
          {error ? <FieldError message={error} /> : null}
          <Button label={label} size="lg" fullWidth loading={loading} onClick={onContinue} />
          {/* Y26: a way out for whoever entered the wrong account. */}
          <Button label="Sair e entrar com outra conta" variant="ghost" fullWidth onClick={askSignOut} />
        </>
      }
    >
      {children}
    </FlowLayout>
  );
}

function Heading({ overline, title, help }: { overline: string; title: string; help: string }) {
  return (
    <div className="flex flex-col gap-2.5">
      <span className="text-xs font-bold tracking-[0.08em] uppercase text-concrete-500">{overline}</span>
      <h1 className="font-display font-bold text-3xl text-concrete-900">{title}</h1>
      <p className="text-base text-concrete-700">{help}</p>
    </div>
  );
}

interface WorkerUI {
  step: number;
  saving: boolean;
  saveError: string | null;
  capa: string | null;
  photo: string | null;
  oficioId: string;
  cidade: string;
  pickerOpen: boolean;
  especialidades: string[];
  errors: { oficioId?: string | null; especialidades?: string | null };
}

function WorkerFlow() {
  const [ui, setUi] = useUI<WorkerUI>('completar-trabalhador', {
    step: 0,
    saving: false,
    saveError: null,
    capa: null,
    photo: null,
    oficioId: '',
    cidade: DEFAULT_CITY,
    pickerOpen: false,
    especialidades: [],
    errors: {}
  });

  const toStep1 = () => {
    if (!ui.oficioId) {
      setUi({ errors: { oficioId: 'Escolha o seu ofício principal.' } });
      return;
    }
    setUi({ step: 1, errors: {} });
  };

  if (ui.step === 0) {
    return (
      <Shell step={0} total={2} onContinue={toStep1} label="Continuar">
        <Heading
          overline="Completar perfil"
          title="Capa, foto e o seu ofício"
          help="Isso aparece no seu perfil para as construtoras que virem seu bico."
        />
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-concrete-900">Foto de capa</span>
          <PhotoSlot
            shape="rect"
            value={ui.capa}
            onChange={(v) => setUi({ capa: v })}
            height="7.5rem"
            placeholder="Capa do seu perfil"
          />
        </div>
        <div className="flex items-center gap-4">
          <PhotoSlot
            shape="circle"
            value={ui.photo}
            onChange={(v) => setUi({ photo: v })}
            className="w-[4.5rem] h-[4.5rem] shrink-0"
            placeholder="Sua foto"
          />
          <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-concrete-900">Sua foto de perfil</span>
            <span className="text-sm text-concrete-500">Opcional. Rosto bem visível passa mais confiança.</span>
          </div>
        </div>
        <Select
          label="Seu ofício principal"
          placeholder="Escolha seu ofício"
          options={OFICIO_OPTIONS}
          value={ui.oficioId}
          error={ui.errors.oficioId}
          onChange={(v) => setUi({ oficioId: v, errors: { ...ui.errors, oficioId: null } })}
        />
      </Shell>
    );
  }

  return (
    <Shell
      step={1}
      total={2}
      onBack={() => setUi({ step: 0 })}
      onContinue={() => {
        if (ui.saving) return;
        if (ui.especialidades.length === 0) {
          setUi({ errors: { especialidades: 'Adicione ao menos uma especialidade.' } });
          return;
        }
        setUi({ saving: true, saveError: null });
        finishSignUp({ role: 'trabalhador', oficioId: ui.oficioId, city: ui.cidade, specialties: ui.especialidades })
          .then(() => savePictures({ foto: ui.photo, capa: ui.capa }))
          .then(() => {
            setUi({ saving: false });
            // L10: the automatic CNPJ check runs in the background (the profile shows the result).
            void checkMyCompany().catch(() => undefined);
            navigate('/mural', { replace: true });
          })
          .catch((e: unknown) => setUi({ saving: false, saveError: errorMessage(e) }));
      }}
      label="Concluir perfil"
      loading={ui.saving}
      error={ui.saveError}
    >
      <Heading
        overline="Completar perfil"
        title="Onde e no que você trabalha"
        help="Usamos para mostrar bicos perto de você e do jeito certo para seu ofício."
      />
      <LocationButton
        title="Onde você quer trabalhar"
        location={ui.cidade}
        onClick={() => setUi({ pickerOpen: true })}
      />
      <SpecialtiesField
        id="completar-especialidade"
        value={ui.especialidades}
        error={ui.errors.especialidades}
        onChange={(list) => setUi({ especialidades: list, errors: { ...ui.errors, especialidades: null } })}
      />
      <CityPicker
        open={ui.pickerOpen}
        title="Onde você quer trabalhar"
        value={ui.cidade}
        stateKey="completar-trabalhador-cidade"
        onChoose={(cidade) => setUi({ cidade, pickerOpen: false })}
        onClose={() => setUi({ pickerOpen: false })}
      />
    </Shell>
  );
}

interface RecruiterUI {
  step: number;
  saving: boolean;
  saveError: string | null;
  capa: string | null;
  logo: string | null;
  tipoObra: string;
  cidade: string;
  pickerOpen: boolean;
  errors: { tipoObra?: string | null };
}

function RecruiterFlow() {
  const [ui, setUi] = useUI<RecruiterUI>('completar-recrutador', {
    step: 0,
    saving: false,
    saveError: null,
    capa: null,
    logo: null,
    tipoObra: '',
    cidade: DEFAULT_CITY,
    pickerOpen: false,
    errors: {}
  });

  if (ui.step === 0) {
    return (
      <Shell
        step={0}
        total={2}

        onContinue={() => setUi({ step: 1 })}
        label="Continuar"
      >
        <Heading
          overline="Completar perfil"
          title="Capa e logo da construtora"
          help="Isso aparece no perfil que os candidatos veem antes de se candidatar."
        />
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-concrete-900">Foto de capa</span>
          <PhotoSlot
            shape="rect"
            value={ui.capa}
            onChange={(v) => setUi({ capa: v })}
            height="7.5rem"
            placeholder="Capa da construtora"
          />
        </div>
        <div className="flex items-center gap-4">
          <PhotoSlot
            shape="circle"
            value={ui.logo}
            onChange={(v) => setUi({ logo: v })}
            className="w-[4.5rem] h-[4.5rem] shrink-0"
            placeholder="Logo"
          />
          <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-concrete-900">Foto ou logo de perfil</span>
            <Button label="Pular por enquanto" variant="ghost" size="sm" onClick={() => setUi({ step: 1 })} />
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell
      step={1}
      total={2}
      onBack={() => setUi({ step: 0 })}
      onContinue={() => {
        if (ui.saving) return;
        if (!ui.tipoObra) {
          setUi({ errors: { tipoObra: 'Selecione o tipo de obra.' } });
          return;
        }
        setUi({ saving: true, saveError: null });
        finishSignUp({ role: 'recrutador', tipoObra: ui.tipoObra, city: ui.cidade })
          .then(() => savePictures({ logo: ui.logo, capa: ui.capa }))
          .then(() => {
            setUi({ saving: false });
            navigate('/mural', { replace: true });
          })
          .catch((e: unknown) => setUi({ saving: false, saveError: errorMessage(e) }));
      }}
      label="Concluir perfil"
      loading={ui.saving}
      error={ui.saveError}
    >
      <Heading
        overline="Completar perfil"
        title="Sobre a sua obra"
        help="Usamos para destacar o tipo de obra e mostrar suas vagas na região certa."
      />
      <Select
        label="Tipo de obra"
        placeholder="Selecione o tipo de obra"
        options={TIPOS_OBRA}
        value={ui.tipoObra}
        error={ui.errors.tipoObra}
        onChange={(v) => setUi({ tipoObra: v, errors: { tipoObra: null } })}
      />
      <LocationButton title="Onde ficam suas obras" location={ui.cidade} onClick={() => setUi({ pickerOpen: true })} />
      <CityPicker
        open={ui.pickerOpen}
        title="Onde ficam suas obras"
        value={ui.cidade}
        stateKey="completar-recrutador-cidade"
        onChoose={(cidade) => setUi({ cidade, pickerOpen: false })}
        onClose={() => setUi({ pickerOpen: false })}
      />
    </Shell>
  );
}
