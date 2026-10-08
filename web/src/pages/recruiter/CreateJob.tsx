import { useRef } from 'react';
import { BackBar } from '../../components/BackBar';
import { Button } from '../../components/Button';
import { CityPicker, LocationButton } from '../../components/CityPicker';
import { FieldError } from '../../components/FieldError';
import { Icon } from '../../components/icons/Icon';
import { Input } from '../../components/Input';
import { JobTile } from '../../components/JobTile';
import { PhotoManager } from '../../components/PhotoManager';
import { Select } from '../../components/Select';
import { Switch } from '../../components/Switch';
import { Tag } from '../../components/Tag';
import { TextArea } from '../../components/TextArea';
import { useDb, useUI } from '../../hooks/useStore';
import { EXAMPLE_CEPS, lookupCep, maskCEP, onlyDigits } from '../../services/address';
import { OFICIO_OPTIONS, REQUISITOS_OPCOES } from '../../services/catalog';
import { errorMessage } from '../../services/errors';
import { publishJob } from '../../services/jobs';
import { goBack, navigate } from '../../services/router';
import { currentCompanyId, getCompany } from '../../services/selectors';
import { resetUI } from '../../services/store';
import type { DiasKey } from '../../types/models';
import { cx } from '../../utils/cx';
import { todayISO } from '../../utils/dates';
import { DIAS, DIAS_ORDEM, durationText } from '../../utils/jobInfo';
import { toggleItem } from '../../utils/list';
import {
  draftFromForm,
  emptyForm,
  formDiarias,
  MIN_PAY,
  validateStep1,
  validateStep2,
  type FieldKey,
  type FormErrors,
  type JobForm
} from './jobForm';

const KEY = 'create-job';

type CepStatus = 'idle' | 'loading' | 'found' | 'notfound' | 'error';

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

