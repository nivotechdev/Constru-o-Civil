#!/usr/bin/env node
// Monta (e, com DATABASE_URL, roda) um teste SQL de supabase/tests/: os utilitários (_helpers.sql), as
// migrations ainda não aplicadas que o teste precisa (--with) e o teste, tudo numa transação desfeita.
//
//   node supabase/tests/run.mjs supabase/tests/z01_candidaturas.sql             # imprime o SQL
//   node supabase/tests/run.mjs --with supabase/migrations/2026…_z01….sql supabase/tests/z01_candidaturas.sql
//   DATABASE_URL=postgres://… node supabase/tests/run.mjs supabase/tests/*.sql  # roda com psql
//
// O SQL impresso pode ser colado no SQL Editor do Supabase. Nada fica gravado: o teste termina em rollback.
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const withFiles = [];
const tests = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--with') withFiles.push(args[++i]);
  else tests.push(args[i]);
}
if (!tests.length) {
  console.error('Uso: node supabase/tests/run.mjs [--with migration.sql]… teste.sql…');
  process.exit(2);
}

const strip = (sql) => sql.replace(/^\s*begin;\s*$/gim, '').replace(/^\s*rollback;\s*$/gim, '');
const helpers = readFileSync(join(here, '_helpers.sql'), 'utf8');

let failed = 0;
for (const test of tests) {
  const sql = [
    'begin;',
    ...withFiles.map((f) => readFileSync(f, 'utf8')),
    helpers,
    strip(readFileSync(test, 'utf8')),
    "select 'TODOS OS TESTES PASSARAM' as resultado;",
    'rollback;'
  ].join('\n');
  if (!process.env.DATABASE_URL) {
    process.stdout.write(sql + '\n');
    continue;
  }
  const run = spawnSync('psql', [process.env.DATABASE_URL, '-v', 'ON_ERROR_STOP=1', '-q', '-f', '-'], {
    input: sql,
    encoding: 'utf8',
    env: { ...process.env, PGOPTIONS: '-c client_min_messages=warning' }
  });
  const ok = run.status === 0 && run.stdout.includes('TODOS OS TESTES PASSARAM');
  console.log(`${ok ? '✓' : '✗'} ${test}`);
  if (!ok) {
    failed++;
    console.log(run.stdout.split('\n').filter(Boolean).slice(-5).join('\n'), run.stderr);
  }
}
process.exit(failed ? 1 : 0);
