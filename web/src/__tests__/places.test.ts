// B06 — real dates, times and places: texts derived from them, distances, the publish form's rules and
// the mural's filters and order.
import { describe, expect, it, vi } from 'vitest';
import { feedOrigin, orderJobs, passesFilters } from '../pages/worker/feed/feedUI';
import {
  draftFromForm,
  emptyForm,
  formDiarias,
  validateStep1,
  validateStep2,
  type JobForm
} from '../pages/recruiter/jobForm';
import { lookupCep, locate, maskCEP } from '../services/address';
import type { Job } from '../types/models';
import { addDays, dayLabel, isValidISODate, todayISO } from '../utils/dates';
import { distanceKm, formatKm } from '../utils/geo';
import { countDiarias, dateText, hoursText, isExpired, runsOn, whenText } from '../utils/jobInfo';

// Thursday, 8 Oct 2026, 10:00 local time.
const NOW = new Date(2026, 9, 8, 10, 0);
const TODAY = todayISO(NOW);

const baseJob = (patch: Partial<Job> = {}): Job => ({
  id: 'BC-1',
  companyId: 'meridiano',
  oficioId: 'limpeza',
  title: null,
  pay: 200,
  address: {
    cep: '03307-000',
    street: 'Rua Serra de Bragança',
    number: '1240',
    complement: null,
    neighborhood: 'Tatuapé',
    city: 'São Paulo',
    uf: 'SP',
    lat: -23.54,
    lon: -46.576
  },
  dateToArrange: false,
  startDate: TODAY,
  endDate: TODAY,
  startTime: '07:00',
  endTime: '17:00',
  diarias: 1,
  dias: 'qualquer',
  slots: 1,
  description: '',
  requirements: [],
  ...patch
});

describe('dates', () => {
  it('names days relative to today, and in full otherwise', () => {
    expect(dayLabel(TODAY, NOW)).toBe('Hoje');
    expect(dayLabel(addDays(TODAY, 1), NOW)).toBe('Amanhã');
    expect(dayLabel('2026-10-16', NOW)).toBe('Sex, 16 out');
    expect(dayLabel('2027-01-05', NOW)).toBe('Ter, 5 jan de 2027');
    expect(isValidISODate('2026-02-30')).toBe(false);
  });

  it('derives every schedule text from the stored dates and times', () => {
    expect(whenText(baseJob(), NOW)).toBe('Hoje · 7h–17h');
    expect(dateText(baseJob({ endDate: '2026-10-10' }), NOW)).toBe('Hoje até 10 out');
    expect(hoursText(baseJob({ startTime: '07:30', endTime: '16:00' }))).toBe('7h30–16h');
    const toArrange = baseJob({ dateToArrange: true, startDate: null, endDate: null, startTime: null, endTime: null });
    expect(whenText(toArrange, NOW)).toBe('Data e horário a combinar');
  });

  it('counts the diárias on the job days and knows when a job has expired', () => {
    // Thu 8 → Tue 13 Oct: Thu, Fri, Mon, Tue on weekdays; Sat, Sun on weekends.
    expect(countDiarias('2026-10-08', '2026-10-13', 'semana')).toBe(4);
    expect(countDiarias('2026-10-08', '2026-10-13', 'fimdesemana')).toBe(2);
    expect(countDiarias('2026-10-08', '2026-10-13', 'qualquer')).toBe(6);
    expect(isExpired(baseJob({ startDate: '2026-10-01', endDate: '2026-10-07' }), NOW)).toBe(true);
    expect(isExpired(baseJob({ dateToArrange: true, startDate: null, endDate: null }), NOW)).toBe(false);
    expect(runsOn(baseJob({ endDate: '2026-10-12', dias: 'semana' }), '2026-10-10')).toBe(false); // Saturday
  });
});

describe('distance', () => {
  it('measures straight-line km (Haversine) and writes it like people say it', () => {
    // Praça da Sé → Av. Paulista (MASP): about 2.9 km.
    const km = distanceKm({ lat: -23.5503, lon: -46.6339 }, { lat: -23.5614, lon: -46.6559 });
    expect(km).toBeGreaterThan(2.5);
    expect(km).toBeLessThan(3.0);
    expect(formatKm(0.42)).toBe('400 m');
    expect(formatKm(3.24)).toBe('3,2 km');
    expect(formatKm(45.6)).toBe('46 km');
  });
});

