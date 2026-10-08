// Accounts with the real backend (Supabase Auth), behind the same functions as demo mode
// (services/auth.ts). Proven flows from the legacy app are kept: the e-mail/document stuck in a sign-up
// that was never confirmed is freed and the sign-up retried once (reiniciar_cadastro_pendente_*), and
// the CPF/CNPJ is checked before the account is created.
import type { Role } from '../../types/models';
import type { ProfileData, SignInResult, SignUpData, SignUpResult } from '../auth';
import { serviceError } from '../errors';
import { getSession } from '../store';
import { db, request, toServiceError } from './client';
import { authRedirectUrl, enterPendingSession, enterSession, leaveSession, setRecovering } from './session';

const digits = (s: string) => s.replace(/\D/g, '');

interface AuthErrorLike {
  code?: string;
  message?: string;
  status?: number;
}

const authCode = (e: unknown) => ((e ?? {}) as AuthErrorLike).code ?? '';

// ---- sign-in ----

/** E-mail + password, or CPF/CNPJ + password (the document is resolved on the server). */
export async function signIn(identifier: string, password: string): Promise<SignInResult> {
  const client = await db();
  const id = identifier.trim();
  let email = id.toLowerCase();

  if (!id.includes('@')) {
    // The document never becomes an e-mail in the browser: the Edge Function signs in with it and
    // answers only the session (or why not).
    const doc = digits(id);
    if (doc.length !== 11 && doc.length !== 14) return { ok: false, reason: 'conta-inexistente' };
    const { data, error } = await client.functions.invoke<{
      access_token?: string;
      refresh_token?: string;
      email?: string;
      erro?: string;
    }>('entrar-com-documento', { body: { documento: doc, senha: password } });
    let answer = data;
    if (error) {
      const context = (error as { context?: Response }).context;
      answer = context && typeof context.json === 'function' ? await context.json().catch(() => null) : null;
      if (!answer?.erro) throw toServiceError(error);
    }
    if (answer?.erro === 'conta-inexistente') return { ok: false, reason: 'conta-inexistente' };
    if (answer?.erro === 'senha-errada') return { ok: false, reason: 'senha-errada' };
    if (answer?.erro === 'email-nao-confirmado' && answer.email) {
      enterPendingSession({ id: 'pendente', email: answer.email, role: 'trabalhador' });
      return { ok: true, role: 'trabalhador' };
    }
    if (!answer?.access_token || !answer.refresh_token) throw serviceError('falha_demo');
    const { data: set, error: setError } = await client.auth.setSession({
      access_token: answer.access_token,
      refresh_token: answer.refresh_token
    });
    if (setError || !set.user) throw toServiceError(setError);
    return { ok: true, role: await enterSession(set.user) };
  }

  let result;
  try {
    result = await client.auth.signInWithPassword({ email, password });
  } catch (e) {
    throw toServiceError(e);
  }
  if (result.error) {
    const code = authCode(result.error);
    // Supabase doesn't tell a wrong password from an unknown e-mail (on purpose).
    if (code === 'invalid_credentials') return { ok: false, reason: 'credenciais' };
    if (code === 'email_not_confirmed') {
      enterPendingSession({ id: 'pendente', email, role: 'trabalhador' });
      return { ok: true, role: 'trabalhador' };
    }
    throw toServiceError(result.error);
  }
  email = result.data.user.email ?? email;
  return { ok: true, role: await enterSession(result.data.user) };
}

export async function signOut(): Promise<void> {
  const client = await db();
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

async function documentAvailable(doc: string): Promise<boolean> {
  const client = await db();
  if (await request(() => client.rpc('document_available', { p_document: doc }))) return true;
  // Maybe stuck in an earlier sign-up never confirmed: free it (only unconfirmed ones) and check again.
  await client.rpc('reiniciar_cadastro_pendente_documento', { p_documento: doc }).then(undefined, () => undefined);
  return request(() => client.rpc('document_available', { p_document: doc }));
}

export async function signUp(data: SignUpData): Promise<SignUpResult> {
  const client = await db();
  if (!(await documentAvailable(data.doc))) return { ok: false, reason: 'doc-taken' };
  const email = data.email.trim().toLowerCase();

  const attempt = async () => {
    try {
      return await client.auth.signUp({
        email,
        password: data.password,
        options: {
          emailRedirectTo: authRedirectUrl(),
          // Read by the database when the account is created (accounts + worker/company, in one
          // transaction). `tipo` keeps the legacy app's trigger working for the same user.
          data: {
            nome: data.name.trim(),
            role: data.role,
            tipo: ROLE_TIPO[data.role],
            documento: digits(data.doc),
            whatsapp: digits(data.whatsapp),
            terms_version: data.acceptedTermsVersion
          }
        }
      });
    } catch (e) {
      throw toServiceError(e);
    }
  };

  let result = await attempt();
  const code = authCode(result.error);
  if (code === 'user_already_exists' || code === 'email_exists') {
    // The same e-mail in a sign-up never confirmed: free it and try once more.
    await client.rpc('reiniciar_cadastro_pendente_email', { p_email: email }).then(undefined, () => undefined);
    result = await attempt();
  } else if (code === 'unexpected_failure' || code === 'database_error_saving_new_user') {
    await client
      .rpc('reiniciar_cadastro_pendente_documento', { p_documento: data.doc })
      .then(undefined, () => undefined);
    result = await attempt();
  }

  if (result.error) {
    const again = authCode(result.error);
    if (again === 'user_already_exists' || again === 'email_exists') return { ok: false, reason: 'email-taken' };
    if (again === 'unexpected_failure' || again === 'database_error_saving_new_user')
      return { ok: false, reason: 'doc-taken' };
    if (again === 'weak_password')
      throw serviceError('validacao', 'Essa senha é fraca. Use pelo menos 8 caracteres, com letras e números.');
    if (again === 'over_email_send_rate_limit')
      throw serviceError('conflito', 'Muitas tentativas agora. Espere alguns minutos e tente de novo.');
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
export async function confirmEmail(): Promise<void> {
  const client = await db();
  const { data } = await client.auth.getSession();
  let user = data.session?.user ?? null;
  if (user && !user.email_confirmed_at) {
    const fresh = await client.auth.getUser();
    user = fresh.data.user ?? user;
  }
  if (user?.email_confirmed_at) {
    await enterSession(user);
    return;
  }
  throw serviceError(
    'conflito',
    user || getSession()?.accountId === 'pendente'
      ? 'Ainda não recebemos a confirmação. Abra o link que enviamos para o seu e-mail.'
      : 'Abra o link que enviamos para o seu e-mail e depois entre com seu e-mail e senha.'
  );
}

export async function resendConfirmationEmail(): Promise<void> {
  const email = getSession()?.email;
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

// ---- password ----

export async function requestPasswordReset(email: string): Promise<void> {
  const client = await db();
  const { error } = await client.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: authRedirectUrl()
  });
  if (error) {
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
