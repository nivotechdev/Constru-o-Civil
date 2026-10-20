// Pure helpers: every legacy function and its TypeScript port must return the same thing.
import { describe, expect, it } from 'vitest';
import * as legacyFormat from '../../../archive/app/js/utils/format.js';
import { nearestCity, popularCities, searchCities } from '../services/cities';
import { formatBRL, formatPostDate, isValidEmail, maskCNPJ, maskCPF, passwordStrength } from '../utils/format';
import { whatsappUrl } from '../utils/whatsapp';

const TEXTS = [
  '',
  '1',
  '12',
  '123',
  '1234',
  '123456',
  '1234567',
  '123456789',
  '12345678901',
  '123456789012345',
  '111.111.111-11',
  'ab1c2',
  ' 98 7 ',
  '11.111.111/1111-11',
  '(11) 98842-3310',
  '55 11 98842-3310',
  'abc'
];

describe('format', () => {
  it('masks CPF and CNPJ exactly like the legacy app', () => {
    for (const t of TEXTS) {
      expect(maskCPF(t)).toBe(legacyFormat.maskCPF(t));
      expect(maskCNPJ(t)).toBe(legacyFormat.maskCNPJ(t));
    }
    expect(maskCPF('12345678901')).toBe('123.456.789-01');
    expect(maskCNPJ('12345678000199')).toBe('12.345.678/0001-99');
  });

  it('validates e-mail and rates passwords the same way', () => {
    for (const t of ['', 'a@', 'a@b', 'a@b.c', ' jorge@email.com ', 'jo rge@x.com', 'x@y.com.br']) {
      expect(isValidEmail(t)).toBe(legacyFormat.isValidEmail(t));
    }
    for (const t of ['', 'abc', 'abcdefgh', 'abcdefgh1', 'abcdefgh1!', 'abcdefghijk1', '12345678']) {
      expect(passwordStrength(t)).toBe(legacyFormat.passwordStrength(t));
    }
  });

  it('formats money and post dates the same way', () => {
    // Whole values read as in the legacy app; W01: with cents, the cents show (the legacy app rounded them away).
    for (const n of [0, 80, 1234, -3, NaN]) expect(formatBRL(n)).toBe(legacyFormat.formatBRL(n));
    expect(formatBRL(150.4)).toBe('R$ 150,40');
    expect(formatBRL(12345.6)).toBe('R$ 12.345,60');
    expect(formatBRL(99.999)).toBe('R$ 100');
    for (const d of ['2026-09-10', '2026-01-01', 'x', '2026-13'])
      expect(formatPostDate(d)).toBe(legacyFormat.formatPostDate(d));
  });
});

// The legacy app no longer ships its cities and WhatsApp helpers (they moved into its bundle), so these
// two are pinned with direct expectations instead of a side-by-side comparison.
describe('whatsapp links', () => {
  it('build wa.me URLs with the Brazilian prefix', () => {
    expect(whatsappUrl('', 'oi')).toBeNull();
    expect(whatsappUrl('(11) 98842-3310', 'oi')).toBe('https://wa.me/5511988423310?text=oi');
    expect(whatsappUrl('5511988423310')).toBe('https://wa.me/5511988423310');
    // L11: DDD 55 (RS) without the country code still gets it.
    expect(whatsappUrl('(55) 99123-4567')).toBe('https://wa.me/5555991234567');
  });
});

describe('city picker', () => {
  it('searches and geolocates', () => {
    expect(popularCities()).toHaveLength(8);
    expect(searchCities('sao', 8).length).toBeGreaterThan(0);
    expect(searchCities('São Paulo', 8)[0]?.label).toBe('São Paulo, SP');
    expect(searchCities('campinas, sp', 8)[0]?.label).toBe('Campinas, SP');
    expect(searchCities('xyz', 8)).toEqual([]);
    expect(nearestCity(-23.55, -46.63)?.label).toBe('São Paulo, SP');
    expect(nearestCity(-22.9, -47.06)?.label).toBe('Campinas, SP');
  });
});

