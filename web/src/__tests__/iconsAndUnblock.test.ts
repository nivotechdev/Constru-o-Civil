// AUD-128: the icons link through the app's base address, so they load on every route (/v/:id too).
// AUD-105: "Desbloquear" shows the spinner only on the account being unblocked.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(fileURLToPath(new URL(`../../${p}`, import.meta.url)), 'utf8');

describe('ícones da aba e desbloquear (AUD-128, AUD-105)', () => {
  it('the favicon and touch icons use the base address, not a relative path', () => {
    const html = read('index.html');
    expect(html).toContain('href="%BASE_URL%icons/favicon-32.png"');
    expect(html).not.toMatch(/href="\.\/icons\//);
  });
  it('only the account being unblocked is busy', () => {
    const page = read('src/pages/shared/BlockedAccounts.tsx');
    expect(page).toMatch(/loading=\{unblock\.loading && unblocking === b\.id\}/);
  });
});
