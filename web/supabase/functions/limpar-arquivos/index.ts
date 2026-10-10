// Limpeza diária do Storage (X09): apaga, pela API do Storage, os arquivos que `orphan_storage_objects` diz
// que ninguém usa (envio que não chegou a ser gravado, foto trocada de vaga, vaga excluída) e as fotos de
// identidade 30 dias depois da decisão. Chamada pelo pg_cron (call_storage_cleanup, via pg_net) com o
// segredo `x-webhook-secret` — publicada sem conferir JWT (`--no-verify-jwt`).
//
// Segredo: CLEANUP_SECRET (o mesmo guardado no Vault como bicos_cleanup_secret).
// Respostas: 200 { apagados } · 401 { erro: 'segredo' } · 502 { erro: 'falha' }.
import { adminClient, json } from '../_shared/http.ts';

const SECRET = Deno.env.get('CLEANUP_SECRET') ?? '';

function same(a: string, b: string): boolean {
  if (!a || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ erro: 'metodo' }, 405);
  if (!SECRET || !same(req.headers.get('x-webhook-secret') ?? '', SECRET)) return json({ erro: 'segredo' }, 401);
  const admin = adminClient();
  let removed = 0;
  // Até 5 rodadas de 500 por chamada; o que sobrar sai no dia seguinte.
  for (let round = 0; round < 5; round++) {
    const { data, error } = await admin.rpc('orphan_storage_objects', { p_limit: 500 });
    if (error) return json({ erro: 'falha', apagados: removed }, 502);
    const rows = (data ?? []) as { bucket: string; name: string }[];
    if (!rows.length) break;
    const byBucket = new Map<string, string[]>();
    for (const r of rows) byBucket.set(r.bucket, [...(byBucket.get(r.bucket) ?? []), r.name]);
    for (const [bucket, names] of byBucket) {
      for (let i = 0; i < names.length; i += 100) {
        const chunk = names.slice(i, i + 100);
        const { error: rmError } = await admin.storage.from(bucket).remove(chunk);
        if (rmError) return json({ erro: 'falha', apagados: removed }, 502);
        removed += chunk.length;
      }
    }
    if (rows.length < 500) break;
  }
  return json({ apagados: removed });
});
