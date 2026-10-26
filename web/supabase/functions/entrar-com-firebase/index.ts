// Entrar com o Google ou com o celular (U28). O Firebase Authentication faz a parte difícil no navegador — a janela do
// Google, o código por SMS e o reCAPTCHA contra robôs — e entrega um ID token. Esta função confere o token
// (_shared/firebase.ts) e abre a sessão da Bicos no Supabase Auth, onde ficam as contas:
//   * Google (e-mail confirmado pelo Google): entra na conta desse e-mail (U64: mesmo a que o cadastro por e-mail deixou
//     sem confirmar — o Google prova o e-mail, ele passa a ficar confirmado e a senha antiga deixa de valer, X31); sem
//     conta, cria o login (provedor "google") e o app segue pelo cadastro normal, sem o passo do e-mail nem a
//     confirmação dele (U37);
//   * celular: entra na conta cujo WhatsApp é esse número (o SMS prova que a pessoa tem o número, e o WhatsApp da
//     conta fica marcado como confirmado). Sem conta com o número, não cria nada: 404 { erro: 'sem-conta' } e o app
//     oferece criar a conta com esse número.
// A sessão sai de um link de acesso gerado aqui (nada é enviado por e-mail): o app troca o `token_hash` pela sessão
// com verifyOtp. Limite de 20 tentativas por IP a cada 15 minutos.
// U46: `conta` diz se o e-mail já tem conta na Bicos — sem ela, o app vai direto para o cadastro, sem ler a conta
// que não existe. E `{ aquecer: true }` (mandado quando abre uma tela com o botão do Google) só "acorda" a função e
// busca as chaves do Firebase, para o toque de verdade não esperar a função subir.
//
// Pedido: { idToken } (ou { aquecer: true } → 204). Respostas: 200 { token_hash, novo, conta } · 400 { erro: 'token' }
// · 401 { erro: 'token-invalido' } · 404 { erro: 'sem-conta' } · 429 { erro: 'muitas-tentativas' }
// · 503 { erro: 'desligado' } · 405/502 { erro }.
// Segredo: FIREBASE_PROJECT_ID (o "projectId" do Firebase; sem ele a função responde 503).
// Publicar: supabase functions deploy entrar-com-firebase (ver web/docs/SUPABASE.md).
import { confirmProvenEmail } from '../_shared/confirm.ts';
import { brazilianMobile, verifyFirebaseToken, warmFirebaseKeys } from '../_shared/firebase.ts';
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

    let body: { idToken?: unknown; aquecer?: unknown };
    try {
      body = await req.json();
    } catch {
      return json({ erro: 'token' }, 400);
    }
    // U46: só acordar (não conta no limite: não lê nem cria nada).
    if (body.aquecer === true) {
      await warmFirebaseKeys();
      return new Response(null, { status: 204 });
    }
    const token = typeof body.idToken === 'string' ? body.idToken : '';
    if (!token || token.length > 4096) return json({ erro: 'token' }, 400);

    // U46: o limite e a conferência do token ao mesmo tempo (a resposta continua na mesma ordem).
    const admin = adminClient();
    const [limit, checked] = await Promise.all([
      admin.rpc('rate_limit_hit', {
        p_key: 'firebase-ip:' + clientIp(req),
        p_max: 20,
        p_window: '15 minutes'
      }),
      verifyFirebaseToken(token, PROJECT).then(
        (who) => ({ who }),
        () => null
      )
    ]);
    if (limit.error) return json({ erro: 'falha' }, 502);
    if (limit.data === true) return json({ erro: 'muitas-tentativas' }, 429);
    if (!checked) return json({ erro: 'falha' }, 502);
    const { who } = checked;
    if (!who) return json({ erro: 'token-invalido' }, 401);

    let email: string;
    let novo = false;
    let conta = true;
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
      conta = Boolean(data);
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

    let link = await admin.auth.admin.generateLink({ type: 'magiclink', email });
    // U64: a login whose e-mail was never confirmed (sign-up by e-mail and the link not yet clicked) gets a link of
    // another kind, which the app's verifyOtp('magiclink') refuses — the person saw an error entering with Google on
    // the e-mail of their own account. Google (or the SMS) just proved the person owns it: confirm it, then link again.
    // X31: the password that login had stops working (whoever started that sign-up may not be this person).
    const user = link.data?.user;
    if (!link.error && user && !user.email_confirmed_at) {
      const confirmed = await confirmProvenEmail(
        (id, attributes) => admin.auth.admin.updateUserById(id, attributes),
        user.id
      );
      if (!confirmed) return json({ erro: 'falha' }, 502);
      link = await admin.auth.admin.generateLink({ type: 'magiclink', email });
    }
    const hash = link.data?.properties?.hashed_token;
    if (link.error || !hash) return json({ erro: 'falha' }, 502);
    return json({ token_hash: hash, novo, conta });
  })
);
