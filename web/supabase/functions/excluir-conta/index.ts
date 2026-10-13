// Excluir a conta (Y15): o único caminho que o app usa para apagar a conta de verdade.
//
// O app chama com o token da sessão, logo depois de conferir a senha: { confirmCommitments: boolean }.
// 1. Chama a RPC delete_my_account COM O TOKEN DO USUÁRIO: ela exige login de no máximo 5 minutos, recusa
//    se houver bico em andamento sem confirmação, avisa o outro lado, anonimiza o perfil e as avaliações
//    (reviews.author_label) e apaga a conta de acesso — tudo numa transação.
// 2. Só se a conta saiu: apaga os arquivos do usuário nos buckets (avatars, portfolio, vagas — a pasta
//    `<id>/` de cada um) e tira das vagas antigas os endereços dessas fotos.
//
// Respostas: 200 { ok: true, arquivos } · 401/409/422 { erro, mensagem }.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { adminClient, CORS, json, requestUser, rpcError } from '../_shared/http.ts';
import { monitored } from '../_shared/monitoring.ts';

const BUCKETS = ['avatars', 'portfolio', 'vagas'];

/** Apaga tudo em `<bucket>/<id>/`, em lotes; devolve quantos arquivos saíram. */
async function removeFolder(admin: ReturnType<typeof adminClient>, bucket: string, id: string): Promise<number> {
  let removed = 0;
  for (let round = 0; round < 50; round++) {
    const { data, error } = await admin.storage.from(bucket).list(id, { limit: 100 });
    if (error) throw error;
    const paths = (data ?? []).filter((f) => f.id).map((f) => `${id}/${f.name}`);
    if (!paths.length) break;
    const { error: removeError } = await admin.storage.from(bucket).remove(paths);
    if (removeError) throw removeError;
    removed += paths.length;
  }
  return removed;
}

Deno.serve(
  monitored('excluir-conta', async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    if (req.method !== 'POST') return json({ erro: 'metodo' }, 405);

    const user = await requestUser(req);
    if (!user) return json({ erro: 'BC401', mensagem: 'Entre na sua conta de novo para continuar.' }, 401);

    let body: { confirmCommitments?: boolean };
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    // A RPC roda como o próprio usuário (auth.uid() e a hora do login vêm do token dele).
    const asUser = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } }
    });
    const { error } = await asUser.rpc('delete_my_account', {
      p_confirm_commitments: body.confirmCommitments === true
    });
    if (error) return rpcError(error);

    // A conta já saiu: daqui em diante, uma falha não volta atrás — fica no log para limpar à mão.
    const admin = adminClient();
    let files = 0;
    for (const bucket of BUCKETS) {
      try {
        files += await removeFolder(admin, bucket, user.id);
      } catch (e) {
        console.error(`excluir-conta: arquivos de ${user.id} em ${bucket} ficaram`, e);
      }
    }
    const { error: photosError } = await admin.from('jobs').update({ photos: [] }).eq('company_id', user.id);
    if (photosError) console.error(`excluir-conta: fotos das vagas de ${user.id} ficaram`, photosError);

    return json({ ok: true, arquivos: files });
  })
);
