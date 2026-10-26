// Cadastro: o e-mail, o CPF/CNPJ ou o WhatsApp digitado já é de outra conta? (U10)
//
// A tela de cadastro pergunta no passo em que o dado é digitado, em vez de só descobrir no fim, ao criar a conta.
// Conta só a conta CONFIRMADA (um cadastro nunca confirmado é liberado pelo banco quando outro usa o mesmo dado).
// Para ninguém usar isto para varrer quem tem conta: limite de 30 perguntas por IP e de 10 por valor a cada
// 15 minutos (as mesmas tabelas do entrar-com-documento), e a resposta é só sim ou não.
//
// Pedido: { campo: 'email' | 'documento' | 'whatsapp', valor }.
// X32: quem passa de 12 perguntas por IP em 15 minutos precisa do captcha (Turnstile) em cada uma: quem digita o
// cadastro pergunta 2 ou 3 vezes; uma varredura de CPFs ou e-mails não passa do desafio.
//
// Respostas: 200 { disponivel } · 400 { erro: 'campo' | 'captcha' } · 429 { erro: 'muitas-tentativas' } · 405/502 { erro }.
// Publicar: supabase functions deploy verificar-cadastro (ver web/docs/SUPABASE.md).
import { captchaOk } from '../_shared/captcha.ts';
import { adminClient, clientIp, json, preflight, requireAppOrigin } from '../_shared/http.ts';
import { monitored } from '../_shared/monitoring.ts';

// Chamada pelo navegador — sem APP_ORIGIN a função não sobe.
requireAppOrigin();

const CAMPOS = new Set(['email', 'documento', 'whatsapp']);

async function sha256Hex(text: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** O valor como o banco guarda: e-mail em minúsculas; documento e telefone só com os números. */
function normalizado(campo: string, valor: string): string | null {
  if (campo === 'email') {
    const v = valor.trim().toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 254 ? v : null;
  }
  const d = valor.replace(/\D/g, '');
  if (campo === 'documento') return d.length === 11 || d.length === 14 ? d : null;
  return d.length === 11 ? d : null;
}

Deno.serve(
  monitored('verificar-cadastro', async (req) => {
    if (req.method === 'OPTIONS') return preflight(req);
    if (req.method !== 'POST') return json({ erro: 'metodo' }, 405);

    let body: { campo?: unknown; valor?: unknown; captchaToken?: unknown };
    try {
      body = await req.json();
    } catch {
      return json({ erro: 'campo' }, 400);
    }
    const campo = String(body.campo ?? '');
    const valor = CAMPOS.has(campo) ? normalizado(campo, String(body.valor ?? '')) : null;
    if (!valor) return json({ erro: 'campo' }, 400);

    const admin = adminClient();
    const ip = clientIp(req);
    const challenge = await admin.rpc('rate_limit_hit', {
      p_key: 'cadastro-desafio-ip:' + ip,
      p_max: 12,
      p_window: '15 minutes'
    });
    if (challenge.error) return json({ erro: 'falha' }, 502);
    if (challenge.data === true && !(await captchaOk(body.captchaToken, ip)))
      return json({ erro: 'captcha', mensagem: 'Confirme que você não é um robô e tente de novo.' }, 400);
    const limits = await Promise.all([
      admin.rpc('rate_limit_hit', { p_key: 'cadastro-ip:' + ip, p_max: 30, p_window: '15 minutes' }),
      admin.rpc('rate_limit_hit', {
        p_key: 'cadastro:' + (await sha256Hex(campo + ':' + valor)),
        p_max: 10,
        p_window: '15 minutes'
      })
    ]);
    if (limits.some((r) => r.error)) return json({ erro: 'falha' }, 502);
    if (limits.some((r) => r.data === true)) return json({ erro: 'muitas-tentativas' }, 429);

    const { data, error } = await admin.rpc('signup_taken', { p_kind: campo, p_value: valor });
    if (error) return json({ erro: 'falha' }, 502);
    return json({ disponivel: data !== true });
  })
);
