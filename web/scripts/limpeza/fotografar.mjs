// C01 — fotografia de todas as rotas (modo demonstração), para provar que a interface não mudou na limpeza.
// Uso: FOTOS=/caminho/fora/do/repo node scripts/limpeza/fotografar.mjs <rotulo>
//      (com `npx vite preview --port 4173` servindo o `npm run build:demo`)
// Abre cada rota de src/routes.ts nas três sessões (sem login, trabalhador, construtora), em 360×800 e 1280×800,
// e salva um print por combinação — quando a rota não é da sessão, o print mostra para onde ela redireciona.
// Depois, alguns estados que só aparecem com um clique: modal aberto e erro de formulário.
// O relógio do navegador fica parado numa data fixa: a demonstração mostra datas relativas a "hoje", e a
// comparação do "depois" pode rodar em outro dia. Comparar: node scripts/limpeza/comparar.mjs <antes> <depois>
// SO=<regex> refaz só os prints cujo nome casa (para repetir os que diferiram por ruído de rasterização).
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const label = process.argv[2] ?? 'antes';
const out = process.env.FOTOS;
if (!out) throw new Error('Defina FOTOS=<pasta fora do repositório>.');
const base = process.env.BASE_URL ?? 'http://localhost:4173';
const chromePath = process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium';
const AGORA = new Date('2026-10-19T12:00:00-03:00');

