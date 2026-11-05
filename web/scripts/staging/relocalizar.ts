// U77 — Põe as vagas e os endereços do STAGING no ponto certo com o geocodificador do U76 (o mesmo do app).
// As vagas de exemplo foram gravadas com coordenadas digitadas à mão (ex.: -29.15, -51.17: até ~1 km de erro) e
// endereços antigos ficaram no "ponto do CEP" que é o centro da cidade. Roda pelo workflow "staging-localizacao"
// (aqui a rede de fora não alcança os mapas). O texto dos endereços não muda — só o ponto (e, numa vaga de exemplo
// cujo CEP não é daquela rua, o CEP certo da rua).
//
//   DB_URL=<conexão do banco do staging> VITE_SUPABASE_URL=… VITE_SUPABASE_ANON_KEY=… [ENSAIO=1] \
//     npx vite-node scripts/staging/relocalizar.ts
// Lê e grava pelo psql (o mesmo acesso das migrations do staging). Só no staging: recusa a produção. Nada de dado
// pessoal no relatório (dos endereços de conta, só o começo do id).
import { spawnSync } from 'node:child_process';
import { geocode, resolveAddress, type AddressDraft } from '../../src/services/address';
import { cityByLabel } from '../../src/services/cities';
import { distanceKm } from '../../src/utils/geo';

const dbUrl = process.env.DB_URL ?? '';
const dry = Boolean(process.env.ENSAIO);
if (!dbUrl) throw new Error('Falta DB_URL (conexão do banco do staging).');
if (dbUrl.includes('ppnxdajiihsjaojxokzh')) throw new Error('Isto é só para o staging.');

/** Roda um SQL no banco do staging e devolve a saída (uma linha, sem cabeçalho). */
function sql(query: string): string {
  const r = spawnSync('psql', [dbUrl, '-v', 'ON_ERROR_STOP=1', '-At', '-c', query], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`psql: ${(r.stderr || '').trim().slice(0, 300)}`);
  return r.stdout.trim();
}
const rows = <T>(query: string): T[] => JSON.parse(sql(`select coalesce(json_agg(t), '[]') from (${query}) t`)) as T[];
const num = (n: number) => {
  if (!Number.isFinite(n)) throw new Error('número inválido');
  return String(n);
};
const text = (v: string, pattern: RegExp) => {
  if (!pattern.test(v)) throw new Error('valor inesperado');
  return `'${v}'`;
};

// O Nominatim pede que cada programa se identifique (no navegador, o próprio navegador faz isso).
const realFetch = globalThis.fetch;
globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const target = String(input instanceof Request ? input.url : input);
  if (target.includes('openstreetmap') || target.includes('komoot')) {
    const headers = new Headers(init?.headers);
    headers.set('User-Agent', 'Valorjob-staging/1.0 (https://nivotech.com.br)');
    headers.set('Referer', 'https://nivotechdev.github.io/Constru-o-Civil/');
    return realFetch(input, { ...init, headers });
  }
  return realFetch(input, init);
}) as typeof fetch;

type Point = { lat: number; lon: number };
type Found = { point: Point; precision: string; cep: string };

/** O endereço como o app o salvaria hoje; null quando nem a rua se acha. */
async function locate(d: AddressDraft & { uf: string; cityName: string }): Promise<Found | null> {
  const r = await resolveAddress(d);
  if (r.ok)
    return { point: { lat: r.address.lat, lon: r.address.lon }, precision: r.address.precision, cep: r.address.cep };
  // Um CEP que não é daquela rua (vaga de exemplo): sem ele, o CEP se acha pela rua.
  if (r.errors.cep && d.cep) {
    const again = await resolveAddress({ ...d, cep: '' });
    if (again.ok)
      return {
        point: { lat: again.address.lat, lon: again.address.lon },
        precision: again.address.precision,
        cep: again.address.cep
      };
  }
  // Nem a rua no Correios: o ponto direto do mapa.
  const city = cityByLabel(d.city);
  if (!city) return null;
  const g = await geocode({
    street: d.street,
    number: d.number ?? '',
    neighborhood: d.neighborhood,
    city: city.name,
    uf: city.uf,
    cep: d.cep,
    cityCentre: { lat: city.lat, lon: city.lon },
    cepPoint: null
  });
  return { point: g.point, precision: g.precision, cep: d.cep };
}

