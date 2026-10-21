// X05: axe-core (WCAG 2.1 A/AA) on the main screens of the demo build, as worker and as company, on a
// phone-sized window. Needs `npx vite preview --port 4173` running and axe-core installed (the CI does both).
// Exits 1 when anything is found.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const axe = readFileSync('node_modules/axe-core/axe.min.js', 'utf8');
const b = await chromium.launch();
const results = {};
async function scan(p, name) {
  await p.addScriptTag({ content: axe });
  const r = await p.evaluate(async () =>
    (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] })).violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      n: v.nodes.length,
      sample: v.nodes.slice(0, 2).map((x) => x.target.join(' ') + ' :: ' + (x.failureSummary || '').split('\n')[1])
    }))
  );
  results[name] = r;
}
for (const [who, email, pages] of [
  [
    'w',
    'trabalhador@bicos.demo',
    ['/mural', '/vaga/BC-4821', '/candidaturas', '/perfil', '/configuracoes', '/configuracoes/avisos', '/salvas']
  ],
  ['r', 'empresa@bicos.demo', ['/minhas-vagas', '/publicar', '/pagamentos', '/empresa', '/configuracoes']]
]) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  // U21/U30: A11Y_TEMA=escuro checks the same screens in the dark theme. The demo keeps no database, so the dark
  // colours are pinned on the page (the theme's own logic is covered by src/__tests__/theme.test.ts).
  if (process.env.A11Y_TEMA === 'escuro')
    await ctx.addInitScript(() => {
      const root = document.documentElement;
      const pin = () => root.dataset.theme !== 'dark' && (root.dataset.theme = 'dark');
      pin();
      new MutationObserver(pin).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    });
  const p = await ctx.newPage();
  await p.goto('http://localhost:4173/login');
  await p.waitForTimeout(800);
  await scan(p, who + ':/login');
  await p.fill('#login-identifier', email);
  await p.fill('#login-password', 'bicos123');
  await p.press('#login-password', 'Enter');
  await p.waitForTimeout(1500);
  for (const path of pages) {
    await p.goto('http://localhost:4173' + path);
    await p.waitForTimeout(1500);
    await scan(p, who + ':' + path);
  }
  await ctx.close();
}
await b.close();
let failed = false;
for (const [k, v] of Object.entries(results)) {
  if (!v.length) continue;
  failed = true;
  console.log('✗', k, JSON.stringify(v, null, 1));
}
console.log(
  failed
    ? 'Problemas de acessibilidade encontrados.'
    : `✓ ${Object.keys(results).length} telas sem problemas (WCAG 2.1 A/AA).`
);
process.exit(failed ? 1 : 0);
