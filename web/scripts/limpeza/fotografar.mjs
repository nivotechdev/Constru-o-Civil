// C01 — fotografia de todas as rotas (modo demonstração), para provar que a interface não mudou na limpeza.
// Uso: FOTOS=/caminho/fora/do/repo node scripts/limpeza/fotografar.mjs <rotulo>
// Abre cada rota de src/routes.ts com a sessão que ela pede (sem login, trabalhador ou construtora), em 360×800
// e 1280×800, e salva um print por rota. Os prints ficam fora do repositório; a lista de rotas vai para o JSON.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const label = process.argv[2] ?? 'antes';
const out = process.env.FOTOS;
if (!out) throw new Error('Defina FOTOS=<pasta fora do repositório>.');
const base = process.env.BASE_URL ?? 'http://localhost:4173';
const chromePath = process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium';

const src = readFileSync(fileURLToPath(new URL('../../src/routes.ts', import.meta.url)), 'utf8');
// access → sessão: guest/onboarding/public = sem login; app/trabalhador = trabalhador; recrutador = construtora.
const routes = [...src.matchAll(/compileRoute\('([^']+)',\s*(\w+)\(/g)].map(([, path, guard]) => ({ path, guard }));
// Parâmetros de exemplo, com os ids da demonstração (seed).
const exemplo = {
  id: 'BC-5001',
  role: 'trabalhador',
  plan: 'destaque',
  jobId: 'BC-5001',
  workerId: 'w-ana',
  type: 'trabalhador'
};
const preenche = (p) => p.replace(/:(\w+)/g, (_, k) => exemplo[k] ?? k);
const sessao = (guard) =>
  guard === 'worker' || guard === 'app' ? 'trabalhador' : guard === 'company' ? 'construtora' : null;
const viewports = { celular: { width: 360, height: 800 }, desktop: { width: 1280, height: 800 } };

const browser = await chromium.launch({ executablePath: chromePath, args: ['--no-sandbox'] });
const dir = `${out}/${label}`;
mkdirSync(dir, { recursive: true });
const resultado = [];

async function entrar(page, papel) {
  await page.goto(base + '/login');
  await page.getByRole('button', { name: papel === 'construtora' ? /Construtora:/ : /Trabalhador:/ }).click();
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.waitForURL(/\/mural/, { timeout: 15000 }).catch(() => undefined);
}

for (const [nome, vp] of Object.entries(viewports)) {
  for (const papel of ['nenhuma', 'trabalhador', 'construtora']) {
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    if (papel !== 'nenhuma') await entrar(page, papel);
    for (const r of routes) {
      if (
        sessao(r.guard) !== (papel === 'nenhuma' ? null : papel === 'trabalhador' ? 'trabalhador' : 'construtora') &&
        !(papel === 'nenhuma' && sessao(r.guard) === null)
      )
        continue;
      const alvo = preenche(r.path);
      const arquivo = `${dir}/${nome}-${papel}-${alvo.replace(/[^\w-]+/g, '_')}.png`;
      try {
        await page.goto(base + alvo, { waitUntil: 'networkidle', timeout: 20000 });
        await page.waitForTimeout(400);
        await page.screenshot({ path: arquivo, fullPage: false });
        resultado.push({
          rota: r.path,
          alvo,
          guard: r.guard,
          sessao: papel,
          viewport: nome,
          final: page.url().replace(base, ''),
          arquivo
        });
      } catch (e) {
        resultado.push({
          rota: r.path,
          alvo,
          guard: r.guard,
          sessao: papel,
          viewport: nome,
          erro: String(e.message).slice(0, 200)
        });
      }
    }
    await ctx.close();
  }
}
await browser.close();
writeFileSync(`${dir}/rotas.json`, JSON.stringify(resultado, null, 1));
console.log(`${resultado.length} capturas em ${dir}`);
