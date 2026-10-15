// L05: in production (captcha on) no public form reaches the server without a captcha token.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeSupabase } from './fakeSupabase';

const holder = vi.hoisted(() => ({ client: null as unknown }));

vi.mock('../services/supabase', () => ({
  isSupabaseConfigured: () => true,
  supabaseConfig: () => ({ url: 'https://x.supabase.co', anonKey: 'anon' }),
  getSupabase: async () => holder.client
}));
vi.mock('../services/features', async (original) => {
  const real = await original<typeof import('../services/features')>();
  return { ...real, FEATURES: { ...real.FEATURES, captcha: true } };
});

const { signIn, signUp, requestPasswordReset } = await import('../services/auth');

const noToken = async () => undefined;
const token = async () => 'turnstile-token';

let fake: ReturnType<typeof fakeSupabase>;
beforeEach(() => {
  fake = fakeSupabase({ functions: { 'entrar-com-documento': () => ({ data: { email: 'a@b.com' }, error: null }) } });
  holder.client = fake.client;
});

describe('captcha obrigatório (L05)', () => {
  it('e-mail login without a token stops before the Auth', async () => {
    await expect(signIn('ana@exemplo.com', 'senha1234', noToken)).rejects.toMatchObject({
      code: 'validacao',
      message: expect.stringContaining('robô')
    });
    expect(fake.calls.filter((c) => c.kind === 'auth' && c.name === 'signInWithPassword')).toHaveLength(0);
  });

  it('document login without a token never calls the function', async () => {
    await expect(signIn('123.456.789-09', 'senha1234', noToken)).rejects.toMatchObject({
      code: 'validacao',
      message: expect.stringContaining('robô')
    });
    expect(fake.calls.filter((c) => c.kind === 'function')).toHaveLength(0);
  });

  it('sign-up without a token stops before the Auth', async () => {
    await expect(
      signUp(
        {
          role: 'trabalhador',
          name: 'Ana Souza',
          doc: '529.982.247-25',
          email: 'ana@exemplo.com',
          whatsapp: '11988887777',
          password: 'senha1234',
          acceptedTermsVersion: '1.0',
          adult: true
        },
        noToken
      )
    ).rejects.toMatchObject({ code: 'validacao', message: expect.stringContaining('robô') });
    expect(fake.calls.filter((c) => c.kind === 'auth' && c.name === 'signUp')).toHaveLength(0);
  });

  it('password recovery sends the token, and refuses without one', async () => {
    await expect(requestPasswordReset('ana@exemplo.com', noToken)).rejects.toMatchObject({
      code: 'validacao',
      message: expect.stringContaining('robô')
    });
    expect(fake.calls.filter((c) => c.name === 'resetPasswordForEmail')).toHaveLength(0);
    await requestPasswordReset('ana@exemplo.com', token);
    const call = fake.calls.find((c) => c.name === 'resetPasswordForEmail');
    expect(call).toBeDefined();
  });
});
