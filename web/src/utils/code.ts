/** The confirmation codes the app asks for (WhatsApp, e-mail) have 6 numbers. */
export const CODE_LENGTH = 6;

/** The first 6 digits found in a text ("123 456", "Seu código: 123456"…), or '' when there aren't 6. */
export function codeFrom(text: string): string {
  const digits = text.replace(/\D/g, '');
  return digits.length >= CODE_LENGTH ? digits.slice(0, CODE_LENGTH) : '';
}
