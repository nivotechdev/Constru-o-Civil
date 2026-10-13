// X03: notifications on the phone (Web Push). The browser's permission is asked only after the app explains
// what comes (pages/shared/PushPrompt.tsx), and only when the person taps "Ativar". The device's address goes
// to the server (save_push_subscription); the Edge Function `enviar-push` sends each new notice to it,
// following the groups chosen in Configurações › Avisos (F06). Hidden until VITE_VAPID_PUBLIC_KEY is set
// (FEATURES.push); never in the demo.
import { serviceError } from './errors';
import { FEATURES, VAPID_PUBLIC_KEY } from './features';
import { IS_DEMO } from './mode';
import { db, request } from './remote/client';

/** indisponivel: no support or not configured · bloqueado: denied in the browser · desligado · ligado. */
export type PushState = 'indisponivel' | 'bloqueado' | 'desligado' | 'ligado';

interface PushEnv {
  serviceWorker?: ServiceWorkerContainer;
  Notification?: { permission: NotificationPermission; requestPermission: () => Promise<NotificationPermission> };
}

function env(): PushEnv {
  const g = globalThis as unknown as { navigator?: Navigator; Notification?: PushEnv['Notification'] };
  return { serviceWorker: g.navigator?.serviceWorker, Notification: g.Notification };
}

/** The VAPID public key (base64url) as the browser wants it. */
export function vapidKeyBytes(key: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (key.length % 4)) % 4);
  const raw = atob((key + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  const sw = env().serviceWorker;
  if (!sw) return null;
  return (await sw.getRegistration()) ?? null;
}

export async function pushState(): Promise<PushState> {
  const { serviceWorker, Notification } = env();
  if (IS_DEMO || !FEATURES.push || !serviceWorker || !Notification || !('PushManager' in globalThis))
    return 'indisponivel';
  if (Notification.permission === 'denied') return 'bloqueado';
  const sub = await (await registration())?.pushManager.getSubscription();
  return sub && Notification.permission === 'granted' ? 'ligado' : 'desligado';
}

/** Asks the browser (after the explanation), subscribes this device and tells the server. */
export async function enablePush(): Promise<void> {
  const { Notification } = env();
  if ((await pushState()) === 'indisponivel' || !Notification)
    throw serviceError('validacao', 'Este aparelho não recebe notificações do navegador.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted')
    throw serviceError(
      'validacao',
      permission === 'denied'
        ? 'As notificações estão bloqueadas no navegador. Libere nas configurações do site.'
        : 'Sem a permissão, as notificações não chegam no celular.'
    );
  const reg = await registration();
  if (!reg) throw serviceError('validacao', 'Abra o app de novo e tente outra vez.');
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidKeyBytes(VAPID_PUBLIC_KEY) }));
  await saveSubscription(sub);
}

/** Sends the device's address to the server (also after the browser renews it). */
export async function saveSubscription(sub: PushSubscription): Promise<void> {
  const json = sub.toJSON();
  const client = await db();
  await request(() =>
    client.rpc('save_push_subscription', {
      p_endpoint: sub.endpoint,
      p_p256dh: json.keys?.p256dh ?? '',
      p_auth: json.keys?.auth ?? '',
      p_user_agent: (globalThis.navigator?.userAgent ?? '').slice(0, 300) || null
    })
  );
}

/** On every start: if this device receives notices, the server gets its current address. */
export async function syncPushSubscription(): Promise<void> {
  if ((await pushState()) !== 'ligado') return;
  const sub = await (await registration())?.pushManager.getSubscription();
  if (sub) await saveSubscription(sub);
}

/** Stops this device (Configurações, or leaving the account). */
export async function disablePush(): Promise<void> {
  const sub = await (await registration())?.pushManager.getSubscription();
  if (!sub) return;
  try {
    const client = await db();
    await request(() => client.rpc('delete_push_subscription', { p_endpoint: sub.endpoint }));
  } finally {
    await sub.unsubscribe().catch(() => false);
  }
}
