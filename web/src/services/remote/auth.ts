// Accounts with the real backend (Supabase Auth), behind the same functions as demo mode
// (services/auth.ts). The CPF/CNPJ is checked by the database inside the sign-up itself, never by a
// separate question anyone could ask (Z07).
import type { Role } from '../../types/models';
import type { CaptchaSource, ProfileData, SignInResult, SignUpData, SignUpResult } from '../auth';
import { serviceError, ServiceError } from '../errors';
import { FEATURES } from '../features';
import { getSession } from '../store';
import { db, invokeFunction, request, toServiceError } from './client';
import { withTimeout } from '../boot';
import {
  authRedirectUrl,
  enterPendingSession,
  enterSession,
  isRecovering,
  leaveSession,
  setRecovering
} from './session';

const digits = (s: string) => s.replace(/\D/g, '');

interface AuthErrorLike {
  code?: string;
  message?: string;
  status?: number;
}

const authCode = (e: unknown) => ((e ?? {}) as AuthErrorLike).code ?? '';

// ---- sign-in ----

const NOT_A_ROBOT = 'Não conseguimos confirmar que você não é um robô. Tente de novo.';

/**
 * L05: with the captcha on (production), a public form never goes out without a token — the Auth and
 * `entrar-com-documento` would refuse it anyway; stopping here gives a clear message instead.
 */
async function captchaToken(captcha: CaptchaSource): Promise<string | undefined> {
  const token = await captcha();
  if (FEATURES.captcha && !token) throw serviceError('validacao', NOT_A_ROBOT + ' Se continuar, recarregue a página.');
  return token;
}

const TOO_MANY = 'Muitas tentativas. Espere 15 minutos e tente de novo, ou toque em "Esqueci minha senha".';

/**
 * E-mail + password, or CPF/CNPJ + password. For a document, the Edge Function checks the password on
 * the server and only then answers that account's e-mail (Z07: one answer for "no account" and "wrong
 * password", captcha and attempt limits); the sign-in itself is the normal e-mail one, from this device.
 */
export async function signIn(identifier: string, password: string, captcha: CaptchaSource): Promise<SignInResult> {
  const client = await db();
  const id = identifier.trim();
  let email = id.toLowerCase();

  if (!id.includes('@')) {
    const doc = digits(id);
    if (doc.length !== 11 && doc.length !== 14) return { ok: false, reason: 'credenciais' };
    let answer: { email?: string };
    try {
      answer = await invokeFunction<{ email?: string }>('entrar-com-documento', {
        documento: doc,
        senha: password,
        captchaToken: await captchaToken(captcha)
      });
    } catch (e) {
      const refusal = e instanceof ServiceError ? e.reason : null;
      if (refusal === 'credenciais') return { ok: false, reason: 'credenciais' };
      if (refusal === 'muitas-tentativas') throw serviceError('conflito', TOO_MANY);
      if (refusal === 'captcha') throw serviceError('validacao', NOT_A_ROBOT);
      throw e;
    }
    if (!answer.email) return { ok: false, reason: 'credenciais' };
    email = answer.email;
  }

  let result;
  try {
    result = await client.auth.signInWithPassword({
      email,
      password,
      options: { captchaToken: await captchaToken(captcha) }
    });
  } catch (e) {
    throw toServiceError(e);
  }
  if (result.error) {
    const code = authCode(result.error);
    // Supabase doesn't tell a wrong password from an unknown e-mail (on purpose).
    if (code === 'invalid_credentials') return { ok: false, reason: 'credenciais' };
    // Y19: no session (and no way to know the side) until the link is opened: the login says so.
    if (code === 'email_not_confirmed') return { ok: false, reason: 'email-nao-confirmado', email };
    if (code === 'over_request_rate_limit') throw serviceError('conflito', TOO_MANY);
    // L06: the team suspended the account (banned in the Auth).
    if (code === 'user_banned')
      throw serviceError('nao_autorizado', 'Sua conta está suspensa. Fale com o suporte pela Ajuda.');
    if (code === 'captcha_failed') throw serviceError('validacao', NOT_A_ROBOT);
    throw toServiceError(result.error);
  }
  return { ok: true, role: await enterSession(result.data.user) };
}

export async function signOut(): Promise<void> {
  const client = await db();
  // X03: this device stops receiving the account's notices (best effort, with the session still valid).
  await import('../push').then((m) => withTimeout(m.disablePush(), 3000)).catch(() => undefined);
  // Works offline too: the session is dropped on the device even if the server can't be told.
  await client.auth.signOut({ scope: 'local' }).catch(() => undefined);
  await leaveSession();
}

