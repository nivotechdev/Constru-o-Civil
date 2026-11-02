// AUD-023 / AUD-024: o site de teste público (GitHub Pages) aponta para o staging. Ele se anuncia como ambiente de
// teste, não entra em buscadores, e os trabalhos que usam o token do Supabase do staging rodam no environment "staging"
// (o dono do repositório restringe esse environment à branch master e move os segredos para ele).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(fileURLToPath(new URL(`../../../${path}`, import.meta.url)), 'utf8');

describe('site de teste (AUD-024)', () => {
  const site = read('.github/workflows/site.yml');
  it('is built as a test environment, kept out of search engines', () => {
    expect(site).toMatch(/VITE_AMBIENTE_TESTE: "1"/);
    expect(site).toMatch(/Disallow: \//);
    expect(site).toMatch(/noindex/);
  });
  it('the app shows the banner when it is a test build', () => {
    expect(read('web/src/App.tsx')).toContain('<TestEnvironmentBanner />');
    const banner = read('web/src/components/TestEnvironmentBanner.tsx');
    expect(banner).toMatch(/VITE_AMBIENTE_TESTE/);
    expect(banner).toMatch(/AMBIENTE DE TESTE/);
  });
});

describe('segredos do staging em um environment (AUD-023)', () => {
  it('every job that reads SUPABASE_ACCESS_TOKEN declares environment: staging', () => {
    for (const file of ['.github/workflows/staging.yml', '.github/workflows/staging-fotos.yml']) {
      const text = read(file);
      const jobs = text
        .split(/\n(?= {2}[a-z0-9-]+:\n)/)
        .filter((block) => block.includes('secrets.SUPABASE_ACCESS_TOKEN'));
      expect(jobs.length, file).toBeGreaterThan(0);
      for (const job of jobs) expect(job, file + ' › ' + job.slice(0, 40)).toMatch(/\n {4}environment: staging\n/);
    }
  });
});
