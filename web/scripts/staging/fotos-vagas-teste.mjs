#!/usr/bin/env node
// U36 — Fotos reais nas vagas de TESTE do staging (conta recrutador.teste@bicos.test). Busca no Wikimedia Commons só
// fotos de domínio público ou CC0 — uso livre, sem obrigação de crédito —, duas por vaga, sem repetir, já reduzidas a
// 1280 px pelo próprio Commons, envia ao bucket `vagas` na pasta da construtora (a mesma regra do app) e grava em
// jobs.photos. Roda pelo workflow "staging-fotos" (aqui a rede de fora não alcança os bancos de imagens).
//
//   SUPABASE_URL=https://<ref>.supabase.co SERVICE_ROLE_KEY=… node scripts/staging/fotos-vagas-teste.mjs
// Só no staging: recusa a produção.
const url = process.env.SUPABASE_URL ?? '';
const key = process.env.SERVICE_ROLE_KEY ?? '';
if (!url || !key) throw new Error('Faltam SUPABASE_URL e SERVICE_ROLE_KEY.');
if (url.includes('ppnxdajiihsjaojxokzh')) throw new Error('Isto é só para o staging.');

const COMPANY = 'b1c05000-0000-4000-8000-00000000c0de';
const PER_JOB = 2;
// Palavras do título → buscas no Commons (em inglês, onde o acervo é maior) e o que o NOME do arquivo precisa ter
// (a busca do Commons acha o termo em qualquer lugar da página — astronauta "Foreman", adaptador de videogame…).
const SEARCHES = [
  [
    /mestre de obras/i,
    ['construction site workers', 'construction workers helmet'],
    /construction (site|worker)|building site|workers? on site/i
  ],
  [/contrapiso/i, ['concrete floor screed', 'pouring concrete floor'], /concrete|screed/i],
  [
    /pintor/i,
    ['house painter painting wall', 'painting wall roller'],
    /(painter|painting|paint roller).*(wall|house|room|interior|facade)|house ?painter|paint roller/i
  ],
  [/eletricista/i, ['electrician working', 'electrician wiring'], /electrician|electrical (work|wiring|installation)/i],
  [/limpeza/i, ['cleaning floor construction', 'cleaning renovation'], /clean/i],
  [/telhadista|telha/i, ['roofer working roof', 'roofing workers'], /roof/i],
  [/azulejista/i, ['tiler laying tiles', 'tiling floor worker'], /tiler|tiling|laying tiles?|fliesen/i],
  [/armador|funda/i, ['rebar worker construction', 'steel reinforcement concrete'], /rebar|reinforc/i],
  [/encanador/i, ['plumber working', 'plumbing pipes installation'], /plumb/i],
  [/ajudante de pedreiro|pedreiro/i, ['bricklayer laying bricks', 'mason brick wall'], /brick|mason/i]
];
const FALLBACK = [['construction worker', 'construction site workers'], /construction (site|worker)|building site/i];
// Escolhidas à mão entre as candidatas do ensaio (todas CC0 ou domínio público). A busca só entra se uma delas
// sumir do Commons ou mudar de licença.
const PICKS = [
  [
    /mestre de obras/i,
    ['Construction worker and ad (Unsplash).jpg', 'Moscow, Zhukov Lane, Dubinin-Sky construction site, May 2025 19.jpg']
  ],
  [/contrapiso/i, ['Now the Concrete for the New Office is Done (5105188241).jpg', 'Rotary Polisher On Concrete.jpg']],
  [/pintor/i, ['Construction workers in Iran 09.jpg', 'Construction workers in Iran 06.jpg']],
  [/eletricista/i, ['Electricians fixing electricity meter 5.jpg']],
  [
    /limpeza/i,
    [
      'Construction workers in Iran 14.jpg',
      'A break for the construction workers at the Rokin at the building site of the future metro station underground; free photo of Amsterdam streets by Fons Heijnsbroek, 2007.jpg'
    ]
  ],
  [/telhadista|telha/i, ['Men working on roof.jpg', 'Roofing workers fall prevention (9253637735).jpg']],
  [/azulejista/i, ['Verlegen von Fliesen mit einem Nivelliersystem.jpg', 'Construction workers in Iran 13.jpg']],
  [/armador|funda/i, ['Rebar Tying in Beijing.jpg', 'Counting Rebar? (2885736243).jpg']],
  [
    /encanador/i,
    [
      'A construction worker is working underground during the renovation of Central station Amsterdam; free photo Amsterdam by Fons Heijnsbroek, 2012.jpg',
      'Construction workers in Iran 11.jpg'
    ]
  ],
  [/ajudante de pedreiro|pedreiro/i, ['Construction workers in Iran 02.jpg', 'Sabbiee-labor-2665057.jpg']]
];
// U36: primeiro as fotos de banco de imagem livre (Pexels/Unsplash/Pixabay antigos, CC0), as "Quality images" e as
// recentes; pintura, desenho, acervo de museu, militar, espaço e objeto solto ficam de fora.
const STOCK = /pexels|unsplash|pixabay|stocksnap|burst|rawpixel/i;
const REJECT =
  /paint(ing)? by|fresco|munch|canaletto|stonemason's yard|\(1[5-8]\d\d[-–]1[6-9]\d\d\)|drawing|illustration|engraving|lithograph|poster|museum|louvre|archive|lccn|dpla|zentralbibliothek|library of congress|army|navy|military|soldier|seabee|dvids|air force|marine|nasa|\beva\b|sts-|xbox|toy|mascot|broken|wrench|mountain|landscape|fountain|map\b|diagram|logo|recycl|demolition|ruin/i;
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

