// Hash do que a pessoa digitou (CPF/CNPJ, e-mail…) para chaves de limite de taxa (AUD-019). Com o segredo
// RATE_LIMIT_PEPPER é HMAC-SHA256: uma cópia de `auth_attempts` não vira lista de documentos por força bruta. Sem o
// segredo, SHA-256 puro (como era). Funciona no Deno e no Node (WebCrypto).
const hex = (bytes: ArrayBuffer) => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');

export async function keyedHash(text: string, secret: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  if (!secret) return hex(await crypto.subtle.digest('SHA-256', data));
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return hex(await crypto.subtle.sign('HMAC', key, data));
}
