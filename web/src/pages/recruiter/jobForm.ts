// The publish/edit job form: its values, the rules each step checks and the draft it sends. Pure
// functions (no React), so the rules are tested on their own (src/__tests__/jobForm.test.ts).
// U01: the screen no longer asks for the trade, the complement, urgency, how the diária is paid or what to bring.
// The fields stay in the form so that editing a job published before keeps what it had.
// U52: the address is the address fields (city typed, linked to the CEP), with the number and the kind of place
// (optional); the days of the week are marked one by one; the start date is optional (none = "a combinar").
import { addressErrors, onlyDigits, type AddressDraft } from '../../services/address';
import { getOficio } from '../../services/catalog';
import { cityByLabel } from '../../services/cities';
import { DEFAULT_CITY } from '../../services/defaults';
import type { JobDraft } from '../../services/jobs';
import type { DiasKey, GeoPoint, Job, PlaceType, WagePayment } from '../../types/models';
import { isValidISODate, isValidTime, todayISO } from '../../utils/dates';
import { cleanWeekdays, diasFromWeekdays, endDateFor, isoWeekday, jobWeekdays, WEEKDAYS } from '../../utils/jobInfo';

export interface JobForm {
  fotos: string[];
  /** U01: kept from older jobs only ('' on new ones). */
  oficioId: string;
  titulo: string;
  cep: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  /** "São Paulo, SP" (the list's label once chosen; what was typed until then). */
  city: string;
  /** U52: the kind of place (optional; '' = not said). */
  placeType: PlaceType | '';
  /** U52: the days of the week it can happen on (1 = Monday … 7 = Sunday). */
  weekdays: number[];
  /** Jobs from before U52: their part of the week (the form now marks the days one by one). */
  dias: DiasKey | null;
  /** Jobs from before U52 with their dates fixed (new ones: a start date set means fixed). */
  dateToArrange: boolean;
  /** "YYYY-MM-DD" from the date field ('' = to be arranged); the end is worked out from it (U52). */
  startDate: string;
  endDate: string;
  /** "HH:MM" from the time fields ('' while empty). */
  startTime: string;
  endTime: string;
  /** How many diárias (always typed since U52). */
  diarias: string;
  vagas: string;
  valor: string;
  negociavel: boolean;
  requisitos: string[];
  detalhe: string;
  /** Free: the company needs people fast (the mural shows "Urgente" and puts it before the others). */
  urgente: boolean;
  /** L18: how the diária is paid, and (for "outro") how in words. U01: null on new jobs. */
  pagamento: WagePayment | null;
  pagamentoObs: string;
}

export type FieldKey =
  | 'titulo'
  | 'cep'
  | 'street'
  | 'number'
  | 'neighborhood'
  | 'city'
  | 'dias'
  | 'weekdays'
  | 'placeType'
  | 'startDate'
  | 'endDate'
  | 'periodo'
  | 'diarias'
  | 'vagas'
  | 'valor'
  | 'pagamento'
  | 'detalhe';
export type FormErrors = Partial<Record<FieldKey, string | null>>;

/** Longest job one post can cover (beyond that, publish it again). */
export const MAX_DAYS = 60;
export const MIN_PAY = 80;
/** W08: above this a diária is almost surely a typo (the database refuses it too). */
export const MAX_PAY = 5000;
export const MIN_DESCRIPTION = 20;
export const MAX_TITLE = 60;
export const MAX_DESCRIPTION = 1000;

/** A new job's form; it starts in `city` (U13: the company's saved place). */
export function emptyForm(city: string = DEFAULT_CITY): JobForm {
  return {
    fotos: [],
    oficioId: '',
    titulo: '',
    cep: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city,
    placeType: '',
    weekdays: [],
    dias: null,
    dateToArrange: true,
    startDate: '',
    endDate: '',
    startTime: '',
    endTime: '',
    diarias: '',
    vagas: '',
    valor: '',
    negociavel: false,
    requisitos: [],
    detalhe: '',
    urgente: false,
    pagamento: null,
    pagamentoObs: ''
  };
}

