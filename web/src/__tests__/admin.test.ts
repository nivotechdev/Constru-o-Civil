// L06 (lançamento): the team's back-office services — the real body against the fake Supabase, and the
// demo (no team there).
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

const admin = await import('../services/admin');
const store = await import('../services/store');
const state = () => store.getUI(admin.ADMIN_KEY, admin.ADMIN_DEFAULTS);

const queueRow = {
  worker_id: 'w-1',
  name: 'Ana Souza',
  oficio: 'Pedreiro',
  city: 'São Paulo, SP',
  photo_url: null,
  document: '***.456.789-**',
  created_at: '2026-10-01T12:00:00Z',
  submitted_at: '2026-10-14T12:00:00Z',
  selfie_path: 'w-1/selfie.jpg',
  document_path: 'w-1/doc.jpg',
  submissions: 2
};

let fake: ReturnType<typeof fakeSupabase>;
let staff = true;
beforeEach(() => {
  holder.real = true;
  staff = true;
  store.resetUI(admin.ADMIN_KEY);
  fake = fakeSupabase({
    rpc: {
      is_staff: () => ({ data: staff, error: null }),
      admin_identity_queue: () =>
        staff
          ? { data: [queueRow], error: null }
          : { data: null, error: { code: 'BC401', message: 'Área só da equipe da Bicos.' } },
      admin_report_queue: (args) => ({
        data:
          args.p_status === 'aberta'
            ? [
                {
                  id: 'r-1',
                  target_type: 'vaga',
                  target_id: 'BC-9',
                  reason: 'golpe',
                  details: 'Pediu PIX',
                  status: 'aberta',
                  resolution: null,
                  created_at: '2026-10-14T12:00:00Z',
                  resolved_at: null,
                  reports_on_target: 3,
                  target: { title: 'Pedreiro', text: 'Reboco', account_id: 'c-1', hidden: false },
                  account: { account_id: 'c-1', role: 'recrutador', jobs: 4, reports_against: 3 }
                }
              ]
            : [],
        error: null
      })
    }
  });
  holder.client = fake.client;
});

describe('área da equipe (L06)', () => {
  it('asks the server whether the session is on the team', async () => {
    await admin.checkStaff();
    expect(state().isStaff).toBe(true);
    staff = false;
    await admin.checkStaff();
    expect(state().isStaff).toBe(false);
  });

  it('a non-staff session gets "não autorizado" from the server', async () => {
    staff = false;
    await expect(admin.loadIdentityQueue()).rejects.toMatchObject({ code: 'nao_autorizado' });
  });

  it('loads the identity queue and opens the photos with 5-minute links', async () => {
    await admin.loadIdentityQueue();
    const [item] = state().identities;
    expect(item).toMatchObject({ workerId: 'w-1', submissions: 2, selfiePath: 'w-1/selfie.jpg' });
    const links = await admin.identityPhotoLinks(item);
    expect(links.selfie).toContain('/object/sign/identidade/w-1/selfie.jpg');
    const signed = fake.calls.filter((c) => c.kind === 'storage' && c.name === 'identidade');
    expect(signed.map((c) => c.args)).toEqual([
      { path: 'w-1/selfie.jpg', expiresIn: 300 },
      { path: 'w-1/doc.jpg', expiresIn: 300 }
    ]);
  });

  it('refusing needs a reason; a decision leaves the queue', async () => {
    await admin.loadIdentityQueue();
    await expect(admin.decideIdentity('w-1', false, '  ')).rejects.toMatchObject({ code: 'validacao' });
    expect(fake.calls.some((c) => c.name === 'admin_decide_identity')).toBe(false);
    await admin.decideIdentity('w-1', false, 'Documento ilegível');
    expect(fake.calls.find((c) => c.name === 'admin_decide_identity')?.args).toEqual({
      p_worker: 'w-1',
      p_status: 'recusado',
      p_reason: 'Documento ilegível'
    });
    expect(state().identities).toEqual([]);
  });

  it('reports: hiding or suspending needs a reason; archiving does not', async () => {
    await admin.loadReportQueue();
    const [report] = state().reports;
    expect(report).toMatchObject({ id: 'r-1', reportsOnTarget: 3, target: { title: 'Pedreiro' } });
    await expect(admin.resolveReport(report, 'suspender_conta')).rejects.toMatchObject({ code: 'validacao' });
    await admin.resolveReport(report, 'arquivar');
    expect(fake.calls.find((c) => c.name === 'admin_resolve_report')?.args).toEqual({
      p_report: 'r-1',
      p_action: 'arquivar',
      p_reason: null
    });
  });

  it('the demo has no team', async () => {
    holder.real = false;
    await admin.checkStaff();
    expect(state().isStaff).toBe(false);
    await expect(admin.loadReportQueue()).rejects.toMatchObject({ code: 'nao_autorizado' });
  });
});
