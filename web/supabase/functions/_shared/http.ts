// Utilidades das Edge Functions: CORS, respostas JSON e os clientes do Supabase.
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, originsProblem, parseOrigins } from './origin.ts';

// R02: APP_ORIGIN (CORS) é exigido só pelas funções que o navegador chama — cada uma chama requireAppOrigin()
// no topo do arquivo e, sem ele, não sobe (L05). As chamadas de servidor para servidor (webhook-pagamento,
// enviar-push, limpar-arquivos) não dependem dele nem mandam cabeçalho CORS: um segredo esquecido não derruba
// o webhook nem o cron.
let ORIGINS: string[] | null = null;

/** Para as funções do navegador: lê e confere APP_ORIGIN; sem ele (ou inválido), a função não sobe. */
export function requireAppOrigin(): string[] {
  if (!ORIGINS) {
    const origins = parseOrigins(Deno.env.get('APP_ORIGIN'));
    const problem = originsProblem(origins);
    if (problem) throw new Error(problem);
    ORIGINS = origins;
  }
  return ORIGINS;
}

/** Os cabeçalhos CORS para quem chamou (vazio nas funções servidor-a-servidor). */
function corsFor(req: Request): Record<string, string> {
  return ORIGINS ? corsHeaders(ORIGINS, req.headers.get('Origin')) : {};
}

/** Resposta ao "preflight" (OPTIONS) do navegador. */
export function preflight(req: Request): Response {
  return new Response('ok', { headers: corsFor(req) });
}

/** Põe na resposta a origem do pedido, quando ela está em APP_ORIGIN (prévias por PR, staging). */
export function withCors(req: Request, res: Response): Response {
  for (const [k, v] of Object.entries(corsFor(req))) res.headers.set(k, v);
  return res;
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
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