describe('mural filters and order with real data', () => {
  const from = { lat: -23.54, lon: -46.576 };
  const near = baseJob({ id: 'near' });
  const far = baseJob({ id: 'far', address: { ...near.address, neighborhood: 'Penha', lat: -23.6, lon: -46.5 } });
  const later = baseJob({ id: 'later', startDate: '2026-10-12', endDate: '2026-10-12' });
  const all = { location: 'São Paulo, SP', oficio: null, dist: 'Toda a cidade', quando: null, from };

  it('keeps "Até 5 km" to jobs within 5 km of where the person is', () => {
    const f = { ...all, dist: 'Até 5 km' };
    expect([near, far].filter((j) => passesFilters(j, f, NOW)).map((j) => j.id)).toEqual(['near']);
  });

  it('filters "Hoje" and "Amanhã" by the real dates', () => {
    expect([near, later].filter((j) => passesFilters(j, { ...all, quando: 'Hoje' }, NOW)).map((j) => j.id)).toEqual([
      'near'
    ]);
    expect(passesFilters(later, { ...all, quando: 'Amanhã' }, NOW)).toBe(false);
  });

  it('orders "Mais cedo" by start date and "Mais perto" by distance', () => {
    expect(orderJobs([later, far, near], 'trabalhador', 'cedo', from).map((j) => j.id)).toEqual([
      'near',
      'far',
      'later'
    ]);
    expect(orderJobs([far, near], 'trabalhador', 'perto', from).map((j) => j.id)).toEqual(['near', 'far']);
  });

  it('Z03: a running paid boost comes first, then urgent jobs, then the chosen order', () => {
    const boosted = { ...far, id: 'boosted', boostEndsAt: new Date(NOW.getTime() + 3600000).toISOString() };
    const expired = { ...far, id: 'expired', boostEndsAt: new Date(NOW.getTime() - 3600000).toISOString() };
    const urgent = { ...far, id: 'urgent', urgent: true };
    expect(orderJobs([near, expired, urgent, boosted], 'trabalhador', 'perto', from, NOW).map((j) => j.id)).toEqual([
      'boosted',
      'urgent',
      'near',
      'expired'
    ]);
  });

  it('measures from the GPS position, else from the city centre', () => {
    const db = { workers: {} } as never;
    expect(feedOrigin({ location: 'São Paulo, SP', origin: { lat: 1, lon: 2 } }, db, 'recrutador')).toEqual({
      lat: 1,
      lon: 2
    });
    const campinas = feedOrigin({ location: 'Campinas, SP', origin: null }, db, 'recrutador');
    expect(campinas.lat).toBeCloseTo(-22.9, 0);
  });
});

