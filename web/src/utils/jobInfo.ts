// How a job's schedule and place read everywhere in the app, always derived from the stored data (real
// dates, times and address): "Hoje", "Amanhã" and "Sex, 25 set" are worked out from the date, never
// stored. Dates and hours are optional (a job can leave them to be arranged with the worker); `dias`
// says which part of the week the job can happen on.
import type { DiasKey, Job, JobAddress, PlaceType, WagePayment } from '../types/models';
import { addDays, dayLabel, parseISODate, timeLabel, todayISO, weekday } from './dates';
import { formatBRL } from './format';

interface DiasInfo {
  /** Job page. */
  label: string;
  /** Tiles. */
  short: string;
  /** Job page. */
  hint: string;
  /** The three cards in the publish form. */
  pick: string;
  pickSub: string;
}

export const DIAS: Record<DiasKey, DiasInfo> = {
  semana: {
    label: 'Durante a semana',
    short: 'Seg a sex',
    hint: 'De segunda a sexta',
    pick: 'Semana',
    pickSub: 'Seg a sex'
  },
  fimdesemana: {
    label: 'No fim de semana',
    short: 'Sáb e dom',
    hint: 'Sábado e domingo',
    pick: 'Fim de semana',
    pickSub: 'Sáb e dom'
  },
  qualquer: {
    label: 'Qualquer dia',
    short: 'Qualquer dia',
    hint: 'Semana ou fim de semana',
    pick: 'Qualquer dia',
    pickSub: 'Seg a dom'
  }
};
export const DIAS_ORDEM: DiasKey[] = ['semana', 'fimdesemana', 'qualquer'];

type Schedule = Pick<Job, 'dateToArrange' | 'startDate' | 'endDate' | 'startTime' | 'endTime'> & {
  dias?: DiasKey | null;
  weekdays?: number[] | null;
};

export function diasInfo(job: { dias?: DiasKey | null }): DiasInfo | null {
  return (job.dias && DIAS[job.dias]) || null;
}

// ---- U52: the days of the week, one by one (1 = Monday … 7 = Sunday, as the database's isodow) ----

export const WEEKDAYS: { n: number; short: string; name: string }[] = [
  { n: 1, short: 'Seg', name: 'segunda' },
  { n: 2, short: 'Ter', name: 'terça' },
  { n: 3, short: 'Qua', name: 'quarta' },
  { n: 4, short: 'Qui', name: 'quinta' },
  { n: 5, short: 'Sex', name: 'sexta' },
  { n: 6, short: 'Sáb', name: 'sábado' },
  { n: 7, short: 'Dom', name: 'domingo' }
];
const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7];
const WEEK = [1, 2, 3, 4, 5];
const WEEKEND = [6, 7];
const within = (days: number[], set: number[]) => days.every((d) => set.includes(d));

/** The ISO day of the week (1 = Monday … 7 = Sunday) of a date. */
export const isoWeekday = (iso: string): number => weekday(iso) || 7;

/** The days marked, sorted, without repeats (what the form sends and the database keeps). */
export function cleanWeekdays(days: number[]): number[] {
  return [...new Set(days)].filter((d) => d >= 1 && d <= 7).sort((a, b) => a - b);
}

/** The job's days of the week: the ones marked (U52), or those its older "dias" stood for. */
export function jobWeekdays(job: { weekdays?: number[] | null; dias?: DiasKey | null }): number[] {
  if (job.weekdays && job.weekdays.length) return cleanWeekdays(job.weekdays);
  if (job.dias === 'semana') return WEEK;
  if (job.dias === 'fimdesemana') return WEEKEND;
  return ALL_DAYS;
}

/** The summary the filters use ("Durante a semana", "Fim de semana"): what the database keeps in `dias`. */
export function diasFromWeekdays(days: number[]): DiasKey {
  const d = cleanWeekdays(days);
  if (d.length && within(d, WEEK)) return 'semana';
  if (d.length && within(d, WEEKEND)) return 'fimdesemana';
  return 'qualquer';
}

