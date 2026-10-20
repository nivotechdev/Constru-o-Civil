// Accounts and the session: sign-in, sign-up, e-mail confirmation, the end of onboarding and sign-out.
// With the real backend each function hands over to services/remote/auth.ts (Supabase Auth); in demo
// mode (services/mode.ts) every flow is simulated in memory, with realistic delays and outcomes.
// Screens only call these functions, the same in both modes.
import { isValidMobile } from '../utils/format';
import { passwordProblem } from '../utils/password';
import { ACCOUNTS, DEMO_PASSWORD } from '../data/seed';
import type { Account, Company, Role, Worker } from '../types/models';
import { localLatency, mockLatency } from './mockLatency';
import { clearQueries } from './queries';
import { resetHistory } from './router';
import {
  getDb,
  getSession,
  setSessionAccount,
  updateAccount,
  updateCompany,
  updateWorker,
  upsertAccount,
  upsertCompany,
  upsertWorker
} from './store';
import { DEFAULT_CITY, DEFAULT_POINT } from './defaults';
import { IS_DEMO } from './mode';
import * as remote from './remote/auth';
import { isValidCnpj, isValidCpf } from '../utils/document';
import { FEATURES } from './features';
import { serviceError } from './errors';
import { isValidEmail } from '../utils/format';
import { TERMS_VERSION } from './legal';

// ---- mock credentials ----
// Only the mock keeps passwords, and only in memory: the real backend never stores them in app tables.
const passwords = new Map<string, string>(Object.keys(ACCOUNTS).map((id) => [id, DEMO_PASSWORD]));

/** The demo accounts listed on the login screen (none with the real backend). */
export const DEMO_ACCOUNTS: { role: Role; email: string; password: string }[] = IS_DEMO
  ? Object.values(ACCOUNTS).map((a) => ({ role: a.role, email: a.email, password: DEMO_PASSWORD }))
  : [];

const digits = (s: string) => s.replace(/\D/g, '');

function findAccount(identifier: string): Account | undefined {
  const id = identifier.trim().toLowerCase();
  const doc = digits(identifier);
  return Object.values(getDb().accounts).find(
    (a) => a.email.toLowerCase() === id || (doc.length >= 11 && digits(a.document) === doc)
  );
}

/**
 * Whether `password` is the logged-in account's (before a sensitive action, e.g. deleting the account).
 * Backend: re-authenticate with Supabase Auth (signInWithPassword on the same e-mail).
 */
export async function checkPassword(password: string, captcha: CaptchaSource = noCaptcha): Promise<boolean> {
  if (!IS_DEMO) return remote.checkPassword(password, captcha);
  await mockLatency(500);
  const session = getSession();
  return Boolean(session && passwords.get(session.accountId) === password);
}

/** Forgets the mock password of a deleted account. */
export function forgetPassword(accountId: string): void {
  passwords.delete(accountId);
}

// ---- sign-in / sign-out ----

/**
 * Why signing in failed. One answer for an unknown e-mail/CPF/CNPJ and a wrong password, in both modes:
 * telling them apart would reveal who has an account (Z07).
 */
/** `email-nao-confirmado`: right password, but the account's e-mail link was never opened (Y19). */
export type SignInError = 'credenciais' | 'email-nao-confirmado';

/** Where a sign-in or sign-up gets its captcha token (components/Captcha.tsx); none in the demo. */
export type CaptchaSource = () => Promise<string | undefined>;
const noCaptcha: CaptchaSource = async () => undefined;
export type SignInResult = { ok: true; role: Role } | { ok: false; reason: SignInError; email?: string };

/**
 * Signs in with e-mail (or CPF/CNPJ) and password. The side (worker or company) comes from the account.
 * Backend: Supabase Auth `signInWithPassword` (resolving a CPF/CNPJ to the account's e-mail first).
 */
export async function signIn(
  identifier: string,
  password: string,
  captcha: CaptchaSource = noCaptcha
): Promise<SignInResult> {
  if (!IS_DEMO) return remote.signIn(identifier, password, captcha);
  await mockLatency(500);
  const account = findAccount(identifier);
  if (!account || passwords.get(account.id) !== password) return { ok: false, reason: 'credenciais' };
  setSessionAccount(account.id);
  return { ok: true, role: account.role };
}

