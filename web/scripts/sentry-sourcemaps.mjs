#!/usr/bin/env node
// L05 — Depois de `npm run build`: envia os source maps de dist/ ao Sentry (se configurado) e APAGA os .map de
// dist/, para não serem publicados. Roda sempre antes de publicar (scripts/deploy.sh).
//
// Com SENTRY_AUTH_TOKEN, SENTRY_ORG e SENTRY_PROJECT (só no ambiente do deploy, nunca no repositório), a release
// é a mesma que o app manda nos erros: bicos-web@<commit>, calculada como no vite.config.ts (commitRelease).
import { execFileSync } from 'node:child_process';
import { readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const dist = new URL('../dist/', import.meta.url).pathname;
const assets = join(dist, 'assets');
const maps = readdirSync(assets).filter((f) => f.endsWith('.map'));
if (!maps.length) {
  console.log('Nenhum source map em dist/assets (build de demonstração?).');
  process.exit(0);
}

const { SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT } = process.env;
if (SENTRY_AUTH_TOKEN && SENTRY_ORG && SENTRY_PROJECT) {
  const fromCi = process.env.VITE_RELEASE || process.env.CF_PAGES_COMMIT_SHA || process.env.GITHUB_SHA;
  const commit = fromCi
    ? fromCi.slice(0, 12)
    : execFileSync('git', ['rev-parse', '--short=12', 'HEAD']).toString().trim();
  const name = `bicos-web@${commit}`;
  const cli = (...args) => execFileSync('npx', ['--yes', '@sentry/cli@2.39.1', ...args], { stdio: 'inherit' });
  cli('releases', 'new', name, '--org', SENTRY_ORG, '--project', SENTRY_PROJECT);
  cli(
    'sourcemaps',
    'upload',
    '--org',
    SENTRY_ORG,
    '--project',
    SENTRY_PROJECT,
    '--release',
    name,
    '--url-prefix',
    '~/assets',
    assets
  );
  cli('releases', 'finalize', name, '--org', SENTRY_ORG, '--project', SENTRY_PROJECT);
  console.log(`Source maps enviados ao Sentry (${name}).`);
} else {
  console.log('Sentry sem SENTRY_AUTH_TOKEN/ORG/PROJECT: source maps não enviados.');
}

for (const f of maps) rmSync(join(assets, f));
console.log(`${maps.length} source maps apagados de dist/ (não são publicados).`);
