#!/usr/bin/env node
// Junta as migrations ainda não aplicadas no projeto (as de depois de 2026-10-09) em supabase/APLICAR-TUDO.sql,
// para colar de uma vez no SQL Editor. Os valores novos de enum vão primeiro, numa transação própria (o
// Postgres não deixa usar um valor de enum na mesma transação que o criou); o resto vai numa transação só:
// se algo falhar, nada fica pela metade.   node scripts/aplicar-tudo.mjs
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('../supabase/migrations/', import.meta.url));
const out = fileURLToPath(new URL('../supabase/APLICAR-TUDO.sql', import.meta.url));
const APPLIED_UNTIL = '20261009000300';

const files = readdirSync(dir)
  .filter((f) => f.endsWith('.sql') && f.slice(0, 14) > APPLIED_UNTIL)
  .sort();
const enumLines = [];
const bodies = [];
for (const f of files) {
  const sql = readFileSync(dir + f, 'utf8');
  for (const line of sql.split('\n')) if (/^alter type .* add value/i.test(line.trim())) enumLines.push(line.trim());
  bodies.push(`-- ===== ${f} =====\n${sql.trim()}\n`);
}
const text = `-- GERADO por scripts/aplicar-tudo.mjs — não edite à mão. Ordem e conferências em APLICAR.md.
-- ${files.length} migrations (${files[0]} … ${files[files.length - 1]}).
-- Cole tudo no SQL Editor do Supabase e rode. Cada migration é idempotente: rodar de novo não estraga nada.

-- Parte 1: valores novos de enum (precisam estar gravados antes do resto).
begin;
${[...new Set(enumLines)].join('\n')}
commit;

-- Parte 2: as migrations, numa transação só.
begin;

${bodies.join('\n')}
commit;
`;
writeFileSync(out, text);
console.log(`APLICAR-TUDO.sql: ${files.length} migrations.`);
