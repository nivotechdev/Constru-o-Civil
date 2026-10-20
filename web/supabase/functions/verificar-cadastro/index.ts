// Cadastro: o e-mail, o CPF/CNPJ ou o WhatsApp digitado já é de outra conta? (U10)
//
// A tela de cadastro pergunta no passo em que o dado é digitado, em vez de só descobrir no fim, ao criar a conta.
// Conta só a conta CONFIRMADA (um cadastro nunca confirmado é liberado pelo banco quando outro usa o mesmo dado).
// Para ninguém usar isto para varrer quem tem conta: limite de 30 perguntas por IP e de 10 por valor a cada
// 15 minutos (as mesmas tabelas do entrar-com-documento), e a resposta é só sim ou não.
//
// Pedido: { campo: 'email' | 'documento' | 'whatsapp', valor }.
// Respostas: 200 { disponivel } · 400 { erro: 'campo' } · 429 { erro: 'muitas-tentativas' } · 405/502 { erro }.
// Publicar: supabase functions deploy verificar-cadastro (ver web/docs/SUPABASE.md).
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

    let body: { campo?: unknown; valor?: unknown };
    try {
      body = await req.json();
    } catch {
      return json({ erro: 'campo' }, 400);
    }
    const campo = String(body.campo ?? '');
    const valor = CAMPOS.has(campo) ? normalizado(campo, String(body.valor ?? '')) : null;
    if (!valor) return json({ erro: 'campo' }, 400);

    const admin = adminClient();
    const limits = await Promise.all([
      admin.rpc('rate_limit_hit', { p_key: 'cadastro-ip:' + clientIp(req), p_max: 30, p_window: '15 minutes' }),
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
