// Entrar com CPF/CNPJ e senha (tela de login: "E-mail, CPF ou CNPJ").
//
// O Supabase Auth só entra por e-mail. Para não revelar a ninguém o e-mail de um CPF/CNPJ, quem faz a
// troca é esta função, no servidor: acha a conta pelo hash do documento (o mesmo do app antigo), tenta
// a senha e devolve só a sessão — ou por que não deu. O navegador nunca vê o e-mail de outra pessoa.
//
// Respostas: 200 { access_token, refresh_token } · 401 { erro: 'conta-inexistente' | 'senha-errada' |
// 'email-nao-confirmado', email? } · 400/405/502 { erro }.
// Publicar: supabase functions deploy entrar-com-documento (ver web/docs/SUPABASE.md).
import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

async function sha256Hex(text: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ erro: 'metodo' }, 405);

  let body: { documento?: unknown; senha?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ erro: 'pedido-invalido' }, 400);
  }
  const documento = String(body.documento ?? '').replace(/\D/g, '');
  const senha = String(body.senha ?? '');
  if ((documento.length !== 11 && documento.length !== 14) || !senha) return json({ erro: 'conta-inexistente' }, 401);

  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  // A conta do app novo; se não houver, o perfil do app antigo (o hash do documento é o mesmo).
  const hash = await sha256Hex(documento);
  const { data: account } = await admin.from('accounts').select('email').eq('document_hash', hash).maybeSingle();
  let email: string | null = account?.email ?? null;
  if (!email) {
    const { data: profile } = await admin.from('profiles').select('email').eq('documento_hash', hash).maybeSingle();
    email = profile?.email ?? null;
  }
  if (!email) return json({ erro: 'conta-inexistente' }, 401);

  const auth = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await auth.auth.signInWithPassword({ email, password: senha });
  if (error) {
    // Quem acertou a senha pode saber para qual e-mail o link de confirmação foi.
    if (error.code === 'email_not_confirmed') return json({ erro: 'email-nao-confirmado', email }, 401);
    if (error.code === 'invalid_credentials') return json({ erro: 'senha-errada' }, 401);
    return json({ erro: 'falha' }, 502);
  }
  return json({ access_token: data.session?.access_token, refresh_token: data.session?.refresh_token });
});
