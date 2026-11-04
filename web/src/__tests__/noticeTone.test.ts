// AUD-093: a notice's colour comes from whether it is good news, not from how its text starts.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('tom do aviso de sessão (AUD-093)', () => {
  const source = readFileSync(fileURLToPath(new URL('../services/remote/session.ts', import.meta.url)), 'utf8');
  it('the toast tone is decided by the notice flag', () => {
    expect(source).toMatch(/showToast\(text, \{ tone: ok \? 'default' : 'error' \}\)/);
    expect(source).not.toMatch(/startsWith\('E-mail confirmado'\)/);
  });
  it('the e-mail change notice is good news', () => {
    expect(source).toMatch(/text: 'E-mail trocado\. Use o novo para entrar\.', ok: true/);
  });
});
