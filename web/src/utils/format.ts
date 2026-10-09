export function maskCPF(v: string | null | undefined): string {
  const d = String(v || '')
    .replace(/\D/g, '')
    .slice(0, 11);
  if (d.length > 9) return d.slice(0, 3) + '.' + d.slice(3, 6) + '.' + d.slice(6, 9) + '-' + d.slice(9);
  if (d.length > 6) return d.slice(0, 3) + '.' + d.slice(3, 6) + '.' + d.slice(6);
  if (d.length > 3) return d.slice(0, 3) + '.' + d.slice(3);
  return d;
}

export function maskCNPJ(v: string | null | undefined): string {
  const d = String(v || '')
    .replace(/\D/g, '')
    .slice(0, 14);
  if (d.length > 12)
    return d.slice(0, 2) + '.' + d.slice(2, 5) + '.' + d.slice(5, 8) + '/' + d.slice(8, 12) + '-' + d.slice(12);
  if (d.length > 8) return d.slice(0, 2) + '.' + d.slice(2, 5) + '.' + d.slice(5, 8) + '/' + d.slice(8);
  if (d.length > 5) return d.slice(0, 2) + '.' + d.slice(2, 5) + '.' + d.slice(5);
  if (d.length > 2) return d.slice(0, 2) + '.' + d.slice(2);
  return d;
}

/** Brazilian phone as typed: "(11) 98842-3310" (mobile) or "(11) 3842-3310" (landline). */
export function maskPhone(v: string | null | undefined): string {
  const d = String(v || '')
    .replace(/\D/g, '')
    .slice(0, 11);
  if (!d) return '';
  if (d.length <= 2) return '(' + d;
  const ddd = '(' + d.slice(0, 2) + ') ';
  const rest = d.slice(2);
  if (rest.length <= 4) return ddd + rest;
  const split = d.length === 11 ? 5 : 4;
  return ddd + rest.slice(0, split) + '-' + rest.slice(split);
}

export function isValidEmail(v: string | null | undefined): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim());
}

/** 0 = empty, 1 = weak, 2 = medium, 3 = strong. */
type PasswordStrength = 0 | 1 | 2 | 3;

export function passwordStrength(v: string | null | undefined): PasswordStrength {
  const s = String(v || '');
  if (!s) return 0;
  let n: PasswordStrength = 1;
  if (s.length >= 8 && /[a-zA-Z]/.test(s) && /[0-9]/.test(s)) n = 2;
  if (n === 2 && (s.length >= 12 || /[^a-zA-Z0-9]/.test(s))) n = 3;
  return n;
}

export const STRENGTH_LABEL: ReadonlyArray<string | null> = [null, 'Senha fraca', 'Senha média', 'Senha forte'];

/** Fill of the strength bar under a password field: green when strong, amber below that, grey when empty. */
export function strengthBarColor(strength: PasswordStrength): string {
  return strength === 3 ? 'bg-success-500' : strength ? 'bg-warning-500' : 'bg-concrete-200';
}

export function formatBRL(n: number | string | null | undefined): string {
  const v = Math.round(Number(n) || 0);
  return 'R$ ' + v.toLocaleString('pt-BR');
}

/** A job's diária as shown everywhere: "R$ 180", or "A combinar" when the job has no fixed pay. */
export function formatPay(pay: number | null): string {
  return pay == null ? 'A combinar' : formatBRL(pay);
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** '2026-09-10' -> '10 de set de 2026' */
export function formatPostDate(isoDate: string): string {
  const [y, m, d] = String(isoDate).split('-').map(Number);
  if (!y || !m || !d) return isoDate;
  return `${d} de ${MESES[m - 1]} de ${y}`;
}
