// L03 (lançamento): E2E do Bicos num backend de verdade — o staging (CI, job `e2e`) ou o Supabase local
// (e2e/LEIA.md). Os fluxos rodam em ordem (cada um usa o que o anterior criou) e cada etapa vira um print em
// e2e/resultados/prints/, citado em docs/E2E.md. As contas de teste são criadas e apagadas pelo próprio teste.
import { defineConfig, devices } from '@playwright/test';

const chromium = process.env.E2E_CHROMIUM_PATH;

export default defineConfig({
  testDir: './fluxos',
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: 'resultados/relatorio', open: 'never' }], ['./relatorio.ts']],
  outputDir: 'resultados/artefatos',
  globalTeardown: './limpeza.ts',
  use: {
    ...devices['Pixel 7'],
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:4173',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: chromium ? { executablePath: chromium } : {}
  }
});
