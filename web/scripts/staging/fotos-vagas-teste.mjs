#!/usr/bin/env node
// U36/U69 — Fotos reais nas vagas do staging. Busca no Wikimedia Commons só fotos de domínio público ou CC0 — uso
// livre, sem obrigação de crédito —, várias por vaga (U69: 4), sem repetir enquanto der, já reduzidas a 1280 px pelo
// próprio Commons, envia ao bucket `vagas` na pasta da empresa da vaga (a mesma regra do app) e grava em jobs.photos.
// U69: todas as vagas publicadas do staging (não só as da conta de teste); TODAS=0 volta a fazer só as da conta de
// teste. Roda pelo workflow "staging-fotos" (aqui a rede de fora não alcança os bancos de imagens).
//
//   SUPABASE_URL=https://<ref>.supabase.co SERVICE_ROLE_KEY=… node scripts/staging/fotos-vagas-teste.mjs
// Só no staging: recusa a produção.
const url = process.env.SUPABASE_URL ?? '';
const key = process.env.SERVICE_ROLE_KEY ?? '';
if (!url || !key) throw new Error('Faltam SUPABASE_URL e SERVICE_ROLE_KEY.');
if (url.includes('ppnxdajiihsjaojxokzh')) throw new Error('Isto é só para o staging.');

const COMPANY = 'b1c05000-0000-4000-8000-00000000c0de';
const PER_JOB = Number(process.env.FOTOS_POR_VAGA ?? 4);
const ALL = process.env.TODAS !== '0';
// Palavras do título → buscas no Commons (em inglês, onde o acervo é maior) e o que o NOME do arquivo precisa ter
// (a busca do Commons acha o termo em qualquer lugar da página). U48: as vagas de teste são de serviços para o público
// geral (garçom, cozinha, faxina, recepção, mudança, mercado, jardim, cuidadora, panfletos, loja) — nada de obra.
const SEARCHES = [
  [
    /gar[cç]om|gar[cç]onete/i,
    ['waiter serving', 'waiter tray', 'waitress serving', 'catering staff banquet', 'waiter restaurant'],
    /waiter|waitress|catering|banquet/i
  ],
  [
    /cozinha/i,
    ['restaurant kitchen cook', 'chef cooking kitchen', 'kitchen staff', 'cook preparing food'],
    /kitchen|cook|chef/i
  ],
  [
    /faxina|limpeza/i,
    ['house cleaning mop', 'cleaning floor mop', 'cleaner vacuum', 'housekeeping cleaning'],
    /clean|mop|housekeep|vacuum/i
  ],
  [
    /recepcion/i,
    ['receptionist desk', 'trade fair stand', 'exhibition booth visitors', 'conference registration desk'],
    /recep|hostess|trade fair|exhibition|conference/i
  ],
  [
    /mudan[cç]a/i,
    ['movers carrying furniture', 'moving boxes', 'moving truck furniture', 'removal men'],
    /mov(ing|ers)|removal|boxes/i
  ],
  [
    /repositor|mercado/i,
    ['supermarket shelves', 'grocery store shelves', 'supermarket aisle', 'stocking shelves'],
    /supermarket|grocery|shelves|shelf/i
  ],
  [
    /jardin/i,
    ['gardener working garden', 'mowing lawn mower', 'gardening hedge trimming', 'gardener planting'],
    /garden|mow|hedge/i
  ],
  [
    /cuidador/i,
    ['caregiver elderly', 'elderly woman care', 'nursing home caregiver', 'senior care'],
    /care|elderly|senior|grandmother|nursing/i
  ],
  [
    /panflet|entregador/i,
    ['leaflet distribution', 'handing out flyers', 'flyer distribution street', 'leafleting'],
    /flyer|leaflet|pamphlet/i
  ],
  [
    /loja|ajudante geral/i,
    ['clothing store interior', 'shop assistant', 'retail store employee', 'boutique shop interior'],
    /store|shop|retail|boutique/i
  ],
  [/bab[aá]|cuidar de crian/i, ['babysitter playing with children', 'nanny child care'], /babysit|nanny|child|kid/i],
  [/pintur|pintor/i, ['painting a wall roller', 'house painter interior'], /paint/i],
  [
    /churrasc|cozinheir|buffet/i,
    ['barbecue grill cook', 'buffet catering food'],
    /barbecue|grill|buffet|catering|cook/i
  ],
  [/bar ?man|bartender|drinks?/i, ['bartender cocktail bar', 'bartender pouring drink'], /bartend|bar|cocktail/i],
  [/seguran[cç]a|porteiro/i, ['security guard event entrance', 'doorman building'], /security|guard|doorman/i],
  [/motorista|entreg/i, ['delivery driver van', 'courier delivering package'], /deliver|driver|courier/i],
  [
    /evento|festa|casamento/i,
    ['wedding reception party staff', 'event staff setting tables'],
    /wedding|party|event|banquet/i
  ],
  [/caixa|atendente|vendedor/i, ['cashier store counter', 'shop assistant customer'], /cashier|shop|store|customer/i]
];
// U69: sem foto genérica de reserva — uma foto que não é do assunto da vaga é pior que nenhuma (a vaga fica com as
// fotos que já tinha).
const FALLBACK = [[], /^$/];
// Escolhidas à mão entre as candidatas do ensaio (todas CC0 ou domínio público). A busca só entra se uma delas
// sumir do Commons ou mudar de licença. U48: as de obra saíram; a lista nova sai do ensaio das vagas novas.
const PICKS = [];
// U36: primeiro as fotos de banco de imagem livre (Pexels/Unsplash/Pixabay antigos, CC0), as "Quality images" e as
// recentes; pintura, desenho, acervo de museu, militar, espaço e objeto solto ficam de fora.
const STOCK = /pexels|unsplash|pixabay|stocksnap|burst|rawpixel/i;
const REJECT =
  /paint(ing)? by|fresco|munch|canaletto|stonemason's yard|\(1[5-8]\d\d[-–]1[6-9]\d\d\)|drawing|illustration|engraving|lithograph|poster|museum|louvre|archive|lccn|dpla|zentralbibliothek|library of congress|army|navy|military|soldier|seabee|dvids|air force|marine|nasa|\beva\b|sts-|xbox|toy|mascot|broken|wrench|mountain|landscape|fountain|map\b|diagram|logo|recycl|demolition|ruin|construction|building site|bricklay|scaffold|rebar|hard hat|president|secretary|minister|senator|congress|governor|working (dinner|breakfast|lunch)|19[0-6]\d/i;
