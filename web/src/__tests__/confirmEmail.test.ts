// X31: entering with Google on a login that was never confirmed confirms the e-mail AND takes away the password that
// login had, so whoever started that sign-up with someone else's e-mail can't get into the account afterwards.
import { describe, expect, it } from 'vitest';
import { confirmProvenEmail, unknowablePassword } from '../../supabase/functions/_shared/confirm.ts';

describe('confirming an e-mail Google just proved (X31)', () => {
  it('confirms the e-mail and replaces the password in the same request', async () => {
    const calls: { id: string; attributes: { email_confirm: true; password: string } }[] = [];
    const ok = await confirmProvenEmail(async (id, attributes) => {
      calls.push({ id, attributes });
      return { error: null };
    }, 'user-1');
    expect(ok).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].id).toBe('user-1');
    expect(calls[0].attributes.email_confirm).toBe(true);
    expect(calls[0].attributes.password).toMatch(/^[0-9a-f]{64}$/);
  });

  it('says so when the Auth refuses', async () => {
    expect(await confirmProvenEmail(async () => ({ error: { message: 'User not found' } }), 'user-1')).toBe(false);
  });

  it('never repeats a password', () => {
    const seen = new Set(Array.from({ length: 50 }, unknowablePassword));
    expect(seen.size).toBe(50);
  });
});
