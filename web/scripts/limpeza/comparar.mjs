// C10 — compara pixel a pixel duas fotografias de fotografar.mjs. Diferença aceitável: zero.
// Uso: node scripts/limpeza/comparar.mjs <pasta-antes> <pasta-depois>
// Mostra, para cada print diferente, quantos pixels e a maior diferença de cor (0–255). Dois prints da mesma
// build podem diferir em poucos pixels por 1–3 níveis (antialiasing): refaça só esses com SO=… e compare de novo.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const [antes, depois] = process.argv.slice(2);
if (!antes || !depois) throw new Error('Uso: comparar.mjs <pasta-antes> <pasta-depois>');
const pngs = (d) => readdirSync(d).filter((f) => f.endsWith('.png'));
const a = pngs(antes);
const b = new Set(pngs(depois));
let iguais = 0;
const problemas = [];
for (const f of a) {
  if (!b.has(f)) {
    problemas.push(`${f}: só no antes`);
    continue;
  }
  b.delete(f);
  const x = PNG.sync.read(readFileSync(`${antes}/${f}`));
  const y = PNG.sync.read(readFileSync(`${depois}/${f}`));
  if (x.width !== y.width || x.height !== y.height) {
    problemas.push(`${f}: tamanho ${x.width}×${x.height} → ${y.width}×${y.height}`);
    continue;
  }
  const diff = pixelmatch(x.data, y.data, null, x.width, x.height, { threshold: 0 });
  let delta = 0;
  for (let i = 0; i < x.data.length; i++) delta = Math.max(delta, Math.abs(x.data[i] - y.data[i]));
  if (diff || delta) problemas.push(`${f}: ${diff} pixels diferentes, maior diferença de cor ${delta}`);
  else iguais++;
}
for (const f of b) problemas.push(`${f}: só no depois`);
for (const n of ['rotas.json']) {
  if (existsSync(`${antes}/${n}`) && existsSync(`${depois}/${n}`)) {
    const sem = (d) =>
      JSON.parse(readFileSync(`${d}/${n}`, 'utf8')).map((r) => JSON.stringify({ ...r, arquivo: undefined }));
    const ra = sem(antes);
    const rb = sem(depois);
    ra.forEach((r, i) => r !== rb[i] && problemas.push(`rotas.json linha ${i}: ${r} → ${rb[i]}`));
  }
}
console.log(`${a.length} prints no antes; ${iguais} idênticos; ${problemas.length} diferenças`);
for (const p of problemas) console.log('  ' + p);
process.exit(problemas.length ? 1 : 0);