describe('documents (Y17)', () => {
  it('checks the CPF and CNPJ check digits', async () => {
    const { isValidCnpj, isValidCpf } = await import('../utils/document');
    for (const ok of ['529.982.247-25', '39053344705', '111.444.777-35']) expect(isValidCpf(ok)).toBe(true);
    for (const bad of ['', '123.456.789-01', '111.111.111-11', '5299822472', '529.982.247-26'])
      expect(isValidCpf(bad)).toBe(false);
    for (const ok of ['11.222.333/0001-81', '18402551000147']) expect(isValidCnpj(ok)).toBe(true);
    for (const bad of ['', '11.222.333/0001-80', '11.111.111/1111-11', '00000000000000', '1122233300018'])
      expect(isValidCnpj(bad)).toBe(false);
  });
});

describe('specialties (Y23)', () => {
  it('adds free text and suggestions without repeats, up to the limit', async () => {
    const { addSpecialty, MAX_SPECIALTIES } = await import('../utils/specialties');
    expect(addSpecialty(['Reboco'], '  reboco ')).toEqual(['Reboco']);
    expect(addSpecialty(['Reboco'], '  Gesso   3D ')).toEqual(['Reboco', 'Gesso 3D']);
    expect(addSpecialty([], '   ')).toEqual([]);
    const full = Array.from({ length: MAX_SPECIALTIES }, (_, i) => 'E' + i);
    expect(addSpecialty(full, 'Outra')).toBe(full);
  });
});

describe('written requirement (P06)', () => {
  it('adds trimmed text without repeats, up to 12', async () => {
    const { addRequirement } = await import('../pages/recruiter/jobForm');
    expect(addRequirement(['EPI'], '  trena   própria ')).toEqual(['EPI', 'trena própria']);
    expect(addRequirement(['EPI'], 'epi')).toEqual(['EPI']);
    expect(addRequirement(['EPI'], '  ')).toEqual(['EPI']);
  });
});

describe('payment of the diária (L18)', () => {
  it('the form asks how; "outro" needs words; the draft and the texts carry it', async () => {
    const { emptyForm, validateStep2, draftFromForm } = await import('../pages/recruiter/jobForm');
    const { paymentText } = await import('../utils/jobInfo');
    const { draftRow } = await import('../services/remote/jobs');
    const f = { ...emptyForm(), valor: '200', detalhe: 'Reboco' };
    expect(validateStep2(f).pagamento).toBeUndefined();
    expect(validateStep2({ ...f, pagamento: 'outro' }).pagamento).toBe('Conte como a diária vai ser paga.');
    const draft = draftFromForm({ ...f, pagamento: 'outro', pagamentoObs: ' Metade no início ' });
    expect([draft.payment, draft.paymentNote]).toEqual(['outro', 'Metade no início']);
    expect(draftRow(draft)).toMatchObject({ payment_method: 'outro', payment_note: 'Metade no início' });
    expect(draftFromForm({ ...f, pagamento: 'pix_fim', pagamentoObs: 'sobra' }).paymentNote).toBeUndefined();
    expect(paymentText({ payment: 'pix_fim' })).toBe('Pagamento por PIX no fim do bico');
    expect(paymentText({ payment: 'dinheiro' })).toBe('Pagamento em dinheiro');
    expect(paymentText({})).toBe('Pagamento combinado direto');
  });
});

describe('profile edit checks (L11)', () => {
  it('names and city, per field and the same in both modes', async () => {
    const { profileErrors } = await import('../services/profiles');
    expect(profileErrors({ name: 'Jo' }, 'trabalhador').name).toBe('Informe seu nome completo.');
    expect(profileErrors({ name: 'Jorge' }, 'trabalhador').name).toBe('Informe nome e sobrenome.');
    expect(profileErrors({ name: 'Meridiano' }, 'recrutador')).toEqual({});
    expect(profileErrors({ city: 'Lugar Nenhum, XX' }, 'trabalhador')).toEqual({ city: 'Escolha a cidade na lista.' });
    expect(profileErrors({ location: 'São Paulo, SP' }, 'recrutador')).toEqual({});
  });
});

