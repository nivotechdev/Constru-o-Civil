/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build` → dist/ (code-split, served over HTTP).
// `npm run build:standalone` → dist-standalone/index.html with everything inlined, which — like the
// legacy app — also works when opened straight from disk (file://).
//
// The Supabase variables (.env.local) turn the real backend on (src/services/mode.ts). The standalone
// preview and the tests always run on the demo data, so they ignore them.
const DEMO_ENV = { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' };
export default defineConfig(({ mode }) => {
  const standalone = mode === 'standalone';
  return {
    base: './',
    plugins: [react(), ...(standalone ? [viteSingleFile()] : [])],
    define: standalone
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
