// AUD-116: a phone pasted with "+55" or a trunk "0" keeps the right number.
import { describe, expect, it } from 'vitest';
import { maskPhone, phoneDigits } from '../utils/format';

describe('número colado (AUD-116)', () => {
  it('the four pasted forms give the same mobile', () => {
    expect(maskPhone('5499999-9999')).toBe('(54) 99999-9999');
    expect(maskPhone('+55 54 99999-9999')).toBe('(54) 99999-9999');
    expect(maskPhone('5554999999999')).toBe('(54) 99999-9999');
    expect(maskPhone('054 99999-9999')).toBe('(54) 99999-9999');
    expect(maskPhone('(54) 99999-9999')).toBe('(54) 99999-9999');
  });
  it('digits helper keeps only the national number', () => {
    expect(phoneDigits('+55 (54) 99999-9999')).toBe('54999999999');
    expect(phoneDigits('123456789012345')).toBe('12345678901');
  });
});
