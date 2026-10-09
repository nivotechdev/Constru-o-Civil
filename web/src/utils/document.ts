// CPF and CNPJ check digits (Y17). The same rule runs in the database (cpf_valid/cnpj_valid), which refuses
// a sign-up with an invalid document.

const onlyDigits = (v: string | null | undefined) => String(v ?? '').replace(/\D/g, '');

/** A real CPF: 11 digits, not all equal, both check digits right. */
export function isValidCpf(value: string | null | undefined): boolean {
  const d = onlyDigits(value);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const check = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return check(9) === Number(d[9]) && check(10) === Number(d[10]);
}

/** A real CNPJ: 14 digits, not all equal, both check digits right. */
export function isValidCnpj(value: string | null | undefined): boolean {
  const d = onlyDigits(value);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const check = (len: number) => {
    const weights = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((s, w, i) => s + w * Number(d[i]), 0) % 11;
    return sum < 2 ? 0 : 11 - sum;
  };
  return check(12) === Number(d[12]) && check(13) === Number(d[13]);
}
