// Calendar dates as the app stores them: ISO "YYYY-MM-DD" strings in the user's local time zone (a job
// "on the 25th" is on the 25th wherever the server is). Times are "HH:MM".

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const pad = (n: number) => String(n).padStart(2, '0');

/** The local calendar date of `d` as "YYYY-MM-DD". */
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayISO(now: Date = new Date()): string {
  return toISODate(now);
}

/** Local midnight of an ISO date. */
export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function addDays(iso: string, days: number): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** Whole days from `a` to `b` (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((parseISODate(b).getTime() - parseISODate(a).getTime()) / 86400000);
}

export function isValidISODate(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(v) && toISODate(parseISODate(v)) === v;
}

/** 0 = Sunday … 6 = Saturday. */
export function weekday(iso: string): number {
  return parseISODate(iso).getDay();
}

/** "Hoje", "Amanhã", or "Sex, 25 set" (with the year when it isn't this year's). */
export function dayLabel(iso: string, now: Date = new Date()): string {
  const diff = daysBetween(todayISO(now), iso);
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Amanhã';
  if (diff === -1) return 'Ontem';
  const d = parseISODate(iso);
  const base = `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return d.getFullYear() === now.getFullYear() ? base : `${base} de ${d.getFullYear()}`;
}

/** "7h", "7h30" */
export function timeLabel(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  return m ? `${h}h${pad(m)}` : `${h}h`;
}

export function isValidTime(v: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
}

/** "25 set, 9h10" — when something happened (ISO timestamp). */
export function dateTimeLabel(isoTimestamp: string, now: Date = new Date()): string {
  const d = new Date(isoTimestamp);
  const day = dayLabel(toISODate(d), now);
  return `${day}, ${d.getHours()}h${pad(d.getMinutes())}`;
}

/** "Há 12 min", "Há 2h", "Ontem", "3 dias atrás" — how long ago something happened. */
export function relativeTime(isoTimestamp: string, now: Date = new Date()): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - new Date(isoTimestamp).getTime()) / 60000));
  if (minutes < 60) return `Há ${Math.max(1, minutes)} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Há ${hours}h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'Ontem' : `${days} dias atrás`;
}
