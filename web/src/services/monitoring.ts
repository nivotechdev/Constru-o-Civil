// Error reports (X21, L05). In demo mode they only go to the console. In real mode, with VITE_SENTRY_DSN
// set, they are sent to Sentry's store endpoint (no SDK: nothing to download on a slow phone) after
// `beforeSend` takes out anything personal: e-mail, CPF/CNPJ, phone, tokens and ids. The release is the
// commit (VITE_RELEASE, set by vite.config.ts), so the hidden source maps uploaded by the deploy turn the
// stack back into source lines. Without the DSN nothing leaves the device.
import { IS_DEMO } from './mode';
import { currentPath } from './router';

const env: ImportMetaEnv = import.meta.env;
const DSN = env.VITE_SENTRY_DSN ?? '';
// Read directly (not through `env`) so vite.config.ts can put the commit in at build time.
export const RELEASE = 'bicos-web@' + (import.meta.env.VITE_RELEASE || 'dev');
const ENVIRONMENT = env.VITE_SENTRY_ENVIRONMENT || 'production';

export interface SentryFrame {
  filename: string;
  function: string;
  lineno?: number;
  colno?: number;
  in_app: boolean;
}

export interface SentryEvent {
  event_id: string;
  timestamp: string;
  platform: 'javascript';
  level: 'error';
  release: string;
  environment: string;
  tags: Record<string, string>;
  exception: { values: { type: string; value: string; stacktrace?: { frames: SentryFrame[] } }[] };
  extra: Record<string, string>;
}

interface Parsed {
  endpoint: string;
  key: string;
}

function parseDsn(dsn: string): Parsed | null {
  // https://<key>@<host>/<project>
  const m = /^https:\/\/([^@]+)@([^/]+)\/(\d+)$/.exec(dsn.trim());
  return m ? { endpoint: `https://${m[2]}/api/${m[3]}/store/`, key: m[1] } : null;
}

// What never leaves the device, in the order it is replaced (tokens before the digit rules eat them).
const PERSONAL: [RegExp, string][] = [
  [/eyJ[\w-]+\.[\w-]+\.[\w-]*/g, '<token>'],
  [
    /\b(bearer|access_token|refresh_token|token|apikey|captchaToken|code|senha|password)(["']?\s*[=:]\s*["']?|\s+)[^\s"'&,;]{6,}/gi,
    '$1$2<token>'
  ],
  [/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '<email>'],
  [/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, '<cnpj>'],
  [/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '<cpf>'],
  [/(\+?55[\s-]?)?\(?\b\d{2}\)?[\s-]?9?\d{4}[\s-]?\d{4}\b/g, '<telefone>'],
  [/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id'],
  [/BC-\d+/g, ':vaga'],
  [/\d{8,}/g, '<numero>']
];

/** A text with every personal piece replaced by a placeholder. */
export function scrubText(text: string): string {
  return PERSONAL.reduce((out, [re, by]) => out.replace(re, by), text);
}

/**
 * The last step before an event goes out (Sentry's `beforeSend`): every text is scrubbed, except the
 * stack frames' file names and positions — those are the app's own script addresses, which the source
 * maps need untouched (their query strings go, though).
 */
export function beforeSend(event: SentryEvent): SentryEvent {
  return {
    ...event,
    tags: Object.fromEntries(Object.entries(event.tags).map(([k, v]) => [k, scrubText(v)])),
    extra: Object.fromEntries(Object.entries(event.extra).map(([k, v]) => [k, scrubText(v)])),
    exception: {
      values: event.exception.values.map((v) => ({
        type: scrubText(v.type),
        value: scrubText(v.value),
        stacktrace: v.stacktrace && {
          frames: v.stacktrace.frames.map((f) => ({
            ...f,
            filename: f.filename.split(/[?#]/)[0],
            function: scrubText(f.function)
          }))
        }
      }))
    }
  };
}

/** Chrome ("at fn (url:1:2)") and Firefox/Safari ("fn@url:1:2") stacks, oldest call first as Sentry wants. */
export function parseStack(stack: string): SentryFrame[] {
  const frames: SentryFrame[] = [];
  for (const line of stack.split('\n')) {
    const m =
      /^\s*at (?:(.+?) \()?((?:https?|file|blob):.+?):(\d+):(\d+)\)?\s*$/.exec(line) ??
      /^\s*(.*?)@((?:https?|file|blob):.+?):(\d+):(\d+)\s*$/.exec(line);
    if (!m) continue;
    frames.push({
      function: m[1] || '?',
      filename: m[2],
      lineno: Number(m[3]),
      colno: Number(m[4]),
      in_app: !/\/node_modules\//.test(m[2])
    });
  }
  return frames.reverse().slice(-50);
}

/** The route without ids ("/vaga/:id"), so a report never carries which job or person it was about. */
function scrubbedRoute(): string {
  const path = typeof location !== 'undefined' ? currentPath() : '';
  return scrubText(path.split('?')[0]) || '/';
}

/** The event for an error, before `beforeSend`. */
export function buildEvent(error: unknown, context: Record<string, string> = {}): SentryEvent {
  const err = error instanceof Error ? error : new Error(String(error));
  const { componentStack, ...tags } = context;
  const frames = parseStack(err.stack ?? '');
  return {
    event_id: crypto.randomUUID().replace(/-/g, ''),
    timestamp: new Date().toISOString(),
    platform: 'javascript',
    level: 'error',
    release: RELEASE,
    environment: ENVIRONMENT,
    tags: { route: scrubbedRoute(), ...tags },
    exception: {
      values: [{ type: err.name, value: err.message.slice(0, 300), stacktrace: frames.length ? { frames } : undefined }]
    },
    extra: {
      ...(frames.length ? {} : { stack: (err.stack ?? '').slice(0, 2000) }),
      ...(componentStack ? { componentStack: componentStack.slice(0, 1500) } : {})
    }
  };
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
  const body = beforeSend(buildEvent(error, context));
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