const metres = (a: Point, b: Point) => Math.round(distanceKm(a, b) * 1000);
const lines: string[] = [];
const out = (s: string) => {
  lines.push(s);
  console.log(s);
};

out(`## Relocalizar o staging (U77)${dry ? ' — ensaio, nada gravado' : ''}\n`);

type JobRow = {
  id: string;
  title: string | null;
  cep: string;
  street: string;
  number: string | null;
  neighborhood: string;
  city: string;
  uf: string;
  lat: number;
  lon: number;
};
const jobs = rows<JobRow>(
  'select id, title, cep, street, number, neighborhood, city, uf, lat, lon from public.jobs where deleted_at is null order by id'
);
out(`### Vagas (${jobs.length})\n`);
out('| vaga | endereço | antes | depois | precisão | mudou |');
out('| --- | --- | --- | --- | --- | --- |');
let moved = 0;
for (const j of jobs) {
  const before = { lat: j.lat, lon: j.lon };
  const found = await locate({
    cep: j.cep ?? '',
    city: `${j.city}, ${j.uf}`,
    street: j.street,
    neighborhood: j.neighborhood,
    number: j.number ?? '',
    uf: j.uf,
    cityName: j.city
  }).catch((e: unknown) => {
    out(`| ${j.id} | ${j.street}, ${j.neighborhood} | erro: ${String(e).slice(0, 80)} | | | |`);
    return null;
  });
  if (!found) continue;
  const d = metres(before, found.point);
  const cepChanged = Boolean(found.cep) && found.cep !== j.cep;
  out(
    `| ${j.id} | ${j.street}${j.number ? ', ' + j.number : ''} — ${j.neighborhood}${cepChanged ? ` (CEP ${j.cep} → ${found.cep})` : ''} | ` +
      `${before.lat}, ${before.lon} | ${found.point.lat}, ${found.point.lon} | ${found.precision} | ${d} m |`
  );
  if (d < 15 && !cepChanged) continue;
  moved++;
  if (!dry)
    sql(
      `update public.jobs set lat = ${num(found.point.lat)}, lon = ${num(found.point.lon)}` +
        (cepChanged ? `, cep = ${text(found.cep, /^\d{5}-\d{3}$/)}` : '') +
        ` where id = ${text(j.id, /^BC-\d+$/)}`
    );
}
out(`\n${moved} vaga(s) ${dry ? 'mudariam' : 'mudaram'} de lugar.\n`);

type AddressRow = {
  account_id: string;
  cep: string;
  street: string;
  neighborhood: string;
  city: string;
  uf: string;
  lat: number;
  lon: number;
  precision: string;
};
const addresses = rows<AddressRow>(
  'select account_id, cep, street, neighborhood, city, uf, lat, lon, precision from public.addresses order by account_id'
);
out(`### Endereços de conta (${addresses.length})\n`);
out('| conta | precisão antes | precisão depois | mudou |');
out('| --- | --- | --- | --- |');
let movedHomes = 0;
for (const a of addresses) {
  const before = { lat: a.lat, lon: a.lon };
  const found = await locate({
    cep: a.cep,
    city: `${a.city}, ${a.uf}`,
    street: a.street,
    neighborhood: a.neighborhood,
    uf: a.uf,
    cityName: a.city
  }).catch(() => null);
  const id = a.account_id.slice(0, 8);
  if (!found) {
    out(`| ${id}… | ${a.precision} | não achado | — |`);
    continue;
  }
  const d = metres(before, found.point);
  out(`| ${id}… | ${a.precision} | ${found.precision} | ${d} m |`);
  if (d < 15) continue;
  movedHomes++;
  if (!dry) {
    const account = text(a.account_id, /^[0-9a-f-]{36}$/);
    sql(
      `update public.addresses set lat = ${num(found.point.lat)}, lon = ${num(found.point.lon)}, ` +
        `precision = ${text(found.precision, /^(numero|rua|cep|bairro|cidade)$/)} where account_id = ${account}`
    );
    // O ponto público do trabalhador (arredondado a ~1 km), como o set_my_address faz.
    sql(
      `update public.workers set lat = round(${num(found.point.lat)}::numeric, 2), ` +
        `lon = round(${num(found.point.lon)}::numeric, 2) where id = ${account}`
    );
  }
}
out(`\n${movedHomes} endereço(s) ${dry ? 'mudariam' : 'mudaram'} de lugar.`);

if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFileSync } = await import('node:fs');
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n');
}
