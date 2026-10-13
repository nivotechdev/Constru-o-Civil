// Utilidades das Edge Functions: CORS, respostas JSON e os clientes do Supabase.
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

export const CORS = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

const opts = { auth: { persistSession: false, autoRefreshToken: false } };

/** Cliente com a chave service_role: ignora RLS. Só para o que a função já conferiu. */
export function adminClient(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', opts);
}

/** Cliente anônimo (para entrar com senha, sem guardar sessão). */
export function anonClient(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', opts);
}

/** A conta dona do token do pedido (conferido no Auth), ou null. */
export async function requestUser(req: Request): Promise<{ id: string; email: string } | null> {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data, error } = await adminClient().auth.getUser(token);
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? '' };
}

/** O IP de quem chamou (o Supabase repassa o do cliente em x-forwarded-for). */
export function clientIp(req: Request): string {
  return (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'desconhecido';
}

/** Os erros das RPCs (BC401…) viram o mesmo formato que o app entende: { erro, mensagem }. */
export function rpcError(error: { code?: string; message?: string }): Response {
  const status = { BC401: 401, BC404: 404, BC409: 409, BC422: 422 }[error.code ?? ''] ?? 500;
  return json({ erro: error.code ?? 'falha', mensagem: error.message ?? 'Algo deu errado.' }, status);
}
