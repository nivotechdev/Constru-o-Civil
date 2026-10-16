// L03: no fim (passou ou falhou), toda conta criada pelo E2E sai pelo mesmo caminho do app — a função
// excluir-conta, que também apaga os arquivos —, e o que sobrar sai pela Admin API.
import { createClient } from '@supabase/supabase-js';
import { admin, ENV, estado } from './apoio';

export default async function limpeza(): Promise<void> {
  if (process.env.E2E_MANTER_CONTAS === '1') return;
  const { criadas } = estado();
  for (const conta of criadas) {
    const c = createClient(ENV.supabaseUrl, ENV.anonKey(), { auth: { persistSession: false } });
    const { data } = await c.auth.signInWithPassword({ email: conta.email, password: ENV.password });
    if (data.session) {
      await fetch(`${ENV.functionsUrl}/functions/v1/excluir-conta`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${data.session.access_token}`,
          apikey: ENV.anonKey(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ confirmCommitments: true })
      }).catch(() => undefined);
    }
    await admin()
      .auth.admin.deleteUser(conta.id)
      .catch(() => undefined);
  }
  console.log(`Limpeza: ${criadas.length} contas de teste apagadas.`);
}
