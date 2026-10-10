// Entrar com CPF/CNPJ e senha (tela de login: "E-mail, CPF ou CNPJ").
//
// O Supabase Auth só entra por e-mail. Esta função acha a conta pelo hash do documento, confere a senha
// no banco (document_login_email) e só então devolve o e-mail da própria conta; o navegador entra com
// e-mail e senha normalmente (do IP de quem está entrando, com os limites do Auth para cada pessoa).
// Z07: uma resposta só para "não existe" e "senha errada"; captcha (Turnstile, quando configurado);
// limite de 5 tentativas por documento e 20 por IP a cada 15 minutos.
//
// Respostas: 200 { email } · 401 { erro: 'credenciais' } · 400 { erro: 'captcha' } ·
// 429 { erro: 'muitas-tentativas' } · 405/502 { erro }.
// Publicar: supabase functions deploy entrar-com-documento (ver web/docs/SUPABASE.md).
import { captchaOk } from '../_shared/captcha.ts';
import { adminClient, clientIp, CORS, json } from '../_shared/http.ts';
import { monitored } from '../_shared/monitoring.ts';

async function sha256Hex(text: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(
  monitored('entrar-com-documento', async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    if (req.method !== 'POST') return json({ erro: 'metodo' }, 405);

    let body: { documento?: unknown; senha?: unknown; captchaToken?: unknown };
    try {
      body = await req.json();
    } catch {
      return json({ erro: 'credenciais' }, 401);
    }
    const ip = clientIp(req);
    if (!(await captchaOk(body.captchaToken, ip))) return json({ erro: 'captcha' }, 400);

    const documento = String(body.documento ?? '').replace(/\D/g, '');
    const senha = String(body.senha ?? '');
    const admin = adminClient();

    // Conta cada tentativa (mesmo as inválidas) por IP e por documento.
    const limits = await Promise.all([
      admin.rpc('rate_limit_hit', { p_key: 'ip:' + ip, p_max: 20, p_window: '15 minutes' }),
      admin.rpc('rate_limit_hit', { p_key: 'doc:' + (await sha256Hex(documento)), p_max: 5, p_window: '15 minutes' })
    ]);
    if (limits.some((r) => r.error)) return json({ erro: 'falha' }, 502);
    if (limits.some((r) => r.data === true)) return json({ erro: 'muitas-tentativas' }, 429);

    if ((documento.length !== 11 && documento.length !== 14) || !senha) return json({ erro: 'credenciais' }, 401);
    const { data: email, error } = await admin.rpc('document_login_email', {
      p_document: documento,
      p_password: senha
    });
    if (error) return json({ erro: 'falha' }, 502);
    if (!email) return json({ erro: 'credenciais' }, 401);
    return json({ email });
  })
);