/** "Seg, qua e sex", "Seg a sáb" (three or more days in a row). */
function listDays(days: number[], name: 'short' | 'name'): string {
  const d = cleanWeekdays(days);
  const label = (n: number) => WEEKDAYS[n - 1][name];
  const inARow = d.length >= 3 && d.every((n, i) => i === 0 || n === d[i - 1] + 1);
  if (inARow) return `${label(d[0])} a ${label(d[d.length - 1]).toLowerCase()}`;
  const words = d.map((n, i) => (i === 0 ? label(n) : label(n).toLowerCase()));
  return words.length > 1 ? `${words.slice(0, -1).join(', ')} e ${words[words.length - 1]}` : (words[0] ?? '');
}

/**
 * U52: the days in a word, for the card: "Durante a semana" (only Monday to Friday, any of them), "Fim de semana"
 * (only Saturday and Sunday), "Todos os dias" (the seven); other mixes listed short ("Ter e sáb"). A job from before,
 * marked "qualquer dia", stays "Qualquer dia".
 */
export function daysText(job: { weekdays?: number[] | null; dias?: DiasKey | null }): string {
  if (!job.weekdays?.length && (!job.dias || job.dias === 'qualquer')) return 'Qualquer dia';
  const d = jobWeekdays(job);
  if (d.length === 7) return 'Todos os dias';
  if (within(d, WEEK)) return 'Durante a semana';
  if (within(d, WEEKEND)) return 'Fim de semana';
  return listDays(d, 'short');
}

