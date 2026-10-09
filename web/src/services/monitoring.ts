// Error reports (X21). In demo mode they only go to the console. In real mode, with VITE_SENTRY_DSN set,
// they are sent to Sentry's store endpoint with no personal data: no e-mail, no names, no URLs with ids.
// Without the DSN nothing leaves the device.
import { IS_DEMO } from './mode';

const DSN = (import.meta.env as ImportMetaEnv).VITE_SENTRY_DSN ?? '';

interface Parsed {
  endpoint: string;
  key: string;
}

function parseDsn(dsn: string): Parsed | null {
  // https://<key>@<host>/<project>
  const m = /^https:\/\/([^@]+)@([^/]+)\/(\d+)$/.exec(dsn.trim());
  return m ? { endpoint: `https://${m[2]}/api/${m[3]}/store/`, key: m[1] } : null;
}

/** The route without ids ("/vaga/:id"), so a report never carries which job or person it was about. */
function scrubbedRoute(): string {
  const hash = typeof location !== 'undefined' ? location.hash.replace(/^#/, '') : '';
  return (
    hash
      .replace(/BC-\d+/g, ':vaga')
      .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ':id')
      .split('?')[0] || '/'
  );
}

let sent = 0;

export function reportError(error: unknown, context: Record<string, string> = {}): void {
  if (IS_DEMO || !DSN) {
    console.error('[bicos]', error, context);
    return;
  }
  const target = parseDsn(DSN);
  if (!target || sent >= 20) return; // a loop of errors doesn't flood the service
  sent++;
  const err = error instanceof Error ? error : new Error(String(error));
  const body = {
    event_id: crypto.randomUUID().replace(/-/g, ''),
    timestamp: new Date().toISOString(),
    platform: 'javascript',
    level: 'error',
    release: 'bicos-web@' + ((import.meta.env as ImportMetaEnv & { VITE_RELEASE?: string }).VITE_RELEASE ?? 'dev'),
    tags: { route: scrubbedRoute(), ...context, componentStack: undefined },
    exception: { values: [{ type: err.name, value: err.message.slice(0, 300), stacktrace: undefined }] },
    extra: { stack: (err.stack ?? '').slice(0, 2000), componentStack: context.componentStack?.slice(0, 1500) }
  };
  void fetch(`${target.endpoint}?sentry_version=7&sentry_key=${target.key}`, {
    method: 'POST',
    body: JSON.stringify(body),
    keepalive: true
  }).catch(() => undefined);
}

/** Uncaught errors and rejected promises anywhere in the app. */
export function installGlobalErrorReporting(): void {
  window.addEventListener('error', (e) => reportError(e.error ?? e.message, { where: 'window' }));
  window.addEventListener('unhandledrejection', (e) => reportError(e.reason, { where: 'promise' }));
}