/** Ends the session and forgets every screen's state. Backend: Supabase Auth `signOut`. */
export async function signOut(): Promise<void> {
  pendingSignUp = null;
  if (!IS_DEMO) return remote.signOut();
  await localLatency(300); // signing out works offline too: the session is dropped on the device
  setSessionAccount(null);
  clearQueries();
  resetHistory();
}

// ---- sign-up ----

export interface SignUpData {
  role: Role;
  /** Full name (worker) or razão social (recruiter). */
  name: string;
  /** CPF (worker) or CNPJ (recruiter), masked as typed. */
  doc: string;
  email: string;
  /** Confirmed by code (see sendWhatsAppCode). */
  whatsapp: string;
  password: string;
  /** The version of the terms/privacy policy the person accepted (see services/legal.ts). */
  acceptedTermsVersion: string;
  /** L14: "Tenho 18 anos ou mais" (the terms require it; the server refuses without it). */
  adult: boolean;
  /** F15: recruiter — who talks to the candidates. */
  contactName?: string;
}

/**
 * `email-taken`: the e-mail already has a confirmed account. `recusado`: the account couldn't be created
 * with that data — the server doesn't say why (it would reveal whether a CPF/CNPJ has an account; Z07).
 */
export type SignUpResult = { ok: true } | { ok: false; reason: 'recusado' | 'email-taken' };

/** Demo: documents that already have an account elsewhere (valid ones, so they pass the form). */
const TAKEN_DOCS = ['111.444.777-35', '11.222.333/0001-81'];

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase() || '?';
}

/** U10: the data the sign-up checks as soon as it is typed (each one belongs to a single account). */
export type SignUpCheck = 'email' | 'documento' | 'whatsapp';

/**
 * U10: whether the e-mail, CPF/CNPJ or WhatsApp is still free — asked on the sign-up step where it is typed,
 * so a taken one stops the person there instead of at the end. Only a confirmed account holds it (a sign-up
 * never confirmed gives it up). Backend: Edge Function `verificar-cadastro` (attempt limits, yes/no only).
 */
export async function isFreeForSignUp(kind: SignUpCheck, value: string): Promise<boolean> {
  if (!IS_DEMO) return remote.isFreeForSignUp(kind, value);
  await mockLatency(300);
  const accounts = Object.values(getDb().accounts);
  if (kind === 'email') return !accounts.some((a) => a.email.toLowerCase() === value.trim().toLowerCase());
  if (kind === 'documento')
    return (
      !TAKEN_DOCS.some((d) => digits(d) === digits(value)) &&
      !accounts.some((a) => digits(a.document) === digits(value))
    );
  return !accounts.some((a) => digits(a.whatsapp) === digits(value));
}

/**
 * Creates the account and its empty profile, and logs it in. The e-mail confirmation and the profile
 * come next (the route guards send the user there). Backend: Supabase Auth `signUp` + a trigger that
 * creates the `accounts` row and the worker/company row.
 */
export async function signUp(data: SignUpData, captcha: CaptchaSource = noCaptcha): Promise<SignUpResult> {
  // X18: only a mobile (DDD + 9 + 8 digits) is a WhatsApp — the same check as the server.
  if (!isValidMobile(data.whatsapp))
    throw serviceError('validacao', 'Confira o WhatsApp: celular com DDD, 11 números.');
  const result = await createAccount(data, captcha);
  // U11: kept in memory only (never stored) so "Corrigir e-mail" can redo it with the right address.
  pendingSignUp = result.ok ? data : pendingSignUp;
  return result;
}

/**
 * U11: the sign-up waiting for its e-mail code, while the app stays open — what "Corrigir e-mail" needs to
 * send the code to another address without asking everything again. Forgotten on reload, sign-out and once
 * the e-mail is confirmed.
 */
let pendingSignUp: SignUpData | null = null;

/** Whether the e-mail can still be corrected right on the code screen (the sign-up is in memory). */
export function canChangePendingEmail(): boolean {
  return pendingSignUp !== null;
}

