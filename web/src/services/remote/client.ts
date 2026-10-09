// The real backend's entry point for the services: the Supabase client and the translation of what it
// can fail with (network, Auth, PostgREST, the RPCs' own codes) into the app's ServiceError — the same
// codes and plain-Portuguese messages the screens already show in demo mode (services/errors.ts).
import { getSupabase, type BicosSupabase } from '../supabase';
import { serviceError, ServiceError, type ServiceErrorCode } from '../errors';

/** The client; only called with the real backend on (services/mode.ts), where it always exists. */
export async function db(): Promise<BicosSupabase> {
  const client = await getSupabase();
  if (!client) throw serviceError('falha_demo', 'O app não está ligado ao servidor.');
  return client;
}

interface ErrorLike {
  code?: unknown;
  message?: unknown;
  name?: unknown;
  status?: unknown;
}

/** SQLSTATEs raised by the RPCs (supabase/migrations/*_bicos_v2_rules.sql) → app codes. */
const RPC_CODES: Record<string, ServiceErrorCode> = {
  BC401: 'nao_autorizado',
  BC404: 'nao_encontrado',
  BC409: 'conflito',
  BC422: 'validacao'
};

/** Postgres/PostgREST codes that can reach the app → app codes (the default messages fit them). */
const PG_CODES: Record<string, ServiceErrorCode> = {
  '42501': 'nao_autorizado', // RLS / missing privilege
  PGRST301: 'nao_autorizado', // expired or invalid session token
  PGRST116: 'nao_encontrado', // .single() found no row
  '23503': 'nao_encontrado', // the referenced row no longer exists
  '23505': 'conflito', // unique violation: already done
  '23514': 'validacao', // check constraint
  '22P02': 'validacao', // invalid input syntax
  '22007': 'validacao', // invalid date
  '22008': 'validacao'
};

function isNetworkFailure(e: ErrorLike): boolean {
  if (globalThis.navigator?.onLine === false) return true;
  const text = `${String(e.name ?? '')} ${String(e.message ?? '')}`;
  return /Failed to fetch|NetworkError|Load failed|fetch failed|AuthRetryableFetchError|network/i.test(text);
}

/** Any error from the client (or a thrown one) as the ServiceError the screens understand. */
export function toServiceError(error: unknown): ServiceError {
  if (error instanceof ServiceError) return error;
  const e = (error && typeof error === 'object' ? error : { message: String(error) }) as ErrorLike;
  if (isNetworkFailure(e)) return serviceError('offline');
  const code = typeof e.code === 'string' ? e.code : '';
  const message = typeof e.message === 'string' ? e.message : '';
  if (RPC_CODES[code]) return serviceError(RPC_CODES[code], message || undefined);
  if (PG_CODES[code]) return serviceError(PG_CODES[code]);
  return serviceError('falha_demo');
}

/** The data of a supabase-js answer that succeeded (its `{ data, error }` has `error: null`). */
type OkData<R> = R extends { error: null; data: infer D } ? D : never;

/**
 * Runs a request and translates whatever it fails with — including a fetch that never reached the
 * server (supabase-js rejects, instead of returning `{ error }`, on some network failures).
 */
export async function request<R extends { data: unknown; error: unknown }>(
  run: () => PromiseLike<R>
): Promise<OkData<R>> {
  let result: R;
  try {
    result = await run();
  } catch (e) {
    throw toServiceError(e);
  }
  if (result.error) throw toServiceError(result.error);
  return result.data as OkData<R>;
}

/** The id of the logged-in Supabase user (the account id), or a "sign in again" error. */
export async function currentUserId(): Promise<string> {
  const client = await db();
  const { data } = await client.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw serviceError('nao_autorizado', 'Entre na sua conta de novo para continuar.');
  return id;
}