/** Re-authenticates the logged-in account (before deleting it). */
export async function checkPassword(password: string): Promise<boolean> {
  const email = getSession()?.email;
  if (!email) return false;
  const client = await db();
  let result;
  try {
    result = await client.auth.signInWithPassword({ email, password });
  } catch (e) {
    throw toServiceError(e);
  }
  if (!result.error) return true;
  if (authCode(result.error) === 'invalid_credentials') return false;
  throw toServiceError(result.error);
}

// ---- sign-up ----

const ROLE_TIPO: Record<Role, string> = { trabalhador: 'pedreiro', recrutador: 'construtora' };

/**
 * Creates the account in Supabase Auth; a trigger creates `accounts` and the worker/company in the same
 * transaction, and checks the CPF/CNPJ there (Z07): a document of a confirmed account makes the sign-up
 * fail without saying why; a document stuck in a sign-up never confirmed is freed.
 */
export async function signUp(data: SignUpData, captcha: CaptchaSource): Promise<SignUpResult> {
  const client = await db();
  const email = data.email.trim().toLowerCase();
  let result;
  try {
    result = await client.auth.signUp({
      email,
      password: data.password,
      options: {
        emailRedirectTo: authRedirectUrl(),
        captchaToken: await captchaToken(captcha),
        // Read by the database when the account is created; the document is removed from the Auth
        // metadata right after it is encrypted (Z09). `tipo` keeps the legacy app's trigger working.
        data: {
          nome: data.name.trim(),
          role: data.role,
          tipo: ROLE_TIPO[data.role],
          documento: digits(data.doc),
          whatsapp: digits(data.whatsapp),
          terms_version: data.acceptedTermsVersion,
          maior_de_idade: data.adult,
          ...(data.contactName ? { responsavel: data.contactName } : {})
        }
      }
    });
  } catch (e) {
    throw toServiceError(e);
  }

  if (result.error) {
    const code = authCode(result.error);
    if (code === 'user_already_exists' || code === 'email_exists') return { ok: false, reason: 'email-taken' };
    if (code === 'unexpected_failure' || code === 'database_error_saving_new_user' || result.error.status === 500)
      return { ok: false, reason: 'recusado' };
    if (code === 'weak_password')
      throw serviceError('validacao', 'Essa senha é fraca. Use pelo menos 8 caracteres, com letras e números.');
    if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit')
      throw serviceError('conflito', 'Muitas tentativas agora. Espere alguns minutos e tente de novo.');
    if (code === 'captcha_failed') throw serviceError('validacao', NOT_A_ROBOT);
    throw toServiceError(result.error);
  }
  const user = result.data.user;
  // An e-mail already confirmed comes back as a user without identities (Supabase hides that it exists).
  if (user && user.identities && user.identities.length === 0) return { ok: false, reason: 'email-taken' };
  if (result.data.session && user) await enterSession(user);
  else if (user) enterPendingSession({ id: user.id, email, role: data.role });
  return { ok: true };
}

/** "Já confirmei": the link may have been opened in another tab or device — check with the server. */
export async function confirmEmail(): Promise<'entrou' | 'entrar-com-senha'> {
  const client = await db();
  const { data } = await client.auth.getSession();
  let user = data.session?.user ?? null;
  // A sign-up waiting for the link has no Auth session here: only signing in can tell (Y19).
  if (!user) return 'entrar-com-senha';
  if (!user.email_confirmed_at) {
    const fresh = await client.auth.getUser();
    user = fresh.data.user ?? user;
  }
  if (user.email_confirmed_at) {
    await enterSession(user);
    return 'entrou';
  }
  throw serviceError('conflito', 'Ainda não recebemos a confirmação. Abra o link que enviamos para o seu e-mail.');
}

export async function resendConfirmationEmail(to?: string): Promise<void> {
  const email = to ?? getSession()?.email;
  if (!email) throw serviceError('nao_autorizado', 'Entre com seu e-mail e senha para receber o link de novo.');
  const client = await db();
  const { error } = await client.auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: authRedirectUrl() }
  });
  if (error) {
    if (authCode(error) === 'over_email_send_rate_limit')
      throw serviceError('conflito', 'Já enviamos o link há pouco. Espere alguns minutos para pedir outro.');
    throw toServiceError(error);
  }
}

/** "Completar perfil": saves it and lets the account into the app. */
export async function finishSignUp(profile: ProfileData): Promise<void> {
  const client = await db();
  const { cityByLabel } = await import('../cities');
  const { DEFAULT_POINT } = await import('../defaults');
  const p =
    profile.role === 'trabalhador'
      ? {
          oficio_id: profile.oficioId,
          city: profile.city,
          specialties: profile.specialties,
          ...(cityByLabel(profile.city) ?? DEFAULT_POINT)
        }
      : { tipo_obra: profile.tipoObra, city: profile.city };
  await request(() => client.rpc('finish_sign_up', { p }));
  const { data } = await client.auth.getSession();
  if (data.session) await enterSession(data.session.user);
}

