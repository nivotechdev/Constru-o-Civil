// U37: creating the account with "Continuar com o Google". A Google account with no Bicos account goes through the
// SAME sign-up as everyone else (side, name, CPF/CNPJ, WhatsApp, password, terms) — only the e-mail and its
// confirmation are left out, because Google already confirmed that e-mail. While it lasts, the device holds a
// Supabase session with no account row; this module keeps what the screens need to know about it:
//   * the side chosen before leaving for Google (this tab's storage, until the account exists);
//   * the Google e-mail and name (store UI `GOOGLE_SIGNUP_KEY`), shown on every step and used to start the form.
import { getUI, resetUI, setUI } from './store';
import type { Role } from '../types/models';

const ROLE_KEY = 'bicos-google-papel';
export const GOOGLE_SIGNUP_KEY = 'google-signup';

export interface GoogleIdentity {
  email: string;
  name: string;
}
export interface GoogleSignUpUI {
  identity: GoogleIdentity | null;
}
export const GOOGLE_SIGNUP_DEFAULTS: GoogleSignUpUI = { identity: null };

/** The side chosen before leaving for Google (kept until the account is created). */
export function rememberGoogleRole(role: Role | null): void {
  try {
    if (role) sessionStorage.setItem(ROLE_KEY, role);
    else sessionStorage.removeItem(ROLE_KEY);
  } catch {
    // Without storage the side is just asked again.
  }
}

export function googleRole(): Role | null {
  try {
    const role = sessionStorage.getItem(ROLE_KEY);
    return role === 'trabalhador' || role === 'recrutador' ? role : null;
  } catch {
    return null;
  }
}

/** Where a Google account without a Bicos account continues: its side's sign-up, or choosing the side first. */
export function googleSignUpPath(): string {
  const role = googleRole();
  return role ? '/cadastro/' + role : '/escolha-perfil';
}

/** The screens of that sign-up (and the terms it links to): already there, nothing to redirect. */
export function inGoogleSignUp(path: string): boolean {
  return path === '/escolha-perfil' || path.startsWith('/cadastro/') || path === '/termos' || path === '/privacidade';
}

export function googleIdentity(): GoogleIdentity | null {
  return getUI<GoogleSignUpUI>(GOOGLE_SIGNUP_KEY, GOOGLE_SIGNUP_DEFAULTS).identity;
}

export function setGoogleIdentity(identity: GoogleIdentity | null): void {
  setUI<GoogleSignUpUI>(GOOGLE_SIGNUP_KEY, { identity });
}

/** The account was created, or the person chose another e-mail: back to the plain sign-up. */
export function endGoogleSignUp(): void {
  rememberGoogleRole(null);
  resetUI(GOOGLE_SIGNUP_KEY);
}