async function createAccount(data: SignUpData, captcha: CaptchaSource): Promise<SignUpResult> {
  if (!IS_DEMO) return remote.signUp(data, captcha);
  await mockLatency(700);
  const accounts = Object.values(getDb().accounts);
  if (!data.adult) return { ok: false, reason: 'recusado' };
  // Y17: like the server, an invalid document (or none) is refused.
  const validDoc = data.role === 'recrutador' ? isValidCnpj(data.doc) || isValidCpf(data.doc) : isValidCpf(data.doc);
  if (!validDoc) return { ok: false, reason: 'recusado' };
  if (TAKEN_DOCS.includes(data.doc) || accounts.some((a) => digits(a.document) === digits(data.doc)))
    return { ok: false, reason: 'recusado' };
  if (accounts.some((a) => a.email.toLowerCase() === data.email.trim().toLowerCase()))
    return { ok: false, reason: 'email-taken' };
  if (accounts.some((a) => digits(a.whatsapp) === digits(data.whatsapp)))
    throw serviceError('conflito', 'Esse WhatsApp já está em outra conta da Bicos.');

  const stamp = Date.now().toString(36);
  const now = new Date().toISOString();
  const account: Account = {
    id: 'conta-' + stamp,
    email: data.email.trim(),
    role: data.role,
    document: data.doc,
    whatsapp: data.whatsapp,
    whatsappVerifiedAt: now,
    emailConfirmedAt: null,
    profileCompletedAt: null,
    termsVersion: data.acceptedTermsVersion,
    termsAcceptedAt: now,
    workerId: null,
    companyId: null,
    createdAt: now
  };
  if (data.role === 'trabalhador') {
    const worker: Worker = {
      id: 't-' + stamp,
      name: data.name.trim(),
      initials: initialsOf(data.name),
      oficioId: '',
      whatsapp: data.whatsapp,
      city: DEFAULT_CITY,
      neighborhood: null,
      ...DEFAULT_POINT,
      rating: 0,
      reviewCount: 0,
      jobsDone: 0,
      novo: true,
      verified: false,
      specialties: [],
      facts: [],
      reviews: []
    };
    upsertWorker(worker);
    account.workerId = worker.id;
  } else {
    const company: Company = {
      id: 'c-' + stamp,
      name: data.name.trim(),
      // Y16: only a CNPJ goes to the public profile (a recruiter on their own signs up with a CPF).
      ...(isValidCnpj(data.doc) ? { cnpj: data.doc } : {}),
      location: DEFAULT_CITY,
      whatsapp: data.whatsapp,
      rating: 0,
      reviewCount: 0,
      verified: false,
      verification: 'pendente',
      ...(data.contactName ? { contactName: data.contactName } : {}),
      reviews: []
    };
    upsertCompany(company);
    account.companyId = company.id;
  }
  passwords.set(account.id, data.password);
  upsertAccount(account);
  setSessionAccount(account.id);
  return { ok: true };
}

/** U11: what the e-mail code screen says when the code is wrong or old. */
export const WRONG_EMAIL_CODE = 'Código incorreto. Confira os 6 números no e-mail e tente de novo.';

/**
 * U11: confirms the e-mail with the 6-number code sent to it, and enters the account (the next step is
 * completing the profile). Backend: Supabase Auth `verifyOtp({ email, token, type: 'email' })`, which opens
 * the session. Demo: any 6 numbers confirm, except 000000.
 */
export async function verifyEmailCode(email: string, code: string): Promise<void> {
  if (!/^\d{6}$/.test(code)) throw serviceError('validacao', 'Digite os 6 números do código.');
  if (!IS_DEMO) {
    await remote.verifyEmailCode(email, code);
    pendingSignUp = null;
    return;
  }
  await mockLatency(500);
  if (code === '000000') throw serviceError('validacao', WRONG_EMAIL_CODE);
  const account = Object.values(getDb().accounts).find((a) => a.email.toLowerCase() === email.trim().toLowerCase());
  if (!account) throw serviceError('validacao', WRONG_EMAIL_CODE);
  updateAccount(account.id, { emailConfirmedAt: new Date().toISOString() });
  setSessionAccount(account.id);
  pendingSignUp = null;
}

/** Sends a new e-mail code (the old one stops working). Backend: Supabase Auth `resend({ type: 'signup' })`. */
export async function resendConfirmationEmail(email?: string): Promise<void> {
  if (!IS_DEMO) return remote.resendConfirmationEmail(email);
  await mockLatency(600);
}

/**
 * U11: "Corrigir e-mail" on the code screen — the sign-up is done again with the new address (same data, kept
 * in memory) and the code goes there; the account with the wrong address, never confirmed, gives up the
 * CPF/CNPJ and the WhatsApp to the new one. `email-taken`: the new address already has an account.
 */
