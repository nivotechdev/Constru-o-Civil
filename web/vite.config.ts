/// <reference types="vitest/config" />
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { VitePWA } from 'vite-plugin-pwa';
import { isDemoMode, productionEnvError, productionEnvProblems } from './build/env';

// `npm run build` → dist/ (code-split, served over HTTP, installable: manifest + service worker, X02).
// It is the PRODUCTION build and stops when a required variable is missing (L01, build/env.ts).
// `npm run build:demo` → the same app on the in-memory demo data (CI, Lighthouse, axe).
// `npm run build:standalone` → dist-standalone/index.html with everything inlined, which — like the
// legacy app — also works when opened straight from disk (file://). No service worker there.
//
// The Supabase variables (.env.local) turn the real backend on (src/services/mode.ts). The demo builds
// and the tests always run on the demo data, so they ignore them.
const DEMO_ENV = { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' };

/** L01: a production build without its variables fails before bundling, listing what is missing. */
function requireProductionEnv(env: Record<string, string>): Plugin {
  return {
    name: 'bicos-production-env',
    apply: 'build',
    config() {
      const problems = productionEnvProblems(env);
      if (problems.length) throw new Error(productionEnvError(problems));
    }
  };
}

/** X02: the link preview (`og:`) needs absolute URLs — `VITE_SITE_URL` is the published address. */
function siteUrl(url: string): Plugin {
  return {
    name: 'bicos-site-url',
    transformIndexHtml: (html) => html.replaceAll('__SITE_URL__', url.replace(/\/+$/, ''))
  };
}

export default defineConfig(({ mode }) => {
  const standalone = mode === 'standalone';
  const demo = isDemoMode(mode);
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    // X17: routes are real paths (`/vaga/BC-1`), so the files are referenced from the site's root (or
    // VITE_BASE when it is served under a folder). The standalone preview keeps relative paths.
    base: standalone ? './' : (env.VITE_BASE ?? '/'),
    plugins: [
      ...(demo ? [] : [requireProductionEnv(env)]),
      react(),
      siteUrl(env.VITE_SITE_URL ?? ''),
      ...(standalone
        ? [viteSingleFile()]
        : [
            VitePWA({
              // A new version waits for the person to tap "Atualizar" (services/pwa.ts) instead of
              // swapping the files under a screen that is open.
              registerType: 'prompt',
              injectRegister: false,
              includeAssets: ['icons/favicon-32.png', 'icons/apple-touch-icon.png', 'icons/icon.svg'],
              manifest: {
                name: 'Bicos — diárias de obra',
                short_name: 'Bicos',
                description: 'Diárias de obra perto de você: construtoras e trabalhadores da construção civil.',
                lang: 'pt-BR',
                start_url: '.',
                scope: '.',
                display: 'standalone',
                theme_color: '#1D4BED',
                background_color: '#1D4BED',
                categories: ['business', 'productivity'],
                icons: [
                  { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
                  { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
                  { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
                ]
              },
              workbox: {
                // The app shell (scripts, styles, fonts) is kept on the phone, so it opens without signal and
                // shows the offline screens instead of the browser's dinosaur.
                globPatterns: ['**/*.{js,css,html,woff2,svg}', 'icons/*.png'],
                navigateFallback: 'index.html',
                // X03: the push notices (public/push-sw.js).
                importScripts: ['push-sw.js'],
                cleanupOutdatedCaches: true,
                runtimeCaching: [
                  {
                    // Photos (Storage public buckets and the demo pictures): from the phone first.
                    urlPattern: ({ url }) =>
                      url.pathname.includes('/storage/v1/object/public/') || url.pathname.includes('/img/'),
                    handler: 'CacheFirst',
                    options: {
                      cacheName: 'bicos-fotos',
                      expiration: { maxEntries: 300, maxAgeSeconds: 30 * 24 * 60 * 60 },
                      cacheableResponse: { statuses: [0, 200] }
                    }
                  }
                  // Everything else (database, Auth, Edge Functions) always goes to the network.
                ]
              }
            })
          ])
    ],
    resolve: standalone ? { alias: { 'virtual:pwa-register': '/src/services/pwaStub.ts' } } : undefined,
    define: demo
      ? Object.fromEntries(Object.entries(DEMO_ENV).map(([k, v]) => [`import.meta.env.${k}`, JSON.stringify(v)]))
      : undefined,
    build: {
      outDir: standalone ? 'dist-standalone' : 'dist',
      target: 'es2020',
      // Shared helpers smaller than 1 kB (a field error, a formatter…) ride along in a chunk that loads
      // under the same conditions instead of becoming requests of their own. Rollup only merges chunks
      // without side effects, so the order code runs in doesn't change.
      rollupOptions: standalone ? {} : { output: { experimentalMinChunkSize: 1000 } }
    },
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
      env: DEMO_ENV
    }
  };
});
