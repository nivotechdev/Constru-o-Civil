import { useEffect } from 'react';
import { AddressFields } from '../../components/AddressFields';
import { BackBar } from '../../components/BackBar';
import { Button } from '../../components/Button';
import { FieldError } from '../../components/FieldError';
import { Icon } from '../../components/icons/Icon';
import { Input } from '../../components/Input';
import { JobTile } from '../../components/JobTile';
import { PhotoManager } from '../../components/PhotoManager';
import { Select } from '../../components/Select';
import { Switch } from '../../components/Switch';
import { TextArea } from '../../components/TextArea';
import { useBusyWhile } from '../../hooks/useBusy';
import { useDb, useScreenUI } from '../../hooks/useStore';
import { useTextField } from '../../hooks/useTextField';
import { resolveAddress, type AddressErrors } from '../../services/address';
import { knownCity } from '../../services/cities';
import { errorMessage } from '../../services/errors';
import { publishJob, significantChanges, updateJob } from '../../services/jobs';
import { holdsSlot, isPending } from '../../services/applicationMachine';
import { showToast } from '../../services/toast';
import { goBack, navigate } from '../../services/router';
import { applicationsForJob, approvedCount, currentCompanyId, getCompany } from '../../services/selectors';
import { resetUI } from '../../services/store';
import type { GeoPoint, Job, PlaceType } from '../../types/models';
import { cx } from '../../utils/cx';
import { dayLabel, todayISO } from '../../utils/dates';
import { fold } from '../../utils/addressText';
import { cleanWeekdays, daysText, PLACE_TYPES, WEEKDAYS } from '../../utils/jobInfo';
import { FEATURES } from '../../services/features';
import {
  draftFromForm,
  emptyForm,
  formAddress,
  formDiarias,
  formEndDate,
  formFromJob,
  MAX_DESCRIPTION,
  MAX_TITLE,
  MIN_PAY,
  sameAddress,
  validateStep1,
  validateStep2,
  type FieldKey,
  type FormErrors,
  type JobForm
} from './jobForm';

const STEPS: { n: 1 | 2; label: string }[] = [
  { n: 1, label: 'Serviço e local' },
  { n: 2, label: 'Valor e pessoas' }
];

interface CreateJobUI {
  step: 1 | 2;
  form: JobForm;
  errors: FormErrors;
  /** U52: finding the address on the map (leaving step 1, or publishing). */
  locating: boolean;
  /** The point found for the address as it is now (`key`); found again only if the address changes. */
  located: (GeoPoint & { key: string }) | null;
  publishing: boolean;
  publishError: string | null;
}

function digits(v: string, max: number) {
  return String(v).replace(/\D/g, '').slice(0, max);
}

const hasErrors = (e: FormErrors) => Object.values(e).some(Boolean);

