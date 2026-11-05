// U76/U80: a distância A PÉ da casa do trabalhador até a vaga (o número que o card do mural e a página da vaga mostram)
// e o tempo DE CARRO, pelo Google (Routes API) — os mesmos números do Google Maps.
//
// O app chama com o token da sessão e:
//   * { job_id } — a página da vaga: a rota a pé (distância, caminho, onde o Google pôs cada endereço) e o tempo de carro;
//   * { job_ids: [...] } (até 25) — os cards do mural: a distância a pé de cada vaga, numa matriz só.
// A função lê, com a chave de serviço, o endereço da própria conta (addresses) e o das vagas (jobs) e pergunta ao Google
// com os ENDEREÇOS em texto: o Google os põe no mapa do mesmo jeito que o Google Maps. Ninguém manda coordenada nem
// endereço de outra pessoa: só a distância da casa de quem chamou até vagas que existem. Se o Google não achar um
// endereço, a rota vai pelos pontos salvos.
//
// Respostas: 200 { metros, texto_distancia, caminho, origem, destino, carro_segundos, carro_texto }
//   ou 200 { distancias: { [job_id]: { metros, texto } | null } }
//   · 400 · 401 · 404 (vaga, ou conta sem endereço) · 429 (mais de 120 por hora) · 502 (Google fora)
//   · 503 (sem GOOGLE_MAPS_API_KEY: o app usa as rotas gratuitas).
// Segredo: GOOGLE_MAPS_API_KEY (Google Cloud, restrita à Routes API). Nenhum endereço vai para log ou Sentry.
import { adminClient, json, preflight, requestUser, requireAppOrigin } from '../_shared/http.ts';
import { monitored } from '../_shared/monitoring.ts';
import {
  FIELD_MASK,
  MATRIX_FIELD_MASK,
  MATRIX_URL,
  ROUTES_URL,
  lerMatriz,
  lerRota,
  pedidoDeMatriz,
  pedidoDeRota,
  porEndereco,
  porPonto,
  textoDoEndereco,
  type Endereco,
  type Modo,
  type Ponto,
  type RotaGoogle
} from '../_shared/googleRoutes.ts';

// Chamada pelo navegador — sem APP_ORIGIN a função não sobe (R02).
requireAppOrigin();

const KEY = Deno.env.get('GOOGLE_MAPS_API_KEY') ?? '';
const URL_ROTAS = Deno.env.get('GOOGLE_ROUTES_URL') ?? ROUTES_URL;
const URL_MATRIZ = Deno.env.get('GOOGLE_MATRIX_URL') ?? MATRIX_URL;
const MAX_VAGAS = 25;
const ID = /^[A-Za-z0-9-]{1,40}$/;

// A distância a pé não muda com o trânsito (vale 1 dia); o tempo de carro, sim (5 minutos).
const guardadas = new Map<string, { ate: number; valor: unknown }>();
const lembrar = <T>(chave: string, ms: number, valor: T): T => {
  if (guardadas.size > 1000) guardadas.clear();
  guardadas.set(chave, { ate: Date.now() + ms, valor });
  return valor;
};
const lembrada = (chave: string) => {
  const g = guardadas.get(chave);
  return g && g.ate > Date.now() ? g.valor : undefined;
};

async function post(url: string, mask: string, corpo: unknown): Promise<{ status: number; body: unknown }> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': KEY, 'X-Goog-FieldMask': mask },
      body: JSON.stringify(corpo),
      signal: AbortSignal.timeout(8000)
    });
    return { status: res.status, body: res.ok ? await res.json().catch(() => null) : null };
  } catch {
    return { status: 0, body: null };
  }
}

/** A rota pelo endereço em texto; se o Google não achar um deles (400 ou sem rota), pelos pontos salvos. */
async function rota(de: Endereco, ate: Endereco, modo: Modo): Promise<RotaGoogle | null> {
  const chave = `${modo}|${textoDoEndereco(de)}|${de.lat},${de.lon}>${textoDoEndereco(ate)}|${ate.lat},${ate.lon}`;
  const g = lembrada(chave) as RotaGoogle | undefined;
  if (g) return g;
  let r = await post(URL_ROTAS, FIELD_MASK, pedidoDeRota(porEndereco(de), porEndereco(ate), modo));
  let achada = r.status === 200 ? lerRota(r.body) : null;
  if (!achada && (r.status === 200 || r.status === 400)) {
    r = await post(URL_ROTAS, FIELD_MASK, pedidoDeRota(porPonto(de), porPonto(ate), modo));
    achada = r.status === 200 ? lerRota(r.body) : null;
  }
  return achada ? lembrar(chave, modo === 'WALK' ? 86_400_000 : 300_000, achada) : null;
}

