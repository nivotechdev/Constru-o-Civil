// AUD-007: the public screens (the job's link, Ajuda, finishing a Google sign-up) open without a session and without
// the navigation shell, which reads the signed-in account's name.
import { describe, expect, it } from 'vitest';
import { usesAppShell } from '../routes';

describe('quais telas levam a moldura logada (AUD-007)', () => {
  it('a visitor never gets the shell', () => {
    for (const path of ['/v/BC-1', '/v/abc123', '/ajuda', '/completar-cadastro', '/mural', '/perfil', '/login']) {
      expect(usesAppShell(path, false), path).toBe(false);
    }
  });
  it('a signed-in person gets the shell on the app screens, not on the sign-in flow', () => {
    expect(usesAppShell('/mural', true)).toBe(true);
    expect(usesAppShell('/vaga/BC-1', true)).toBe(true);
    expect(usesAppShell('/perfil', true)).toBe(true);
    expect(usesAppShell('/login', true)).toBe(false);
    expect(usesAppShell('/cadastro/trabalhador', true)).toBe(false);
  });
});
