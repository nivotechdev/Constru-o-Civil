// U76: a distância e o tempo de carro da casa do trabalhador até a vaga pelo Google (Routes API) — os mesmos números
// do Google Maps.
//
// O app chama com o token da sessão e { job_id }. A função lê, com a chave de serviço, o endereço da própria conta
// (addresses) e o da vaga (jobs) e pergunta ao Google com os dois ENDEREÇOS em texto: o Google os põe no mapa do
// mesmo jeito que o Google Maps, e o tempo conta o trânsito de agora. Ninguém manda coordenada nem endereço de outra
// pessoa: só a rota da casa de quem chamou até uma vaga que existe. Se o Google não achar um dos endereços, a rota vai
// pelos pontos salvos.
//
// Respostas: 200 { metros, segundos, segundos_sem_transito, texto_distancia, texto_tempo, caminho, origem, destino }
//   · 400 (sem job_id) · 401 · 404 (vaga, ou conta sem endereço) · 429 (mais de 120 por hora) · 502 (Google fora)
//   · 503 (sem GOOGLE_MAPS_API_KEY: o app usa as rotas gratuitas).
// Segredo: GOOGLE_MAPS_API_KEY (Google Cloud, restrita à Routes API). Nenhum endereço vai para log ou Sentry.
import { adminClient, json, preflight, requestUser, requireAppOrigin } from '../_shared/http.ts';
import { monitored } from '../_shared/monitoring.ts';
import {
  FIELD_MASK,
  ROUTES_URL,
  lerRota,
  pedidoDeRota,
  porEndereco,
  porPonto,
  textoDoEndereco,
  type Endereco,
  type RotaGoogle
} from '../_shared/googleRoutes.ts';

// Chamada pelo navegador — sem APP_ORIGIN a função não sobe (R02).
requireAppOrigin();

const KEY = Deno.env.get('GOOGLE_MAPS_API_KEY') ?? '';
const URL_ROTAS = Deno.env.get('GOOGLE_ROUTES_URL') ?? ROUTES_URL;

// O tempo segue o trânsito: a mesma rota vale por 5 minutos (economiza chamadas pagas quando a tela abre de novo).
const guardadas = new Map<string, { ate: number; rota: RotaGoogle }>();
const VALIDADE_MS = 5 * 60 * 1000;

type Ponto = Parameters<typeof pedidoDeRota>[0];

async function perguntar(origem: Ponto, destino: Ponto): Promise<{ ok: boolean; rota: RotaGoogle | null }> {
  let res: Response;
  try {
    res = await fetch(URL_ROTAS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': KEY, 'X-Goog-FieldMask': FIELD_MASK },
      body: JSON.stringify(pedidoDeRota(origem, destino)),
      signal: AbortSignal.timeout(8000)
    });
  } catch {
    return { ok: false, rota: null };
  }
  // 400: um endereço que o Google não achou — tenta pelos pontos; outro erro é o Google fora (ou a chave).
  if (!res.ok) return { ok: res.status === 400, rota: null };
  return { ok: true, rota: lerRota(await res.json().catch(() => null)) };
}

Deno.serve(
  monitored('calcular-rota', async (req) => {
    if (req.method === 'OPTIONS') return preflight(req);
    if (req.method !== 'POST') return json({ erro: 'metodo' }, 405);
    if (!KEY) return json({ erro: 'nao-configurado', mensagem: 'Rotas do Google desligadas.' }, 503);
    const user = await requestUser(req);
    if (!user) return json({ erro: 'BC401', mensagem: 'Entre na sua conta de novo para continuar.' }, 401);
    const body = (await req.json().catch(() => null)) as { job_id?: unknown } | null;
    const jobId = typeof body?.job_id === 'string' ? body.job_id.trim() : '';
    if (!/^[A-Za-z0-9-]{1,40}$/.test(jobId)) return json({ erro: 'BC422', mensagem: 'Vaga inválida.' }, 400);

    const admin = adminClient();
    const limite = await admin.rpc('rate_limit_hit', { p_key: 'rota:' + user.id, p_max: 120, p_window: '1 hour' });
    if (limite.error) return json({ erro: 'falha' }, 502);
    if (limite.data === true) return json({ erro: 'muitas-tentativas', mensagem: 'Tente de novo daqui a pouco.' }, 429);

    const [casa, vaga] = await Promise.all([
      admin
        .from('addresses')
        .select('street, neighborhood, city, uf, cep, lat, lon')
        .eq('account_id', user.id)
        .maybeSingle(),
      admin
        .from('jobs')
        .select('street, number, neighborhood, city, uf, cep, lat, lon')
        .eq('id', jobId)
        .is('deleted_at', null)
        .maybeSingle()
    ]);
    if (casa.error || vaga.error) return json({ erro: 'falha' }, 502);
    if (!vaga.data) return json({ erro: 'BC404', mensagem: 'Vaga não encontrada.' }, 404);
    if (!casa.data) return json({ erro: 'BC404', mensagem: 'Cadastre o seu endereço para ver a distância.' }, 404);
    const de = casa.data as Endereco;
    const ate = vaga.data as Endereco;

    const chave = `${textoDoEndereco(de)}|${de.lat},${de.lon}>${textoDoEndereco(ate)}|${ate.lat},${ate.lon}`;
    const guardada = guardadas.get(chave);
    if (guardada && guardada.ate > Date.now()) return json(guardada.rota);

    let resposta = await perguntar(porEndereco(de), porEndereco(ate));
    if (resposta.ok && !resposta.rota) resposta = await perguntar(porPonto(de), porPonto(ate));
    if (!resposta.rota) return json({ erro: 'indisponivel', mensagem: 'Não deu para calcular a rota agora.' }, 502);
    if (guardadas.size > 500) guardadas.clear();
    guardadas.set(chave, { ate: Date.now() + VALIDADE_MS, rota: resposta.rota });
    return json(resposta.rota);
  })
);
