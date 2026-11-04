// AUD-029: an answer that arrives after the sign-out belongs to the account that left: it does not reach the store
// of the next account, and it does not change the state of its screen.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearQueries, getQuery, runQuery } from '../services/queries';
import { clearSessionData, getDb, isSessionOver, setSessionAccount } from '../services/store';
import { apply } from '../services/remote/merge';

describe('resposta que chega depois do Sair (AUD-029)', () => {
  beforeEach(() => {
    clearQueries();
    setSessionAccount('conta-a');
  });

  it('a recipe applied after the sign-out is dropped, and the next session starts clean', () => {
    clearSessionData();
    expect(isSessionOver()).toBe(true);
    apply((db) => ({ ...db, notifications: [{ id: 'n1' } as never] }));
    setSessionAccount('conta-b');
    expect(isSessionOver()).toBe(false);
    expect(getDb().notifications.some((n) => n.id === 'n1')).toBe(false);
  });

  it('a query that was loading when the sign-out happened does not mark its screen ready for the next account', async () => {
    let finish: () => void = () => undefined;
    const loader = vi.fn(() => new Promise<void>((r) => (finish = r)));
    const pending = runQuery('notifications', loader);
    expect(getQuery('notifications').status).toBe('loading');
    clearQueries();
    finish();
    await pending;
    expect(getQuery('notifications').status).not.toBe('ready');
  });
});