const CASA = 'street, neighborhood, city, uf, cep, lat, lon';
const VAGA = 'id, street, number, neighborhood, city, uf, cep, lat, lon';

Deno.serve(
  monitored('calcular-rota', async (req) => {
    if (req.method === 'OPTIONS') return preflight(req);
    if (req.method !== 'POST') return json({ erro: 'metodo' }, 405);
    if (!KEY) return json({ erro: 'nao-configurado', mensagem: 'Rotas do Google desligadas.' }, 503);
    const user = await requestUser(req);
    if (!user) return json({ erro: 'BC401', mensagem: 'Entre na sua conta de novo para continuar.' }, 401);
    const body = (await req.json().catch(() => null)) as { job_id?: unknown; job_ids?: unknown } | null;
    const lote = Array.isArray(body?.job_ids)
      ? [...new Set((body.job_ids as unknown[]).filter((x): x is string => typeof x === 'string' && ID.test(x)))]
      : null;
    const jobId = typeof body?.job_id === 'string' ? body.job_id.trim() : '';
    if (lote ? !lote.length || lote.length > MAX_VAGAS : !ID.test(jobId))
      return json({ erro: 'BC422', mensagem: 'Vaga inválida.' }, 400);

    const admin = adminClient();
    const limite = await admin.rpc('rate_limit_hit', { p_key: 'rota:' + user.id, p_max: 120, p_window: '1 hour' });
    if (limite.error) return json({ erro: 'falha' }, 502);
    if (limite.data === true) return json({ erro: 'muitas-tentativas', mensagem: 'Tente de novo daqui a pouco.' }, 429);

    const [casa, vagas] = await Promise.all([
      admin.from('addresses').select(CASA).eq('account_id', user.id).maybeSingle(),
      admin
        .from('jobs')
        .select(VAGA)
        .in('id', lote ?? [jobId])
        .is('deleted_at', null)
    ]);
    if (casa.error || vagas.error) return json({ erro: 'falha' }, 502);
    if (!casa.data) return json({ erro: 'BC404', mensagem: 'Cadastre o seu endereço para ver a distância.' }, 404);
    const de = casa.data as Endereco;
    const achadas = (vagas.data ?? []) as (Endereco & { id: string })[];

    if (lote) {
      // Os cards: uma matriz a pé, com as vagas que ainda não estão guardadas.
      const distancias: Record<string, { metros: number; texto: string | null } | null> = {};
      const casaChave = `${textoDoEndereco(de)}|${de.lat},${de.lon}`;
      const faltam = achadas.filter((v) => {
        const g = lembrada(`MAT|${casaChave}>${textoDoEndereco(v)}|${v.lat},${v.lon}`);
        if (g !== undefined) distancias[v.id] = g as { metros: number; texto: string | null };
        return g === undefined;
      });
      if (faltam.length) {
        const pedir = async (ponto: (e: Endereco) => Ponto) =>
          post(URL_MATRIZ, MATRIX_FIELD_MASK, pedidoDeMatriz(ponto(de), faltam.map(ponto)));
        let r = await pedir(porEndereco);
        let lidas = r.status === 200 ? lerMatriz(r.body, faltam.length) : null;
        if (!lidas || lidas.every((x) => !x)) {
          r = await pedir(porPonto);
          lidas = r.status === 200 ? lerMatriz(r.body, faltam.length) : lidas;
        }
        if (!lidas) return json({ erro: 'indisponivel', mensagem: 'Não deu para calcular agora.' }, 502);
        faltam.forEach((v, i) => {
          const d = lidas?.[i] ?? null;
          distancias[v.id] = d;
          if (d) lembrar(`MAT|${casaChave}>${textoDoEndereco(v)}|${v.lat},${v.lon}`, 86_400_000, d);
        });
      }
      return json({ distancias });
    }

    const ate = achadas[0];
    if (!ate) return json({ erro: 'BC404', mensagem: 'Vaga não encontrada.' }, 404);
    // A página da vaga: a pé (a distância e o caminho) e de carro (o tempo), juntos.
    const [aPe, carro] = await Promise.all([rota(de, ate, 'WALK'), rota(de, ate, 'DRIVE')]);
    if (!aPe) return json({ erro: 'indisponivel', mensagem: 'Não deu para calcular a rota agora.' }, 502);
    return json({
      metros: aPe.metros,
      texto_distancia: aPe.texto_distancia,
      caminho: aPe.caminho,
      origem: aPe.origem,
      destino: aPe.destino,
      carro_segundos: carro?.segundos ?? null,
      carro_texto: carro?.texto_tempo ?? null
    });
  })
);
