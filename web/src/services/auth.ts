// Accounts and the session: sign-in, sign-up, e-mail confirmation, the end of onboarding and sign-out.
// With the real backend each function hands over to services/remote/auth.ts (Supabase Auth); in demo
// mode (services/mode.ts) every flow is simulated in memory, with realistic delays and outcomes.
// Screens only call these functions, the same in both modes.
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
export async function checkPassword(password: string): Promise<boolean> {
  if (!IS_DEMO) return remote.checkPassword(password);
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
 * Why signing in failed. With the real backend an e-mail sign-in can't tell an unknown e-mail from a
 * wrong password (Supabase Auth hides it on purpose): that is `credenciais`.
 */
export type SignInError = 'conta-inexistente' | 'senha-errada' | 'credenciais';
export type SignInResult = { ok: true; role: Role } | { ok: false; reason: SignInError };

/**
 * Signs in with e-mail (or CPF/CNPJ) and password. The side (worker or company) comes from the account.
 * Backend: Supabase Auth `signInWithPassword` (resolving a CPF/CNPJ to the account's e-mail first).
 */
export async function signIn(identifier: string, password: string): Promise<SignInResult> {
  if (!IS_DEMO) return remote.signIn(identifier, password);
  await mockLatency(500);
  const account = findAccount(identifier);
  if (!account) return { ok: false, reason: 'conta-inexistente' };
  if (passwords.get(account.id) !== password) return { ok: false, reason: 'senha-errada' };
  setSessionAccount(account.id);
  return { ok: true, role: account.role };
}

/** Ends the session and forgets every screen's state. Backend: Supabase Auth `signOut`. */
export async function signOut(): Promise<void> {
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
}

export type SignUpResult = { ok: true } | { ok: false; reason: 'doc-taken' | 'email-taken' };

// Demo: these CPF/CNPJ are "already registered" — they reproduce the "documento já cadastrado" error.
const TAKEN_DOCS = ['111.111.111-11', '11.111.111/1111-11'];

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase() || '?';
}

/**
 * Creates the account and its empty profile, and logs it in. The e-mail confirmation and the profile
 * come next (the route guards send the user there). Backend: Supabase Auth `signUp` + a trigger that
 * creates the `accounts` row and the worker/company row.
 */
export async function signUp(data: SignUpData): Promise<SignUpResult> {
  if (!IS_DEMO) return remote.signUp(data);
  await mockLatency(700);
  const accounts = Object.values(getDb().accounts);
  if (TAKEN_DOCS.includes(data.doc) || accounts.some((a) => digits(a.document) === digits(data.doc)))
    return { ok: false, reason: 'doc-taken' };
  if (accounts.some((a) => a.email.toLowerCase() === data.email.trim().toLowerCase()))
    return { ok: false, reason: 'email-taken' };

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
      cnpj: data.doc,
      location: DEFAULT_CITY,
      whatsapp: data.whatsapp,
      rating: 0,
      reviewCount: 0,
      verified: false,
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

/**
 * Demo stand-in for opening the link sent by e-mail: confirms the logged-in account's e-mail.
 * Backend: Supabase Auth confirms it when the link is opened; the app only re-reads the session.
 */
export async function confirmEmail(): Promise<void> {
  if (!IS_DEMO) return remote.confirmEmail();
  await mockLatency(500);
  const session = getSession();
  if (session) updateAccount(session.accountId, { emailConfirmedAt: new Date().toISOString() });
}

/** Sends the confirmation link again. Backend: Supabase Auth `resend({ type: 'signup' })`. */
export async function resendConfirmationEmail(): Promise<void> {
  if (!IS_DEMO) return remote.resendConfirmationEmail();
  await mockLatency(600);
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

// ---- password ----

/** Sends the "reset your password" link. Demo: nothing is sent. */
export async function requestPasswordReset(_email: string): Promise<void> {
  if (!IS_DEMO) return remote.requestPasswordReset(_email);
  await mockLatency(600);
}

/** Sets the new password chosen from the reset link. Demo: nothing is stored. */
export async function resetPassword(_newPassword: string): Promise<void> {
  if (!IS_DEMO) return remote.resetPassword(_newPassword);
  await mockLatency(600);
}

// ---- WhatsApp ----

/** Sends the 6-digit confirmation code to the number by WhatsApp. Demo: nothing is sent. */
export async function sendWhatsAppCode(_phone: string): Promise<void> {
  await mockLatency(600);
}

/** Checks the code the user typed. Demo: any 6 digits confirm the number, except 000000. */
export async function verifyWhatsAppCode(_phone: string, code: string): Promise<boolean> {
  await mockLatency(600);
  return /^\d{6}$/.test(code) && code !== '000000';
}

/**
 * Whether the sign-up can confirm the WhatsApp number by code. It needs a WhatsApp/SMS provider (e.g.
 * Twilio or the Meta API), not integrated yet: with the real backend the code step is left out and the
 * number is stored unconfirmed (accounts.whatsapp_verified_at stays empty). The demo simulates it.
 */
export const WHATSAPP_CODE_AVAILABLE = IS_DEMO;

/** Seconds before the code can be sent again. */
export const WHATSAPP_RESEND_SECONDS = 15;
