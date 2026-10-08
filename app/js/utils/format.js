export function maskCPF(v) {
  const d = String(v || '').replace(/\D/g, '').slice(0, 11);
  if (d.length > 9) return d.slice(0, 3) + '.' + d.slice(3, 6) + '.' + d.slice(6, 9) + '-' + d.slice(9);
  if (d.length > 6) return d.slice(0, 3) + '.' + d.slice(3, 6) + '.' + d.slice(6);
  if (d.length > 3) return d.slice(0, 3) + '.' + d.slice(3);
  return d;
}

export function maskCNPJ(v) {
  const d = String(v || '').replace(/\D/g, '').slice(0, 14);
  if (d.length > 12) return d.slice(0, 2) + '.' + d.slice(2, 5) + '.' + d.slice(5, 8) + '/' + d.slice(8, 12) + '-' + d.slice(12);
  if (d.length > 8) return d.slice(0, 2) + '.' + d.slice(2, 5) + '.' + d.slice(5, 8) + '/' + d.slice(8);
  if (d.length > 5) return d.slice(0, 2) + '.' + d.slice(2, 5) + '.' + d.slice(5);
  if (d.length > 2) return d.slice(0, 2) + '.' + d.slice(2);
  return d;
}

export function isValidEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim());
}

export function passwordStrength(v) {
  const s = String(v || '');
  if (!s) return 0;
  let n = 1;
  if (s.length >= 8 && /[a-zA-Z]/.test(s) && /[0-9]/.test(s)) n = 2;
  if (n === 2 && (s.length >= 12 || /[^a-zA-Z0-9]/.test(s))) n = 3;
  return n;
}

export const STRENGTH_LABEL = [null, 'Senha fraca', 'Senha média', 'Senha forte'];

export function formatBRL(n) {
  const v = Math.round(Number(n) || 0);
  return 'R$ ' + v.toLocaleString('pt-BR');
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** '2026-09-10' -> '10 de set de 2026' */
export function formatPostDate(isoDate) {
  const [y, m, d] = String(isoDate).split('-').map(Number);
  if (!y || !m || !d) return isoDate;
  return `${d} de ${MESES[m - 1]} de ${y}`;
}
