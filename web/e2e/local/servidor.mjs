#!/usr/bin/env node
// L03 — Ambiente do E2E LOCAL: um proxy na porta 55400 que manda /functions/v1/<nome> para a função rodando no
// Deno (serve-fn.ts) e todo o resto para o Supabase local (supabase start). O app do E2E aponta para o proxy.
//   E2E_SUPABASE_URL=http://127.0.0.1:55321 SUPABASE_ANON_KEY=… SUPABASE_SERVICE_ROLE_KEY=… node e2e/local/servidor.mjs
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const API = process.env.E2E_SUPABASE_URL ?? 'http://127.0.0.1:55321';
const DENO = process.env.DENO_BIN ?? 'deno';
const FUNCTIONS = ['entrar-com-documento', 'excluir-conta', 'verificar-cnpj'];
const here = fileURLToPath(new URL('.', import.meta.url));
const ports = {};
FUNCTIONS.forEach((name, i) => {
  ports[name] = 56001 + i;
  const child = spawn(DENO, ['run', '-A', '--quiet', here + 'serve-fn.ts', name], {
    env: {
      ...process.env,
      PORT: String(ports[name]),
      DENO_NO_PACKAGE_JSON: '1',
      SUPABASE_URL: API,
      APP_ORIGIN: process.env.APP_ORIGIN ?? 'http://localhost:4173',
      CAPTCHA_OPCIONAL: '1'
    },
    stdio: 'inherit'
  });
  child.on('exit', (code) => console.error(`${name} saiu (${code})`));
});

http
  .createServer((req, res) => {
    const m = /^\/functions\/v1\/([a-z-]+)/.exec(req.url ?? '');
    const target = new URL(m && ports[m[1]] ? `http://127.0.0.1:${ports[m[1]]}/` : API + (req.url ?? '/'));
    const upstream = http.request(
      {
        hostname: target.hostname,
        port: target.port,
        path: m ? '/' : target.pathname + target.search,
        method: req.method,
        headers: { ...req.headers, host: target.host }
      },
      (r) => {
        res.writeHead(r.statusCode ?? 502, r.headers);
        r.pipe(res);
      }
    );
    upstream.on('error', () => {
      res.writeHead(502);
      res.end();
    });
    req.pipe(upstream);
  })
  .listen(55400, () => console.log('Proxy do E2E em http://127.0.0.1:55400 →', API));
