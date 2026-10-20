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
// Palavras do título → busca no Commons (em inglês, onde o acervo é maior).
const SEARCHES = [
  [/mestre de obras/i, 'construction site workers'],
  [/contrapiso/i, 'concrete floor construction worker'],
  [/pintor de fachada|pintor/i, 'house painter painting wall'],
  [/eletricista/i, 'electrician wiring'],
  [/limpeza/i, 'construction site cleaning'],
  [/telhadista|telha/i, 'roofer roof tiles'],
  [/azulejista/i, 'tiler laying tiles'],
  [/armador|funda/i, 'rebar reinforcement construction'],
  [/encanador/i, 'plumber pipes'],
  [/ajudante de pedreiro|pedreiro/i, 'bricklayer brick wall']
];

const rest = (path, init = {}) =>
  fetch(`${url}${path}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, ...(init.headers ?? {}) }
  });

const UA = 'BicosStaging/1.0 (https://github.com/nivotechdev/Constru-o-Civil)';
const FREE = /^(public domain|pd|cc0|cc-zero|cc0 1\.0)/i;

async function candidates(query) {
  const q = new URLSearchParams({
    action: 'query',
    format: 'json',
    generator: 'search',
    gsrnamespace: '6',
    gsrsearch: `${query} filetype:bitmap`,
    gsrlimit: '50',
    prop: 'imageinfo',
    iiprop: 'url|size|mime|extmetadata',
    iiurlwidth: '1280'
  });
  const res = await fetch(`https://commons.wikimedia.org/w/api.php?${q}`, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Commons ${res.status} para "${query}"`);
  const pages = Object.values((await res.json()).query?.pages ?? {}).sort((x, y) => x.index - y.index);
  return pages
    .map((p) => ({ id: p.pageid, title: p.title, info: p.imageinfo?.[0] }))
    .filter(({ info }) => {
      const license = info?.extmetadata?.LicenseShortName?.value ?? '';
      return (
        info?.mime === 'image/jpeg' &&
        FREE.test(license) &&
        info.width >= 1000 &&
        info.width >= info.height &&
        info.width <= info.height * 2.2 &&
        info.thumburl
      );
    })
    .map(({ id, title, info }) => ({
      id,
      title,
      thumb: info.thumburl,
      license: info.extmetadata?.LicenseShortName?.value,
      creator: (info.extmetadata?.Artist?.value ?? '').replace(/<[^>]+>/g, '').trim(),
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
const credits = [];

for (const job of jobs) {
  const query = SEARCHES.find(([re]) => re.test(job.title))?.[1] ?? 'construction worker';
  const photos = [];
  // A busca da vaga e, se faltar foto boa, uma mais geral.
  const pool = [...(await candidates(query)), ...(await candidates('construction worker building site'))];
  for (const image of pool) {
    if (photos.length >= PER_JOB) break;
    if (used.has(image.id)) continue;
    const bytes = await download(image);
    if (!bytes) continue;
    const path = `vagas/${COMPANY}/${job.id}-${photos.length + 1}.jpg`;
    const up = await rest(`/storage/v1/object/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'image/jpeg', 'x-upsert': 'true', 'Cache-Control': '3600' },
      body: bytes
    });
    if (!up.ok) throw new Error(`upload ${job.id}: ${up.status} ${await up.text()}`);
    used.add(image.id);
    photos.push(`${url}/storage/v1/object/public/${path}`);
    credits.push(
      `${job.id} · ${image.title ?? 'sem título'} — ${image.creator ?? 'autor desconhecido'} (${image.license}) ${image.foreign_landing_url ?? ''}`
    );
  }
  if (!photos.length) {
    console.log(`✗ ${job.id} ${job.title}: nenhuma foto boa para "${query}"`);
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
