// Sign-in, sign-up and password flows. Without a Supabase project configured every flow stays
// simulated, with the same delays and outcomes as before — the mock/parity test suites exercise this
// exact branch and must keep passing unmodified. Once `isSupabaseConfigured()` is true, these same
// functions call the real `supabase.auth.*` methods instead (see docs/SUPABASE.md).
import type { Role } from '../types/models';
import { mockLatency } from './mockLatency';
import { getSupabase, isSupabaseConfigured } from './supabase';
import { setRole } from './store';
import { documentoDuplicado, emailDuplicado, emailNaoConfirmado, traduzirErroSupabase } from '../utils/erros';

export interface SignInInput {
  /** Mock mode only: which demo side to log in as ("Entrar como (demonstração)"). */
  role: Role;
  /** Real mode only: the account's e-mail and password. */
  email?: string;
  password?: string;
}

/** Mock: logs straight into the chosen demo side. Real: authenticates with e-mail/password. */
export async function signIn({ role, email, password }: SignInInput): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await getSupabase();
    if (!supabase) throw new Error('Supabase indisponível.');
    const { error } = await supabase.auth.signInWithPassword({
      email: (email || '').trim().toLowerCase(),
      password: password || ''
    });
    if (error) throw error;
    return;
  }
  await mockLatency(500);
  setRole(role);
}

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
}

export type SignUpResult = { ok: true } | { ok: false; reason: 'doc-taken' | 'email-taken'; message: string };

// Demo: these CPF/CNPJ are "already registered" — they reproduce the "documento já cadastrado" error.
const TAKEN_DOCS = ['111.111.111-11', '11.111.111/1111-11'];

/** Creates the account. The e-mail confirmation and the profile come next (see finishSignUp). */
export async function signUp(data: SignUpData, jaTentouLiberar = false): Promise<SignUpResult> {
  if (isSupabaseConfigured()) {
    const supabase = await getSupabase();
    if (!supabase) throw new Error('Supabase indisponível.');
    const tipo = data.role === 'recrutador' ? 'construtora' : 'pedreiro';
    const { error } = await supabase.auth.signUp({
      email: data.email.trim().toLowerCase(),
      password: data.password,
      options: { data: { nome: data.name, tipo, documento: data.doc } }
    });
    if (!error) return { ok: true };

    // Auto-recuperação de cadastro-fantasma: um e-mail ou documento preso numa tentativa anterior
    // nunca confirmada é liberado e a tentativa é refeita uma única vez antes de admitir erro.
    if (!jaTentouLiberar) {
      if (emailDuplicado(error)) {
        try {
          await supabase.rpc('reiniciar_cadastro_pendente_email', { p_email: data.email });
        } catch {
          /* segue mesmo se falhar */
        }
        return signUp(data, true);
      }
      if (documentoDuplicado(error)) {
        try {
          await supabase.rpc('reiniciar_cadastro_pendente_documento', { p_documento: data.doc });
        } catch {
          /* segue mesmo se falhar */
        }
        return signUp(data, true);
      }
    }
    if (emailDuplicado(error)) return { ok: false, reason: 'email-taken', message: traduzirErroSupabase(error) };
    return { ok: false, reason: 'doc-taken', message: traduzirErroSupabase(error) };
  }

  await mockLatency(700);
  return TAKEN_DOCS.includes(data.doc)
    ? { ok: false, reason: 'doc-taken', message: 'Esse CPF/CNPJ já tem conta na Bicos.' }
    : { ok: true };
}

export interface FinishSignUpPatch {
  cargo?: string;
  regiao?: string;
  especialidades?: string[];
  tipoObra?: string;
  regiaoAtuacao?: string;
}

/** Last step of sign-up: the profile is filled in and the user enters the app. */
export async function finishSignUp(role: Role, patch?: FinishSignUpPatch): Promise<void> {
  if (isSupabaseConfigured() && patch) {
    const supabase = await getSupabase();
    if (supabase) {
      const {
        data: { session }
      } = await supabase.auth.getSession();
      if (session) {
        const dbPatch =
          role === 'recrutador'
            ? { tipo_obra: patch.tipoObra || null, regiao_atuacao: patch.regiaoAtuacao || null }
            : { cargo: patch.cargo || null, regiao: patch.regiao || null, especialidades: patch.especialidades || [] };
        await supabase.from('profiles').update(dbPatch).eq('id', session.user.id);
      }
    }
    return;
  }
  setRole(role);
}

/** Sends the "reset your password" link. */
export async function requestPasswordReset(email: string): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await getSupabase();
    if (!supabase) throw new Error('Supabase indisponível.');
    // Sem fragmento de rota de propósito: o Supabase acrescenta os tokens de recovery como o
    // PRÓPRIO fragmento (#access_token=...&type=recovery) — main.tsx trata isso antes do roteador
    // rodar (consumeRecoveryTokenFromUrl), senão viraria um hash inválido para o roteador.
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + window.location.pathname
    });
    if (error) throw error;
    return;
  }
  await mockLatency(600);
}

/** Sets the new password chosen from the reset link. Requires a recovery session (see main.tsx). */
export async function resetPassword(newPassword: string): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await getSupabase();
    if (!supabase) throw new Error('Supabase indisponível.');
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
    return;
  }
  await mockLatency(600);
}

/** Sends the 6-digit confirmation code to the number by WhatsApp. Not wired to a real provider yet —
 *  same "unavailable" scope decision the legacy app made for WhatsApp/Google sign-in. */
export async function sendWhatsAppCode(_phone: string): Promise<void> {
  await mockLatency(600);
}

/** Checks the code the user typed. Demo: any 6 digits confirm the number, except 000000. */
export async function verifyWhatsAppCode(_phone: string, code: string): Promise<boolean> {
  await mockLatency(600);
  return /^\d{6}$/.test(code) && code !== '000000';
}

/** Seconds before the code can be sent again. */
export const WHATSAPP_RESEND_SECONDS = 15;

export { emailNaoConfirmado, traduzirErroSupabase };
