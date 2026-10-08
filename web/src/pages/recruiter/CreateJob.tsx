import { BackBar } from '../../components/BackBar';
import { Button } from '../../components/Button';
import { FieldError } from '../../components/FieldError';
import { Icon } from '../../components/icons/Icon';
import { Input } from '../../components/Input';
import { JobTile } from '../../components/JobTile';
import { PhotoManager } from '../../components/PhotoManager';
import { Tag } from '../../components/Tag';
import { TextArea } from '../../components/TextArea';
import { useDb, useUI } from '../../hooks/useStore';
import { REQUISITOS_OPCOES } from '../../services/catalog';
import { publishJob } from '../../services/marketplace';
import { goBack, navigate } from '../../services/router';
import { currentCompanyId, getCompany } from '../../services/selectors';
import { resetUI } from '../../services/store';
import type { DiasKey } from '../../types/models';
import { cx } from '../../utils/cx';
import { DIAS, DIAS_ORDEM } from '../../utils/jobInfo';
import { toggleItem } from '../../utils/list';

const KEY = 'create-job';

type ErrorKey = 'tipo' | 'local' | 'dias' | 'periodo' | 'diarias' | 'vagas' | 'valor' | 'detalhe';
type Errors = Partial<Record<ErrorKey, string | null>>;

interface CreateJobUI {
  step: 1 | 2;
  fotos: string[];
  tipo: string;
  local: string;
  dias: DiasKey | null;
  data: string;
  periodoInicio: string;
  periodoFim: string;
  diarias: string;
  vagas: string;
  valor: string;
  negociavel: boolean;
  requisitos: string[];
  detalhe: string;
  errors: Errors;
  publishing: boolean;
}

function digits(v: string, max: number) {
  return String(v).replace(/\D/g, '').slice(0, max);
}

// Step 1: what, where, when and how many. Hours are optional, but if one end is filled in, so must the other.
function validateStep1(ui: CreateJobUI): Errors {
  const errors: Errors = {};
  if (!ui.tipo.trim()) errors.tipo = 'Escreva o tipo de serviço da vaga.';
  if (!ui.local.trim()) errors.local = 'Informe o endereço da obra.';
  if (!ui.dias) errors.dias = 'Escolha em que dias o bico pode acontecer.';
  if (Boolean(ui.periodoInicio) !== Boolean(ui.periodoFim))
    errors.periodo = 'Preencha o início e o fim, ou deixe os dois em branco.';
  if (!ui.diarias || Number(ui.diarias) < 1) errors.diarias = 'Informe quantas diárias.';
  if (!ui.vagas || Number(ui.vagas) < 1) errors.vagas = 'Informe quantas pessoas a vaga precisa.';
  return errors;
}

// Step 2: the pay (or "a combinar") and the description.
function validateStep2(ui: CreateJobUI): Errors {
  const errors: Errors = {};
  if (!ui.negociavel) {
    const n = parseInt(ui.valor, 10);
    if (!ui.valor.trim()) errors.valor = 'Informe o valor da diária, ou marque como a combinar.';
    else if (!n || n < 80) errors.valor = 'Informe um valor de R$ 80 ou mais.';
  }
  if (!ui.detalhe.trim()) errors.detalhe = 'Descreva o serviço da vaga.';
  return errors;
}

