// C09 — confere os links relativos entre os .md do repositório (fora de archive/): todo [texto](caminho) aponta
// para um arquivo ou pasta que existe; e todo caminho citado entre crases (`web/docs/X.md`, `scripts/deploy.sh`)
// existe a partir da pasta do .md, da raiz ou de web/ — ou é o fim do caminho de um arquivo do repositório
// (os documentos abreviam: `remote/session.ts`). Uso (na raiz do repositório): node web/scripts/limpeza/links.mjs
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const arquivos = execSync('git ls-files "*.md"', { encoding: 'utf8' })
  .split('\n')
  .filter((f) => f && !f.startsWith('archive/') && f !== 'web/docs/LIMPEZA.md'); // este cita de propósito o que sumiu
const todos = execSync('git ls-files', { encoding: 'utf8' }).split('\n');
const quebrados = [];
let total = 0;
for (const f of arquivos) {
  const texto = readFileSync(f, 'utf8').replace(/```[\s\S]*?```/g, '');
  for (const [, alvo] of texto.matchAll(/\]\(([^)\s]+)\)/g)) {
    if (/^(https?:|mailto:|#)/.test(alvo)) continue;
    total++;
    const caminho = join(dirname(f), decodeURI(alvo.split('#')[0]));
    if (!existsSync(caminho)) quebrados.push(`${f} → ${alvo}`);
  }
  for (const [, citado] of texto.matchAll(
    /`((?:\.{1,2}\/)?[\w.-]+\/[\w./-]*\.(?:md|tsx?|mjs|js|sh|sql|css|json|ya?ml|html))`/g
  )) {
    total++;
    const bases = [dirname(f), '.', 'web', 'web/src', 'web/supabase'];
    const achou = bases.some((b) => existsSync(join(b, citado))) || todos.some((t) => t.endsWith('/' + citado));
    if (!achou) quebrados.push(`${f} → \`${citado}\``);
  }
}
console.log(`${arquivos.length} arquivos .md, ${total} links relativos, ${quebrados.length} quebrados`);
for (const q of quebrados) console.log('  ' + q);
process.exit(quebrados.length ? 1 : 0);