describe('sharing a job (F09)', () => {
  it('links to the public page and says what and where', async () => {
    const { jobShareUrl, jobShareText, isLegacyJobLink } = await import('../utils/share');
    const loc = { origin: 'https://bicos.app', pathname: '/', protocol: 'https:' };
    // L10: the random slug, never the sequential id; demo jobs (no slug) keep the id.
    expect(jobShareUrl({ id: 'BC-1', publicSlug: 'k7m2q9x4tbn3' }, loc)).toBe('https://bicos.app/v/k7m2q9x4tbn3');
    expect(jobShareUrl({ id: 'BC-1' }, loc)).toBe('https://bicos.app/v/BC-1');
    expect(isLegacyJobLink('BC-12')).toBe(true);
    expect(isLegacyJobLink('k7m2q9x4tbn3')).toBe(false);
    expect(
      jobShareText({
        oficioId: 'pintor',
        title: null,
        pay: 200,
        address: { neighborhood: 'Tatuapé', city: 'São Paulo' } as never
      })
    ).toBe('Pintor em Tatuapé · R$ 200 por diária. Vi na Bicos:');
  });
});

describe('professional profile (F10)', () => {
  it('the facts come from the fields', async () => {
    const { workerFacts } = await import('../utils/workerInfo');
    expect(
      workerFacts({ availability: 'semana', yearsExperience: 12, desiredPay: 200, travelKm: 15, jobsDone: 1 })
    ).toEqual([
      '12 anos de experiência',
      'Disponível: dias de semana',
      'Diária a partir de R$ 200',
      'Vai até 15 km de casa',
      '1 bico concluído na Bicos'
    ]);
    expect(workerFacts({ jobsDone: 0 })).toEqual([]);
  });
});

describe('portfolio files (F16)', () => {
  it('photo up to 10 MB, video up to 50 MB', async () => {
    const { portfolioFileProblem } = await import('../utils/media');
    const MB = 1024 * 1024;
    expect(await portfolioFileProblem({ type: 'image/jpeg', size: 9 * MB })).toBeNull();
    expect(await portfolioFileProblem({ type: 'image/jpeg', size: 11 * MB })).toBe('Foto de até 10 MB.');
    expect(await portfolioFileProblem({ type: 'video/mp4', size: 51 * MB })).toMatch(/50 MB/);
    expect(await portfolioFileProblem({ type: 'application/pdf', size: MB })).toBe('Escolha uma foto ou um vídeo.');
  });
});

describe('W02: a job already going on', () => {
  it('says only until when', async () => {
    const { dateText } = await import('../utils/jobInfo');
    const now = new Date(2026, 9, 14, 10);
    const job = {
      dateToArrange: false,
      startDate: '2026-10-13',
      endDate: '2026-10-16',
      startTime: null,
      endTime: null
    };
    expect(dateText(job, now)).toBe('Até 16 out');
    expect(dateText({ ...job, endDate: '2026-10-14' }, now)).toBe('Até hoje');
    expect(dateText({ ...job, startDate: '2026-10-15' }, now)).toBe('Amanhã até 16 out');
    expect(dateText({ ...job, startDate: '2026-10-01', endDate: '2026-10-03' }, now)).toMatch(/até 3 out/);
  });
});

describe('W03: the whole job', () => {
  it('diária × diárias, only with a fixed pay and more than one diária', async () => {
    const { totalText } = await import('../utils/jobInfo');
    expect(totalText({ pay: 220, diarias: 3 })).toBe('R$ 660 por 3 diárias');
    expect(totalText({ pay: 220, diarias: 1 })).toBeNull();
    expect(totalText({ pay: null, diarias: 5 })).toBeNull();
  });
});