// ENSAIO=1: só lista as melhores candidatas de cada vaga, sem enviar nada.
const DRY = process.env.ENSAIO === '1';

const rest = (path, init = {}) =>
  fetch(`${url}${path}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, ...(init.headers ?? {}) }
  });

const UA = 'BicosStaging/1.0 (https://github.com/nivotechdev/Constru-o-Civil)';
const FREE = /^(public domain|pd|cc0|cc-zero|cc0 1\.0)/i;
const strip = (html) =>
  (html ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

async function commons(params) {
  const q = new URLSearchParams({
    action: 'query',
    format: 'json',
    prop: 'imageinfo',
    iiprop: 'url|size|mime|extmetadata',
    iiurlwidth: '1280',
    ...params
  });
  const res = await fetch(`https://commons.wikimedia.org/w/api.php?${q}`, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Commons ${res.status}`);
  return Object.values((await res.json()).query?.pages ?? {}).sort((x, y) => (x.index ?? 0) - (y.index ?? 0));
}

const search = (text) =>
  commons({ generator: 'search', gsrnamespace: '6', gsrsearch: `${text} filetype:bitmap`, gsrlimit: '50' });

/** As fotos escolhidas à mão, na ordem da lista, se ainda existirem e forem livres. */
async function picked(titles) {
  const pages = await commons({ titles: titles.map((t) => `File:${t}`).join('|') });
  const order = (p) => titles.findIndex((t) => `File:${t}` === p.title);
  return describe(
    pages.filter((p) => p.imageinfo).sort((a, b) => order(a) - order(b)),
    /./
  );
}

/**
 * U69: o Openverse (o buscador de imagens livres do WordPress: Flickr, bancos de imagem…) acha fotos de gente
 * trabalhando muito melhor que a busca do Commons. Só CC0 e domínio público, paisagem, grandes; o assunto é conferido
 * no título e nas etiquetas.
 */
