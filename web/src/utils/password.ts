// The one password rule (sign-up, new password from the e-mail link, Configurações › Trocar senha): X11.

/** What is wrong with the password, or null. */
export function passwordProblem(password: string): string | null {
  if (password.length < 8) return 'Senha curta. Use 8 caracteres ou mais.';
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) return 'Misture letras e números na senha.';
  return null;
}
