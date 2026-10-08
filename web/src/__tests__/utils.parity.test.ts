// Pure helpers: every legacy function and its TypeScript port must return the same thing.
import { describe, expect, it } from 'vitest';
import * as legacyStatus from '../../../app/js/utils/applicationStatus.js';
import * as legacyCidades from '../../../app/js/utils/cidades.js';
import * as legacyFormat from '../../../app/js/utils/format.js';
import * as legacyJobInfo from '../../../app/js/utils/jobInfo.js';
import * as legacyWhatsapp from '../../../app/js/utils/whatsapp.js';
import { COMPANIES, JOBS } from '../data/seed';
import { nearestCity, popularCities, searchCities } from '../services/cities';
import type { ApplicationStatus } from '../types/models';
import { statusInfo } from '../utils/applicationStatus';
import { formatBRL, formatPostDate, isValidEmail, maskCNPJ, maskCPF, passwordStrength } from '../utils/format';
import { dateText, diasInfo, hoursText, whenText } from '../utils/jobInfo';
import { whatsappUrl, workerToCompanyUrl } from '../utils/whatsapp';

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
    for (const n of [0, 80, 150.4, 150.5, 1234, 12345.6, -3, NaN]) expect(formatBRL(n)).toBe(legacyFormat.formatBRL(n));
    for (const d of ['2026-09-10', '2026-01-01', 'x', '2026-13'])
      expect(formatPostDate(d)).toBe(legacyFormat.formatPostDate(d));
  });
});

describe('job schedule texts', () => {
  it('match the legacy texts for every seed job and every date/hours combination', () => {
    const cases = [
      ...Object.values(JOBS),
      { date: null, hours: null, dias: null },
      { date: 'Hoje', hours: null, dias: 'fimdesemana' as const },
      { date: null, hours: '7h–17h', dias: 'qualquer' as const }
    ];
    for (const job of cases) {
      expect(dateText(job)).toBe(legacyJobInfo.dateText(job));
      expect(whenText(job)).toBe(legacyJobInfo.whenText(job));
      expect(hoursText(job)).toBe(legacyJobInfo.hoursText(job));
      expect(diasInfo(job)).toEqual(legacyJobInfo.diasInfo(job));
    }
  });
});

describe('application status', () => {
  it('maps every status to the same badge and next step', () => {
    const all: ApplicationStatus[] = [
      'enviada',
      'em_analise',
      'pre_selecionado',
      'contratado',
      'concluida',
      'avaliada',
      'nao_selecionado'
    ];
    for (const s of all) expect(statusInfo(s, 'BC-1')).toEqual(legacyStatus.statusInfo(s, 'BC-1'));
    expect(statusInfo('outro' as ApplicationStatus, 'BC-1')).toEqual(legacyStatus.statusInfo('outro', 'BC-1'));
  });
});

describe('whatsapp links', () => {
  it('build the same wa.me URLs', () => {
    for (const phone of ['', '(11) 98842-3310', '5511988423310'])
      expect(whatsappUrl(phone, 'oi')).toBe(legacyWhatsapp.whatsappUrl(phone, 'oi'));
    const job = JOBS['BC-4821'];
    expect(workerToCompanyUrl(COMPANIES.meridiano, job)).toBe(
      legacyWhatsapp.workerToCompanyUrl(COMPANIES.meridiano, job)
    );
  });
});

describe('city picker', () => {
  it('searches and geolocates like the legacy picker', () => {
    expect(popularCities()).toEqual(legacyCidades.popularCities());
    for (const q of ['', 'sao', 'São Paulo', 'campinas, sp', 'jose', 'rio', 'xyz', 'mg', '  bh ']) {
      expect(searchCities(q, 8)).toEqual(legacyCidades.searchCities(q, 8));
    }
    for (const [lat, lon] of [
      [-23.55, -46.63],
      [-22.9, -47.06],
      [-3.1, -60],
      [0, 0]
    ]) {
      expect(nearestCity(lat, lon)).toEqual(legacyCidades.nearestCity(lat, lon));
    }
  });
});
