// Erros das Edge Functions (X21): sem SENTRY_DSN nos Secrets, só vão para o log da função (painel ›
// Edge Functions › Logs). Com ele, vão também para o Sentry — sem dados pessoais: nome da função, tipo e
// mensagem do erro e a pilha; nunca o corpo do pedido, cabeçalhos, e-mail, documento ou telefone.
import { json, withCors } from './http.ts';

const DSN = Deno.env.get('SENTRY_DSN') ?? '';
const RELEASE = Deno.env.get('RELEASE') ?? 'dev';

function target(): { endpoint: string; key: string } | null {
  const m = /^https:\/\/([^@]+)@([^/]+)\/(\d+)$/.exec(DSN.trim());
  return m ? { endpoint: `https://${m[2]}/api/${m[3]}/store/`, key: m[1] } : null;
}

/** Tokens, e-mails e números longos (CPF, CNPJ, telefone, ids) saem da mensagem antes de ir para fora. */
const scrub = (text: string) =>
  text
    .replace(/eyJ[\w-]+\.[\w-]+\.[\w-]*/g, '<token>') // L05: JWT
    .replace(/\b(bearer|token|secret|senha|password|apikey)(["']?\s*[=:]\s*["']?|\s+)[^\s"'&,;]{6,}/gi, '$1$2<token>')
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '<email>')
    .replace(/\d[\d.\-/ ]{6,}\d/g, '<numero>');

export async function reportError(fn: string, error: unknown): Promise<void> {
  const err = error instanceof Error ? error : new Error(String(error));
  console.error(`[${fn}]`, err);
  const t = target();
  if (!t) return;
  await fetch(`${t.endpoint}?sentry_version=7&sentry_key=${t.key}`, {
    method: 'POST',
    body: JSON.stringify({
      event_id: crypto.randomUUID().replace(/-/g, ''),
      timestamp: new Date().toISOString(),
      platform: 'javascript',
      level: 'error',
      release: 'bicos-functions@' + RELEASE,
      tags: { function: fn },
      exception: { values: [{ type: err.name, value: scrub(err.message).slice(0, 300) }] },
      extra: { stack: scrub(err.stack ?? '').slice(0, 2000) }
    })
  }).catch(() => undefined);
}

/** Envolve o handler: um erro não tratado vira 500 { erro: 'falha' } e é registrado. */
export function monitored(
  fn: string,
  handler: (req: Request) => Promise<Response>
): (req: Request) => Promise<Response> {
  return async (req) => {
    try {
      return withCors(req, await handler(req));
    } catch (e) {
      await reportError(fn, e);
      return withCors(req, json({ erro: 'falha', mensagem: 'Algo deu errado. Tente de novo.' }, 500));
    }
  };
}