let openverseWarned = false;
async function openverse(query, must, source = '') {
  const q = new URLSearchParams({
    q: query,
    license: 'cc0,pdm',
    aspect_ratio: 'wide',
    size: 'large',
    mature: 'false',
    page_size: '20',
    ...(source ? { source } : {})
  });
  const res = await fetch(`https://api.openverse.org/v1/images/?${q}`, { headers: { 'User-Agent': UA } });
  if (!res.ok) {
    if (!openverseWarned) console.log(`(Openverse respondeu ${res.status}: ${(await res.text()).slice(0, 160)})`);
    openverseWarned = true;
    return [];
  }
  const results = (await res.json()).results ?? [];
  if (DRY) console.log(`  (Openverse${source ? ' ' + source : ''} "${query}": ${results.length} resultados)`);
  return results
    .map((r) => ({
      id: `ov:${r.id}`,
      title: `${r.title ?? ''} [${r.provider}]`,
      about: [r.title, ...(r.tags ?? []).map((t) => t.name)].join(' '),
      thumb: r.url,
      width: r.width ?? 0,
      height: r.height ?? 0,
      license: `${r.license}`.toUpperCase(),
      creator: (r.creator ?? '').slice(0, 80),
      page: r.foreign_landing_url,
      score: r.source === 'stocksnap' ? 8 : 5
    }))
    .filter(
      (c) =>
        c.width >= 900 &&
        c.width >= c.height &&
        c.width <= c.height * 2.2 &&
        /\.jpe?g($|\?)/i.test(c.thumb) &&
        must.test(c.about) &&
        !REJECT.test(c.about)
    );
}

/**
 * As fotos livres e boas de uma busca, com nota. U69: primeiro o StockSnap (fotos atuais, de gente trabalhando, CC0);
 * só se faltar, o resto do Openverse e, por último, o Commons — cada fonte a mais custa tempo.
 */
async function candidates(query, must, enough = 6) {
  const found = [...(await openverse(query, must, 'stocksnap'))];
  if (found.length < enough) found.push(...(await openverse(query, must)).filter((c) => !/rawpixel/i.test(c.title)));
  if (found.length < enough) {
    const pages = [
      ...(await search(`${query} pexels`)),
      ...(await search(`${query} unsplash`)),
      ...(await search(query))
    ];
    found.push(...describe(pages, must));
  }
  return found.sort((a, b) => b.score - a.score);
}

/** As páginas do Commons que servem (livres, paisagem, boas e do assunto), com nota. */
function describe(pages, must) {
  const seen = new Set();
  return pages
    .filter((p) => !seen.has(p.pageid) && seen.add(p.pageid))
    .map((p) => {
      const info = p.imageinfo?.[0];
      const meta = info?.extmetadata ?? {};
      const about = [p.title, strip(meta.Artist?.value), strip(meta.Credit?.value), strip(meta.Categories?.value)].join(
        ' '
      );
      const year = Number((strip(meta.DateTimeOriginal?.value).match(/(19|20)\d{2}/) ?? [])[0]) || null;
      return { id: p.pageid, title: p.title, info, about, year, license: meta.LicenseShortName?.value ?? '' };
    })
    .filter(
      ({ title, info, about, year, license }) =>
        info?.mime === 'image/jpeg' &&
        FREE.test(license) &&
        info.width >= 1000 &&
        info.width >= info.height &&
        info.width <= info.height * 2.2 &&
        info.thumburl &&
        must.test(title.replace(/_/g, ' ')) &&
        !REJECT.test(about) &&
        !(year && year < 1995)
    )
    .map((c) => ({
      ...c,
      score:
        (STOCK.test(c.about) ? 4 : 0) +
        (/quality images|featured pictures/i.test(c.about) ? 3 : 0) +
        (c.year && c.year >= 2010 ? 2 : 0)
    }))
    .map(({ id, title, info, about, license, score }) => ({
      id,
      title,
      thumb: info.thumburl,
      license,
      score,
      creator: strip(info.extmetadata?.Artist?.value).slice(0, 80) || (STOCK.exec(about)?.[0] ?? ''),
      page: info.descriptionurl
    }));
}

async function download(image) {
  const res = await fetch(image.thumb, { headers: { 'User-Agent': UA } });
  if (!res.ok || !/image\/jpe?g/i.test(res.headers.get('content-type') ?? '')) return null;
  const bytes = new Uint8Array(await res.arrayBuffer());
  return bytes.length > 20_000 && bytes.length < 6_000_000 ? bytes : null;
}

