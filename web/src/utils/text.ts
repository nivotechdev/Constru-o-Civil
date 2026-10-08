/** Lowercase without accents, for searching ("Elétrica" and "eletrica" match). */
export function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