/** The address as the map needs it, spelling aside: a new key means it has to be found again. */
const addressKey = (f: JobForm) =>
  [f.cep, f.city, f.street, f.neighborhood, f.number].map((x) => fold(x ?? '')).join('|');

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
    locating: false,
    located: null,
    publishing: false,
    publishError: null
  }));
  const f = ui.form;
  // U45: while the address is looked up or the job saved, nothing else takes a tap.
  useBusyWhile(ui.locating || ui.publishing);

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

  /**
   * U52: where the address is on the map — the saved point when editing an unchanged address, the one already found
   * for this same address, or found now (CEP checked against the city and the street; a blank CEP found from the
   * street). `null` with the problems shown on step 1.
   */
  async function locate(form: JobForm): Promise<{ point: GeoPoint; form: JobForm } | null> {
    if (job && sameAddress(form, job)) return { point: { lat: job.address.lat, lon: job.address.lon }, form };
    if (ui.located && ui.located.key === addressKey(form))
      return { point: { lat: ui.located.lat, lon: ui.located.lon }, form };
    const r = await resolveAddress(formAddress(form));
    if (!r.ok) {
      setUi((s) => ({ step: 1, errors: { ...s.errors, ...(r.errors as Partial<Record<FieldKey, string | null>>) } }));
      return null;
    }
    const next = {
      ...form,
      cep: r.draft.cep,
      city: r.draft.city,
      street: r.draft.street,
      neighborhood: r.draft.neighborhood
    };
    const point = { lat: r.address.lat, lon: r.address.lon };
    setUi({ form: next, located: { ...point, key: addressKey(next) } });
    return { point, form: next };
  }

  async function leaveStep1(): Promise<boolean> {
    const errors = validateStep1(f);
    if (hasErrors(errors)) {
      setUi({ step: 1, errors });
      return false;
    }
    setUi({ locating: true, publishError: null });
    try {
      return (await locate(f)) !== null;
    } catch (e: unknown) {
      setUi({ publishError: errorMessage(e) });
      return false;
    } finally {
      setUi({ locating: false });
    }
  }

  // Step 2 opens only with step 1 complete (the same check as "Continuar"); a mistake is shown on step 1.
  async function goToStep(step: 1 | 2) {
    if (step === 1 || ui.step === 2) {
      setUi({ step, errors: {} });
      return;
    }
    if (await leaveStep1()) setUi({ step: 2, errors: {} });
  }

  async function advance() {
    if (ui.locating || ui.publishing) return;
    if (ui.step === 1) {
      if (await leaveStep1()) setUi({ step: 2, errors: {} });
      return;
    }
    // U02: publishing checks both steps; a mistake on step 1 sends the user back to it.
    const first = validateStep1(f);
    const second = validateStep2(f, limits);
    if (hasErrors(first) || hasErrors(second)) {
      setUi({ errors: { ...first, ...second }, step: hasErrors(first) ? 1 : 2 });
      return;
    }
    setUi({ publishing: true, publishError: null });
    try {
      const found = await locate(f);
      if (!found) {
        setUi({ publishing: false });
        return;
      }
      // The form as `locate` left it (the CEP found, the city as the list names it).
      const draft = draftFromForm(found.form, job, found.point);
      if (job) {
        await updateJob(job.id, draft);
        resetUI(KEY);
        showToast(warnChanges.length ? 'Vaga atualizada. Avisamos os candidatos.' : 'Vaga atualizada');
        navigate('/vaga-gerenciar/' + job.id, { replace: true });
      } else {
        const id = await publishJob(draft);
        resetUI(KEY);
        navigate('/vaga-publicada/' + id);
      }
    } catch (e: unknown) {
      setUi({ publishing: false, publishError: errorMessage(e) });
    }
  }

  // Editing a job people applied to: a new pay, date or address is told to them.
  const warnChanges =
    job && candidates.length && !hasErrors(validateStep1(f)) && !hasErrors(validateStep2(f, limits))
      ? significantChanges(job, draftFromForm(f, job, ui.located ?? undefined))
      : [];
  const end = formEndDate(f);
  const marked = cleanWeekdays(f.weekdays);

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
        placeholder="Ex.: Garçom para evento de sábado"
        icon="pencil"
        value={f.titulo}
        error={ui.errors.titulo}
        maxLength={MAX_TITLE}
        onInput={(v) => set({ titulo: v }, 'titulo')}
      />

      <fieldset className="flex flex-col gap-3">
        <legend className="text-xs font-bold tracking-[0.08em] uppercase text-concrete-500 pb-3">
          Endereço do serviço
        </legend>
        {/* U52: the city typed (with the list), linked to the CEP; the CEP fills itself from the street. */}
        <AddressFields
          idPrefix="create-job"
          value={formAddress(f)}
          errors={ui.errors as AddressErrors}
          onChange={(patch, clear) => set(patch, ...clear)}
        />
        <div className="grid grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)] gap-3 items-start">
          <Input
            id="create-job-numero"
            label="Número (opcional)"
            placeholder="Ex.: 120"
            maxLength={10}
            value={f.number}
            error={ui.errors.number}
            onInput={(v) => set({ number: v }, 'number')}
          />
          <Select
            id="create-job-tipo"
            label="Tipo do local (opcional)"
            placeholder="Não dizer"
            clearable
            options={PLACE_TYPES.map((p) => ({ value: p.id, label: p.label }))}
            value={f.placeType}
            onChange={(v) => set({ placeType: v as PlaceType | '' }, 'placeType')}
          />
        </div>
        <span className="-mt-1 text-sm text-concrete-500">O número só aparece para quem você aprovar.</span>
      </fieldset>

      <WeekdayPicker
        value={marked}
        error={ui.errors.weekdays}
        onChange={(weekdays) => set({ weekdays }, 'weekdays', 'startDate')}
      />
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
      <div className="w-[12.5rem]">
        <Input
          id="create-job-diarias"
          label="Quantas diárias"
          suffix="diária(s)"
          inputMode="numeric"
          value={f.diarias}
          error={ui.errors.diarias}
          onInput={(v) => set({ diarias: digits(v, 2) }, 'diarias', 'startDate')}
        />
      </div>

      {/* U52: the start date is optional — without it the job reads "Data e horário a combinar". */}
      <div className="flex flex-col gap-1.5 max-w-[27rem]">
        <div className="w-[12.5rem]">
          <Input
            id="create-job-data"
            label="Data de início (opcional)"
            type="date"
            min={todayISO()}
            value={f.startDate}
            error={ui.errors.startDate}
            onInput={(v) => set({ startDate: v }, 'startDate')}
          />
        </div>
        {ui.errors.startDate ? null : (
          <span className="text-sm text-concrete-500">
            {f.startDate && end
              ? end === f.startDate
                ? `Um dia só: ${dayLabel(f.startDate)}.`
                : `De ${dayLabel(f.startDate)} até ${dayLabel(end)} (${formDiarias(f)} diárias nos dias marcados).`
              : 'Sem data, a vaga fica com a data a combinar.'}
          </span>
        )}
        {f.startDate ? (
          <button
            type="button"
            className="self-start h-9 px-3 -ml-3 rounded-full text-sm font-semibold text-brand-600 hover:bg-brand-50"
            onClick={() => set({ startDate: '' }, 'startDate')}
          >
            Tirar a data (a combinar)
          </button>
        ) : null}
      </div>

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
          placeholder="Ex.: servir as mesas num aniversário de 80 pessoas. Uniforme preto, almoço incluso."
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
              weekdays: marked,
              dateToArrange: !f.startDate,
              startDate: f.startDate || null,
              endDate: end || null,
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
                onClick={() => void goToStep(step.n)}
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
          loading={ui.locating || ui.publishing}
          onClick={() => void advance()}
        />
        {job ? null : (
          <span className="text-center text-xs text-concrete-500">
            {FEATURES.payments ? 'Publicar é grátis. Você paga só se impulsionar.' : 'Publicar é grátis.'}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * U52: "Em que dias pode ser?" — the seven days in one row, each a toggle, with shortcuts for the usual choices and
 * the word the mural card will show ("Durante a semana", "Fim de semana", "Todos os dias").
 */
function WeekdayPicker({
  value,
  error,
  onChange
}: {
  value: number[];
  error?: string | null;
  onChange: (days: number[]) => void;
}) {
  const toggle = (n: number) =>
    onChange(value.includes(n) ? value.filter((d) => d !== n) : cleanWeekdays([...value, n]));
  const shortcuts: { label: string; days: number[] }[] = [
    { label: 'Seg a sex', days: [1, 2, 3, 4, 5] },
    { label: 'Fim de semana', days: [6, 7] },
    { label: 'Todos', days: [1, 2, 3, 4, 5, 6, 7] }
  ];
  return (
    <fieldset className="flex flex-col gap-2.5 max-w-[27rem]">
      <legend className="text-sm font-semibold text-concrete-900 pb-2">Em que dias pode ser?</legend>
      <div className="grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((d) => {
          const on = value.includes(d.n);
          return (
            <button
              key={d.n}
              type="button"
              aria-pressed={on ? 'true' : 'false'}
              className={cx(
                'h-11 rounded-xl border text-sm font-semibold transition-colors outline-none focus-visible:ring-4 focus-visible:ring-brand-100',
                on
                  ? 'bg-brand-500 border-brand-500 text-white'
                  : error
                    ? 'bg-concrete-0 border-danger-500 text-concrete-700'
                    : 'bg-concrete-0 border-concrete-300 text-concrete-700 hover:bg-concrete-50'
              )}
              onClick={() => toggle(d.n)}
            >
              {d.short}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {shortcuts.map((s) => {
          const on = value.length === s.days.length && s.days.every((d) => value.includes(d));
          return (
            <button
              key={s.label}
              type="button"
              aria-pressed={on ? 'true' : 'false'}
              className={cx(
                'h-8 px-3 rounded-full border text-xs font-semibold transition-colors',
                on
                  ? 'bg-brand-50 border-brand-200 text-brand-700'
                  : 'bg-concrete-0 border-concrete-200 text-concrete-700 hover:bg-concrete-50'
              )}
              onClick={() => onChange(s.days)}
            >
              {s.label}
            </button>
          );
        })}
        {value.length ? (
          <span className="ml-auto text-sm text-concrete-500" aria-live="polite">
            {`No mural: ${daysText({ weekdays: value })}`}
          </span>
        ) : null}
      </div>
      {error ? <FieldError message={error} /> : null}
    </fieldset>
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
