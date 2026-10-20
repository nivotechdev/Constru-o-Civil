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
// Palavras do título → buscas no Commons (em inglês, onde o acervo é maior), da mais certeira à mais geral.
const SEARCHES = [
  [/mestre de obras/i, ['construction foreman', 'construction workers helmet site']],
  [/contrapiso/i, ['concrete floor screed', 'pouring concrete floor worker']],
  [/pintor/i, ['painter painting wall roller', 'house painter wall']],
  [/eletricista/i, ['electrician working', 'electrical wiring installation']],
  [/limpeza/i, ['cleaning construction site', 'renovation cleaning floor']],
  [/telhadista|telha/i, ['roofer working roof', 'roof tiles installation']],
  [/azulejista/i, ['tiler laying tiles', 'ceramic tiles installation']],
  [/armador|funda/i, ['rebar worker', 'steel reinforcement concrete construction']],
  [/encanador/i, ['plumber working', 'plumbing pipes installation']],
  [/ajudante de pedreiro|pedreiro/i, ['bricklayer laying bricks', 'mason building brick wall']]
];
const FALLBACK = ['construction worker', 'construction site workers'];
// U36 (2ª rodada): a 1ª trouxe pintura de museu, foto do século passado, ferramenta solta e paisagem. Agora vêm
// primeiro as fotos de banco de imagem livre (Pexels/Unsplash/Pixabay antigos, CC0) e as recentes; pintura,
// desenho, acervo histórico, militar e objeto quebrado ficam de fora.
const STOCK = /pexels|unsplash|pixabay|stocksnap|burst|rawpixel/i;
const REJECT =
  /paint(ing)? by|painting|fresco|munch|drawing|illustration|engraving|lithograph|poster|museum|archive|lccn|dpla|zentralbibliothek|library of congress|army|navy|military|soldier|seabee|dvids|air force|marine|broken|wrench|mountain|landscape|map\b|diagram|logo/i;

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

async function search(text) {
  const q = new URLSearchParams({
    action: 'query',
    format: 'json',
    generator: 'search',
    gsrnamespace: '6',
    gsrsearch: `${text} filetype:bitmap`,
    gsrlimit: '50',
    prop: 'imageinfo',
    iiprop: 'url|size|mime|extmetadata',
    iiurlwidth: '1280'
  });
  const res = await fetch(`https://commons.wikimedia.org/w/api.php?${q}`, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Commons ${res.status} para "${text}"`);
  return Object.values((await res.json()).query?.pages ?? {}).sort((x, y) => x.index - y.index);
}

/** As fotos livres e boas de uma busca, com nota: banco de imagem e recentes primeiro. */
async function candidates(query) {
  const pages = [
    ...(await search(`${query} pexels`)),
    ...(await search(`${query} unsplash`)),
    ...(await search(`${query} pixabay`)),
    ...(await search(query))
  ];
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
      ({ info, about, year, license }) =>
        info?.mime === 'image/jpeg' &&
        FREE.test(license) &&
        info.width >= 1000 &&
        info.width >= info.height &&
        info.width <= info.height * 2.2 &&
        info.thumburl &&
        !REJECT.test(about) &&
        !(year && year < 1995)
    )
    .map((c) => ({ ...c, score: (STOCK.test(c.about) ? 4 : 0) + (c.year && c.year >= 2010 ? 2 : 0) }))
    .sort((a, b) => b.score - a.score)
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
const STAMP = Date.now().toString(36);
const credits = [];

for (const job of jobs) {
  const queries = SEARCHES.find(([re]) => re.test(job.title))?.[1] ?? FALLBACK;
  const photos = [];
  // As buscas da vaga e, se faltar foto boa, as gerais.
  const pool = [];
  for (const q of [...queries, ...FALLBACK]) {
    pool.push(...(await candidates(q)));
    if (pool.filter((c) => !used.has(c.id)).length >= 6) break;
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
if (!credits.length) throw new Error('Nenhuma foto encontrada.');
