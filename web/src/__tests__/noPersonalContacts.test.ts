// AUD-082: the repository is public; the developers' personal e-mail does not belong in code, examples or
// workflows. Support contacts come from the environment (VITE_SUPORTE_EMAIL / VITE_SUPORTE_WHATSAPP).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const web = fileURLToPath(new URL('../..', import.meta.url));
const repo = join(web, '..');

function walk(dir: string, skip: (path: string) => boolean): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (skip(path)) return [];
    return statSync(path).isDirectory() ? walk(path, skip) : [path];
  });
}

describe('sem contato pessoal no repositório (AUD-082)', () => {
  it('the support mailbox and phone of the developers are in no code, example, workflow or doc', () => {
    const skip = (p: string) =>
      /node_modules|[\\/]dist|[\\/]\.git[\\/]|docs[\\/]auditoria|AUDITORIA|PLANO-CORRECAO|PROMPT-CORRECAO|RELATORIO-CORRECAO|\.(png|jpe?g|webp|ico|woff2?|svg|tsbuildinfo)$/.test(
        p
      );
    const files = [...walk(web, skip), ...walk(join(repo, '.github'), skip), join(repo, 'CLAUDE.md')];
    const offenders = files.filter((f) =>
      /nivotech\.dev@gmail|5499473\d{4}|9473-16\d\d/i.test(readFileSync(f, 'utf8'))
    );
    expect(offenders.map((f) => relative(repo, f))).toEqual([]);
  });
});
