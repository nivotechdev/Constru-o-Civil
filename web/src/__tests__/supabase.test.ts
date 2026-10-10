// Supabase preparation: the client stays off without the environment variables, the table types work
// with supabase-js, and the demo data survives a round trip through the table shapes unchanged.
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import * as seed from '../data/seed';
import { getSupabase, isSupabaseConfigured, supabaseConfig, type BicosSupabase } from '../services/supabase';
import {
  databaseFromRows,
  databaseToInserts,
  notificationFromRow,
  relativeTime,
  type DatabaseRows
} from '../services/supabaseMappers';
import type { DiasKey } from '../types/models';
import { seedDatabase } from './helpers';
import type { TableInsert, TableRow } from '../types/supabase';

const CREATED = '2026-09-25T12:00:00.000Z';

/** What Postgres returns for an insert: the row plus the column defaults. */
function stored(inserts: ReturnType<typeof databaseToInserts>): DatabaseRows {
  return {
    accounts: inserts.accounts.map((r): TableRow<'accounts'> => ({
      whatsapp_verified_at: null,
      email_confirmed_at: null,
      profile_completed_at: null,
      worker_id: null,
      company_id: null,
      created_at: CREATED,
      ...r
    })),
    companies: inserts.companies.map((r): TableRow<'companies'> => ({
      cnpj: null,
      tipo_obra: null,
      rating: 0,
      review_count: 0,
      verified: false,
      verified_since: null,
      verification_status: 'pendente',
      verified_at: null,
      contact_name: null,
      since_label: null,
      respond_time: null,
      paid_count: null,
      logo_url: null,
      cover_url: null,
      created_at: CREATED,
      ...r,
      id: r.id ?? ''
    })),
    workers: inserts.workers.map((r): TableRow<'workers'> => ({
      oficio_id: null,
      neighborhood: null,
      rating: 0,
      review_count: 0,
      jobs_done: 0,
      novo: false,
      verified: false,
      specialties: [],
      facts: [],
      photo_url: null,
      cover_url: null,
      availability: null,
      years_experience: null,
      desired_pay: null,
      travel_km: null,
      bio: null,
      created_at: CREATED,
      ...r,
      id: r.id ?? ''
    })),
    jobs: inserts.jobs.map((r): TableRow<'jobs'> => ({
      payment_method: null,
      payment_note: null,
      title: null,
      pay: null,
      complement: null,
      date_to_arrange: false,
      start_date: null,
      end_date: null,
      start_time: null,
      end_time: null,
      diarias: 1,
      dias: null,
      urgent: false,
      boost_ends_at: null,
      photos: null,
      slots: 1,
      closed: false,
      sem_contratacao: false,
      requirements: [],
      created_at: CREATED,
      deleted_at: null,
      updated_at: CREATED,
      area_lat: 0,
      area_lon: 0,
      ...r,
      id: r.id ?? ''
    })),
    applications: inserts.applications.map((r): TableRow<'applications'> => ({
      presence_confirmed_at: null,
      status: 'enviada',
      created_at: CREATED,
      status_changed_at: CREATED,
      auto_rejected: false,
      worker_reviewed: false,
      company_reviewed: false,
      ...r,
      id: r.id ?? ''
    })),
    applicationEvents: inserts.application_events.map((r, i): TableRow<'application_events'> => ({
      reason: null,
      ...r,
      id: i + 1
    })),
    savedJobs: inserts.saved_jobs,
    reviews: inserts.reviews.map((r: TableInsert<'reviews'>): TableRow<'reviews'> => ({
      application_id: null,
      company_id: null,
      worker_id: null,
      tags: [],
      comment: '',
      created_at: CREATED,
      ...r,
      id: r.id ?? ''
    })),
    workerPosts: inserts.worker_posts.map((r): TableRow<'worker_posts'> => ({
      media_url: null,
      media_type: 'image',
      caption: '',
      created_at: CREATED,
      ...r,
      posted_on: r.posted_on ?? '',
      id: r.id ?? ''
    })),
    boostPayments: inserts.boost_payments.map((r): TableRow<'boost_payments'> => ({
      status: 'aguardando',
      pix_code: null,
      card_last4: null,
      expires_at: null,
      confirmed_at: null,
      boost_ends_at: null,
      created_at: CREATED,
      ...r,
      id: r.id ?? ''
    })),
    notifications: inserts.notifications.map((r): TableRow<'notifications'> => ({
      worker_id: null,
      company_id: null,
      target: null,
      read_at: null,
      created_at: CREATED,
      ...r,
      id: r.id ?? ''
    }))
  };
}

