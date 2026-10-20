// Entrar com o Google ou com o celular (U28). O Firebase Authentication faz a parte difícil no navegador — a janela do
// Google, o código por SMS e o reCAPTCHA contra robôs — e entrega um ID token. Esta função confere o token
// (_shared/firebase.ts) e abre a sessão da Bicos no Supabase Auth, onde ficam as contas:
//   * Google (e-mail confirmado pelo Google): entra na conta desse e-mail; sem conta, cria o login (provedor
//     "google") e o app segue pelo cadastro normal, sem o passo do e-mail nem a confirmação dele (U37);
//   * celular: entra na conta cujo WhatsApp é esse número (o SMS prova que a pessoa tem o número, e o WhatsApp da
//     conta fica marcado como confirmado). Sem conta com o número, não cria nada: 404 { erro: 'sem-conta' } e o app
//     oferece criar a conta com esse número.
// A sessão sai de um link de acesso gerado aqui (nada é enviado por e-mail): o app troca o `token_hash` pela sessão
// com verifyOtp. Limite de 20 tentativas por IP a cada 15 minutos.
//
// Pedido: { idToken }. Respostas: 200 { token_hash, novo } · 400 { erro: 'token' } · 401 { erro: 'token-invalido' }
// · 404 { erro: 'sem-conta' } · 429 { erro: 'muitas-tentativas' } · 503 { erro: 'desligado' } · 405/502 { erro }.
// Segredo: FIREBASE_PROJECT_ID (o "projectId" do Firebase; sem ele a função responde 503).
// Publicar: supabase functions deploy entrar-com-firebase (ver web/docs/SUPABASE.md).
import { brazilianMobile, verifyFirebaseToken } from '../_shared/firebase.ts';
import { adminClient, clientIp, json, preflight, requireAppOrigin } from '../_shared/http.ts';
import { monitored } from '../_shared/monitoring.ts';

// Chamada pelo navegador — sem APP_ORIGIN a função não sobe.
requireAppOrigin();

const PROJECT = Deno.env.get('FIREBASE_PROJECT_ID') ?? '';

Deno.serve(
  monitored('entrar-com-firebase', async (req) => {
    if (req.method === 'OPTIONS') return preflight(req);
    if (req.method !== 'POST') return json({ erro: 'metodo' }, 405);
    if (!PROJECT) return json({ erro: 'desligado' }, 503);

    let body: { idToken?: unknown };
    try {
      body = await req.json();
    } catch {
      return json({ erro: 'token' }, 400);
    }
    const token = typeof body.idToken === 'string' ? body.idToken : '';
    if (!token || token.length > 4096) return json({ erro: 'token' }, 400);

    const admin = adminClient();
    const limit = await admin.rpc('rate_limit_hit', {
      p_key: 'firebase-ip:' + clientIp(req),
      p_max: 20,
      p_window: '15 minutes'
    });
    if (limit.error) return json({ erro: 'falha' }, 502);
    if (limit.data === true) return json({ erro: 'muitas-tentativas' }, 429);

    let who;
    try {
      who = await verifyFirebaseToken(token, PROJECT);
    } catch {
      return json({ erro: 'falha' }, 502);
    }
    if (!who) return json({ erro: 'token-invalido' }, 401);

    let email: string;
    let novo = false;
    if (who.provider === 'phone') {
      const phone = brazilianMobile(who.phone);
      if (!phone) return json({ erro: 'sem-conta' }, 404);
      const { data, error } = await admin
        .from('accounts')
        .select('id, email')
        .eq('whatsapp', phone)
        .not('email_confirmed_at', 'is', null)
        .maybeSingle();
      if (error) return json({ erro: 'falha' }, 502);
      if (!data) return json({ erro: 'sem-conta' }, 404);
      email = data.email;
      // O SMS acabou de provar que o número é da pessoa.
      await admin.from('accounts').update({ whatsapp_verified_at: new Date().toISOString() }).eq('id', data.id);
    } else if (who.provider === 'google.com' && who.email && who.emailVerified) {
      email = who.email;
      const { data, error } = await admin.from('accounts').select('id').eq('email', email).maybeSingle();
      if (error) return json({ erro: 'falha' }, 502);
      if (!data) {
        // Sem conta na Bicos: o login nasce como conta do Google (o app pede o resto em "Completar cadastro").
        const created = await admin.auth.admin.createUser({
          email,
          email_confirm: true,
          app_metadata: { provider: 'google', providers: ['google'], via: 'firebase' },
          user_metadata: who.name ? { full_name: who.name, name: who.name } : {}
        });
        // Já existe login com esse e-mail (cadastro começado): o Google confirmou o e-mail, entra nele.
        if (created.error && !/registered|exists/i.test(created.error.message)) return json({ erro: 'falha' }, 502);
        novo = !created.error;
      }
    } else {
      return json({ erro: 'token-invalido' }, 401);
    }

    const link = await admin.auth.admin.generateLink({ type: 'magiclink', email });
    const hash = link.data?.properties?.hashed_token;
    if (link.error || !hash) return json({ erro: 'falha' }, 502);
    return json({ token_hash: hash, novo });
  })
);
