// U52 — the days of the week marked one by one, how the card and the job page say them, a date without hours, and
// what the whole job pays.
import { describe, expect, it } from 'vitest';
import {
  countDiarias,
  daysListText,
  daysText,
  diasFromWeekdays,
  endDateFor,
  jobPayTotal,
  jobWeekdays,
  placeTypeText,
  runsOn,
  whenText
} from '../utils/jobInfo';

describe('the days of the week', () => {
  it('the card says them in a word: during the week, weekend, every day; a mix is listed short', () => {
    expect(daysText({ weekdays: [1, 3, 5] })).toBe('Durante a semana');
    expect(daysText({ weekdays: [2] })).toBe('Durante a semana');
    expect(daysText({ weekdays: [6, 7] })).toBe('Fim de semana');
    expect(daysText({ weekdays: [7] })).toBe('Fim de semana');
    expect(daysText({ weekdays: [1, 2, 3, 4, 5, 6, 7] })).toBe('Todos os dias');
    expect(daysText({ weekdays: [2, 6] })).toBe('Ter e sáb');
    expect(daysText({ weekdays: [1, 2, 3, 4, 5, 6] })).toBe('Seg a sáb');
    // Jobs from before: their part of the week.
    expect(daysText({ dias: 'semana' })).toBe('Durante a semana');
    expect(daysText({ dias: 'qualquer' })).toBe('Qualquer dia');
  });

  it('the job page lists them', () => {
    expect(daysListText({ weekdays: [1, 3, 5] })).toBe('Segunda, quarta e sexta');
    expect(daysListText({ weekdays: [1, 2, 3, 4, 5] })).toBe('Segunda a sexta');
    expect(daysListText({ weekdays: [6, 7] })).toBe('Sábado e domingo');
    expect(daysListText({ weekdays: [1, 2, 3, 4, 5, 6, 7] })).toBe('Todos os dias');
  });

  it('the summary the filters use, and the days of an older job', () => {
    expect(diasFromWeekdays([5, 1])).toBe('semana');
    expect(diasFromWeekdays([6])).toBe('fimdesemana');
    expect(diasFromWeekdays([1, 6])).toBe('qualquer');
    expect(jobWeekdays({ dias: 'fimdesemana' })).toEqual([6, 7]);
    expect(jobWeekdays({ weekdays: [3, 1, 3], dias: 'semana' })).toEqual([1, 3]);
  });

  it('the diárias fall only on the days marked; the end is worked out from the start', () => {
    // Thu 8 Oct 2026 to Tue 13 Oct: Thu, Fri, Mon, Tue on weekdays; Sat and Sun on the weekend.
    expect(countDiarias('2026-10-08', '2026-10-13', [1, 2, 3, 4, 5])).toBe(4);
    expect(countDiarias('2026-10-08', '2026-10-13', [6, 7])).toBe(2);
    expect(endDateFor('2026-10-08', 4, [1, 2, 3, 4, 5])).toBe('2026-10-13');
    expect(endDateFor('2026-10-10', 1, [6])).toBe('2026-10-10');
    expect(endDateFor('2026-10-11', 20, [7])).toBeNull(); // past 60 days
    const job = {
      dateToArrange: false,
      startDate: '2026-10-08',
      endDate: '2026-10-13',
      startTime: null,
      endTime: null
    };
    expect(runsOn({ ...job, weekdays: [4] }, '2026-10-08')).toBe(true); // Thursday
    expect(runsOn({ ...job, weekdays: [4] }, '2026-10-09')).toBe(false);
  });
});

describe('the card when', () => {
  const NOW = new Date(2026, 9, 8, 10, 0);
  it('no date and no hours; a date without hours; hours without a date', () => {
    const base = { dateToArrange: true, startDate: null, endDate: null, startTime: null, endTime: null };
    expect(whenText(base, NOW)).toBe('Data e horário a combinar');
    expect(whenText({ ...base, dateToArrange: false, startDate: '2026-10-09', endDate: '2026-10-09' }, NOW)).toBe(
      'Amanhã · horário a combinar'
    );
    expect(whenText({ ...base, startTime: '07:00', endTime: '17:00' }, NOW)).toBe('Data a combinar · 7h–17h');
  });
});

describe('what the job pays', () => {
  it('diária × diárias; nothing when the pay is to be arranged', () => {
    expect(jobPayTotal({ pay: 150, diarias: 3 })).toBe(450);
    expect(jobPayTotal({ pay: 150, diarias: 1 })).toBe(150);
    expect(jobPayTotal({ pay: null, diarias: 3 })).toBeNull();
    expect(placeTypeText({ placeType: 'condominio' })).toBe('Condomínio');
    expect(placeTypeText({ placeType: null })).toBeNull();
  });
});
