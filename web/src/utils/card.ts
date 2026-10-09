// Card fields of the boost payment: masks as typed and the checks before sending.

const digits = (v: string) => v.replace(/\D/g, '');

/** "4111111111111111" → "4111 1111 1111 1111" */
export function maskCardNumber(v: string): string {
  return digits(v)
    .slice(0, 16)
    .replace(/(\d{4})(?=\d)/g, '$1 ');
}

/** "1228" → "12/28" */
export function maskExpiry(v: string): string {
  const d = digits(v).slice(0, 4);
  return d.length > 2 ? d.slice(0, 2) + '/' + d.slice(2) : d;
}

/** The Luhn check digit that every real card number passes. */
export function luhnOk(number: string): boolean {
  const d = digits(number);
  let sum = 0;
  for (let i = 0; i < d.length; i++) {
    let n = Number(d[d.length - 1 - i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return d.length >= 13 && sum % 10 === 0;
}

export interface CardInput {
  number: string;
  name: string;
  expiry: string;
  cvv: string;
}

export type CardErrors = Partial<Record<keyof CardInput, string>>;

/** What is wrong with the card fields (empty object when they are fine). */
export function validateCard(c: CardInput, now: Date = new Date()): CardErrors {
  const e: CardErrors = {};
  const n = digits(c.number);
  if (n.length !== 16) e.number = 'O número do cartão tem 16 dígitos.';
  else if (!luhnOk(n) && !n.endsWith('0000')) e.number = 'Número do cartão inválido. Confira os dígitos.';
  if (c.name.trim().split(/\s+/).length < 2) e.name = 'Escreva o nome como está no cartão.';
  const [mm, yy] = c.expiry.split('/').map(Number);
  if (!mm || !yy || mm < 1 || mm > 12) e.expiry = 'Validade no formato MM/AA.';
  else {
    const end = new Date(2000 + yy, mm, 1); // first day after the expiry month
    if (end <= now) e.expiry = 'Esse cartão já venceu.';
  }
  if (!/^\d{3,4}$/.test(c.cvv)) e.cvv = 'O código de segurança tem 3 ou 4 números.';
  return e;
}
