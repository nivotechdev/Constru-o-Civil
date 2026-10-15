// Cloudflare Turnstile: confere o token do captcha no servidor.
// L05: obrigatório. Sem TURNSTILE_SECRET o pedido é RECUSADO (antes passava sem captcha) — a não ser que
// CAPTCHA_OPCIONAL=1 esteja nos Secrets, o que só se usa em desenvolvimento local. No staging use a chave de
// teste da Cloudflare (1x0000000000000000000000000000000AA), que sempre aprova.

export function captchaEnabled(): boolean {
  return Boolean(Deno.env.get('TURNSTILE_SECRET')) || Deno.env.get('CAPTCHA_OPCIONAL') !== '1';
}

export async function captchaOk(token: unknown, ip: string): Promise<boolean> {
  const secret = Deno.env.get('TURNSTILE_SECRET');
  if (!secret) {
    if (Deno.env.get('CAPTCHA_OPCIONAL') === '1') return true;
    console.error('[captcha] TURNSTILE_SECRET não configurado: pedido recusado.');
    return false;
  }
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