/** The form filled in with a job's values (editing it, or publishing it again). */
export function formFromJob(job: Job): JobForm {
  return {
    fotos: job.photos ? [...job.photos] : [],
    oficioId: job.oficioId ?? '',
    titulo: job.title ?? '',
    cep: job.address.cep,
    street: job.address.street,
    number: job.address.number,
    complement: job.address.complement ?? '',
    neighborhood: job.address.neighborhood,
    city: `${job.address.city}, ${job.address.uf}`,
    placeType: job.placeType ?? '',
    weekdays: jobWeekdays(job),
    dias: job.dias ?? null,
    dateToArrange: job.dateToArrange,
    startDate: job.startDate ?? '',
    endDate: job.endDate ?? '',
    startTime: job.startTime ?? '',
    endTime: job.endTime ?? '',
    diarias: String(job.diarias),
    vagas: String(job.slots || 1),
    valor: job.pay == null ? '' : String(job.pay),
    negociavel: job.pay == null,
    requisitos: [...job.requirements],
    detalhe: job.description,
    urgente: Boolean(job.urgent),
    pagamento: job.payment ?? null,
    pagamentoObs: job.paymentNote ?? ''
  };
}

/** Diárias the job will have (typed). */
export function formDiarias(f: Pick<JobForm, 'diarias'>): number {
  return Number(f.diarias) || 0;
}

/** When editing a job: what the form can't go below/before. */
export interface EditLimits {
  /** The job's current start date: keeping it is fine even if it is already in the past. */
  originalStartDate?: string | null;
  /** People already approved or hired: the headcount can't go below it. */
  minSlots?: number;
}

/** U52: the address fields of the form, as the address service reads them. */
export function formAddress(f: JobForm): AddressDraft {
  return { cep: f.cep, city: f.city, street: f.street, neighborhood: f.neighborhood, number: f.number };
}

/** U52: the last day, when the date is set (start + the diárias on the marked days); '' otherwise. */
export function formEndDate(f: Pick<JobForm, 'startDate' | 'diarias' | 'weekdays'>): string {
  if (!isValidISODate(f.startDate)) return '';
  return endDateFor(f.startDate, formDiarias(f), f.weekdays) ?? '';
}

// Step 1: what and where (U52: the address as typed — it is found on the map when the step is done) and the days.
export function validateStep1(f: JobForm): FormErrors {
  const e: FormErrors = {};
  const titulo = f.titulo.trim();
  if (!titulo) e.titulo = 'Dê um título para a vaga. Ex.: Garçom para evento.';
  else if (titulo.length > MAX_TITLE) e.titulo = `Use até ${MAX_TITLE} letras no título.`;
  Object.assign(e, addressErrors(formAddress(f)));
  if (f.number.trim().length > 10) e.number = 'Use até 10 caracteres no número.';
  if (!cleanWeekdays(f.weekdays).length) e.weekdays = 'Marque pelo menos um dia.';
  return e;
}

// Step 2: the pay (or "a combinar"), the diárias, the date (optional), the hours, the people and the description.
export function validateStep2(f: JobForm, limits: EditLimits = {}, now: Date = new Date()): FormErrors {
  const e: FormErrors = {};
  const n = formDiarias(f);
  if (!n || n < 1 || n > MAX_DAYS) e.diarias = 'Informe quantas diárias (de 1 a 60).';

  if (f.startDate) {
    const today = todayISO(now);
    const marked = cleanWeekdays(f.weekdays);
    if (!isValidISODate(f.startDate)) e.startDate = 'Data inválida.';
    else if (f.startDate < today && f.startDate !== limits.originalStartDate)
      e.startDate = 'A data de início não pode ser no passado.';
    else if (marked.length && !marked.includes(isoWeekday(f.startDate)))
      e.startDate = `Esse dia é ${WEEKDAYS[isoWeekday(f.startDate) - 1].name}. Escolha um dos dias marcados.`;
    else if (!e.diarias && !formEndDate(f))
      e.startDate = `Essas diárias passam de ${MAX_DAYS} dias. Diminua as diárias ou marque mais dias.`;
  }

  const hasStart = Boolean(f.startTime);
  const hasEnd = Boolean(f.endTime);
  if (hasStart !== hasEnd) e.periodo = 'Preencha o início e o fim, ou deixe os dois em branco.';
  else if (hasStart && (!isValidTime(f.startTime) || !isValidTime(f.endTime))) e.periodo = 'Horário inválido.';
  // W08: a night shift (22h–6h) goes past midnight; only the same start and end is refused.
  else if (hasStart && f.startTime === f.endTime) e.periodo = 'O início e o fim não podem ser iguais.';

  const vagas = Number(f.vagas);
  if (!vagas || vagas < 1 || vagas > 50) e.vagas = 'Informe quantas pessoas a vaga precisa (de 1 a 50).';
  else if (limits.minSlots && vagas < limits.minSlots)
    e.vagas = `Você já aprovou ${limits.minSlots} ${limits.minSlots === 1 ? 'pessoa' : 'pessoas'}. Não dá para pedir menos que isso.`;

  if (!f.negociavel) {
    const pay = parseInt(f.valor, 10);
    if (!f.valor.trim()) e.valor = 'Informe o valor da diária ou escolha combinar com o trabalhador.';
    else if (!pay || pay < MIN_PAY) e.valor = `Informe um valor de R$ ${MIN_PAY} ou mais.`;
    else if (pay > MAX_PAY) e.valor = `Confira o valor: a diária vai até R$ ${MAX_PAY.toLocaleString('pt-BR')}.`;
  }
  if (f.pagamento === 'outro' && !f.pagamentoObs.trim()) e.pagamento = 'Conte como a diária vai ser paga.';
  else if (f.pagamentoObs.trim().length > 80) e.pagamento = 'Use até 80 caracteres para explicar o pagamento.';
  const desc = f.detalhe.trim();
  if (!desc) e.detalhe = 'Descreva o serviço da vaga.';
  else if (desc.length < MIN_DESCRIPTION)
    e.detalhe = `Conte um pouco mais (pelo menos ${MIN_DESCRIPTION} letras): o que vai ser feito, onde, materiais.`;
  else if (desc.length > MAX_DESCRIPTION) e.detalhe = `Use até ${MAX_DESCRIPTION} letras na descrição.`;
  return e;
}