export async function changePendingEmail(email: string, captcha: CaptchaSource = noCaptcha): Promise<SignUpResult> {
  const clean = email.trim().toLowerCase();
  if (!isValidEmail(clean)) throw serviceError('validacao', 'E-mail inválido. Confira se tem @ e o domínio.');
  const pending = pendingSignUp;
  if (!pending) throw serviceError('validacao', 'Para trocar o e-mail, faça o cadastro de novo.');
  if (clean === pending.email.trim().toLowerCase()) throw serviceError('validacao', 'Esse já é o e-mail do cadastro.');
  if (!(await isFreeForSignUp('email', clean))) return { ok: false, reason: 'email-taken' };
  if (IS_DEMO) {
    await mockLatency(500);
    const session = getSession();
    if (session) updateAccount(session.accountId, { email: clean });
    pendingSignUp = { ...pending, email: clean };
    return { ok: true };
  }
  const result = await remote.signUp({ ...pending, email: clean }, captcha);
  if (result.ok) pendingSignUp = { ...pending, email: clean };
  return result;
}

export type ProfileData =
  | { role: 'trabalhador'; oficioId: string; city: string; specialties: string[] }
  | { role: 'recrutador'; tipoObra: string; city: string };

/** Last step of sign-up: saves "Completar perfil" and lets the account into the app. Backend: update the profile row. */
export async function finishSignUp(profile: ProfileData): Promise<void> {
  if (!IS_DEMO) return remote.finishSignUp(profile);
  await mockLatency(500);
  const session = getSession();
  if (!session) return;
  if (profile.role === 'trabalhador' && session.workerId) {
    // The city picker's list is big: it loads only here, when it is needed.
    const { cityByLabel } = await import('./cities');
    const center = cityByLabel(profile.city) ?? DEFAULT_POINT;
    updateWorker(session.workerId, {
      oficioId: profile.oficioId,
      city: profile.city,
      neighborhood: null,
      lat: center.lat,
      lon: center.lon,
      specialties: profile.specialties
    });
  } else if (profile.role === 'recrutador' && session.companyId) {
    updateCompany(session.companyId, { tipoObra: profile.tipoObra, location: profile.city });
  }
  updateAccount(session.accountId, { profileCompletedAt: new Date().toISOString() });
}

// ---- terms (L07) ----

/**
 * Accepts the current terms and privacy policy (a new version since the last acceptance). Backend: RPC
 * accept_terms (stores the version and the time in terms_acceptances).
 */
export async function acceptTerms(): Promise<void> {
  const session = getSession();
  if (!session) throw serviceError('nao_autorizado');
  if (!IS_DEMO) await remote.acceptTerms(TERMS_VERSION);
  else await mockLatency(400);
  updateAccount(session.accountId, { termsVersion: TERMS_VERSION, termsAcceptedAt: new Date().toISOString() });
}

// ---- password ----

/** Sends the "reset your password" link (captcha in production — L05). Demo: nothing is sent. */
export async function requestPasswordReset(_email: string, captcha: CaptchaSource = noCaptcha): Promise<void> {
  if (!IS_DEMO) return remote.requestPasswordReset(_email, captcha);
  await mockLatency(600);
}

/** Sets the new password chosen from the reset link. Demo: nothing is stored. */
export async function resetPassword(_newPassword: string): Promise<void> {
  // X11: the same rule as the sign-up.
  const problem = passwordProblem(_newPassword);
  if (problem) throw serviceError('validacao', problem);
  if (!IS_DEMO) return remote.resetPassword(_newPassword);
  await mockLatency(600);
}

/** X11: the reset screen was left without saving: the short session from the e-mail link ends. */
export async function abandonPasswordReset(): Promise<void> {
  if (!IS_DEMO) return remote.abandonPasswordReset();
}

// ---- Google (L13) ----

/** "Continuar com o Google": leaves for Google and comes back signed in. Backend: Supabase OAuth. */
export async function signInWithGoogle(): Promise<void> {
  if (IS_DEMO) throw serviceError('validacao', 'Na demonstração, entre com e-mail e senha.');
  return remote.signInWithGoogle();
}

export interface OAuthSignUpData {
  role: Role;
  name: string;
  doc: string;
  whatsapp: string;
  acceptedTermsVersion: string;
  adult: boolean;
  contactName?: string;
}

/**
 * L13: a Google account without a side yet chooses it and gives the same data as the e-mail sign-up.
 * Backend: RPC create_my_account (same rules), then the session starts as usual.
 */
