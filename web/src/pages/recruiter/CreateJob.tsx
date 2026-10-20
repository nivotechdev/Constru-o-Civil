import { useEffect, useRef } from 'react';
import { BackBar } from '../../components/BackBar';
import { Button } from '../../components/Button';
import { CityPicker, LocationButton } from '../../components/CityPicker';
import { FieldError } from '../../components/FieldError';
import { Icon } from '../../components/icons/Icon';
import { Input } from '../../components/Input';
import { JobTile } from '../../components/JobTile';
import { PhotoManager } from '../../components/PhotoManager';
import { Switch } from '../../components/Switch';
import { TextArea } from '../../components/TextArea';
import { useDb, useScreenUI } from '../../hooks/useStore';
import { useTextField } from '../../hooks/useTextField';
import { EXAMPLE_CEPS, lookupCep, maskCEP, onlyDigits } from '../../services/address';
import { knownCity } from '../../services/cities';
import { IS_DEMO } from '../../services/mode';
import { errorMessage } from '../../services/errors';
import { publishJob, significantChanges, updateJob } from '../../services/jobs';
import { holdsSlot, isPending } from '../../services/applicationMachine';
import { showToast } from '../../services/toast';
import { goBack, navigate } from '../../services/router';
import { applicationsForJob, approvedCount, currentCompanyId, getCompany } from '../../services/selectors';
import { resetUI } from '../../services/store';
import type { DiasKey, Job } from '../../types/models';
import { cx } from '../../utils/cx';
import { DIAS, DIAS_ORDEM } from '../../utils/jobInfo';
import { FEATURES } from '../../services/features';
import {
  draftFromForm,
  emptyForm,
  formFromJob,
  MAX_DESCRIPTION,
  MAX_TITLE,
  MIN_PAY,
  validateStep1,
  validateStep2,
  type FieldKey,
  type FormErrors,
  type JobForm
} from './jobForm';

type CepStatus = 'idle' | 'loading' | 'found' | 'notfound' | 'error';

const STEPS: { n: 1 | 2; label: string }[] = [
  { n: 1, label: 'Serviço e local' },
  { n: 2, label: 'Valor e pessoas' }
];

interface CreateJobUI {
  step: 1 | 2;
  form: JobForm;
  errors: FormErrors;
  cepStatus: CepStatus;
  cepError: string | null;
  pickerOpen: boolean;
  publishing: boolean;
  publishError: string | null;
}

function digits(v: string, max: number) {
  return String(v).replace(/\D/g, '').slice(0, max);
}

const hasErrors = (e: FormErrors) => Object.values(e).some(Boolean);

/** Publishing a new job. */
export default function CreateJob() {
  return <JobFormScreen />;
}

/**
 * The job form: publishing a new job, or editing `job` (B05). Editing keeps the start date if it is
 * already in the past, can't go below the people already approved, and warns when candidates will be
 * told about a change.
 */