/** X10/U52: the address as the map knows it didn't change (so the saved point stays and nothing is looked up). */
export function sameAddress(f: JobForm, job: Job): boolean {
  const a = job.address;
  return (
    onlyDigits(f.cep) === onlyDigits(a.cep) &&
    f.street.trim() === a.street &&
    f.number.trim() === a.number &&
    f.neighborhood.trim() === a.neighborhood &&
    f.city === `${a.city}, ${a.uf}`
  );
}

/**
 * What the form sends to the service (call only after both steps validate). `located` is the point the address was
 * found at (address.resolveAddress); editing an unchanged address keeps the saved one.
 */
export function draftFromForm(f: JobForm, original?: Job, located?: GeoPoint): JobDraft {
  const [cityName, uf = ''] = f.city.split(',').map((x) => x.trim());
  const point =
    original && sameAddress(f, original)
      ? { lat: original.address.lat, lon: original.address.lon }
      : (located ?? cityByLabel(f.city) ?? { lat: original?.address.lat ?? 0, lon: original?.address.lon ?? 0 });
  const weekdays = cleanWeekdays(f.weekdays);
  const dated = Boolean(f.startDate);
  return {
    oficioId: getOficio(f.oficioId) ? f.oficioId : null,
    title: f.titulo.trim(),
    pay: f.negociavel ? null : parseInt(f.valor, 10),
    address: {
      cep: f.cep,
      street: f.street.trim(),
      number: f.number.trim(),
      complement: f.complement.trim() || null,
      neighborhood: f.neighborhood.trim(),
      city: cityName,
      uf,
      lat: point.lat,
      lon: point.lon
    },
    dateToArrange: !dated,
    startDate: dated ? f.startDate : null,
    endDate: dated ? formEndDate(f) || null : null,
    startTime: f.startTime || null,
    endTime: f.endTime || null,
    diarias: formDiarias(f),
    dias: diasFromWeekdays(weekdays),
    weekdays,
    placeType: f.placeType || null,
    slots: Number(f.vagas) || 1,
    requirements: f.requisitos,
    description: f.detalhe.trim(),
    photos: f.fotos,
    urgent: f.urgente,
    ...(f.pagamento ? { payment: f.pagamento } : {}),
    ...(f.pagamento === 'outro' ? { paymentNote: f.pagamentoObs.trim() } : {})
  };
}

/** P06: the list with a written requirement added (trimmed, up to 60 characters, no repeats, at most 12). */
export function addRequirement(list: string[], text: string): string[] {
  const clean = text.trim().replace(/\s+/g, ' ').slice(0, 60);
  if (!clean || list.length >= 12 || list.some((r) => r.toLowerCase() === clean.toLowerCase())) return list;
  return [...list, clean];
}
