// The publish/edit job form: its values, the rules each step checks and the draft it sends. Pure
// functions (no React), so the rules are tested on their own (src/__tests__/jobForm.test.ts).
import { locate, maskCEP, onlyDigits } from '../../services/address';
import { getOficio } from '../../services/catalog';
import { DEFAULT_CITY } from '../../services/defaults';
import type { JobDraft } from '../../services/jobs';
import type { DiasKey, Job } from '../../types/models';
import { isValidISODate, isValidTime, todayISO, daysBetween } from '../../utils/dates';
import { countDiarias, DIAS } from '../../utils/jobInfo';

export interface JobForm {
  fotos: string[];
  oficioId: string;
  titulo: string;
  cep: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  /** "São Paulo, SP" (the city picker's label). */
  city: string;
  dias: DiasKey | null;
  dateToArrange: boolean;
  /** "YYYY-MM-DD" from the date fields ('' while empty). */
  startDate: string;
  endDate: string;
  /** "HH:MM" from the time fields ('' while empty). */
  startTime: string;
  endTime: string;
  /** Typed only when the date is to be arranged; otherwise worked out from the dates. */
  diarias: string;
  vagas: string;
  valor: string;
  negociavel: boolean;
  requisitos: string[];
  detalhe: string;
  /** Free: the company needs people fast (the mural shows "Urgente" and puts it before the others). */
  urgente: boolean;
}

export type FieldKey =
  | 'oficio'
  | 'cep'
  | 'street'
  | 'number'
  | 'neighborhood'
  | 'city'
  | 'dias'
  | 'startDate'
  | 'endDate'
  | 'periodo'
  | 'diarias'
  | 'vagas'
  | 'valor'
  | 'detalhe';
export type FormErrors = Partial<Record<FieldKey, string | null>>;

/** Longest job one post can cover (beyond that, publish it again). */
export const MAX_DAYS = 60;
export const MIN_PAY = 80;

export function emptyForm(): JobForm {
  return {
    fotos: [],
    oficioId: '',
    titulo: '',
    cep: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: DEFAULT_CITY,
    dias: null,
    dateToArrange: false,
    startDate: '',
    endDate: '',
    startTime: '',
    endTime: '',
    diarias: '1',
    vagas: '1',
    valor: '',
    negociavel: false,
    requisitos: ['Botina e capacete próprios'],
    detalhe: '',
    urgente: false
  };
}

/** The form filled in with a job's values (editing it, or publishing it again). */
export function formFromJob(job: Job): JobForm {
  return {
    fotos: job.photos ? [...job.photos] : [],
    oficioId: job.oficioId,
    titulo: job.title ?? '',
    cep: job.address.cep,
    street: job.address.street,
    number: job.address.number,
    complement: job.address.complement ?? '',
    neighborhood: job.address.neighborhood,
    city: `${job.address.city}, ${job.address.uf}`,
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
    urgente: Boolean(job.urgent)
  };
}

/** Diárias the job will have: worked out from the dates, or as typed when the date is to be arranged. */
export function formDiarias(f: Pick<JobForm, 'dateToArrange' | 'startDate' | 'endDate' | 'dias' | 'diarias'>): number {
  if (f.dateToArrange) return Number(f.diarias) || 0;
  if (!isValidISODate(f.startDate) || !isValidISODate(f.endDate) || f.endDate < f.startDate) return 0;
  return countDiarias(f.startDate, f.endDate, f.dias);
}

/** When editing a job: what the form can't go below/before. */
export interface EditLimits {
  /** The job's current start date: keeping it is fine even if it is already in the past. */
  originalStartDate?: string | null;
  /** People already approved or hired: the headcount can't go below it. */
  minSlots?: number;
}