/** U52: the days one by one, for the job's page: "Segunda a sexta", "Terça e sábado", "Todos os dias". */
export function daysListText(job: { weekdays?: number[] | null; dias?: DiasKey | null }): string {
  if (!job.weekdays?.length && (!job.dias || job.dias === 'qualquer')) return 'Semana ou fim de semana';
  const d = jobWeekdays(job);
  if (d.length === 7) return 'Todos os dias';
  const text = listDays(d, 'name');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Whether a day of the week (0 = Sunday, as Date.getDay) is one the job can happen on. */
export function fitsDias(days: DiasKey | number[] | null | undefined, day: number): boolean {
  const marked = Array.isArray(days) ? cleanWeekdays(days) : jobWeekdays({ dias: days ?? null });
  return marked.includes(day || 7);
}

/** How many diárias fit between two dates (inclusive) on the job's days of the week. */
export function countDiarias(start: string, end: string, days?: DiasKey | number[] | null): number {
  let n = 0;
  for (let d = start, guard = 0; d <= end && guard < 400; d = addDays(d, 1), guard++)
    if (fitsDias(days, weekday(d))) n++;
  return n;
}

/**
 * U52: the last day of a job that starts on `start` and has `diarias` work days on its days of the week (the start
 * itself counts when it is one of them); null when it would go past 60 days.
 */
export function endDateFor(start: string, diarias: number, days: number[]): string | null {
  const marked = cleanWeekdays(days);
  if (!marked.length || diarias < 1) return null;
  let left = diarias;
  for (let d = start, i = 0; i < 60; d = addDays(d, 1), i++) {
    if (marked.includes(isoWeekday(d))) left--;
    if (left === 0) return d;
  }
  return null;
}

const shortDay = (iso: string) => {
  const d = parseISODate(iso);
  return `${d.getDate()} ${MESES[d.getMonth()]}`;
};
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** "Hoje", "Sex, 25 set", "Hoje até 27 set", "Até 16 out" (already going on), or "Data a combinar". */
export function dateText(job: Schedule, now: Date = new Date()): string {
  if (job.dateToArrange || !job.startDate) return 'Data a combinar';
  const start = dayLabel(job.startDate, now);
  if (!job.endDate || job.endDate === job.startDate) return start;
  // W02: a job that started before today and is still going says only when it ends.
  const today = todayISO(now);
  if (job.startDate < today && job.endDate >= today)
    return job.endDate === today ? 'Até hoje' : `Até ${shortDay(job.endDate)}`;
  return `${start} até ${shortDay(job.endDate)}`;
}

/** "7h–17h", "7h30–16h", or "Horário a combinar". */
export function hoursText(job: Schedule): string {
  if (!job.startTime || !job.endTime) return 'Horário a combinar';
  const range = `${timeLabel(job.startTime)}–${timeLabel(job.endTime)}`;
  // W08: a night shift ends the next day.
  return job.endTime < job.startTime ? `${range} (vira a noite)` : range;
}

/** "Hoje · 7h–17h", "Data a combinar · 7h–17h", "Sex, 25 set · horário a combinar", "Data e horário a combinar". */
export function whenText(job: Schedule, now: Date = new Date()): string {
  const hasHours = Boolean(job.startTime && job.endTime);
  if (job.dateToArrange || !job.startDate)
    return hasHours ? `Data a combinar · ${hoursText(job)}` : 'Data e horário a combinar';
  // U52: a date without hours says that the hours are to be arranged.
  return `${dateText(job, now)} · ${hasHours ? hoursText(job) : 'horário a combinar'}`;
}

/**
 * U56: the "when" line of a tile: with the date to be arranged, only the hours ("7h–17h"); with a date, the date and the
 * hours ("Hoje · 7h–17h"); nothing fixed at all says "Horário a combinar" (the line keeps the tiles the same size).
 */
export function tileWhenText(job: Schedule, now: Date = new Date()): string {
  const hasHours = Boolean(job.startTime && job.endTime);
  if (job.dateToArrange || !job.startDate) return hasHours ? hoursText(job) : 'Horário a combinar';
  return `${dateText(job, now)} · ${hasHours ? hoursText(job) : 'horário a combinar'}`;
}

/** W03: what the whole job pays (diária × diárias) — only when there is more than one diária and a fixed pay. */
export function totalText(job: Pick<Job, 'pay' | 'diarias'>): string | null {
  if (job.pay == null || job.diarias <= 1) return null;
  return `${formatBRL(job.pay * job.diarias)} por ${job.diarias} diárias`;
}

/** U52: what the worker gets for the whole job (diária × diárias); null when the pay is to be arranged. */
export function jobPayTotal(job: Pick<Job, 'pay' | 'diarias'>): number | null {
  return job.pay == null ? null : job.pay * Math.max(job.diarias || 1, 1);
}

/** "1 diária", "3 diárias". */
export function durationText(job: Pick<Job, 'diarias'>): string {
  return job.diarias === 1 ? '1 diária' : `${job.diarias} diárias`;
}

/** How long a job with the date to be arranged stays up (Y04). */
export const TO_ARRANGE_DAYS = 30;

/**
 * The job's last day (YYYY-MM-DD): its end date, or — with the date to be arranged — 30 days after it was
 * published; `null` when unknown (demo jobs to be arranged have no publish date).
 */
export function lastDay(job: Schedule & { createdAt?: string }): string | null {
  if (!job.dateToArrange) return job.endDate ?? null;
  return job.createdAt ? addDays(todayISO(new Date(job.createdAt)), TO_ARRANGE_DAYS) : null;
}

/** The job's last day has passed: it leaves the mural (F03, Y04). */
export function isExpired(job: Schedule & { createdAt?: string }, now: Date = new Date()): boolean {
  const last = lastDay(job);
  return Boolean(last) && (last as string) < todayISO(now);
}

/** Whether the job has a work day on `iso`. */
export function runsOn(job: Schedule, iso: string): boolean {
  if (job.dateToArrange || !job.startDate) return false;
  const end = job.endDate || job.startDate;
  return job.startDate <= iso && iso <= end && jobWeekdays(job).includes(isoWeekday(iso));
}

// ---- where ----

type Place = { address: Pick<JobAddress, 'neighborhood' | 'city' | 'uf' | 'street' | 'number' | 'complement' | 'cep'> };

/** "Tatuapé, São Paulo" — what everyone sees before approval. */
export function placeText(job: Place): string {
  return [job.address.neighborhood, job.address.city].filter(Boolean).join(', ');
}

/** "São Paulo, SP" — the city as the city picker names it. */
export function cityLabel(job: Place): string {
  return `${job.address.city}, ${job.address.uf}`;
}

/** "Rua Serra de Bragança, 1240 · casa 2" — the full street address. */
export function streetText(job: Place): string {
  const a = job.address;
  // U52: the number is optional ("Rua Sinimbu" alone, never "Rua Sinimbu, ").
  return [a.number ? `${a.street}, ${a.number}` : a.street, a.complement].filter(Boolean).join(' · ');
}

/** "Rua Serra de Bragança, 1240, Tatuapé, São Paulo - SP, 03307-000" — for the map apps. */
export function fullAddressText(job: Place): string {
  const a = job.address;
  return [a.street, a.number, a.neighborhood, `${a.city} - ${a.uf}`, a.cep].filter(Boolean).join(', ');
}

/** Links that open the address in Google Maps and in Waze (Z06 / L04). */
export function mapLinks(job: Place & { address: { lat: number; lon: number } }): { google: string; waze: string } {
  const q = encodeURIComponent(fullAddressText(job));
  return {
    google: `https://www.google.com/maps/search/?api=1&query=${q}`,
    waze: `https://waze.com/ul?ll=${job.address.lat},${job.address.lon}&navigate=yes&q=${q}`
  };
}

/** U52: the kinds of place the form offers, and how they read. */
export const PLACE_TYPES: { id: PlaceType; label: string }[] = [
  { id: 'casa', label: 'Casa' },
  { id: 'apartamento', label: 'Apartamento' },
  { id: 'condominio', label: 'Condomínio' },
  { id: 'predio', label: 'Prédio' },
  { id: 'comercio', label: 'Comércio' },
  { id: 'outro', label: 'Outro' }
];

/** "Casa", "Apartamento"…; null when not said. */
export function placeTypeText(job: { placeType?: PlaceType | null }): string | null {
  return PLACE_TYPES.find((p) => p.id === job.placeType)?.label ?? null;
}

// ---- boost ----

/** The job is at the top of the mural right now (a paid boost still running; B08/Z03). */
export function isBoosted(job: { boostEndsAt?: string | null }, now: Date = new Date()): boolean {
  return Boolean(job.boostEndsAt && new Date(job.boostEndsAt).getTime() > now.getTime());
}

// ---- money ----

/** The whole job: diária × diárias × people, or "A combinar" (Y09/W03). */
export function jobTotal(job: { pay: number | null; diarias: number }, people = 1): string {
  if (job.pay == null) return 'A combinar';
  return formatBRL(job.pay * Math.max(job.diarias || 1, 1) * Math.max(people, 1));
}

/** L18: the ways a diária can be paid, as the form offers them. */
export const WAGE_PAYMENTS: { id: WagePayment; label: string }[] = [
  { id: 'pix_dia', label: 'PIX no fim de cada diária' },
  { id: 'pix_fim', label: 'PIX no fim do bico' },
  { id: 'dinheiro', label: 'Dinheiro' },
  { id: 'outro', label: 'Outro jeito' }
];

/** How the job's diária is paid, as the detail screens say it. */
export function paymentText(job: Pick<Job, 'payment' | 'paymentNote'>): string {
  if (!job.payment) return 'Pagamento combinado direto';
  if (job.payment === 'outro') return job.paymentNote || 'Pagamento combinado direto';
  const label = WAGE_PAYMENTS.find((p) => p.id === job.payment)?.label ?? '';
  return job.payment === 'dinheiro' ? 'Pagamento em dinheiro' : 'Pagamento por ' + label;
}
