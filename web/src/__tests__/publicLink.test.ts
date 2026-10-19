// L10 (lançamento): the public job link goes by the job's random slug, never by its sequential id (BC-n);
// the RPC's per-IP limit reaches the screen as a message. Real body against the fake Supabase.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeSupabase } from './fakeSupabase';

const holder = vi.hoisted(() => ({ client: null as unknown, real: true }));

vi.mock('../services/mode', () => ({
  get IS_DEMO() {
    return !holder.real;
  }
}));
vi.mock('../services/supabase', () => ({
  isSupabaseConfigured: () => true,
  supabaseConfig: () => ({ url: 'https://x.supabase.co', anonKey: 'anon' }),
  getSupabase: async () => holder.client
}));

const jobs = await import('../services/jobs');
const { ServiceError } = await import('../services/errors');

const card = {
  id: 'BC-12',
  public_slug: 'k7m2q9x4tbn3',
  oficio_id: 'pedreiro',
  title: null,
  pay: 180,
  neighborhood: 'Tatuapé',
  city: 'São Paulo',
  uf: 'SP',
  date_to_arrange: true,
  start_date: null,
  end_date: null,
  start_time: null,
  end_time: null,
  diarias: 1,
  dias: null,
  slots: 1,
  urgent: false,
  photos: null,
  description: 'Reboco',
  requirements: [],
  payment_method: null,
  payment_note: null,
  created_at: '2026-10-16T12:00:00Z',
  aberta: true,
  company: { name: 'Obra Boa', logo_url: null, rating: 4.5, review_count: 3, verified: true }
};

describe('public job link (real)', () => {
  let limited = false;
  let fake: ReturnType<typeof fakeSupabase>;
  beforeEach(() => {
    holder.real = true;
    limited = false;
    fake = fakeSupabase({
      rpc: {
        public_job_card: (args) =>
          limited
            ? {
                data: null,
                error: {
                  code: 'BC409',
                  message: 'Muitas vagas abertas em pouco tempo. Espere alguns minutos e tente de novo.'
                }
              }
            : { data: args.p_slug === card.public_slug ? card : null, error: null }
      }
    });
    holder.client = fake.client;
  });

  it('asks by the slug and keeps the BC-n as the job id', async () => {
    const got = await jobs.loadPublicJob('k7m2q9x4tbn3');
    expect(fake.calls.find((c) => c.name === 'public_job_card')?.args).toEqual({ p_slug: 'k7m2q9x4tbn3' });
    expect(got?.job.id).toBe('BC-12');
    expect(got?.job.publicSlug).toBe('k7m2q9x4tbn3');
    expect(got?.job.address).toMatchObject({ street: '', exact: false });
    expect(got?.company).toMatchObject({ name: 'Obra Boa', verified: true });
    expect(await jobs.loadPublicJob('BC-12')).toBeNull();
  });

  it('the per-IP limit becomes a conflict with the message ready', async () => {
    limited = true;
    const err = await jobs.loadPublicJob('k7m2q9x4tbn3').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ServiceError);
    expect(err).toMatchObject({ code: 'conflito', message: expect.stringContaining('Espere alguns minutos') });
  });
});
// The demo (jobs without a slug: the link carries the id) is covered in services.test.ts › F09.