export default function CreateJob() {
  const db = useDb();
  const [ui, setUi] = useUI<CreateJobUI>(KEY, () => ({
    step: 1,
    form: emptyForm(),
    errors: {},
    cepStatus: 'idle',
    cepError: null,
    pickerOpen: false,
    publishing: false,
    publishError: null
  }));
  const f = ui.form;
  const today = todayISO();

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

  function onCep(v: string) {
    const cep = maskCEP(v);
    set({ cep }, 'cep');
    if (onlyDigits(cep).length === 8 && onlyDigits(cep) !== onlyDigits(f.cep)) searchCep(cep);
    else if (onlyDigits(cep).length < 8) {
      cepSeq.current++;
      setUi({ cepStatus: 'idle', cepError: null });
    }
  }

  function advance() {
    if (ui.step === 1) {
      const errors = validateStep1(f);
      if (hasErrors(errors)) {
        setUi({ errors });
        return;
      }
      setUi({ step: 2, errors: {} });
      return;
    }
    const errors = validateStep2(f);
    if (hasErrors(errors)) {
      setUi({ errors });
      return;
    }
    if (ui.publishing) return;
    setUi({ publishing: true, publishError: null });
    publishJob(draftFromForm(f))
      .then((id) => {
        resetUI(KEY);
        navigate('/vaga-publicada/' + id);
      })
      .catch((e: unknown) => setUi({ publishing: false, publishError: errorMessage(e) }));
  }

  const diarias = formDiarias(f);
  const cepHint =
    ui.cepStatus === 'loading'
      ? 'Buscando o endereço…'
      : ui.cepStatus === 'found'
        ? 'Endereço encontrado. Confira e complete com o número.'
        : ui.cepStatus === 'notfound'
          ? 'Não achamos esse CEP. Preencha o endereço abaixo.'
          : `Demonstração: ${EXAMPLE_CEPS.slice(0, 3).join(', ')} são encontrados.`;

  const step1 = (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-2.5 text-center">
        <span className="text-sm font-semibold text-concrete-900">Fotos da vaga (opcional)</span>
        <PhotoManager photos={f.fotos} onChange={(fotos) => set({ fotos })} />
        <span className="max-w-[22rem] text-sm text-concrete-500">
          Até 6 fotos do canteiro. A primeira vira a capa do bico no mural.
        </span>
      </div>
      <Select
        label="Ofício"
        placeholder="Escolha o ofício da vaga"
        options={OFICIO_OPTIONS}
        value={f.oficioId}
        error={ui.errors.oficio}
        onChange={(v) => set({ oficioId: v }, 'oficio')}
      />
      <Input
        id="create-job-titulo"
        label="Título (opcional)"
        placeholder="Ex.: Pedreiro para reboco de fachada"
        icon="pencil"
        hint="Sem título, a vaga aparece com o nome do ofício."
        value={f.titulo}
        maxLength={60}
        onInput={(v) => set({ titulo: v })}
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
          ) : (
            <span className={cx('text-sm', ui.cepStatus === 'found' ? 'text-success-500' : 'text-concrete-500')}>
              {cepHint}
            </span>
          )}
        </div>
        <Input
          id="create-job-rua"
          label="Rua"
          placeholder="Ex.: Rua Serra de Bragança"
          value={f.street}
          error={ui.errors.street}
          onInput={(v) => set({ street: v }, 'street')}
        />
        <div className="grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)] gap-3">
          <Input
            id="create-job-numero"
            label="Número"
            placeholder="1240"
            value={f.number}
            error={ui.errors.number}
            maxLength={10}
            onInput={(v) => set({ number: v }, 'number')}
          />
          <Input
            id="create-job-complemento"
            label="Complemento (opcional)"
            placeholder="Ex.: fundos, bloco B"
            value={f.complement}
            maxLength={40}
            onInput={(v) => set({ complement: v })}
          />
        </div>
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
        <span className="text-sm text-concrete-500">
          Antes de aprovar alguém, os candidatos veem só o bairro e a cidade. O endereço completo aparece para quem você
          aprovar.
        </span>
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

      <div className="flex flex-col gap-3">
        <div className="rounded-card border border-concrete-200 bg-white px-4">
          <Switch
            label="Data a combinar"
            description="Ligue se o dia ainda vai ser combinado com o trabalhador."
            checked={f.dateToArrange}
            onChange={(on) => set({ dateToArrange: on }, 'startDate', 'endDate', 'diarias')}
          />
        </div>
        {f.dateToArrange ? (
          <div className="w-[12.5rem]">
            <Input
              id="create-job-diarias"
              label="Quantas diárias"
              placeholder="1"
              suffix="diária(s)"
              inputMode="numeric"
              value={f.diarias}
              error={ui.errors.diarias}
              onInput={(v) => set({ diarias: digits(v, 2) }, 'diarias')}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <div className="grid grid-cols-2 gap-3 max-w-[27rem]">
              <Input
                id="create-job-inicio"
                label="Começa em"
                type="date"
                min={today}
                value={f.startDate}
                error={ui.errors.startDate}
                onInput={(v) =>
                  set({ startDate: v, endDate: f.endDate && f.endDate >= v ? f.endDate : v }, 'startDate', 'endDate')
                }
              />
              <Input
                id="create-job-fim"
                label="Termina em"
                type="date"
                min={f.startDate || today}
                value={f.endDate}
                error={ui.errors.endDate}
                onInput={(v) => set({ endDate: v }, 'endDate')}
              />
            </div>
            {diarias > 0 && !ui.errors.startDate && !ui.errors.endDate ? (
              <span className="text-sm text-concrete-500">
                {`${durationText({ diarias })} no período${f.dias && f.dias !== 'qualquer' ? `, só ${DIAS[f.dias].short.toLowerCase()}` : ''}.`}
              </span>
            ) : null}
          </div>
        )}
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
        {ui.errors.periodo ? (
          <FieldError message={ui.errors.periodo} />
        ) : (
          <span className="text-sm text-concrete-500">Em branco: horário a combinar.</span>
        )}
      </div>

      <div className="w-[10rem]">
        <Input
          id="create-job-vagas"
          label="Pessoas"
          placeholder="1"
          suffix="pessoa(s)"
          inputMode="numeric"
          value={f.vagas}
          error={ui.errors.vagas}
          hint="Quantos trabalhadores você precisa."
          onInput={(v) => set({ vagas: digits(v, 2) }, 'vagas')}
        />
      </div>
    </div>
  );

  const step2 = (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-start gap-2">
        {f.negociavel ? null : (
          <div className="w-full max-w-[15rem]">
            <Input
              id="create-job-valor"
              label="Valor da diária"
              placeholder="220"
              suffix="reais"
              inputMode="numeric"
              value={f.valor}
              error={ui.errors.valor}
              hint={ui.errors.valor ? null : `O trabalhador vê esse valor no mural. Mínimo de R$ ${MIN_PAY}.`}
              onInput={(v) => set({ valor: digits(v, 5) }, 'valor')}
            />
          </div>
        )}
        {f.negociavel ? null : (
          <Button
            label="Deixar valor a combinar"
            variant="ghost"
            size="sm"
            iconLeft="handshake"
            onClick={() => set({ negociavel: true, valor: '' }, 'valor')}
          />
        )}
        {f.negociavel ? <span className="text-sm font-semibold text-concrete-900">Valor da diária</span> : null}
        {f.negociavel ? (
          <div className="w-full flex items-center gap-2 p-3 rounded-control bg-brand-50 border border-brand-200">
            <Icon name="handshake" size={18} color="var(--text-brand)" />
            <span className="flex-1 text-sm text-brand-600">
              O trabalhador vê "A combinar" no lugar do valor, e negocia direto com você.
            </span>
            <Button label="Definir um valor" variant="ghost" size="sm" onClick={() => set({ negociavel: false })} />
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
              selected={f.requisitos.includes(r)}
              onClick={() => set({ requisitos: toggleItem(f.requisitos, r) })}
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
          value={f.detalhe}
          className={cx(
            'w-full px-3 py-2.5 bg-white rounded-control border outline-none text-base text-concrete-900 placeholder:text-concrete-400 resize-none transition-colors duration-150',
            ui.errors.detalhe
              ? 'border-danger-500'
              : 'border-concrete-300 focus:border-brand-500 focus:ring-4 focus:ring-brand-100'
          )}
          onInput={(v) => set({ detalhe: v }, 'detalhe')}
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
              oficioId: f.oficioId,
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
      <BackBar title="Publicar vaga" onBack={() => (ui.step === 2 ? setUi({ step: 1 }) : goBack('/mural'))} />
      <div className="flex items-center gap-2 px-4 sm:px-0 pt-3">
        <StepDot n={1} active={ui.step >= 1} />
        <span className="text-sm text-concrete-500">Serviço, local e datas</span>
        <span className="flex-1 h-px bg-concrete-200" />
        <StepDot n={2} active={ui.step >= 2} />
        <span className="text-sm text-concrete-500">Valor e requisitos</span>
      </div>
      <div className="px-4 sm:px-0 py-5">{ui.step === 1 ? step1 : step2}</div>
      <div className="px-4 sm:px-0 py-3 flex flex-col gap-1.5">
        {hasErrors(ui.errors) ? <FieldError message="Confira os campos marcados em vermelho." /> : null}
        {ui.publishError ? <FieldError message={ui.publishError} /> : null}
        <Button
          label={ui.step === 1 ? 'Continuar' : 'Publicar vaga'}
          size="lg"
          fullWidth
          loading={ui.publishing}
          onClick={advance}
        />
        <span className="text-center text-xs text-concrete-500">Publicar é grátis. Você paga só se impulsionar.</span>
      </div>
      <CityPicker
        open={ui.pickerOpen}
        title="Cidade da obra"
        value={f.city}
        stateKey="create-job-city"
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