export default function CreateJob() {
  const db = useDb();
  const [ui, setUi] = useUI<CreateJobUI>(KEY, () => ({
    step: 1,
    fotos: [],
    tipo: '',
    local: '',
    dias: null,
    data: '',
    periodoInicio: '',
    periodoFim: '',
    diarias: '1',
    vagas: '1',
    valor: '',
    negociavel: false,
    requisitos: ['Botina e capacete próprios'],
    detalhe: '',
    errors: {},
    publishing: false
  }));

  const clearError = (field: ErrorKey) => ({ ...ui.errors, [field]: null });
  // Hours are optional, but if one end is filled in, so must the other.
  const hasHours = Boolean(ui.periodoInicio && ui.periodoFim);
  // "Diárias" and "vagas" sit side by side and share one message.
  const countError = ui.errors.diarias || ui.errors.vagas;

  function advance() {
    if (ui.step === 1) {
      const errors = validateStep1(ui);
      if (Object.keys(errors).length) {
        setUi({ errors });
        return;
      }
      setUi({ step: 2, errors: {} });
      return;
    }
    const errors = validateStep2(ui);
    if (Object.keys(errors).length) {
      setUi({ errors });
      return;
    }
    setUi({ publishing: true });
    const diariasNum = Number(ui.diarias) || 1;
    publishJob({
      role: ui.tipo.trim(),
      pay: ui.negociavel ? null : parseInt(ui.valor, 10),
      address: ui.local,
      date: ui.data.trim() || null,
      hours: hasHours ? `${ui.periodoInicio}h–${ui.periodoFim}h` : null,
      dias: ui.dias,
      duration: diariasNum === 1 ? '1 diária' : `${diariasNum} diárias`,
      slots: Number(ui.vagas) || 1,
      requirements: ui.requisitos,
      description: ui.detalhe.trim(),
      photos: ui.fotos
    }).then((id) => {
      setUi({ publishing: false });
      resetUI(KEY);
      navigate('/vaga-publicada/' + id);
    });
  }

  const step1 = (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-2.5 text-center">
        <span className="text-sm font-semibold text-concrete-900">Fotos da vaga (opcional)</span>
        <PhotoManager photos={ui.fotos} onChange={(fotos) => setUi({ fotos })} />
        <span className="max-w-[22rem] text-sm text-concrete-500">
          Até 6 fotos do canteiro. A primeira vira a capa do bico no mural.
        </span>
      </div>
      <Input
        id="create-job-tipo"
        label="Tipo de serviço"
        placeholder="Ex.: Pedreiro de acabamento"
        icon="hammer"
        value={ui.tipo}
        error={ui.errors.tipo}
        onInput={(v) => setUi({ tipo: v, errors: { ...ui.errors, tipo: null } })}
      />
      <Input
        id="create-job-local"
        label="Endereço da obra"
        placeholder="Rua, número e bairro"
        icon="map-pin"
        value={ui.local}
        error={ui.errors.local}
        onInput={(v) => setUi({ local: v, errors: { ...ui.errors, local: null } })}
      />
      <div className="flex flex-col gap-2" role="radiogroup" aria-labelledby="create-job-dias-label">
        <span id="create-job-dias-label" className="text-sm font-semibold text-concrete-900">
          Em que dias pode ser?
        </span>
        <div className="grid grid-cols-3 gap-2 max-w-[27rem]">
          {DIAS_ORDEM.map((id) => (
            <DiasOption
              key={id}
              id={id}
              checked={ui.dias === id}
              onSelect={() => setUi({ dias: id, errors: clearError('dias') })}
            />
          ))}
        </div>
        {ui.errors.dias ? <FieldError message={ui.errors.dias} /> : null}
      </div>
      {/* Short answers get short fields, side by side where they fit. */}
      <div className="flex flex-wrap items-start gap-x-6 gap-y-6">
        <div className="w-[12.5rem]">
          <Input
            id="create-job-data"
            label="Data (opcional)"
            placeholder="Ex.: 12 set"
            icon="calendar"
            value={ui.data}
            hint="Em branco: data a combinar."
            onInput={(v) => setUi({ data: v })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-concrete-900">Horário (opcional)</span>
          <div className="flex items-center gap-2">
            <div className="w-[6.5rem]">
              <Input
                id="create-job-periodo-inicio"
                placeholder="7"
                suffix="h"
                inputMode="numeric"
                value={ui.periodoInicio}
                invalid={Boolean(ui.errors.periodo)}
                onInput={(v) => setUi({ periodoInicio: digits(v, 2), errors: clearError('periodo') })}
              />
            </div>
            <span className="text-sm text-concrete-500">às</span>
            <div className="w-[6.5rem]">
              <Input
                id="create-job-periodo-fim"
                placeholder="17"
                suffix="h"
                inputMode="numeric"
                value={ui.periodoFim}
                invalid={Boolean(ui.errors.periodo)}
                onInput={(v) => setUi({ periodoFim: digits(v, 2), errors: clearError('periodo') })}
              />
            </div>
          </div>
          {ui.errors.periodo ? (
            <span className="max-w-[15rem] text-sm text-danger-500">{ui.errors.periodo}</span>
          ) : (
            <span className="text-sm text-concrete-500">Em branco: horário a combinar.</span>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="grid grid-cols-2 gap-3 max-w-[20rem]">
          <Input
            id="create-job-diarias"
            label="Diárias"
            placeholder="1"
            suffix="diária(s)"
            inputMode="numeric"
            value={ui.diarias}
            invalid={Boolean(ui.errors.diarias)}
            onInput={(v) => setUi({ diarias: digits(v, 2), errors: clearError('diarias') })}
          />
          <Input
            id="create-job-vagas"
            label="Pessoas"
            placeholder="1"
            suffix="pessoa(s)"
            inputMode="numeric"
            value={ui.vagas}
            invalid={Boolean(ui.errors.vagas)}
            onInput={(v) => setUi({ vagas: digits(v, 2), errors: clearError('vagas') })}
          />
        </div>
        {countError ? (
          <FieldError message={countError} />
        ) : (
          <span className="text-sm text-concrete-500">
            Quantos dias o bico dura e quantos trabalhadores você precisa.
          </span>
        )}
      </div>
    </div>
  );

  const step2 = (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-start gap-2">
        {ui.negociavel ? null : (
          <div className="w-full max-w-[15rem]">
            <Input
              id="create-job-valor"
              label="Valor da diária"
              placeholder="220"
              suffix="reais"
              inputMode="numeric"
              value={ui.negociavel ? '' : ui.valor}
              error={ui.errors.valor}
              hint={ui.errors.valor || ui.negociavel ? null : 'O trabalhador vê esse valor no mural. Mínimo de R$ 80.'}
              onInput={(v) => setUi({ valor: digits(v, 5), errors: { ...ui.errors, valor: null } })}
            />
          </div>
        )}
        {ui.negociavel ? null : (
          <Button
            label="Deixar valor a combinar"
            variant="ghost"
            size="sm"
            iconLeft="handshake"
            onClick={() => setUi({ negociavel: true, valor: '', errors: { ...ui.errors, valor: null } })}
          />
        )}
        {ui.negociavel ? <span className="text-sm font-semibold text-concrete-900">Valor da diária</span> : null}
        {ui.negociavel ? (
          <div className="w-full flex items-center gap-2 p-3 rounded-control bg-brand-50 border border-brand-200">
            <Icon name="handshake" size={18} color="var(--text-brand)" />
            <span className="flex-1 text-sm text-brand-600">
              O trabalhador vê "A combinar" no lugar do valor, e negocia direto com você.
            </span>
            <Button label="Definir um valor" variant="ghost" size="sm" onClick={() => setUi({ negociavel: false })} />
          </div>
        ) : null}
      </div>
      <div className="flex flex-col gap-2.5">
        <div className="text-xs font-bold tracking-[0.08em] uppercase text-concrete-500">
          O que o trabalhador precisa levar
        </div>
        <div className="flex flex-wrap gap-2">
          {REQUISITOS_OPCOES.map((r) => (
            <Tag
              key={r}
              label={r}
              selected={ui.requisitos.includes(r)}
              onClick={() =>
                setUi({
                  requisitos: toggleItem(ui.requisitos, r)
                })
              }
            />
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-1.5 w-full">
        <label htmlFor="create-job-detalhe" className="text-sm font-semibold text-concrete-900">
          Descrição do bico
        </label>
        <TextArea
          id="create-job-detalhe"
          rows={3}
          placeholder="Ex.: reboco de duas paredes internas, argamassa e areia já estão no local."
          value={ui.detalhe}
          className={cx(
            'w-full px-3 py-2.5 bg-white rounded-control border outline-none text-base text-concrete-900 placeholder:text-concrete-400 resize-none transition-colors duration-150',
            ui.errors.detalhe
              ? 'border-danger-500'
              : 'border-concrete-300 focus:border-brand-500 focus:ring-4 focus:ring-brand-100'
          )}
          onInput={(v) => setUi({ detalhe: v, errors: { ...ui.errors, detalhe: null } })}
        />
        {ui.errors.detalhe ? (
          <FieldError message={ui.errors.detalhe} />
        ) : (
          <span className="text-sm text-concrete-500">
            Quanto mais claro, menos desencontro no canteiro. Essa descrição aparece para quem ver o bico.
          </span>
        )}
      </div>
      <div className="flex flex-col items-center gap-3 pt-5 border-t border-concrete-200 text-center">
        <span className="font-semibold text-concrete-900">Como vai aparecer no mural</span>
        <div className="w-[13rem] max-w-full text-left" aria-hidden="true">
          <JobTile
            job={{
              id: 'previa',
              role: ui.tipo.trim() || 'Tipo de serviço',
              location: 'Tatuapé, SP',
              dias: ui.dias,
              date: ui.data.trim() || null,
              hours: hasHours ? `${ui.periodoInicio}h–${ui.periodoFim}h` : null,
              pay: ui.negociavel || !ui.valor ? null : parseInt(ui.valor, 10),
              photos: ui.fotos
            }}
            company={getCompany(db, currentCompanyId())}
            onClick={() => {}}
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col">
      <BackBar title="Publicar vaga" onBack={() => (ui.step === 2 ? setUi({ step: 1 }) : goBack('/mural'))} />
      <div className="flex items-center gap-2 px-4 sm:px-0 pt-3">
        <StepDot n={1} active={ui.step >= 1} />
        <span className="text-sm text-concrete-500">Serviço, local e dias</span>
        <span className="flex-1 h-px bg-concrete-200" />
        <StepDot n={2} active={ui.step >= 2} />
        <span className="text-sm text-concrete-500">Valor e requisitos</span>
      </div>
      <div className="px-4 sm:px-0 py-5">{ui.step === 1 ? step1 : step2}</div>
      <div className="px-4 sm:px-0 py-3 flex flex-col gap-1.5">
        <Button
          label={ui.step === 1 ? 'Continuar' : 'Publicar vaga'}
          size="lg"
          fullWidth
          loading={ui.publishing}
          onClick={advance}
        />
        <span className="text-center text-xs text-concrete-500">Publicar é grátis. Você paga só se impulsionar.</span>
      </div>
    </div>
  );
}

function DiasOption({ id, checked, onSelect }: { id: DiasKey; checked: boolean; onSelect: () => void }) {
  const d = DIAS[id];
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked ? 'true' : 'false'}
      aria-label={`${d.label}: ${d.hint}`}
      className={cx(
        'relative flex flex-col items-center justify-center gap-0.5 min-h-[4.5rem] px-2 py-2.5 rounded-card border text-center transition-colors',
        checked
          ? 'bg-brand-50 border-brand-500 ring-1 ring-brand-500'
          : 'bg-white border-concrete-300 hover:bg-concrete-50'
      )}
      onClick={onSelect}
    >
      {checked ? (
        <span className="absolute top-1.5 right-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-brand-500">
          <Icon name="check" size={11} color="#fff" />
        </span>
      ) : null}
      <span className={cx('text-sm font-bold leading-tight', checked ? 'text-brand-600' : 'text-concrete-900')}>
        {d.pick}
      </span>
      <span className="text-xs text-concrete-500">{d.pickSub}</span>
    </button>
  );
}

function StepDot({ n, active }: { n: number; active: boolean }) {
  return (
    <span
      className={`inline-flex items-center justify-center w-7 h-7 rounded-full font-bold text-sm ${active ? 'bg-brand-500 text-white' : 'bg-concrete-100 text-concrete-500'}`}
    >
      {String(n)}
    </span>
  );
}
