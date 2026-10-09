// Código de confirmação do WhatsApp (Y25; também o passo do cadastro) pelo Twilio Verify.
//
// { acao: 'enviar', telefone, captchaToken? } manda o código (canal TWILIO_VERIFY_CHANNEL: 'whatsapp',
// padrão, ou 'sms'). { acao: 'conferir', telefone, codigo } confere; aprovado, o número fica confirmado por
// 30 minutos (mark_whatsapp_verified): a conta nova nasce confirmada, e change_whatsapp troca já confirmado.
// Com sessão, marca na hora a conta do usuário se o número dela for esse.
//
// Limites: enviar 3 por número e 10 por IP a cada hora; conferir 8 por número a cada 15 minutos.
// Sem TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_VERIFY_SID: 503 e o app pula o passo do código
// (VITE_CODIGO_WHATSAPP desligado).
//
// Respostas: 200 { ok: true } · 200 { ok: false } (código errado) · 400 { erro: 'captcha' | 'telefone' } ·
// 429 { erro: 'muitas-tentativas' } · 503 { erro: 'codigo-desligado' } · 502 { erro: 'falha' }.
import { captchaOk } from '../_shared/captcha.ts';
import { adminClient, clientIp, CORS, json, requestUser } from '../_shared/http.ts';

const SID = Deno.env.get('TWILIO_ACCOUNT_SID') ?? '';
const TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN') ?? '';
const SERVICE = Deno.env.get('TWILIO_VERIFY_SID') ?? '';
const CHANNEL = Deno.env.get('TWILIO_VERIFY_CHANNEL') === 'sms' ? 'sms' : 'whatsapp';

async function twilio(path: string, form: Record<string, string>): Promise<{ status?: string } | null> {
  const res = await fetch(`https://verify.twilio.com/v2/Services/${SERVICE}/${path}`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + btoa(`${SID}:${TOKEN}`),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams(form)
  });
  // 404 na conferência = código vencido ou já usado.
  if (res.status === 404) return { status: 'expired' };
  if (!res.ok) return null;
  return (await res.json()) as { status?: string };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ erro: 'metodo' }, 405);
  if (!SID || !TOKEN || !SERVICE)
    return json({ erro: 'codigo-desligado', mensagem: 'A confirmação por código ainda não está disponível.' }, 503);

  let body: { acao?: string; telefone?: string; codigo?: string; captchaToken?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ erro: 'telefone' }, 400);
  }
  const phone = String(body.telefone ?? '').replace(/\D/g, '');
  if (!/^[1-9][1-9]9\d{8}$/.test(phone))
    return json({ erro: 'telefone', mensagem: 'Confira o número: celular com DDD, 11 números.' }, 400);
  const ip = clientIp(req);
  const admin = adminClient();
  const hit = (key: string, max: number, window: string) =>
    admin.rpc('rate_limit_hit', { p_key: key, p_max: max, p_window: window });

  if (body.acao === 'enviar') {
    if (!(await captchaOk(body.captchaToken, ip))) return json({ erro: 'captcha' }, 400);
    const limits = await Promise.all([hit('zap:' + phone, 3, '1 hour'), hit('zap-ip:' + ip, 10, '1 hour')]);
    if (limits.some((r) => r.error)) return json({ erro: 'falha' }, 502);
    if (limits.some((r) => r.data === true))
      return json({ erro: 'muitas-tentativas', mensagem: 'Muitos códigos pedidos. Espere uma hora e tente de novo.' }, 429);
    const sent = await twilio('Verifications', { To: '+55' + phone, Channel: CHANNEL, Locale: 'pt-BR' });
    return sent ? json({ ok: true }) : json({ erro: 'falha' }, 502);
  }

  if (body.acao === 'conferir') {
    const code = String(body.codigo ?? '');
    if (!/^\d{4,8}$/.test(code)) return json({ ok: false });
    const limit = await hit('zap-conferir:' + phone, 8, '15 minutes');
    if (limit.error) return json({ erro: 'falha' }, 502);
    if (limit.data === true)
      return json({ erro: 'muitas-tentativas', mensagem: 'Muitas tentativas. Peça um código novo daqui a pouco.' }, 429);
    const check = await twilio('VerificationCheck', { To: '+55' + phone, Code: code });
    if (!check) return json({ erro: 'falha' }, 502);
    if (check.status !== 'approved') return json({ ok: false });
    const user = await requestUser(req);
    const { error } = await admin.rpc('mark_whatsapp_verified', { p_phone: phone, p_user: user?.id ?? null });
    return error ? json({ erro: 'falha' }, 502) : json({ ok: true });
  }

  return json({ erro: 'acao' }, 400);
});
