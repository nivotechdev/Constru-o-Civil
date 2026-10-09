// Cloudflare Turnstile: confere o token do captcha no servidor. Sem TURNSTILE_SECRET configurado o
// captcha está desligado (o app também não mostra o desafio: VITE_TURNSTILE_SITE_KEY vazio).

export function captchaEnabled(): boolean {
  return Boolean(Deno.env.get('TURNSTILE_SECRET'));
}

export async function captchaOk(token: unknown, ip: string): Promise<boolean> {
  const secret = Deno.env.get('TURNSTILE_SECRET');
  if (!secret) return true;
  if (typeof token !== 'string' || !token) return false;
  const form = new FormData();
  form.append('secret', secret);
  form.append('response', token);
  if (ip && ip !== 'desconhecido') form.append('remoteip', ip);
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: form
    });
    const body = (await res.json()) as { success?: boolean };
    return body.success === true;
  } catch {
    return false;
  }
}
