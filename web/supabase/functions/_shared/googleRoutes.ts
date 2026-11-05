// U76/U80: a rota pelo Google (Routes API) — a pé (a distância que o app mostra no card e na vaga) e de carro (o
// tempo) — e a matriz a pé para os cards do mural: o pedido, a leitura da resposta e o texto de cada endereço.
// Sem Deno aqui: os testes do app (Vitest) importam este arquivo (como o origin.ts).

export interface Endereco {
  street: string;
  number?: string | null;
  neighborhood: string;
  city: string;
  uf: string;
  cep: string;
  lat: number;
  lon: number;
}

export interface RotaGoogle {
  metros: number;
  segundos: number;
  segundos_sem_transito: number | null;
  texto_distancia: string | null;
  texto_tempo: string | null;
  /** O caminho, em pontos [lat, lon]. */
  caminho: [number, number][];
  /** Onde o Google pôs cada endereço (o começo e o fim da rota). */
  origem: { lat: number; lon: number } | null;
  destino: { lat: number; lon: number } | null;
}

export const ROUTES_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';
export const FIELD_MASK = [
  'routes.distanceMeters',
  'routes.duration',
  'routes.staticDuration',
  'routes.polyline.encodedPolyline',
  'routes.localizedValues',
  'routes.legs.startLocation',
  'routes.legs.endLocation'
].join(',');

const limpo = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();

/**
 * O endereço como se digita no Google Maps: "Rua Sinimbu, 1234 - Centro, Caxias do Sul - RS, 95020-000, Brasil".
 * O número vem do campo próprio (vaga) ou já está na rua (o trabalhador o digita junto, quando digita).
 */
export function textoDoEndereco(e: Endereco): string {
  const rua = limpo(e.street);
  const numero = limpo(e.number);
  const linha = numero ? `${rua}, ${numero}` : rua;
  const bairro = limpo(e.neighborhood);
  return `${linha}${bairro ? ` - ${bairro}` : ''}, ${limpo(e.city)} - ${limpo(e.uf)}, ${limpo(e.cep)}, Brasil`;
}

export type Ponto = { address: string } | { location: { latLng: { latitude: number; longitude: number } } };
export type Modo = 'DRIVE' | 'WALK';

/**
 * O corpo do pedido, em português: a pé (WALK — o Google não aceita preferência de trânsito aí) ou de carro (DRIVE, com o
 * trânsito de agora: o mesmo cálculo do Google Maps).
 */
export function pedidoDeRota(origem: Ponto, destino: Ponto, modo: Modo = 'DRIVE'): Record<string, unknown> {
  return {
    origin: origem,
    destination: destino,
    travelMode: modo,
    ...(modo === 'DRIVE' ? { routingPreference: 'TRAFFIC_AWARE_OPTIMAL' } : {}),
    computeAlternativeRoutes: false,
    languageCode: 'pt-BR',
    regionCode: 'br',
    units: 'METRIC'
  };
}

export const MATRIX_URL = 'https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix';
export const MATRIX_FIELD_MASK =
  'originIndex,destinationIndex,status,condition,distanceMeters,duration,localizedValues';

/** A matriz a pé de uma casa até várias vagas (os cards do mural), num pedido só. */
export function pedidoDeMatriz(origem: Ponto, destinos: Ponto[]): Record<string, unknown> {
  return {
    origins: [{ waypoint: origem }],
    destinations: destinos.map((d) => ({ waypoint: d })),
    travelMode: 'WALK',
    languageCode: 'pt-BR',
    regionCode: 'br',
    units: 'METRIC'
  };
}

/** A distância a pé de cada destino da matriz (pela ordem pedida); null onde o Google não achou caminho. */
export function lerMatriz(body: unknown, quantos: number): ({ metros: number; texto: string | null } | null)[] {
  const out: ({ metros: number; texto: string | null } | null)[] = Array.from({ length: quantos }, () => null);
  if (!Array.isArray(body)) return out;
  for (const e of body as Record<string, unknown>[]) {
    const i = typeof e?.destinationIndex === 'number' ? e.destinationIndex : -1;
    // O Google omite os zeros: a vaga na própria casa vem sem distanceMeters.
    const metros = e?.distanceMeters ?? (e?.condition === 'ROUTE_EXISTS' ? 0 : undefined);
    const existe = !e?.condition || e.condition === 'ROUTE_EXISTS';
    if (i < 0 || i >= quantos || !existe || typeof metros !== 'number' || !Number.isFinite(metros)) continue;
    const textos = (e.localizedValues ?? {}) as Record<string, { text?: string } | undefined>;
    out[i] = { metros, texto: textos.distance?.text ?? null };
  }
  return out;
}

export const porEndereco = (e: Endereco): Ponto => ({ address: textoDoEndereco(e) });
export const porPonto = (e: Endereco): Ponto => ({ location: { latLng: { latitude: e.lat, longitude: e.lon } } });

/** O "encoded polyline" do Google (5 casas) em pontos [lat, lon]. */
export function decodificarLinha(encoded: string): [number, number][] {
  const out: [number, number][] = [];
  let i = 0;
  let lat = 0;
  let lon = 0;
  const proximo = () => {
    let result = 0;
    let shift = 0;
    let b: number;
    do {
      b = encoded.charCodeAt(i++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (i < encoded.length) {
    lat += proximo();
    lon += proximo();
    out.push([lat / 1e5, lon / 1e5]);
  }
  return out;
}

/** "560s" → 560. */
const segundos = (d: unknown) => {
  const m = typeof d === 'string' ? /^(\d+(?:\.\d+)?)s$/.exec(d) : null;
  return m ? Math.round(Number(m[1])) : null;
};

const ponto = (l: unknown) => {
  const ll = (l as { latLng?: { latitude?: number; longitude?: number } } | undefined)?.latLng;
  return ll && Number.isFinite(ll.latitude) && Number.isFinite(ll.longitude)
    ? { lat: ll.latitude as number, lon: ll.longitude as number }
    : null;
};

/** A primeira rota da resposta do Google, ou null quando ele não achou caminho. */
export function lerRota(body: unknown): RotaGoogle | null {
  const r = (body as { routes?: Record<string, unknown>[] } | null)?.routes?.[0];
  if (!r) return null;
  const metros = r.distanceMeters;
  const tempo = segundos(r.duration);
  if (typeof metros !== 'number' || !Number.isFinite(metros) || tempo === null) return null;
  const textos = (r.localizedValues ?? {}) as Record<string, { text?: string } | undefined>;
  const pernas = (r.legs ?? []) as { startLocation?: unknown; endLocation?: unknown }[];
  const linha = (r.polyline as { encodedPolyline?: string } | undefined)?.encodedPolyline;
  return {
    metros,
    segundos: tempo,
    segundos_sem_transito: segundos(r.staticDuration),
    texto_distancia: textos.distance?.text ?? null,
    texto_tempo: textos.duration?.text ?? null,
    caminho: linha ? decodificarLinha(linha) : [],
    origem: ponto(pernas[0]?.startLocation),
    destino: ponto(pernas[pernas.length - 1]?.endLocation)
  };
}
