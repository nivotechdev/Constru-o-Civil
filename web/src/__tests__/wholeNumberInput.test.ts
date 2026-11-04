// AUD-026: whole-number fields never change the number silently.
import { describe, expect, it } from 'vitest';
import { readWholeInput } from '../utils/wholeNumberInput';

describe('campos de número inteiro (AUD-026)', () => {
  it('accepts whole numbers and trims to the limit', () => {
    expect(readWholeInput('150', 5, 'reais')).toEqual({ value: '150', problem: null });
    expect(readWholeInput(' 2 ', 2, 'quantidade')).toEqual({ value: '2', problem: null });
    expect(readWholeInput('123456', 5, 'reais').value).toBe('12345');
    expect(readWholeInput('', 5, 'reais')).toEqual({ value: '', problem: null });
  });
  it('refuses a separator instead of dropping it (45,50 must not become 4550)', () => {
    expect(readWholeInput('45,50', 5, 'reais')).toEqual({
      value: null,
      problem: 'Use só o valor em reais, sem centavos.'
    });
    expect(readWholeInput('150.00', 5, 'reais').value).toBeNull();
  });
  it('refuses 1.5 days (it must not become 15)', () => {
    expect(readWholeInput('1.5', 2, 'quantidade')).toEqual({
      value: null,
      problem: 'Use só números inteiros, sem vírgula.'
    });
  });
  it('refuses a sign and any letter', () => {
    expect(readWholeInput('-1', 2, 'quantidade')).toMatchObject({ value: null, problem: 'Use só números, sem sinal.' });
    expect(readWholeInput('1a', 2, 'quantidade')).toMatchObject({ value: null, problem: 'Use só números.' });
  });
});
