import type { ReactNode } from 'react';
import { Button } from '../../components/Button';
import { CityPicker, LocationButton } from '../../components/CityPicker';
import { FieldError } from '../../components/FieldError';
import { IconButton } from '../../components/IconButton';
import { Input } from '../../components/Input';
import { PhotoSlot } from '../../components/PhotoSlot';
import { Select } from '../../components/Select';
import { Tag } from '../../components/Tag';
import { useUI } from '../../hooks/useStore';
import { DEFAULT_CITY } from '../../services/cities';
import { finishSignUp } from '../../services/auth';
import { OFICIO_OPTIONS, TIPOS_OBRA } from '../../services/catalog';
import type { ScreenProps } from '../../types/screen';
import { navigate } from '../../services/router';
import { saveMyProfileImages } from '../../services/profiles';
import { showToast } from '../../services/toast';

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
    <div className="min-h-screen flex flex-col bg-white lg:min-h-0 lg:h-[calc(100vh-5rem)] lg:max-w-app lg:mx-auto lg:shadow-card lg:my-10 lg:rounded-card lg:overflow-hidden">
      <div className="sticky top-0 z-10 bg-white border-b border-concrete-200 px-2 pb-3">
        <div className="flex items-center gap-1.5 min-h-14">
          {onBack ? <IconButton icon="arrow-left" label="Voltar" onClick={onBack} /> : <span className="w-11 h-11" />}
          <span className="flex-1 text-sm font-semibold text-concrete-500">{`Passo ${step + 1} de ${total}`}</span>
        </div>
        <div className="h-1 mx-2 rounded-full bg-concrete-200 overflow-hidden">
          <div
            className="h-full bg-brand-500 rounded-full transition-all duration-200"
            style={{ width: ((step + 1) / total) * 100 + '%' }}
          />
        </div>
      </div>
      <div className="flex-1 px-5 sm:px-8 py-8 flex flex-col gap-7 bg-concrete-50 lg:min-h-0 lg:overflow-y-auto">
        {children}
      </div>
      <div className="px-5 sm:px-8 py-3 bg-white shadow-bar flex flex-col gap-2">
        {error ? <FieldError message={error} /> : null}
        <Button label={label} size="lg" fullWidth loading={loading} onClick={onContinue} />
      </div>
    </div>
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

const SAVE_ERROR = 'Não deu para salvar seu perfil agora. Confira sua internet e tente de novo.';

interface WorkerUI {
  step: number;
  saving: boolean;
  saveError: string | null;
  capa: string | null;
  photo: string | null;
  oficioId: string;
  cidade: string;
  pickerOpen: boolean;
  /** What is being typed in the specialties field. */
  especialidade: string;
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
    especialidade: '',
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

  // Typed specialties pile up as chips under the field (same word twice is ignored).
  const addEspecialidade = () => {
    const value = ui.especialidade.trim().replace(/\s+/g, ' ');
    if (!value) return;
    const exists = ui.especialidades.some((e) => e.toLowerCase() === value.toLowerCase());
    setUi({
      especialidade: '',
      especialidades: exists ? ui.especialidades : [...ui.especialidades, value],
      errors: { ...ui.errors, especialidades: null }
    });
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
            navigate('/mural', { replace: true });
          })
          .catch(() => setUi({ saving: false, saveError: SAVE_ERROR }));
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
      <div className="flex flex-col gap-2.5">
        <div className="flex items-end gap-2">
          <Input
            id="completar-especialidade"
            label="Especialidades"
            placeholder="Ex.: Reboco, pintura, elétrica"
            icon="hammer"
            value={ui.especialidade}
            invalid={Boolean(ui.errors.especialidades)}
            onInput={(v) => setUi({ especialidade: v })}
            onEnter={addEspecialidade}
          />
          <Button label="Adicionar" variant="secondary" iconLeft="plus" onClick={addEspecialidade} />
        </div>
        {ui.errors.especialidades ? (
          <FieldError message={ui.errors.especialidades} />
        ) : (
          <span className="text-sm text-concrete-500">
            Escreva uma especialidade e toque em Adicionar ou aperte Enter.
          </span>
        )}
        {ui.especialidades.length ? (
          <div className="flex flex-wrap gap-2 pt-1" aria-label="Suas especialidades">
            {ui.especialidades.map((e) => (
              <Tag
                key={e}
                label={e}
                selected
                onRemove={() => setUi({ especialidades: ui.especialidades.filter((x) => x !== e) })}
              />
            ))}
          </div>
        ) : null}
      </div>
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
          .catch(() => setUi({ saving: false, saveError: SAVE_ERROR }));
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
