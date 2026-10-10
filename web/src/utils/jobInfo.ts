// How a job's schedule and place read everywhere in the app, always derived from the stored data (real
// dates, times and address): "Hoje", "Amanhã" and "Sex, 25 set" are worked out from the date, never
// stored. Dates and hours are optional (a job can leave them to be arranged with the worker); `dias`
// says which part of the week the job can happen on.
import type { DiasKey, Job, JobAddress, WagePayment } from '../types/models';
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
};

export function diasInfo(job: { dias?: DiasKey | null }): DiasInfo | null {
  return (job.dias && DIAS[job.dias]) || null;
}

/** Whether a day of the week (0 = Sunday) is one the job can happen on. */
export function fitsDias(dias: DiasKey | null | undefined, day: number): boolean {
  if (dias === 'semana') return day >= 1 && day <= 5;
  if (dias === 'fimdesemana') return day === 0 || day === 6;
  return true;
}

/** How many diárias fit between two dates (inclusive) on the job's days of the week. */
export function countDiarias(start: string, end: string, dias?: DiasKey | null): number {
  let n = 0;
  for (let d = start, guard = 0; d <= end && guard < 400; d = addDays(d, 1), guard++)
    if (fitsDias(dias, weekday(d))) n++;
  return n;
}

const shortDay = (iso: string) => {
  const d = parseISODate(iso);
  return `${d.getDate()} ${MESES[d.getMonth()]}`;
};
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** "Hoje", "Sex, 25 set", "Hoje até 27 set", or "Data a combinar". */
export function dateText(job: Schedule, now: Date = new Date()): string {
  if (job.dateToArrange || !job.startDate) return 'Data a combinar';
  const start = dayLabel(job.startDate, now);
  if (!job.endDate || job.endDate === job.startDate) return start;
  return `${start} até ${shortDay(job.endDate)}`;
}

/** "7h–17h", "7h30–16h", or "Horário a combinar". */
export function hoursText(job: Schedule): string {
  return job.startTime && job.endTime ? `${timeLabel(job.startTime)}–${timeLabel(job.endTime)}` : 'Horário a combinar';
}

/** "Hoje · 7h–17h", "Data a combinar · 7h–17h", "Data e horário a combinar"… */
export function whenText(job: Schedule, now: Date = new Date()): string {
  const hasHours = Boolean(job.startTime && job.endTime);
  if (job.dateToArrange || !job.startDate)
    return hasHours ? `Data a combinar · ${hoursText(job)}` : 'Data e horário a combinar';
  return hasHours ? `${dateText(job, now)} · ${hoursText(job)}` : dateText(job, now);
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
  return job.startDate <= iso && iso <= end && fitsDias(job.dias, weekday(iso));
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
  return [`${a.street}, ${a.number}`, a.complement].filter(Boolean).join(' · ');
}

/** "Rua Serra de Bragança, 1240, Tatuapé, São Paulo - SP, 03307-000" — for the map apps. */
export function fullAddressText(job: Place): string {
  const a = job.address;
  return `${a.street}, ${a.number}, ${a.neighborhood}, ${a.city} - ${a.uf}, ${a.cep}`;
}

/** Links that open the address in Google Maps and in Waze (Z06 / L04). */
export function mapLinks(job: Place & { address: { lat: number; lon: number } }): { google: string; waze: string } {
  const q = encodeURIComponent(fullAddressText(job));
  return {
    google: `https://www.google.com/maps/search/?api=1&query=${q}`,
    waze: `https://waze.com/ul?ll=${job.address.lat},${job.address.lon}&navigate=yes&q=${q}`
  };
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
