// U28: confere um ID token do Firebase Authentication (o "crachá" que o Firebase dá depois do Google ou do código por
// SMS), do jeito que o Google manda: assinatura RS256 com as chaves públicas do Firebase (JWK), emissor
// https://securetoken.google.com/<projeto>, público = <projeto>, dentro da validade e com login recente.
// Sem Deno nem bibliotecas: só WebCrypto e fetch, para rodar na Edge Function e nos testes (Node).

export const FIREBASE_JWKS =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

export interface FirebaseIdentity {
  uid: string;
  /** 'google.com' ou 'phone'. */
  provider: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  /** E.164: "+5554991234567". */
  phone: string | null;
}

interface Jwk {
  kid: string;
  kty: string;
  n: string;
  e: string;
  alg?: string;
}

const b64url = (s: string) => {
  const pad = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(pad + '='.repeat((4 - (pad.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};
const decodeJson = (s: string) => JSON.parse(new TextDecoder().decode(b64url(s)));

let cache: { keys: Jwk[]; until: number } | null = null;

/** As chaves públicas do Firebase, guardadas pelo tempo que o Google manda (Cache-Control: max-age). */
async function publicKeys(fetcher: typeof fetch, now: number): Promise<Jwk[]> {
  if (cache && cache.until > now) return cache.keys;
  const res = await fetcher(FIREBASE_JWKS);
  if (!res.ok) throw new Error('chaves do Firebase indisponíveis');
  const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get('cache-control') ?? '')?.[1] ?? 3600);
  const keys = ((await res.json()) as { keys: Jwk[] }).keys;
  cache = { keys, until: now + maxAge * 1000 };
  return keys;
}

/** U46: busca as chaves antes do primeiro token (o app "acorda" a função quando abre a tela do Google). */
export async function warmFirebaseKeys(fetcher: typeof fetch = fetch, now = Date.now()): Promise<void> {
  await publicKeys(fetcher, now).catch(() => undefined);
}

/** Só para os testes. */
export function forgetFirebaseKeys(): void {
  cache = null;
}

/**
 * Devolve quem é a pessoa, ou null se o token não vale (assinatura, projeto, validade ou login de mais de
 * `maxAgeSeconds` atrás). Erros de rede para buscar as chaves sobem (a função responde 502).
 */
export async function verifyFirebaseToken(
  token: string,
  projectId: string,
  {
    fetcher = fetch,
    now = Date.now(),
    maxAgeSeconds = 600
  }: { fetcher?: typeof fetch; now?: number; maxAgeSeconds?: number } = {}
): Promise<FirebaseIdentity | null> {
  const parts = token.split('.');
  if (parts.length !== 3 || !projectId) return null;
  let header: { alg?: string; kid?: string };
  let claims: Record<string, unknown>;
  try {
    header = decodeJson(parts[0]);
    claims = decodeJson(parts[1]);
  } catch {
    return null;
  }
  if (header.alg !== 'RS256' || !header.kid) return null;
  const jwk = (await publicKeys(fetcher, now)).find((k) => k.kid === header.kid);
  if (!jwk) return null;
  const key = await crypto.subtle.importKey(
    'jwk',
    { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );
  const signed = new TextEncoder().encode(parts[0] + '.' + parts[1]);
  if (!(await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64url(parts[2]), signed))) return null;

  const secs = Math.floor(now / 1000);
  const num = (k: string) => (typeof claims[k] === 'number' ? (claims[k] as number) : NaN);
  if (claims.aud !== projectId || claims.iss !== 'https://securetoken.google.com/' + projectId) return null;
  if (!(num('exp') > secs) || !(num('iat') <= secs + 60) || !(num('auth_time') <= secs + 60)) return null;
  if (secs - num('auth_time') > maxAgeSeconds) return null;
  if (typeof claims.sub !== 'string' || !claims.sub) return null;
  const firebase = (claims.firebase ?? {}) as { sign_in_provider?: string };
  return {
    uid: claims.sub,
    provider: String(firebase.sign_in_provider ?? ''),
    email: typeof claims.email === 'string' ? claims.email.toLowerCase() : null,
    emailVerified: claims.email_verified === true,
    name: typeof claims.name === 'string' ? claims.name : null,
    phone: typeof claims.phone_number === 'string' ? claims.phone_number : null
  };
}

/** "+5554991234567" → "54991234567", como o WhatsApp fica na conta (11 números); outro país → null. */
export function brazilianMobile(e164: string | null): string | null {
  const d = (e164 ?? '').replace(/\D/g, '');
  return d.length === 13 && d.startsWith('55') ? d.slice(2) : null;
}
