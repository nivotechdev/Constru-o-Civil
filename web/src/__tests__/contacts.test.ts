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
    expect(r.ok && r.v.name).toBe('Construtora Meridiano');
    expect(r.ok && r.v.url).toContain('https://wa.me/5511988423310?text=');
    expect(r.ok && decodeURIComponent(r.v.url)).toContain('Vi sua vaga de Pedreiro de acabamento (BC-4821) na Bicos');
  });

  it('gives the company the worker number once approved, never before', async () => {
    await settle(m.auth.signIn('construtora@bicos.demo', 'bicos123'));
    const before = await settle(m.contacts.getContact('a11')); // rafael, em análise on BC-4998
    expect(before.ok).toBe(false);
    expect(!before.ok && before.e.message).toMatch(/quando a construtora aprova/);
    await settle(m.apps.approve('BC-4998', 'rafael'));
    const after = await settle(m.contacts.getContact('a11'));
    expect(after.ok && after.v.phone).toBe('(11) 96630-1147');
    expect(after.ok && decodeURIComponent(after.v.url)).toContain('Olá, Rafael! Aqui é da Construtora Meridiano');
  });

  it("refuses anyone who isn't one of the two sides", async () => {
    await settle(m.auth.signIn('construtora@bicos.demo', 'bicos123'));
    const r = await settle(m.contacts.getContact('a8')); // jorge on Obra Aricanduva's job
    expect(r.ok).toBe(false);
  });
});

describe('ready-made messages', () => {
  const job = { id: 'BC-4821', oficioId: 'pedreiro-acabamento' };
  it('say who, which trade and which job', () => {
    expect(workerToCompanyMessage(job)).toBe(
      'Olá! Vi sua vaga de Pedreiro de acabamento (BC-4821) na Bicos e fui aprovado. Podemos combinar os detalhes?'
    );
    expect(companyToWorkerMessage('Jorge Mendes', 'Construtora Meridiano', job)).toBe(
      'Olá, Jorge! Aqui é da Construtora Meridiano, sobre a vaga de Pedreiro de acabamento (BC-4821) na Bicos. Podemos combinar os detalhes?'
    );
    expect(whatsappUrl('', 'oi')).toBeNull();
  });
});