const src = readFileSync(fileURLToPath(new URL('../../src/routes.ts', import.meta.url)), 'utf8');
const routes = [...src.matchAll(/compileRoute\('([^']+)',\s*(\w+)\(/g)].map(([, path, guard]) => ({ path, guard }));
if (routes.length < 50) throw new Error(`Só ${routes.length} rotas lidas de src/routes.ts: confira a regex.`);

// Ids reais da demonstração (src/data/seed.ts): BC-4821 é da Meridiano (construtora da demo), aberta, com o
// Jorge (trabalhador da demo) pré-selecionado; BC-4960 está fechada, com o Marcos concluído; BC-4835 tem
// candidatura enviada do Jorge; BC-4703 foi concluída pelo Jorge.
const ALVOS = {
  '/cadastro/:role': ['/cadastro/trabalhador', '/cadastro/recrutador'],
  '/completar-perfil/:role': ['/completar-perfil/trabalhador'],
  '/v/:id': ['/v/BC-4821'],
  '/vaga/:id': ['/vaga/BC-4821', '/vaga/BC-4841'],
  '/confirmar/:id': ['/confirmar/BC-4841'],
  '/enviado/:id': ['/enviado/BC-4835'],
  '/selecionado/:id': ['/selecionado/BC-4821'],
  '/avaliar/:id': ['/avaliar/BC-4703'],
  '/trabalhador/:id': ['/trabalhador/jorge'],
  '/trabalhador/:id/:jobId': ['/trabalhador/jorge/BC-4821'],
  '/construtora/:id': ['/construtora/meridiano'],
  '/avaliacoes/:type/:id': ['/avaliacoes/trabalhador/jorge', '/avaliacoes/construtora/meridiano'],
  '/vaga-editar/:id': ['/vaga-editar/BC-4821'],
  '/publicar-de-novo/:id': ['/publicar-de-novo/BC-4960'],
  '/vaga-publicada/:id': ['/vaga-publicada/BC-4821'],
  '/vaga-gerenciar/:id': ['/vaga-gerenciar/BC-4821', '/vaga-gerenciar/BC-4960'],
  '/fechado/:id': ['/fechado/BC-4960'],
  '/impulsionar/:id': ['/impulsionar/BC-4821'],
  '/impulsionar/:id/:plan': ['/impulsionar/BC-4821/24h'],
  '/avaliar-trabalhador/:jobId/:workerId': ['/avaliar-trabalhador/BC-4960/marcos']
};
const alvos = (path) => ALVOS[path] ?? (path.includes(':') ? null : [path]);
const semAlvo = routes.filter((r) => !alvos(r.path));
if (semAlvo.length) throw new Error(`Rota com parâmetro sem alvo de exemplo: ${semAlvo.map((r) => r.path)}`);

// Estados alcançados com um clique (sessão, rota, ação).
const ESTADOS = [
  { nome: 'filtros-aberto', sessao: 'trabalhador', alvo: '/mural', clique: { role: 'button', name: /^Filtros/ } },
  {
    nome: 'denunciar-aberto',
    sessao: 'trabalhador',
    alvo: '/vaga/BC-4841',
    clique: { role: 'button', name: 'Denunciar ou bloquear' }
  },
  {
    nome: 'convidar-aberto',
    sessao: 'construtora',
    alvo: '/trabalhador/jorge',
    clique: { role: 'button', name: 'Convidar para uma vaga' }
  },
  { nome: 'login-erro', sessao: 'nenhuma', alvo: '/login', clique: { role: 'button', name: 'Entrar', exact: true } },
  {
    nome: 'cadastro-erro',
    sessao: 'nenhuma',
    alvo: '/cadastro/trabalhador',
    clique: { role: 'button', name: 'Continuar', exact: true }
  },
  {
    nome: 'criar-vaga-erro',
    sessao: 'construtora',
    alvo: '/criar-vaga',
    clique: { role: 'button', name: 'Continuar', exact: true }
  },
  {
    nome: 'esqueci-senha-erro',
    sessao: 'nenhuma',
    alvo: '/esqueci-senha',
    clique: { role: 'button', name: /Enviar/ }
  }
];

const viewports = { celular: { width: 360, height: 800 }, desktop: { width: 1280, height: 800 } };
const browser = await chromium.launch({ executablePath: chromePath, args: ['--no-sandbox'] });
const dir = `${out}/${label}`;
mkdirSync(dir, { recursive: true });
const resultado = [];
const nomeArquivo = (...partes) => `${dir}/${partes.join('-').replace(/[^\w-]+/g, '_')}.png`;
const so = process.env.SO ? new RegExp(process.env.SO) : null;
const pula = (arquivo) => so && !so.test(arquivo.slice(dir.length + 1));

async function novaSessao(vp, papel) {
  const ctx = await browser.newContext({
    viewport: vp,
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo'
  });
  await ctx.clock.setFixedTime(AGORA);
  const page = await ctx.newPage();
  if (papel !== 'nenhuma') {
    await page.goto(base + '/login');
    await page.getByRole('button', { name: papel === 'construtora' ? /Construtora:/ : /Trabalhador:/ }).click();
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await page.waitForURL(/\/mural/, { timeout: 15000 });
  }
  return { ctx, page };
}

async function abrir(page, alvo) {
  await page.goto(base + alvo, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(400);
}

for (const [nome, vp] of Object.entries(viewports)) {
  for (const papel of ['nenhuma', 'trabalhador', 'construtora']) {
    const { ctx, page } = await novaSessao(vp, papel);
    for (const r of routes) {
      for (const alvo of alvos(r.path)) {
        const arquivo = nomeArquivo(nome, papel, alvo);
        if (pula(arquivo)) continue;
        try {
          await abrir(page, alvo);
          await page.screenshot({ path: arquivo, fullPage: true });
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
    }
    await ctx.close();
  }
  for (const est of ESTADOS) {
    const arquivo = nomeArquivo(nome, 'estado', est.nome);
    if (pula(arquivo)) continue;
    const { ctx, page } = await novaSessao(vp, est.sessao);
    try {
      await abrir(page, est.alvo);
      const { role, ...opts } = est.clique;
      await page.getByRole(role, opts).first().click({ timeout: 5000 });
      await page.waitForTimeout(600);
      await page.screenshot({ path: arquivo, fullPage: false });
      resultado.push({
        estado: est.nome,
        alvo: est.alvo,
        sessao: est.sessao,
        viewport: nome,
        final: page.url().replace(base, ''),
        arquivo
      });
    } catch (e) {
      resultado.push({
        estado: est.nome,
        alvo: est.alvo,
        sessao: est.sessao,
        viewport: nome,
        erro: String(e.message).slice(0, 200)
      });
    }
    await ctx.close();
  }
}
await browser.close();
if (!so) writeFileSync(`${dir}/rotas.json`, JSON.stringify(resultado, null, 1));
const erros = resultado.filter((r) => r.erro);
console.log(`${resultado.length} capturas em ${dir}; ${erros.length} com erro`);
for (const e of erros) console.log(`  erro: ${e.viewport} ${e.sessao} ${e.alvo} ${e.estado ?? ''} — ${e.erro}`);
