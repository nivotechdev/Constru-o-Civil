// AUD-035: "JWT expired" with a correct session (a phone whose clock is off) renews the token and asks again once;
// only a renewal that fails leaves the person signed out.
import { describe, expect, it, vi } from 'vitest';
import { isJwtExpired, runWithSessionRefresh } from '../services/remote/client';

describe('renovar a sessão antes de encerrar (AUD-035)', () => {
  it('a token the clock thinks is over is renewed, and the request goes out again', async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: { code: 'PGRST301', message: 'JWT expired' } })
      .mockResolvedValueOnce({ data: [1, 2], error: null });
    const refresh = vi.fn().mockResolvedValue(true);
    const result = await runWithSessionRefresh(run, refresh);
    expect(result).toEqual({ data: [1, 2], error: null });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('a request that throws the expiry is renewed the same way', async () => {
    const run = vi
      .fn()
      .mockRejectedValueOnce(new Error('JWT expired'))
      .mockResolvedValueOnce({ data: 'ok', error: null });
    await expect(runWithSessionRefresh(run, async () => true)).resolves.toEqual({ data: 'ok', error: null });
  });

  it('when the renewal fails, the expiry reaches the caller (the session really is over)', async () => {
    const run = vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST301', message: 'JWT expired' } });
    const result = await runWithSessionRefresh(run, async () => false);
    expect(result.error).toMatchObject({ code: 'PGRST301' });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('other errors are not renewed', async () => {
    const refresh = vi.fn().mockResolvedValue(true);
    const run = vi.fn().mockResolvedValue({ data: null, error: { code: '42501', message: 'permission denied' } });
    await runWithSessionRefresh(run, refresh);
    expect(refresh).not.toHaveBeenCalled();
    expect(isJwtExpired({ code: '42501', message: 'permission denied' })).toBe(false);
  });
});

// AUD-027: a failed read-back after a successful action does not turn the action into an error.
import { afterSuccess } from '../services/remote/client';

describe('ação que deu certo não vira erro (AUD-027)', () => {
  it('a failing refresh after the action is swallowed', async () => {
    await expect(afterSuccess(() => Promise.reject(new Error('rede caiu na releitura')))).resolves.toBeUndefined();
  });
  it('a working refresh runs', async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    await afterSuccess(refresh);
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
