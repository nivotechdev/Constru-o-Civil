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
import { currentPath, getLocation, navigate, resetHistory, subscribe as onRoute } from './router';
import { isBusy, startBusy, type BusyHandle } from './busy';
import {
  getDb,
  getSession,
  setSessionAccount,
  updateAccount,
  upsertAccount,
  upsertCompany,
  upsertWorker
} from './store';
import { DEFAULT_CITY, DEFAULT_POINT } from './defaults';
import { IS_DEMO } from './mode';
import * as remote from './remote/auth';
import * as remoteFirebase from './remote/firebase';
import { isValidCnpj, isValidCpf } from '../utils/document';
import { FEATURES } from './features';
import { serviceError } from './errors';
import { isValidEmail } from '../utils/format';
import { TERMS_VERSION } from './legal';
import type { ResolvedAddress } from './address';
import {
  endGoogleSignUp,
  googleIdentity,
  googleSignUpPath,
  rememberGoogleRole,
  setGoogleIdentity,
  type GoogleIdentity
} from './googleSignUp';

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
    createdAt: now,
    theme: 'claro'
  };
  if (data.role === 'trabalhador') {
    const worker: Worker = {
      id: 't-' + stamp,
      name: data.name.trim(),
      initials: initialsOf(data.name),
      whatsapp: data.whatsapp,
      city: DEFAULT_CITY,
      neighborhood: null,
      ...DEFAULT_POINT,
      rating: 0,
      reviewCount: 0,
      jobsDone: 0,
      novo: true,
      verified: false,
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
 * U11/U43: "Trocar" on the code screen — the e-mail is changed right there and the new code goes to the new address
 * at once. Real backend: the sign-up is done again with the new address (same data, kept in memory) and the
 * account with the wrong address, never confirmed, gives up the CPF/CNPJ and the WhatsApp to the new one.
 * `email-taken`: the new address already has an account.
 */
export async function changePendingEmail(email: string, captcha: CaptchaSource = noCaptcha): Promise<SignUpResult> {
  const clean = email.trim().toLowerCase();
  if (!isValidEmail(clean)) throw serviceError('validacao', 'E-mail inválido. Confira se tem @ e o domínio.');
  const pending = pendingSignUp;
  const current = (pending?.email ?? getSession()?.email ?? '').trim().toLowerCase();
  if (clean === current) throw serviceError('validacao', SAME_EMAIL);
  if (!pending && !IS_DEMO) throw serviceError('validacao', CANNOT_CHANGE_EMAIL);
  if (!(await isFreeForSignUp('email', clean))) return { ok: false, reason: 'email-taken' };
  if (IS_DEMO || !pending) {
    await mockLatency(500);
    const session = getSession();
    if (session) updateAccount(session.accountId, { email: clean });
    if (pending) pendingSignUp = { ...pending, email: clean };
    return { ok: true };
  }
  const result = await remote.signUp({ ...pending, email: clean }, captcha);
  if (result.ok) pendingSignUp = { ...pending, email: clean };
  return result;
}

/** U43: what "Trocar" says when the address typed is the one the code already went to. */
export const SAME_EMAIL = 'Esse é o mesmo e-mail. Digite o e-mail certo.';
/** U43: the sign-up isn't in memory any more (never on a normal visit: it lives as long as the code screen). */
const CANNOT_CHANGE_EMAIL = 'Não deu para trocar o e-mail aqui. Toque em Sair e faça o cadastro com o e-mail certo.';

/**
 * Last step of sign-up (U12, U51): the account's address (found and checked by address.resolveAddress; the photos are
 * saved apart, by profiles.saveMyProfileImages), and the account goes into the app. The address stays the account's
 * own: others see only the city. Its city is where the mural opens and where a new job starts (U13); distances to
 * the jobs are measured from it. Backend: RPC finish_sign_up.
 */
export async function finishSignUp(address: ResolvedAddress): Promise<void> {
  if (!IS_DEMO) return remote.finishSignUp(address);
  await mockLatency(500);
  const session = getSession();
  if (!session) return;
  const { keepAddressInDemo } = await import('./profiles');
  keepAddressInDemo(address);
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

// ---- Google (L13, U37) ----

/**
 * "Continuar com o Google". An account that exists signs in; a Google account without one continues in the normal
 * sign-up (U37) — the side chosen before, or choosing it first — with the e-mail and its confirmation left out.
 * Backend: Firebase (window + ID token) and the Edge Function entrar-com-firebase; without Firebase, Supabase OAuth
 * (leaves the page and comes back).
 */
export async function signInWithGoogle(role?: Role): Promise<void> {
  if (IS_DEMO) throw serviceError('validacao', 'Na demonstração, entre com e-mail e senha.');
  // U45: something is already loading (a second tap in the same instant): nothing happens.
  if (isBusy()) return;
  const attempt = ++googleAttempt;
  const wanted = () => attempt === googleAttempt;
  rememberGoogleRole(role ?? null);
  // U45: from the tap until the next screen, the app shows that it is loading and takes no other tap. While the
  // Google window is open the person can give up ("Cancelar": whatever that window answers later is ignored).
  const lock: BusyHandle = startBusy(
    {
      message: FEATURES.firebase ? 'Esperando o Google…' : 'Abrindo o Google…',
      detail: FEATURES.firebase ? 'Escolha sua conta na janela do Google.' : undefined,
      cancel: {
        label: 'Cancelar',
        onCancel: () => {
          googleAttempt++;
          lock.end();
        }
      }
    },
    { maxMs: GOOGLE_WINDOW_MAX_MS }
  );
  // Supabase's own Google page: the app leaves for it (the lock goes with the page).
  if (!FEATURES.firebase) {
    try {
      await remote.signInWithGoogle();
    } catch (e) {
      lock.end();
      throw e;
    }
    return;
  }
  try {
    // U29: straight into Firebase, nothing awaited before — the Google window must open inside the tap.
    const result = await remoteFirebase.signInWithFirebaseGoogle({
      onAccountChosen: () => {
        if (wanted()) lock.update({ message: 'Entrando na sua conta…', detail: 'Só um instante.' });
      },
      stillWanted: wanted
    });
    if (!wanted() || result === 'cancelado') return;
    unlockOnNextScreen(lock);
    if (result !== 'ok') {
      setGoogleIdentity(result);
      watchGoogleSignUpExit();
      // From choosing the side, the sign-up opens on top of it (its back arrow returns there); from the sign-up's
      // first step, the same screen continues without the e-mail.
      const next = googleSignUpPath();
      navigate(next, { replace: next === currentPath() });
    }
  } catch (e) {
    lock.end();
    if (!wanted()) return; // given up: the window's answer is no news
    throw e;
  }
}

/** U45: the Google attempt being waited on; a newer tap or "Cancelar" makes an older one's answer be ignored. */
let googleAttempt = 0;
/** How long the Google window can stay open (a second step on the Google account takes a while). */
const GOOGLE_WINDOW_MAX_MS = 10 * 60_000;

/**
 * The account opened (the route guard takes it to its screen) or the sign-up continues: the app unlocks once the next
 * screen is drawn, so the previous one never shows again in between.
 */
function unlockOnNextScreen(lock: BusyHandle): void {
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    stop();
    clearTimeout(timer);
    requestAnimationFrame(() => lock.end());
  };
  const stop = onRoute(finish);
  const timer = setTimeout(finish, 1500);
}

/**
 * U45: leaving a Google sign-up by the phone's back button, back to the login, ends the pending Google login too —
 * the same as the screens' own back arrow (U40): the login and the plain sign-up start clean.
 */
let watchingGoogleExit = false;
function watchGoogleSignUpExit(): void {
  if (watchingGoogleExit) return;
  watchingGoogleExit = true;
  onRoute(() => {
    if (getLocation().path === '/login' && googleIdentity()) void leaveGoogleSignUp();
  });
}

/** U29: loads Firebase as a screen with the Google/phone buttons opens, so the tap opens the window at once. */
export function prepareSocialSignIn(): void {
  if (FEATURES.firebase) void remoteFirebase.prepareFirebase().catch(() => undefined);
}

// ---- phone (U28) ----

const PHONE_KEY = 'bicos-celular';

/** "Entrar com o celular": sends the SMS code (Firebase). `container` holds the invisible "I'm not a robot". */
export async function sendPhoneSignInCode(phone: string, container: HTMLElement): Promise<void> {
  if (IS_DEMO || !FEATURES.phoneLogin) throw serviceError('validacao', 'Na demonstração, entre com e-mail e senha.');
  if (!isValidMobile(phone)) throw serviceError('validacao', 'Use o celular com DDD (11 números).');
  return remoteFirebase.sendPhoneCode(phone, container);
}

/**
 * The SMS code: signs in the account whose WhatsApp is that number; 'sem-conta' when there is none (the number is
 * kept for the sign-up, which starts with it filled in).
 */
export async function confirmPhoneSignInCode(phone: string, code: string): Promise<'ok' | 'sem-conta'> {
  const result = await remoteFirebase.confirmPhoneCode(code);
  if (result === 'sem-conta') {
    try {
      sessionStorage.setItem(PHONE_KEY, phone.replace(/\D/g, ''));
    } catch {
      // The sign-up just asks the number again.
    }
  }
  return result;
}

/** U28: the number confirmed by SMS that had no account (read once, to start the sign-up with it). */
export function takeSignUpPhone(): string | null {
  try {
    const phone = sessionStorage.getItem(PHONE_KEY);
    sessionStorage.removeItem(PHONE_KEY);
    return phone && /^\d{11}$/.test(phone) ? phone : null;
  } catch {
    return null;
  }
}

/**
 * U37: the Google sign-up in progress on this device (a Google login whose account isn't created yet): its e-mail
 * and name, for the sign-up screens. Read again when a screen opens (after a reload or Supabase's own Google).
 */
export async function loadGoogleSignUp(): Promise<GoogleIdentity | null> {
  if (IS_DEMO) return null;
  const identity = await remote.pendingGoogleIdentity().catch(() => googleIdentity());
  setGoogleIdentity(identity);
  if (identity) watchGoogleSignUpExit();
  return identity;
}

/** U37: "Usar outro e-mail": leaves the Google login and goes back to the plain sign-up (e-mail and password). */
export async function leaveGoogleSignUp(): Promise<void> {
  endGoogleSignUp();
  if (!IS_DEMO) await remote.signOut().catch(() => undefined);
}

export interface GoogleSignUpData {
  role: Role;
  name: string;
  doc: string;
  whatsapp: string;
  password: string;
  acceptedTermsVersion: string;
  adult: boolean;
  contactName?: string;
}

/**
 * U37: creates the account of a Google login — the same data and rules as the e-mail sign-up (the e-mail is the
 * Google one, already confirmed), plus a password, so the account also enters with CPF/CNPJ or e-mail and password.
 * Backend: Auth updateUser({ password }), RPC create_my_account, then the session starts as usual.
 */
export async function completeGoogleSignUp(data: GoogleSignUpData): Promise<void> {
  if (!data.adult) throw serviceError('validacao', 'A Bicos é só para maiores de 18 anos.');
  const validDoc = data.role === 'recrutador' ? isValidCnpj(data.doc) || isValidCpf(data.doc) : isValidCpf(data.doc);
  if (!validDoc)
    throw serviceError('validacao', data.role === 'recrutador' ? 'CNPJ ou CPF inválido.' : 'CPF inválido.');
  if (!isValidMobile(data.whatsapp)) throw serviceError('validacao', 'Use o celular com DDD (11 números).');
  const weak = passwordProblem(data.password);
  if (weak) throw serviceError('validacao', weak);
  if (IS_DEMO) throw serviceError('validacao', 'Na demonstração, crie a conta pelo cadastro.');
  await remote.completeGoogleSignUp(data);
  endGoogleSignUp();
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