describe('publish form', () => {
  // An older job being edited: with a trade, a street number and dates (U01 keeps them when editing).
  const valid = (): JobForm => ({
    ...emptyForm(),
    oficioId: 'limpeza',
    titulo: 'Faxina de apartamento',
    cep: '03307-000',
    street: 'Rua Serra de Bragança',
    number: '1240',
    neighborhood: 'Tatuapé',
    dias: 'semana',
    dateToArrange: false,
    startDate: '2026-10-08',
    endDate: '2026-10-13',
    vagas: '1'
  });

  it('U01: a new job asks only the title, the address without number, the days, the diárias and the people', () => {
    const fresh: JobForm = {
      ...emptyForm(),
      cep: '03307-000',
      street: 'Rua Serra de Bragança',
      neighborhood: 'Tatuapé',
      dias: 'semana'
    };
    // Starts "a combinar", with no people, no requirement, no payment and no urgency.
    expect([fresh.dateToArrange, fresh.vagas, fresh.requisitos, fresh.pagamento, fresh.urgente]).toEqual([
      true,
      '',
      [],
      null,
      false
    ]);
    const missing = validateStep1(fresh, NOW);
    expect(missing.titulo).toMatch(/título/);
    expect(validateStep2({ ...fresh, vagas: '' }).vagas).toMatch(/quantas pessoas/);
    // U23: "Quantas diárias" starts empty (no "1" to erase) and is asked.
    expect(fresh.diarias).toBe('');
    expect(validateStep2(fresh).diarias).toMatch(/quantas diárias/);
    expect(missing.number).toBeUndefined();
    const ok = { ...fresh, titulo: '  Reboco da fachada ', vagas: '2', diarias: '1' };
    expect(Object.values(validateStep1(ok, NOW)).filter(Boolean)).toEqual([]);
    expect(validateStep1({ ...ok, titulo: 'x'.repeat(61) }, NOW).titulo).toMatch(/até 60/);
    const draft = draftFromForm(ok);
    expect(draft).toMatchObject({
      oficioId: null,
      title: 'Reboco da fachada',
      dateToArrange: true,
      startDate: null,
      endDate: null,
      diarias: 1,
      slots: 2,
      requirements: [],
      urgent: false
    });
    expect(draft.address.number).toBe('');
    expect(draft.payment).toBeUndefined();
    // Editing an older job keeps its trade and payment.
    expect(draftFromForm({ ...valid(), pagamento: 'dinheiro' })).toMatchObject({
      oficioId: 'limpeza',
      payment: 'dinheiro'
    });
  });

  it('accepts a complete form and refuses past dates, end before start and bad hours', () => {
    expect(Object.values(validateStep1(valid(), NOW)).filter(Boolean)).toEqual([]);
    expect(validateStep1({ ...valid(), startDate: '2026-10-07' }, NOW).startDate).toMatch(/passado/);
    expect(validateStep1({ ...valid(), endDate: '2026-10-07' }, NOW).endDate).toMatch(/depois do início/);
    // W08: a night shift crosses midnight; the same start and end is refused.
    // U01: the hours are checked in step 2 (valor e pessoas).
    expect(validateStep2({ ...valid(), startTime: '22:00', endTime: '06:00' }).periodo).toBeUndefined();
    expect(validateStep2({ ...valid(), startTime: '07:00', endTime: '07:00' }).periodo).toMatch(/iguais/);
    expect(validateStep2({ ...valid(), startTime: '07:00' }).periodo).toMatch(/início e o fim/);
    expect(validateStep1({ ...valid(), cep: '0330' }, NOW).cep).toBeTruthy();
    // Sat → Sun on weekdays only: no day fits.
    expect(validateStep1({ ...valid(), startDate: '2026-10-10', endDate: '2026-10-11' }, NOW).endDate).toMatch(
      /Nenhum dia/
    );
  });

  it('works out the diárias from the dates, and builds the draft with the address on the map', () => {
    expect(formDiarias(valid())).toBe(4);
    expect(formDiarias({ ...valid(), dateToArrange: true, diarias: '3' })).toBe(3);
    const draft = draftFromForm(valid());
    expect(draft.address).toMatchObject({ cep: '03307-000', city: 'São Paulo', uf: 'SP', neighborhood: 'Tatuapé' });
    expect(Math.abs(draft.address.lat + 23.54)).toBeLessThan(0.02);
    expect(draft.diarias).toBe(4);
    expect(draft.startTime).toBeNull();
  });
});

describe('CEP', () => {
  it('masks as typed and finds the demo CEPs', async () => {
    vi.useFakeTimers();
    expect(maskCEP('03307000')).toBe('03307-000');
    const found = lookupCep('03307-000');
    await vi.runAllTimersAsync();
    expect((await found)?.street).toBe('Rua Serra de Bragança');
    const missing = lookupCep('99999-999');
    await vi.runAllTimersAsync();
    expect(await missing).toBeNull();
    await expect(lookupCep('123')).rejects.toThrow(/8 números/);
    vi.useRealTimers();
    // An unknown CEP still lands in its city, near the centre.
    const p = locate({ cep: '99999-999', street: 'Rua X', number: '1', city: 'Campinas, SP' });
    expect(p && Math.abs(p.lat + 22.9)).toBeLessThan(0.1);
  });
});