export function JobFormScreen({ job, template, templateId }: { job?: Job; template?: JobForm; templateId?: string }) {
  const db = useDb();
  const KEY = job ? 'edit-job:' + job.id : templateId ? 'create-job:de:' + templateId : 'create-job';
  const holding = job ? approvedCount(db, job.id) : 0;
  const candidates = job
    ? applicationsForJob(db, job.id).filter((a) => isPending(a.status) || holdsSlot(a.status))
    : [];
  const limits = job ? { originalStartDate: job.startDate, minSlots: holding } : {};
  const [ui, setUi] = useScreenUI<CreateJobUI>(KEY, () => ({
    step: 1,
    // U13: a new job starts in the city saved in the company's profile (the CEP still changes it).
    form: job
      ? formFromJob(job)
      : (template ?? emptyForm(knownCity(getCompany(db, currentCompanyId())?.location) ?? undefined)),
    errors: {},
    cepStatus: 'idle',
    cepError: null,
    pickerOpen: false,
    publishing: false,
    publishError: null
  }));
  const f = ui.form;

  // U01: each step opens from the top (the "Continuar" button is at the bottom of a long page).
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [ui.step]);

  /** Changes form values and clears the messages of the fields they belong to. */
  const set = (patch: Partial<JobForm>, ...clear: FieldKey[]) =>
    setUi((s) => ({
      form: { ...s.form, ...patch },
      errors: clear.length ? { ...s.errors, ...Object.fromEntries(clear.map((k) => [k, null])) } : s.errors
    }));

  // The CEP fills street, neighbourhood and city as soon as its 8 digits are typed. A newer lookup (or a
  // change to the CEP) makes the answers of older ones stale.
  const cepSeq = useRef(0);
  function searchCep(cep: string) {
    const seq = ++cepSeq.current;
    setUi({ cepStatus: 'loading', cepError: null });
    lookupCep(cep)
      .then((found) => {
        if (seq !== cepSeq.current) return;
        if (!found) {
          setUi({ cepStatus: 'notfound' });
          return;
        }
        setUi((s) => ({
          cepStatus: 'found',
          form: { ...s.form, street: found.street, neighborhood: found.neighborhood, city: found.city },
          errors: { ...s.errors, cep: null, street: null, neighborhood: null, city: null }
        }));
      })
      .catch((e: unknown) => {
        if (seq === cepSeq.current) setUi({ cepStatus: 'error', cepError: errorMessage(e) });
      });
  }

  // X10: editing, the CEP is looked up again on opening (the map point of a changed number comes from it);
  // the street and the rest stay as saved.
  useEffect(() => {
    if (!job || onlyDigits(job.address.cep).length !== 8) return;
    lookupCep(job.address.cep).catch(() => undefined);
  }, [job]);

  function onCep(v: string) {
    const cep = maskCEP(v);
    set({ cep }, 'cep');
    if (onlyDigits(cep).length === 8 && onlyDigits(cep) !== onlyDigits(f.cep)) searchCep(cep);
    else if (onlyDigits(cep).length < 8) {
      cepSeq.current++;
      setUi({ cepStatus: 'idle', cepError: null });
    }
  }

  // Step 2 opens only with step 1 complete (the same check as "Continuar"); a mistake is shown on step 1.
  function goToStep(step: 1 | 2) {
    if (step === 2) {
      const errors = validateStep1(f, new Date(), limits, job);
      if (hasErrors(errors)) {
        setUi({ step: 1, errors });
        return;
      }
    }
    setUi({ step, errors: {} });
  }

  function advance() {
    if (ui.step === 1) {
      const errors = validateStep1(f, new Date(), limits, job);
      if (hasErrors(errors)) {
        setUi({ errors });
        return;
      }
      setUi({ step: 2, errors: {} });
      return;
    }
    // U02: publishing checks both steps; a mistake on step 1 sends the user back to it.
    const first = validateStep1(f, new Date(), limits, job);
    const second = validateStep2(f, limits);
    if (hasErrors(first) || hasErrors(second)) {
      setUi({ errors: { ...first, ...second }, step: hasErrors(first) ? 1 : 2 });
      return;
    }
    if (ui.publishing) return;
    setUi({ publishing: true, publishError: null });
    const draft = draftFromForm(f, job);
    const saving = job
      ? updateJob(job.id, draft).then(() => {
          resetUI(KEY);
          showToast(warnChanges.length ? 'Vaga atualizada. Avisamos os candidatos.' : 'Vaga atualizada');
          navigate('/vaga-gerenciar/' + job.id, { replace: true });
        })
      : publishJob(draft).then((id) => {
          resetUI(KEY);
          navigate('/vaga-publicada/' + id);
        });
    saving.catch((e: unknown) => setUi({ publishing: false, publishError: errorMessage(e) }));
  }

  // Editing a job people applied to: a new pay, date or address is told to them.
  const warnChanges =
    job &&
    candidates.length &&
    !hasErrors(validateStep1(f, new Date(), limits, job)) &&
    !hasErrors(validateStep2(f, limits))
      ? significantChanges(job, draftFromForm(f, job))
      : [];
  const cepHint =
    ui.cepStatus === 'loading'
      ? 'Buscando o endereço…'
      : ui.cepStatus === 'found'
        ? 'Endereço encontrado. Confira a rua e o bairro.'
        : ui.cepStatus === 'notfound'
          ? 'Não achamos esse CEP. Preencha o endereço abaixo.'
          : IS_DEMO
            ? `Demonstração: ${EXAMPLE_CEPS.slice(0, 3).join(', ')} são encontrados.`
            : '';

  const step1 = (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-2.5 text-center">
        <span className="text-sm font-semibold text-concrete-900">Fotos da vaga (opcional)</span>
        <PhotoManager photos={f.fotos} onChange={(fotos) => set({ fotos })} />
        <span className="max-w-[22rem] text-sm text-concrete-500">Até 6 fotos. A primeira é a capa.</span>
      </div>
      <Input
        id="create-job-titulo"
        label="Título da vaga"
        placeholder="Ex.: Pedreiro para reboco de fachada"
        icon="pencil"
        value={f.titulo}
        error={ui.errors.titulo}
        maxLength={MAX_TITLE}
        onInput={(v) => set({ titulo: v }, 'titulo')}
      />

      <fieldset className="flex flex-col gap-4">
        <legend className="text-xs font-bold tracking-[0.08em] uppercase text-concrete-500 pb-3">
          Endereço da obra
        </legend>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-end gap-2 max-w-[22rem]">
            <Input
              id="create-job-cep"
              label="CEP"
              placeholder="00000-000"
              icon="map-pin"
              inputMode="numeric"
              mono
              value={f.cep}
              error={ui.errors.cep}
              onInput={onCep}
            />
            {ui.cepStatus === 'error' ? (
              <Button
                label="Tentar de novo"
                variant="secondary"
                iconLeft="refresh-cw"
                onClick={() => searchCep(f.cep)}
              />
            ) : null}
          </div>
          {ui.errors.cep ? null : ui.cepStatus === 'error' ? (
            <FieldError message={ui.cepError || 'Não deu para buscar o CEP.'} />
          ) : cepHint ? (
            <span className={cx('text-sm', ui.cepStatus === 'found' ? 'text-success-500' : 'text-concrete-500')}>
              {cepHint}
            </span>
          ) : null}
        </div>
        <Input
          id="create-job-rua"
          label="Rua"
          placeholder="Ex.: Rua Serra de Bragança"
          value={f.street}
          error={ui.errors.street}
          onInput={(v) => set({ street: v }, 'street')}
        />
        <Input
          id="create-job-bairro"
          label="Bairro"
          placeholder="Ex.: Tatuapé"
          value={f.neighborhood}
          error={ui.errors.neighborhood}
          onInput={(v) => set({ neighborhood: v }, 'neighborhood')}
        />
        <LocationButton title="Cidade da obra" location={f.city} onClick={() => setUi({ pickerOpen: true })} />
        {ui.errors.city ? <FieldError message={ui.errors.city} /> : null}
      </fieldset>

      <div className="flex flex-col gap-2" role="radiogroup" aria-labelledby="create-job-dias-label">
        <span id="create-job-dias-label" className="text-sm font-semibold text-concrete-900">
          Em que dias pode ser?
        </span>
        <div className="grid grid-cols-3 gap-2 max-w-[27rem]">
          {DIAS_ORDEM.map((id) => (
            <DiasOption
              key={id}
              id={id}
              checked={f.dias === id}
              onSelect={() => set({ dias: id }, 'dias', 'endDate')}
            />
          ))}
        </div>
        {ui.errors.dias ? <FieldError message={ui.errors.dias} /> : null}
      </div>
    </div>
  );

  const step2 = (
    <div className="flex flex-col gap-6">
      {/* U08: one amount field; "a combinar" is a switch under it that turns the field off. */}
      <div className="flex flex-col gap-2 max-w-[27rem]">
        <PayField
          value={f.valor}
          disabled={f.negociavel}
          error={ui.errors.valor}
          onInput={(v) => set({ valor: digits(v, 5) }, 'valor')}
        />
        <Switch
          label="Combinar o valor com o trabalhador"
          checked={f.negociavel}
          onChange={(on) => set({ negociavel: on, valor: '' }, 'valor')}
        />
      </div>
      {/* U01: the date is always arranged with the worker; older jobs with dates keep them as they are. */}
      {f.dateToArrange ? (
        <div className="flex flex-col gap-1.5">
          <div className="w-[12.5rem]">
            <Input
              id="create-job-diarias"
              label="Quantas diárias"
              suffix="diária(s)"
              inputMode="numeric"
              value={f.diarias}
              error={ui.errors.diarias}
              onInput={(v) => set({ diarias: digits(v, 2) }, 'diarias')}
            />
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-concrete-900">Horário (opcional)</span>
        <div className="flex items-center gap-2">
          <div className="w-[8.5rem]">
            <Input
              id="create-job-hora-inicio"
              type="time"
              value={f.startTime}
              invalid={Boolean(ui.errors.periodo)}
              onInput={(v) => set({ startTime: v }, 'periodo')}
            />
          </div>
          <span className="text-sm text-concrete-500">às</span>
          <div className="w-[8.5rem]">
            <Input
              id="create-job-hora-fim"
              type="time"
              value={f.endTime}
              invalid={Boolean(ui.errors.periodo)}
              onInput={(v) => set({ endTime: v }, 'periodo')}
            />
          </div>
        </div>
        {ui.errors.periodo ? <FieldError message={ui.errors.periodo} /> : null}
      </div>

      <div className="w-[10rem]">
        <Input
          id="create-job-vagas"
          label="Pessoas"
          placeholder="Ex.: 2"
          suffix="pessoa(s)"
          inputMode="numeric"
          value={f.vagas}
          error={ui.errors.vagas}
          onInput={(v) => set({ vagas: digits(v, 2) }, 'vagas')}
        />
      </div>
      <div className="flex flex-col gap-1.5 w-full">
        <label htmlFor="create-job-detalhe" className="text-sm font-semibold text-concrete-900">
          Descrição do bico
        </label>
        <TextArea
          id="create-job-detalhe"
          rows={3}
          placeholder="Ex.: reboco de duas paredes internas, argamassa e areia já estão no local."
          value={f.detalhe}
          className={cx(
            'w-full px-3 py-2.5 bg-concrete-0 rounded-control border outline-none text-base text-concrete-900 placeholder:text-concrete-500 resize-none transition-colors duration-150',
            ui.errors.detalhe
              ? 'border-danger-500'
              : 'border-concrete-300 focus:border-brand-500 focus:ring-4 focus:ring-brand-100'
          )}
          onInput={(v) => set({ detalhe: v.slice(0, MAX_DESCRIPTION) }, 'detalhe')}
        />
        <span className="text-xs text-concrete-500 self-end">{`${f.detalhe.trim().length}/${MAX_DESCRIPTION}`}</span>
        {ui.errors.detalhe ? <FieldError message={ui.errors.detalhe} /> : null}
      </div>
      <div className="flex flex-col items-center gap-3 pt-5 border-t border-concrete-200 text-center">
        <span className="font-semibold text-concrete-900">Como vai aparecer no mural</span>
        <div className="w-[13rem] max-w-full text-left" aria-hidden="true">
          <JobTile
            job={{
              id: 'previa',
              oficioId: f.oficioId || null,
              title: f.titulo.trim() || null,
              address: { neighborhood: f.neighborhood.trim() || 'Bairro' },
              dias: f.dias,
              dateToArrange: f.dateToArrange,
              startDate: f.dateToArrange ? null : f.startDate || null,
              endDate: f.dateToArrange ? null : f.endDate || null,
              startTime: f.startTime || null,
              endTime: f.endTime || null,
              pay: f.negociavel || !f.valor ? null : parseInt(f.valor, 10),
              photos: f.fotos
            }}
            company={getCompany(db, currentCompanyId())}
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col">
      {/* U02: publishing comes from the navbar, so there is no back arrow; editing keeps one. */}
      <BackBar
        title={job ? 'Editar vaga' : 'Publicar vaga'}
        onBack={job ? () => goBack('/vaga-gerenciar/' + job.id) : undefined}
      />
      <div className="px-4 sm:px-0 pt-3">
        <div className="flex bg-concrete-100 rounded-full p-1 gap-1" role="tablist" aria-label="Etapas da vaga">
          {STEPS.map((step) => {
            const selected = ui.step === step.n;
            return (
              <button
                key={step.n}
                type="button"
                role="tab"
                aria-selected={selected}
                className={cx(
                  'flex-1 min-w-0 h-10 flex items-center justify-center gap-2 px-2 rounded-full text-sm font-bold transition-colors',
                  selected ? 'bg-concrete-0 text-brand-600 shadow-card' : 'text-concrete-500'
                )}
                onClick={() => goToStep(step.n)}
              >
                <span
                  className={cx(
                    'inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold shrink-0',
                    selected ? 'bg-brand-500 text-white' : 'bg-concrete-200 text-concrete-700'
                  )}
                >
                  {step.n}
                </span>
                <span className="truncate">{step.label}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="px-4 sm:px-0 py-5">{ui.step === 1 ? step1 : step2}</div>
      <div className="px-4 sm:px-0 py-3 flex flex-col gap-1.5">
        {warnChanges.length ? (
          <div className="flex items-start gap-2.5 p-3 rounded-card bg-warning-50 border border-warning-100 text-sm text-concrete-800">
            <Icon name="triangle-alert" size={18} color="var(--amber-500)" />
            <span>{`Você mudou ${warnChanges.join(', ')}. Os candidatos serão avisados da mudança.`}</span>
          </div>
        ) : null}
        {hasErrors(ui.errors) ? <FieldError message="Confira os campos marcados em vermelho." /> : null}
        {ui.publishError ? <FieldError message={ui.publishError} /> : null}
        <Button
          label={ui.step === 1 ? 'Continuar' : job ? 'Salvar alterações' : 'Publicar vaga'}
          size="lg"
          fullWidth
          loading={ui.publishing}
          onClick={advance}
        />
        {job ? null : (
          <span className="text-center text-xs text-concrete-500">
            {FEATURES.payments ? 'Publicar é grátis. Você paga só se impulsionar.' : 'Publicar é grátis.'}
          </span>
        )}
      </div>
      <CityPicker
        open={ui.pickerOpen}
        title="Cidade da obra"
        value={f.city}
        stateKey={KEY + '-city'}
        onChoose={(city) => {
          set({ city }, 'city');
          setUi({ pickerOpen: false });
        }}
        onClose={() => setUi({ pickerOpen: false })}
      />
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
          : 'bg-concrete-0 border-concrete-300 hover:bg-concrete-50'
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

/**
 * U08: the day's pay — a large amount with "R$" and "por diária" around it, the minimum under it. When the
 * value is "a combinar" the field stays in place, switched off and reading "A combinar", so nothing jumps.
 */
function PayField({
  value,
  disabled,
  error,
  onInput
}: {
  value: string;
  disabled: boolean;
  error?: string | null;
  onInput: (value: string) => void;
}) {
  const [ref, handleChange] = useTextField<HTMLInputElement>(onInput);
  const messageId = 'create-job-valor-msg';
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="create-job-valor" className="text-sm font-semibold text-concrete-900">
        Valor da diária
      </label>
      <div
        className={cx(
          'flex items-center gap-2 h-16 px-4 rounded-control border transition-colors duration-150',
          disabled
            ? 'bg-concrete-50 border-concrete-200'
            : error
              ? 'bg-concrete-0 border-danger-500'
              : 'bg-concrete-0 border-concrete-300 focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-100'
        )}
      >
        {disabled ? null : <span className="font-display font-semibold text-xl text-concrete-500">R$</span>}
        <input
          ref={ref}
          id="create-job-valor"
          inputMode="numeric"
          autoComplete="off"
          placeholder={disabled ? 'A combinar' : '0'}
          disabled={disabled}
          value={disabled ? '' : value}
          aria-invalid={error && !disabled ? 'true' : undefined}
          aria-describedby={messageId}
          className="flex-1 min-w-0 h-full bg-transparent outline-none font-display font-bold text-[1.75rem] tabular-nums text-concrete-900 placeholder:text-concrete-300 disabled:cursor-not-allowed disabled:placeholder:text-concrete-500 disabled:placeholder:font-semibold disabled:placeholder:text-xl"
          onChange={handleChange}
        />
        {disabled ? null : <span className="text-sm font-semibold text-concrete-500">por diária</span>}
      </div>
      {error && !disabled ? (
        <FieldError id={messageId} message={error} />
      ) : (
        <span id={messageId} className="text-sm text-concrete-500">
          {disabled ? 'No mural aparece "A combinar".' : `Mínimo de R$ ${MIN_PAY}.`}
        </span>
      )}
    </div>
  );
}
