// Mercado Pago: só o que o Bicos usa (criar pagamento PIX/cartão, ler um pagamento, conferir o aviso).
// Documentação: https://www.mercadopago.com.br/developers/pt/reference/payments/_payments/post
// Segredos (Supabase → Edge Functions → Secrets): MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET.

const API = 'https://api.mercadopago.com';

export function mercadoPagoConfigured(): boolean {
  return Boolean(Deno.env.get('MP_ACCESS_TOKEN'));
}

export interface MpPayment {
  id: number;
  status:
    | 'pending'
    | 'approved'
    | 'authorized'
    | 'in_process'
    | 'in_mediation'
    | 'rejected'
    | 'cancelled'
    | 'refunded'
    | 'charged_back';
  status_detail?: string;
  external_reference?: string;
  date_of_expiration?: string | null;
  card?: { last_four_digits?: string | null };
  point_of_interaction?: { transaction_data?: { qr_code?: string; qr_code_base64?: string } };
}

async function mp<T>(path: string, init: RequestInit & { idempotencyKey?: string } = {}): Promise<T> {
  const res = await fetch(API + path, {
    ...init,
    headers: {
      Authorization: `Bearer ${Deno.env.get('MP_ACCESS_TOKEN')}`,
      'Content-Type': 'application/json',
      ...(init.idempotencyKey ? { 'X-Idempotency-Key': init.idempotencyKey } : {})
    }
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`mercadopago ${res.status}: ${JSON.stringify(body).slice(0, 300)}`);
  return body as T;
}

export function createPayment(body: Record<string, unknown>, idempotencyKey: string): Promise<MpPayment> {
  return mp<MpPayment>('/v1/payments', { method: 'POST', body: JSON.stringify(body), idempotencyKey });
}

export function getPayment(id: string): Promise<MpPayment> {
  return mp<MpPayment>(`/v1/payments/${encodeURIComponent(id)}`);
}

async function hmacHex(secret: string, text: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text)));
  return [...sig].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Confere a assinatura do aviso (cabeçalho x-signature "ts=…,v1=…" sobre
 * "id:{data.id};request-id:{x-request-id};ts:{ts};"), como manda o Mercado Pago.
 */
export async function validSignature(req: Request, dataId: string): Promise<boolean> {
  const secret = Deno.env.get('MP_WEBHOOK_SECRET');
  const header = req.headers.get('x-signature') ?? '';
  const requestId = req.headers.get('x-request-id') ?? '';
  if (!secret || !header) return false;
  const parts = Object.fromEntries(header.split(',').map((p) => p.trim().split('=') as [string, string]));
  if (!parts.ts || !parts.v1) return false;
  // Avisos com mais de 15 minutos são recusados (repetição de um aviso antigo).
  if (Math.abs(Date.now() / 1000 - Number(parts.ts) / (parts.ts.length > 10 ? 1000 : 1)) > 900) return false;
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${parts.ts};`;
  const expected = await hmacHex(secret, manifest);
  if (expected.length !== parts.v1.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ parts.v1.charCodeAt(i);
  return diff === 0;
}
