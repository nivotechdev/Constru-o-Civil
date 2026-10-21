// B01 — WhatsApp both ways: the number only comes out of getContact, only for a picked/hired candidacy,
// and only to one of its two sides; the ready-made messages.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { companyToWorkerMessage, workerToCompanyMessage, whatsappUrl } from '../utils/whatsapp';

type M = {
  contacts: typeof import('../services/contacts');
  auth: typeof import('../services/auth');
  apps: typeof import('../services/applications');
};

describe('getContact', () => {
  let m: M;
  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();
    m = {
      contacts: await import('../services/contacts'),
      auth: await import('../services/auth'),
      apps: await import('../services/applications')
    };
  });
  afterEach(() => vi.useRealTimers());

  const settle = async <T>(p: Promise<T>) => {
    const r = p.then(
      (v) => ({ ok: true as const, v }),
      (e: unknown) => ({ ok: false as const, e: e as Error })
    );
    await vi.runAllTimersAsync();
    return r;
  };

  it('gives the worker the company number of a picked candidacy, with the ready message', async () => {
    await settle(m.auth.signIn('trabalhador@bicos.demo', 'bicos123'));
    const r = await settle(m.contacts.getContact('a1')); // jorge, pré-selecionado on BC-4821
    expect(r.ok && r.v.name).toBe('Eventos Meridiano');
    expect(r.ok && r.v.url).toContain('https://wa.me/5511988423310?text=');
    expect(r.ok && decodeURIComponent(r.v.url)).toContain(
      'Aqui é Jorge, da Bicos. Fui aprovado para a vaga "Garçom para casamento" (BC-4821)'
    );
  });

  it('gives the company the worker number once approved, never before', async () => {
    await settle(m.auth.signIn('empresa@bicos.demo', 'bicos123'));
    const before = await settle(m.contacts.getContact('a11')); // rafael, em análise on BC-4998
    expect(before.ok).toBe(false);
    expect(!before.ok && before.e.message).toMatch(/quando a empresa aprova/);
    await settle(m.apps.approve('BC-4998', 'rafael'));
    const after = await settle(m.contacts.getContact('a11'));
    expect(after.ok && after.v.phone).toBe('(11) 96630-1147');
    expect(after.ok && decodeURIComponent(after.v.url)).toContain('Olá, Rafael! Aqui é da Eventos Meridiano');
  });

  it("refuses anyone who isn't one of the two sides", async () => {
    await settle(m.auth.signIn('empresa@bicos.demo', 'bicos123'));
    const r = await settle(m.contacts.getContact('a8')); // jorge on Mudanças Aricanduva's job
    expect(r.ok).toBe(false);
  });
});

describe('ready-made messages', () => {
  const job = {
    id: 'BC-4821',
    oficioId: 'garcom',
    title: null,
    startDate: '2026-10-12',
    endDate: '2026-10-12'
  };
  const parts = { workerName: 'Jorge Mendes', companyName: 'Eventos Meridiano', job, hired: false };
  it('say who writes, which job (title, or the trade of an older job) and which day (P07, U01)', () => {
    expect(workerToCompanyMessage(parts)).toBe(
      'Olá, Eventos Meridiano! Aqui é Jorge, da Bicos. Fui aprovado para a vaga "Garçom" (BC-4821) do dia 12/10. Podemos combinar os detalhes?'
    );
    expect(companyToWorkerMessage({ ...parts, hired: true, job: { ...job, endDate: '2026-10-15' } })).toBe(
      'Olá, Jorge! Aqui é da Eventos Meridiano, pela Bicos. Você foi contratado para a vaga "Garçom" (BC-4821) de 12/10 a 15/10. Podemos combinar os detalhes?'
    );
    expect(workerToCompanyMessage({ ...parts, hired: true, job: { ...job, dateToArrange: true } })).toContain(
      'Fui contratado para a vaga "Garçom" (BC-4821) com data a combinar.'
    );
    // U01: a job without a trade is called by its title.
    expect(workerToCompanyMessage({ ...parts, job: { ...job, oficioId: null, title: 'Reboco da fachada' } })).toContain(
      'Fui aprovado para a vaga "Reboco da fachada" (BC-4821)'
    );
    expect(whatsappUrl('', 'oi')).toBeNull();
  });
});

describe('F15: the company contact person', () => {
  it('the worker greets them by first name', () => {
    const job = { id: 'BC-1', oficioId: 'pintor', title: null, startDate: '2026-10-12', endDate: '2026-10-12' };
    expect(
      workerToCompanyMessage({ workerName: 'Jorge', companyName: 'Obra', job, hired: false, contactName: 'Ana Souza' })
    ).toMatch(/^Olá, Ana! Aqui é Jorge/);
  });
});

describe('W09: the WhatsApp contact is read once per candidacy and situation', () => {
  it('a second tap uses the cached contact', async () => {
    vi.resetModules();
    const store = await import('../services/store');
    const contacts = await import('../services/contacts');
    const latency = await import('../services/mockLatency');
    const spy = vi.spyOn(latency, 'mockLatency').mockResolvedValue(undefined);
    const app = store.getDb().applications.find((a) => a.status === 'pre_selecionado' || a.status === 'contratado');
    if (!app) return;
    const company = store.getDb().jobs[app.jobId].companyId;
    store.setSessionAccount(Object.values(store.getDb().accounts).find((a) => a.companyId === company)!.id);
    const first = await contacts.getContact(app.id);
    const calls = spy.mock.calls.length;
    expect(await contacts.getContact(app.id)).toEqual(first);
    expect(spy.mock.calls.length).toBe(calls);
  });
});
