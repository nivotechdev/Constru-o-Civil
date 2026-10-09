// What a service call can fail with. Screens show `message` (already in plain Portuguese) and may branch
// on `code`; the real backend maps its errors (network, RLS, constraint…) onto the same codes.

export type ServiceErrorCode =
  /** No connection (navigator.onLine is false, or the request never reached the server). */
  | 'offline'
  /** The demo's failure switch is on (?falhar=1 or Configurações › Demonstração). */
  | 'falha_demo'
  /** Not logged in, or the account may not do this (e.g. another company's job). */
  | 'nao_autorizado'
  /** The record no longer exists (deleted job, closed account…). */
  | 'nao_encontrado'
  /** The action no longer fits the current state (job full, status already changed…). */
  | 'conflito'
  /** The input was refused (invalid field). */
  | 'validacao';

export class ServiceError extends Error {
  readonly code: ServiceErrorCode;
  /** The server's own reason, when it gives one (e.g. an Edge Function's `erro`), for services to branch on. */
  readonly reason: string | null;
  constructor(code: ServiceErrorCode, message: string, reason: string | null = null) {
    super(message);
    this.name = 'ServiceError';
    this.code = code;
    this.reason = reason;
  }
}

const DEFAULT_MESSAGES: Record<ServiceErrorCode, string> = {
  offline: 'Sem internet. Confira sua conexão e tente de novo.',
  falha_demo: 'Não deu certo agora. Tente de novo em instantes.',
  nao_autorizado: 'Sua conta não pode fazer isso.',
  nao_encontrado: 'Isso não existe mais.',
  conflito: 'Isso mudou enquanto você olhava. Atualize e tente de novo.',
  validacao: 'Confira os dados e tente de novo.'
};

export function serviceError(code: ServiceErrorCode, message = DEFAULT_MESSAGES[code]): ServiceError {
  return new ServiceError(code, message);
}

/** The message to show for anything a service call rejected with. */
export function errorMessage(error: unknown): string {
  if (error instanceof ServiceError) return error.message;
  return DEFAULT_MESSAGES.falha_demo;
}

export function isOfflineError(error: unknown): boolean {
  return error instanceof ServiceError && error.code === 'offline';
}
