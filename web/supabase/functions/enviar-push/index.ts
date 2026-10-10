// Notificação no celular (X03, Web Push com VAPID). Chamada pelo banco a cada aviso novo (gatilho
// push_new_notification, via pg_net) com o segredo `x-webhook-secret` — por isso é publicada sem conferir JWT
// (`--no-verify-jwt`) e confere o segredo.
//
// Corpo: { record: { id, worker_id, company_id, kind, title, body, target } }. Manda para cada aparelho da
// conta, se o grupo do aviso está entre os que a pessoa escolheu (notification_prefs.push_groups; sem linha,
// todos). Aparelho que o navegador diz que não existe mais (404/410) é apagado.
//
// Segredos: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:…), PUSH_WEBHOOK_SECRET (o mesmo
// guardado no Vault como bicos_push_secret). Sem as chaves VAPID: 503 e nada é enviado.
//
// Respostas: 200 { enviados, removidos } · 401 { erro: 'segredo' } · 400 { erro: 'corpo' } · 503.
import webpush from 'npm:web-push@3.6.7';
import { adminClient, json } from '../_shared/http.ts';
import { monitored } from '../_shared/monitoring.ts';

const PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
const PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
const SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:nivotech.dev@gmail.com';
const SECRET = Deno.env.get('PUSH_WEBHOOK_SECRET') ?? '';

// Mesmos grupos de notification_group() no banco (F06).
function group(kind: string): string {
  if (['bico_novo', 'bico_urgente', 'convite'].includes(kind)) return 'bicos_novos';
  if (['confirmar_presenca', 'avaliar_diaria', 'avaliar_trabalhador'].includes(kind)) return 'lembretes';
  if (['verificacao', 'impulsionamento'].includes(kind)) return 'conta';
  return 'candidaturas';
}

/** Comparação em tempo constante (o segredo não vaza pelo tempo de resposta). */
function same(a: string, b: string): boolean {
  if (!a || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

interface NoticeRecord {
  id: string;
  worker_id: string | null;
  company_id: string | null;
  kind: string;
  title: string;
  body: string;
  target: string | null;
}

Deno.serve(
  monitored('enviar-push', async (req) => {
    if (req.method !== 'POST') return json({ erro: 'metodo' }, 405);
    if (!SECRET || !same(req.headers.get('x-webhook-secret') ?? '', SECRET)) return json({ erro: 'segredo' }, 401);
    if (!PUBLIC || !PRIVATE) return json({ erro: 'push-desligado' }, 503);

    let record: NoticeRecord;
    try {
      record = ((await req.json()) as { record: NoticeRecord }).record;
      if (!record?.id || !record.title) throw new Error();
    } catch {
      return json({ erro: 'corpo' }, 400);
    }
    const account = record.worker_id ?? record.company_id;
    if (!account) return json({ enviados: 0, removidos: 0 });

    const admin = adminClient();
    const [{ data: prefs }, { data: subs }] = await Promise.all([
      admin.from('notification_prefs').select('push_groups').eq('account_id', account).maybeSingle(),
      admin.from('push_subscriptions').select('endpoint, p256dh, auth').eq('account_id', account)
    ]);
    const groups: string[] = prefs?.push_groups ?? ['candidaturas', 'lembretes', 'bicos_novos', 'conta'];
    if (!groups.includes(group(record.kind)) || !subs?.length) return json({ enviados: 0, removidos: 0 });

    webpush.setVapidDetails(SUBJECT, PUBLIC, PRIVATE);
    // Sem dados pessoais além do que o próprio aviso já mostra no sino.
    const payload = JSON.stringify({
      title: record.title,
      body: record.body,
      url: record.target ?? '/',
      tag: record.id
    });
    let sent = 0;
    const gone: string[] = [];
    await Promise.all(
      subs.map(async (s: { endpoint: string; p256dh: string; auth: string }) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, {
            TTL: 60 * 60 * 24,
            urgency: group(record.kind) === 'candidaturas' ? 'high' : 'normal'
          });
          sent++;
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) gone.push(s.endpoint);
        }
      })
    );
    if (gone.length) await admin.from('push_subscriptions').delete().in('endpoint', gone);
    // Os que sobraram (os mortos já saíram) foram usados agora.
    if (sent)
      await admin
        .from('push_subscriptions')
        .update({ last_used_at: new Date().toISOString() })
        .eq('account_id', account);
    return json({ enviados: sent, removidos: gone.length });
  })
);