describe('Supabase client (not connected)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('stays off without the environment variables, so the app keeps its mock data', async () => {
    expect(supabaseConfig({ VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' } as ImportMetaEnv)).toBeNull();
    expect(supabaseConfig({ VITE_SUPABASE_URL: 'https://x.supabase.co' } as ImportMetaEnv)).toBeNull();
    expect(isSupabaseConfigured()).toBe(false);
    expect(await getSupabase()).toBeNull();
  });

  it('reads the project URL and anon key when both are set', async () => {
    const env = { VITE_SUPABASE_URL: ' https://x.supabase.co ', VITE_SUPABASE_ANON_KEY: 'anon-key' } as ImportMetaEnv;
    expect(supabaseConfig(env)).toEqual({ url: 'https://x.supabase.co', anonKey: 'anon-key' });
  });

  it('creates the client lazily from the environment, without any request', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://x.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const mod = await import('../services/supabase');
    const client = await mod.getSupabase();
    expect(client).not.toBeNull();
    expect(typeof client?.from).toBe('function');
    expect(await mod.getSupabase()).toBe(client);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('types queries from the table definitions', () => {
    // Type-level only (never called): checked by `npm run typecheck`.
    const typed = async (supabase: BicosSupabase) => {
      const jobs = await supabase.from('jobs').select('id, pay, dias').eq('company_id', 'meridiano');
      expectTypeOf(jobs.data).toEqualTypeOf<{ id: string; pay: number | null; dias: DiasKey | null }[] | null>();
      const apps = await supabase.from('applications').select('*').eq('worker_id', 'jorge');
      expectTypeOf(apps.data).toEqualTypeOf<TableRow<'applications'>[] | null>();
    };
    expect(typeof typed).toBe('function');
  });
});

describe('table <-> domain mappers', () => {
  it('round-trips the whole demo database unchanged', () => {
    const db = seedDatabase();
    const back = databaseFromRows(stored(databaseToInserts(db, seed.CURRENT_WORKER_ID)));
    expect(back).toStrictEqual(db);
  });

  it('keeps deleted posts, in the order they were deleted', () => {
    const db = { ...seedDatabase(), deletedJobIds: ['BC-5025', 'BC-4821'] };
    const back = databaseFromRows(stored(databaseToInserts(db, seed.CURRENT_WORKER_ID)));
    expect(back.deletedJobIds).toEqual(['BC-5025', 'BC-4821']);
    expect(back.jobs['BC-5025']).toStrictEqual(db.jobs['BC-5025']);
  });

  it('writes each review to its side and reads it back with the right label', () => {
    const inserts = databaseToInserts(seedDatabase(), seed.CURRENT_WORKER_ID);
    const toCompanies = inserts.reviews.filter((r) => r.direction === 'para_construtora');
    const toWorkers = inserts.reviews.filter((r) => r.direction === 'para_trabalhador');
    expect(toCompanies.every((r) => r.company_id && !r.worker_id)).toBe(true);
    expect(toWorkers.every((r) => r.worker_id && !r.company_id)).toBe(true);
    const total = (list: { reviews: unknown[] }[]) => list.reduce((n, x) => n + x.reviews.length, 0);
    expect(toCompanies).toHaveLength(total(Object.values(seed.COMPANIES)));
    expect(toWorkers).toHaveLength(total(Object.values(seed.WORKERS)));
  });

  it('shows notification times the way the app writes them', () => {
    const now = new Date('2026-09-25T12:00:00Z');
    expect(relativeTime('2026-09-25T11:48:00Z', now)).toBe('Há 12 min');
    expect(relativeTime('2026-09-25T11:59:50Z', now)).toBe('Há 1 min');
    expect(relativeTime('2026-09-25T10:00:00Z', now)).toBe('Há 2h');
    expect(relativeTime('2026-09-24T09:00:00Z', now)).toBe('Ontem');
    expect(relativeTime('2026-09-23T09:00:00Z', now)).toBe('2 dias atrás');
    const row: TableRow<'notifications'> = {
      id: 'n9',
      worker_id: null,
      company_id: 'meridiano',
      kind: 'bico_fechado',
      title: 'Bico fechado',
      body: 'Todas as vagas de Servente foram preenchidas.',
      target: '/historico',
      created_at: '2026-09-25T09:00:00Z',
      read_at: null
    };
    expect(notificationFromRow(row)).toEqual({
      id: 'n9',
      kind: 'bico_fechado',
      title: 'Bico fechado',
      text: 'Todas as vagas de Servente foram preenchidas.',
      workerId: null,
      companyId: 'meridiano',
      target: '/historico',
      createdAt: '2026-09-25T09:00:00Z',
      readAt: null
    });
  });
});