export async function completeOAuthSignUp(data: OAuthSignUpData): Promise<void> {
  if (!data.adult) throw serviceError('validacao', 'A Bicos é só para maiores de 18 anos.');
  const validDoc = data.role === 'recrutador' ? isValidCnpj(data.doc) || isValidCpf(data.doc) : isValidCpf(data.doc);
  if (!validDoc)
    throw serviceError('validacao', data.role === 'recrutador' ? 'CNPJ ou CPF inválido.' : 'CPF inválido.');
  if (IS_DEMO) throw serviceError('validacao', 'Na demonstração, crie a conta pelo cadastro.');
  return remote.completeOAuthSignUp(data);
}

// ---- account settings ----

/**
 * L15: "Trocar senha" in Configurações: the current password, then the new one. Backend: re-checks the
 * current password and Supabase Auth `updateUser({ password })`.
 */
export async function changePassword(current: string, next: string, captcha: CaptchaSource = noCaptcha): Promise<void> {
  const problem = passwordProblem(next);
  if (problem) throw serviceError('validacao', problem);
  if (!IS_DEMO) return remote.changePassword(current, next, captcha);
  await mockLatency(600);
  const session = getSession();
  if (!session || passwords.get(session.accountId) !== current)
    throw serviceError('validacao', 'Senha atual incorreta.');
  if (current === next) throw serviceError('validacao', 'Use uma senha diferente da atual.');
  passwords.set(session.accountId, next);
}

/**
 * F08: changes the e-mail. Nothing changes until the link sent to the new address is opened. Backend:
 * re-checks the password and Supabase Auth `updateUser({ email })`; a trigger copies the confirmed
 * address to accounts.email. Demo: changes at once (there is no inbox).
 */
export async function changeEmail(email: string, password: string, captcha: CaptchaSource = noCaptcha): Promise<void> {
  const clean = email.trim().toLowerCase();
  if (!isValidEmail(clean)) throw serviceError('validacao', 'E-mail inválido. Confira se tem @ e o domínio.');
  const session = getSession();
  if (session && clean === session.email.toLowerCase()) throw serviceError('validacao', 'Esse já é o seu e-mail.');
  if (!IS_DEMO) return remote.changeEmail(clean, password, captcha);
  await mockLatency(600);
  if (!session || passwords.get(session.accountId) !== password) throw serviceError('validacao', 'Senha incorreta.');
  if (Object.values(getDb().accounts).some((a) => a.email.toLowerCase() === clean))
    throw serviceError('conflito', 'Esse e-mail já tem conta na Bicos.');
  updateAccount(session.accountId, { email: clean });
}

// ---- WhatsApp ----

/** Numbers confirmed by code in this demo session (the server keeps them 30 minutes: Y25). */
export const demoVerifiedPhones = new Set<string>();

/**
 * Sends the 6-digit confirmation code to the number by WhatsApp. Backend: Edge Function
 * `codigo-whatsapp` (Twilio Verify; attempt limits; captcha when configured). Demo: nothing is sent.
 */
export async function sendWhatsAppCode(phone: string, captcha: CaptchaSource = noCaptcha): Promise<void> {
  if (!IS_DEMO) return remote.sendWhatsAppCode(phone, captcha);
  await mockLatency(600);
}

/**
 * Checks the code the user typed; right → the number counts as confirmed (for the sign-up or a number
 * change). Demo: any 6 digits confirm the number, except 000000.
 */
export async function verifyWhatsAppCode(phone: string, code: string): Promise<boolean> {
  if (!IS_DEMO) return remote.verifyWhatsAppCode(phone, code);
  await mockLatency(600);
  const ok = /^\d{6}$/.test(code) && code !== '000000';
  if (ok) demoVerifiedPhones.add(digits(phone));
  return ok;
}

/**
 * Whether the number can be confirmed by code (sign-up, number change). It needs the WhatsApp/SMS
 * provider (Twilio Verify, VITE_CODIGO_WHATSAPP): until it is set up, the code step is left out and the
 * number is stored unconfirmed (accounts.whatsapp_verified_at stays empty). The demo simulates it.
 */
export const WHATSAPP_CODE_AVAILABLE = FEATURES.whatsappCode;

/** Seconds before the code can be sent again. */
export const WHATSAPP_RESEND_SECONDS = 60;