const jobsRes = await rest(
  `/rest/v1/jobs?${ALL ? '' : `company_id=eq.${COMPANY}&`}deleted_at=is.null&select=id,title,company_id&order=id`
);
if (!jobsRes.ok) throw new Error(`jobs ${jobsRes.status}`);
const jobs = await jobsRes.json();
console.log(`${jobs.length} vagas ${ALL ? 'publicadas no staging' : 'da conta de teste'}, ${PER_JOB} fotos em cada.`);
const used = new Set();
// As escolhidas à mão ficam reservadas para a sua vaga: a busca de reserva de outra vaga não as pega.
const reserved = new Set(PICKS.flatMap(([, titles]) => titles.map((t) => `File:${t}`)));
const STAMP = Date.now().toString(36);
const credits = [];

for (const job of jobs) {
  const [, queries, must] = SEARCHES.find(([re]) => re.test(job.title)) ?? [null, ...FALLBACK];
  const photos = [];
  // As escolhidas à mão; se faltar alguma, as buscas da vaga e, depois, as gerais.
  const pool = await picked(PICKS.find(([re]) => re.test(job.title))?.[1] ?? []);
  const hand = new Set(pool.map((c) => c.id));
  for (const [q, re] of [...queries.map((q) => [q, must]), ...FALLBACK[0].map((q) => [q, FALLBACK[1]])]) {
    pool.push(...(await candidates(q, re)).filter((c) => !reserved.has(c.title) && !pool.some((p) => p.id === c.id)));
    if (pool.filter((c) => !used.has(c.id)).length >= (DRY ? 10 : PER_JOB + 2)) break;
  }
  // As do ofício antes das gerais; dentro de cada grupo, as de nota maior.
  const specific = new Set(pool.filter((c) => must.test(c.about ?? c.title.replace(/_/g, ' '))).map((c) => c.id));
  const tier = (c) => (hand.has(c.id) ? 2 : specific.has(c.id) ? 1 : 0);
  pool.sort((a, b) => tier(b) - tier(a) || b.score - a.score);
  if (DRY) {
    console.log(`\n${job.id} ${job.title}:`);
    for (const c of pool.filter((c) => !used.has(c.id)).slice(0, 10))
      console.log(
        `  ${c.id} [${c.score}] ${c.title.slice(0, 90)} (${c.license})${String(c.id).startsWith('ov:') ? ' ' + c.page : ''}`
      );
    pool.slice(0, PER_JOB).forEach((c) => used.add(c.id));
    continue;
  }
  // Primeiro as que ainda não foram usadas; se faltar (muitas vagas do mesmo serviço), repete as do mesmo assunto.
  const order = [...pool.filter((c) => !used.has(c.id)), ...pool.filter((c) => used.has(c.id))];
  const taken = new Set();
  for (const image of order) {
    if (photos.length >= PER_JOB) break;
    if (taken.has(image.id)) continue;
    const bytes = await download(image);
    if (!bytes) continue;
    // Nome novo a cada rodada: o navegador não mostra a foto antiga do cache (as antigas viram órfãs e o
    // limpar-arquivos apaga).
    const path = `vagas/${job.company_id ?? COMPANY}/${job.id}-${STAMP}-${photos.length + 1}.jpg`;
    const up = await rest(`/storage/v1/object/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'image/jpeg', 'x-upsert': 'true', 'Cache-Control': '3600' },
      body: bytes
    });
    if (!up.ok) throw new Error(`upload ${job.id}: ${up.status} ${await up.text()}`);
    used.add(image.id);
    taken.add(image.id);
    photos.push(`${url}/storage/v1/object/public/${path}`);
    credits.push(
      `${job.id} · [${image.score}] ${image.title} — ${image.creator || 'autor desconhecido'} (${image.license}) ${image.page ?? ''}`
    );
  }
  if (photos.length < Math.min(2, PER_JOB)) {
    console.log(`✗ ${job.id} ${job.title}: nenhuma foto boa para "${queries.join('", "')}"`);
    continue;
  }
  const upd = await rest(`/rest/v1/jobs?id=eq.${job.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ photos })
  });
  if (!upd.ok) throw new Error(`fotos ${job.id}: ${upd.status} ${await upd.text()}`);
  console.log(`✓ ${job.id} ${job.title}: ${photos.length} foto(s)`);
}

console.log('\nOrigem das fotos (domínio público / CC0):\n' + credits.join('\n'));
if (!DRY && !credits.length) throw new Error('Nenhuma foto encontrada.');