/** As fotos livres e boas de uma busca, com nota: banco de imagem e recentes primeiro. */
async function candidates(query, must) {
  const pages = [
    ...(await search(`${query} pexels`)),
    ...(await search(`${query} unsplash`)),
    ...(await search(`${query} pixabay`)),
    ...(await search(query))
  ];
  return describe(pages, must).sort((a, b) => b.score - a.score);
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
  return bytes.length > 20_000 && bytes.length < 3_500_000 ? bytes : null;
}

const jobsRes = await rest(`/rest/v1/jobs?company_id=eq.${COMPANY}&select=id,title&order=id`);
if (!jobsRes.ok) throw new Error(`jobs ${jobsRes.status}`);
const jobs = await jobsRes.json();
console.log(`${jobs.length} vagas da conta de teste.`);
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
    if (pool.filter((c) => !used.has(c.id)).length >= (DRY ? 6 : PER_JOB + 2)) break;
  }
  // As do ofício antes das gerais; dentro de cada grupo, as de nota maior.
  const specific = new Set(pool.filter((c) => must.test(c.title.replace(/_/g, ' '))).map((c) => c.id));
  const tier = (c) => (hand.has(c.id) ? 2 : specific.has(c.id) ? 1 : 0);
  pool.sort((a, b) => tier(b) - tier(a) || b.score - a.score);
  if (DRY) {
    console.log(`\n${job.id} ${job.title}:`);
    for (const c of pool.filter((c) => !used.has(c.id)).slice(0, 6))
      console.log(`  [${c.score}] ${c.title} (${c.license}) ${c.page}`);
    pool.slice(0, PER_JOB).forEach((c) => used.add(c.id));
    continue;
  }
  for (const image of pool) {
    if (photos.length >= PER_JOB) break;
    if (used.has(image.id)) continue;
    const bytes = await download(image);
    if (!bytes) continue;
    // Nome novo a cada rodada: o navegador não mostra a foto antiga do cache (as antigas viram órfãs e o
    // limpar-arquivos apaga).
    const path = `vagas/${COMPANY}/${job.id}-${STAMP}-${photos.length + 1}.jpg`;
    const up = await rest(`/storage/v1/object/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'image/jpeg', 'x-upsert': 'true', 'Cache-Control': '3600' },
      body: bytes
    });
    if (!up.ok) throw new Error(`upload ${job.id}: ${up.status} ${await up.text()}`);
    used.add(image.id);
    photos.push(`${url}/storage/v1/object/public/${path}`);
    credits.push(
      `${job.id} · [${image.score}] ${image.title} — ${image.creator || 'autor desconhecido'} (${image.license}) ${image.page ?? ''}`
    );
  }
  if (!photos.length) {
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