describe('Y09/W03: total of the job', () => {
  it('is diária × diárias × people, or "A combinar"', async () => {
    const { jobTotal } = await import('../utils/jobInfo');
    expect(jobTotal({ pay: 200, diarias: 3 }, 2)).toBe('R$ 1.200');
    expect(jobTotal({ pay: null, diarias: 3 }, 2)).toBe('A combinar');
    expect(jobTotal({ pay: 150, diarias: 1 })).toBe('R$ 150');
  });
});

describe('U13: the saved place', () => {
  it('the mural opens on the place saved in the profile, for workers and companies alike', async () => {
    const { homeCity } = await import('../pages/worker/feed/feedUI');
    const store = await import('../services/store');
    const db = store.getDb();
    const worker = Object.values(db.workers)[0];
    const company = Object.values(db.companies)[0];
    const saved = {
      ...db,
      workers: { ...db.workers, [worker.id]: { ...worker, city: 'Caxias do Sul, RS' } },
      companies: { ...db.companies, [company.id]: { ...company, location: 'Caxias do Sul, RS' } }
    };
    const as = (role: 'trabalhador' | 'recrutador', id: string) => {
      store.setSessionAccount(Object.values(db.accounts).find((a) => a.workerId === id || a.companyId === id)!.id);
      return homeCity(saved, role);
    };
    expect(as('trabalhador', worker.id)).toBe('Caxias do Sul, RS');
    expect(as('recrutador', company.id)).toBe('Caxias do Sul, RS');
    // Something that isn't a city (old demo data) falls back to the default city, never to a broken mural.
    expect(
      homeCity(
        { ...saved, companies: { ...db.companies, [company.id]: { ...company, location: 'Zona Leste, SP' } } },
        'recrutador'
      )
    ).toBe('São Paulo, SP');
    store.setSessionAccount(null);
  });

  it("a new job starts in the given city (the company's saved place)", () => {
    expect(emptyForm('Caxias do Sul, RS').city).toBe('Caxias do Sul, RS');
    expect(emptyForm().city).toBe('São Paulo, SP');
  });
});

describe('X19: what a distance is measured from', () => {
  it('"de você" only with the GPS; the neighbourhood of the profile; else the city centre', async () => {
    const { originText } = await import('../pages/worker/feed/feedUI');
    const store = await import('../services/store');
    const db = store.getDb();
    expect(originText({ location: 'Campinas, SP', origin: { lat: -22.9, lon: -47 } }, db, 'trabalhador')).toBe(
      'de você'
    );
    expect(originText({ location: 'Campinas, SP', origin: null }, db, 'recrutador')).toBe('do centro de Campinas');
  });
});

describe('W08: limits of the publish and payment forms', () => {
  it('pay ceiling, description length, CEP of another city, cards of 15 to 19 digits, night shift text', async () => {
    const { validateStep2, validateStep1, emptyForm } = await import('../pages/recruiter/jobForm');
    const { validateCard } = await import('../utils/card');
    const { hoursText } = await import('../utils/jobInfo');
    const base = { ...emptyForm(), valor: '200', detalhe: 'Reboco de duas paredes internas, material no local.' };
    expect(validateStep2(base).valor).toBeUndefined();
    expect(validateStep2({ ...base, valor: '50000' }).valor).toMatch(/até R\$ 5\.000/);
    expect(validateStep2({ ...base, detalhe: 'Reboco' }).detalhe).toMatch(/pelo menos 20/);
    expect(validateStep2({ ...base, detalhe: 'x'.repeat(1001) }).detalhe).toMatch(/até 1000/);
    const { EXAMPLE_CEPS } = await import('../services/address');
    const step1 = validateStep1({ ...emptyForm(), cep: EXAMPLE_CEPS[0], city: 'Recife, PE' });
    expect(step1.cep).toMatch(/Esse CEP é de/);
    const card = { name: 'ANA SILVA', expiry: '12/39', cvv: '123' };
    expect(validateCard({ ...card, number: '378282246310005' }).number).toBeUndefined();
    expect(validateCard({ ...card, number: '4111 1111 1111' }).number).toMatch(/15 a 19/);
    expect(hoursText({ startTime: '22:00', endTime: '06:00' } as never)).toBe('22h–6h (vira a noite)');
  });
});