// ---- terms (L07) ----

export async function acceptTerms(version: string): Promise<void> {
  const client = await db();
  await request(() => client.rpc('accept_terms', { p_version: version }));
}

// ---- password ----

export async function requestPasswordReset(email: string, captcha: CaptchaSource): Promise<void> {
  const client = await db();
  const { error } = await client.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: authRedirectUrl(),
    captchaToken: await captchaToken(captcha)
  });
  if (error) {
    if (authCode(error) === 'captcha_failed') throw serviceError('validacao', NOT_A_ROBOT);
    if (authCode(error) === 'over_email_send_rate_limit')
      throw serviceError('conflito', 'Já enviamos o link há pouco. Espere alguns minutos para pedir outro.');
    throw toServiceError(error);
  }
}

/** Sets the new password with the session opened by the reset link, then ends it (sign in again). */
export async function resetPassword(newPassword: string): Promise<void> {
  const client = await db();
  const { data } = await client.auth.getSession();
  if (!data.session)
    throw serviceError('nao_autorizado', 'O link para redefinir a senha venceu. Peça outro em "Esqueci minha senha".');
  const { error } = await client.auth.updateUser({ password: newPassword });
  if (error) {
    const code = authCode(error);
    if (code === 'same_password') throw serviceError('validacao', 'Use uma senha diferente da anterior.');
    if (code === 'weak_password')
      throw serviceError('validacao', 'Essa senha é fraca. Use pelo menos 8 caracteres, com letras e números.');
    throw toServiceError(error);
  }
  setRecovering(false);
  await signOut();
}

/** X11: leaving the reset screen without a new password signs the link's session out. */
export async function abandonPasswordReset(): Promise<void> {
  if (!isRecovering()) return;
  setRecovering(false);
  await signOut();
}

// ---- WhatsApp code (Y25) ----

export async function sendWhatsAppCode(phone: string, captcha: CaptchaSource): Promise<void> {
  await invokeFunction('codigo-whatsapp', {
    acao: 'enviar',
    telefone: digits(phone),
    captchaToken: await captchaToken(captcha)
  });
}

export async function verifyWhatsAppCode(phone: string, code: string): Promise<boolean> {
  const answer = await invokeFunction<{ ok?: boolean }>('codigo-whatsapp', {
    acao: 'conferir',
    telefone: digits(phone),
    codigo: code
  });
  return answer?.ok === true;
}

// ---- account settings (L15, F08) ----

function passwordProblem(error: unknown): never {
  const code = authCode(error as { code?: string });
  if (code === 'same_password') throw serviceError('validacao', 'Use uma senha diferente da atual.');
  if (code === 'weak_password')
    throw serviceError('validacao', 'Essa senha é fraca. Use pelo menos 8 caracteres, com letras e números.');
  throw toServiceError(error);
}

export async function changePassword(current: string, next: string): Promise<void> {
  if (!(await checkPassword(current))) throw serviceError('validacao', 'Senha atual incorreta.');
  const client = await db();
  const { error } = await client.auth.updateUser({ password: next });
  if (error) passwordProblem(error);
}

export async function changeEmail(email: string, password: string): Promise<void> {
  if (!(await checkPassword(password))) throw serviceError('validacao', 'Senha incorreta.');
  const client = await db();
  const { error } = await client.auth.updateUser({ email }, { emailRedirectTo: authRedirectUrl() });
  if (error) {
    const code = authCode(error);
    if (code === 'email_exists' || code === 'user_already_exists')
      throw serviceError('conflito', 'Esse e-mail já tem conta na Bicos.');
    if (code === 'over_email_send_rate_limit')
      throw serviceError('conflito', 'Já enviamos um link há pouco. Espere alguns minutos para pedir outro.');
    throw toServiceError(error);
  }
}

// ---- Google (L13) ----

export async function signInWithGoogle(): Promise<void> {
  const client = await db();
  const { error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: authRedirectUrl() }
  });
  if (error) throw toServiceError(error);
}

export async function completeOAuthSignUp(data: import('../auth').OAuthSignUpData): Promise<void> {
  const client = await db();
  await request(() =>
    client.rpc('create_my_account', {
      p_role: data.role,
      p_name: data.name.trim(),
      p_document: digits(data.doc),
      p_whatsapp: digits(data.whatsapp),
      p_terms_version: data.acceptedTermsVersion,
      p_adult: data.adult,
      p_contact_name: data.contactName?.trim() || null
    })
  );
  const { data: session } = await client.auth.getSession();
  if (!session.session) throw serviceError('nao_autorizado', 'Entre na sua conta de novo para continuar.');
  await enterSession(session.session.user);
}
