// AUD-033: the job the person came from survives the sign-up (Google, SMS, a new account), and only app paths count.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetReturnTo, isAppPath, peekReturnTo, rememberReturnTo } from '../services/guards';

describe('voltar para a vaga depois de entrar (AUD-033)', () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    vi.stubGlobal('sessionStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k)
    });
  });

  it('remembers the job and gives it back until it is forgotten', () => {
    rememberReturnTo('/vaga/BC-12');
    expect(peekReturnTo()).toBe('/vaga/BC-12');
    expect(peekReturnTo()).toBe('/vaga/BC-12');
    forgetReturnTo();
    expect(peekReturnTo()).toBeNull();
  });

  it('only paths inside the app are accepted (no other site)', () => {
    expect(isAppPath('/vaga/BC-1')).toBe(true);
    expect(isAppPath('https://evil.example/x')).toBe(false);
    expect(isAppPath('//evil.example')).toBe(false);
    expect(isAppPath('vaga/BC-1')).toBe(false);
    rememberReturnTo('https://evil.example');
    expect(peekReturnTo()).toBeNull();
  });
});