// Step 1: what, where, when and how many.
export function validateStep1(f: JobForm, now: Date = new Date(), limits: EditLimits = {}): FormErrors {
  const e: FormErrors = {};
  if (!getOficio(f.oficioId)) e.oficio = 'Escolha o ofício que a vaga precisa.';
  if (onlyDigits(f.cep).length !== 8) e.cep = 'Digite o CEP da obra (8 números).';
  if (!f.street.trim()) e.street = 'Informe a rua da obra.';
  if (!f.number.trim()) e.number = 'Informe o número (ou "s/n").';
  if (!f.neighborhood.trim()) e.neighborhood = 'Informe o bairro.';
  if (!f.city.trim()) e.city = 'Escolha a cidade da obra.';
  if (!f.dias) e.dias = 'Escolha em que dias o bico pode acontecer.';

  if (!f.dateToArrange) {
    const today = todayISO(now);
    if (!isValidISODate(f.startDate)) e.startDate = 'Escolha a data de início.';
    else if (f.startDate < today && f.startDate !== limits.originalStartDate)
      e.startDate = 'A data de início não pode ser no passado.';
    if (!isValidISODate(f.endDate)) e.endDate = 'Escolha a data de fim.';
    else if (isValidISODate(f.startDate) && f.endDate < f.startDate)
      e.endDate = 'A data de fim tem que ser igual ou depois do início.';
    else if (isValidISODate(f.startDate) && daysBetween(f.startDate, f.endDate) >= MAX_DAYS)
      e.endDate = `Uma vaga cobre até ${MAX_DAYS} dias. Para mais, publique de novo depois.`;
    if (!e.startDate && !e.endDate && f.dias && formDiarias(f) === 0)
      e.endDate = `Nenhum dia desse período é ${DIAS[f.dias].label.toLowerCase()}. Ajuste as datas ou os dias.`;
  } else {
    const n = Number(f.diarias);
    if (!n || n < 1 || n > MAX_DAYS) e.diarias = 'Informe quantas diárias (de 1 a 60).';
  }

  const hasStart = Boolean(f.startTime);
  const hasEnd = Boolean(f.endTime);
  if (hasStart !== hasEnd) e.periodo = 'Preencha o início e o fim, ou deixe os dois em branco.';
  else if (hasStart && (!isValidTime(f.startTime) || !isValidTime(f.endTime))) e.periodo = 'Horário inválido.';
  else if (hasStart && f.startTime >= f.endTime) e.periodo = 'O fim tem que ser depois do início.';

  const vagas = Number(f.vagas);
  if (!vagas || vagas < 1 || vagas > 50) e.vagas = 'Informe quantas pessoas a vaga precisa (de 1 a 50).';
  else if (limits.minSlots && vagas < limits.minSlots)
    e.vagas = `Você já aprovou ${limits.minSlots} ${limits.minSlots === 1 ? 'pessoa' : 'pessoas'}. Não dá para pedir menos que isso.`;
  return e;
}

// Step 2: the pay (or "a combinar") and the description.
export function validateStep2(f: JobForm): FormErrors {
  const e: FormErrors = {};
  if (!f.negociavel) {
    const n = parseInt(f.valor, 10);
    if (!f.valor.trim()) e.valor = 'Informe o valor da diária, ou marque como a combinar.';
    else if (!n || n < MIN_PAY) e.valor = `Informe um valor de R$ ${MIN_PAY} ou mais.`;
  }
  if (!f.detalhe.trim()) e.detalhe = 'Descreva o serviço da vaga.';
  return e;
}

/** What the form sends to the service (call only after both steps validate). */
export function draftFromForm(f: JobForm): JobDraft {
  const [cityName, uf = ''] = f.city.split(',').map((x) => x.trim());
  const point = locate({ cep: f.cep, street: f.street, number: f.number, city: f.city }) ?? { lat: 0, lon: 0 };
  return {
    oficioId: f.oficioId,
    title: f.titulo.trim() || null,
    pay: f.negociavel ? null : parseInt(f.valor, 10),
    address: {
      cep: maskCEP(f.cep),
      street: f.street.trim(),
      number: f.number.trim(),
      complement: f.complement.trim() || null,
      neighborhood: f.neighborhood.trim(),
      city: cityName,
      uf,
      ...point
    },
    dateToArrange: f.dateToArrange,
    startDate: f.dateToArrange ? null : f.startDate,
    endDate: f.dateToArrange ? null : f.endDate,
    startTime: f.startTime || null,
    endTime: f.endTime || null,
    diarias: formDiarias(f),
    dias: f.dias,
    slots: Number(f.vagas) || 1,
    requirements: f.requisitos,
    description: f.detalhe.trim(),
    photos: f.fotos,
    urgent: f.urgente
  };
}

/** P06: the list with a written requirement added (trimmed, up to 60 characters, no repeats, at most 12). */
export function addRequirement(list: string[], text: string): string[] {
  const clean = text.trim().replace(/\s+/g, ' ').slice(0, 60);
  if (!clean || list.length >= 12 || list.some((r) => r.toLowerCase() === clean.toLowerCase())) return list;
  return [...list, clean];
}
