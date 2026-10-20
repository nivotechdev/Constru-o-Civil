#!/usr/bin/env node
// U36 — Fotos reais nas vagas de TESTE do staging (conta recrutador.teste@bicos.test). Busca no Openverse (o acervo
// aberto do WordPress/Creative Commons) só fotos de domínio público ou CC0 — uso livre, sem obrigação de crédito —,
// duas por vaga, sem repetir, envia ao bucket `vagas` na pasta da construtora (a mesma regra do app) e grava em
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
// Palavras do título → busca no Openverse (em inglês, onde o acervo é maior).
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

async function candidates(query) {
  const q = new URLSearchParams({ q: query, license: 'cc0,pdm', page_size: '30', mature: 'false' });
  const res = await fetch(`https://api.openverse.org/v1/images/?${q}`, { headers: { 'User-Agent': 'bicos-staging' } });
  if (!res.ok) throw new Error(`Openverse ${res.status} para "${query}"`);
  const { results } = await res.json();
  return results.filter(
    (r) => /jpe?g/i.test(r.filetype ?? r.url) && r.width >= 900 && r.width >= r.height && r.width <= r.height * 2.2
  );
}

async function download(image) {
  // A miniatura grande do próprio Openverse (redimensionada e comprimida); senão o original, se não for enorme.
  for (const src of [
    `https://api.openverse.org/v1/images/${image.id}/thumb/?full_size=true&compressed=true`,
    image.url
  ]) {
    try {
      const res = await fetch(src, { headers: { 'User-Agent': 'bicos-staging' } });
      if (!res.ok || !/image\/jpe?g/i.test(res.headers.get('content-type') ?? '')) continue;
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (bytes.length > 20_000 && bytes.length < 3_500_000) return bytes;
    } catch {
      // tenta a próxima
    }
  }
  return null;
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
  for (const image of await candidates(query)) {
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
